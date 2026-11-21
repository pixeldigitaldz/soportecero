---
title: How to Fix ERR_TOO_MANY_REDIRECTS Loop in WordPress with Cloudflare SSL
description: >-
  Fix the infinite HTTPS redirection loop in WordPress hosted behind Cloudflare
  by configuring SSL/TLS mode to Full (Strict) and setting reverse proxy
  headers.
category: Web & Code
tags:
  - WordPress
  - Cloudflare
  - SSL
readTime: 5 min
date: '2026-07-27'
---

The browser error `ERR_TOO_MANY_REDIRECTS` (or `The page isn't redirecting properly` in Firefox) occurs on WordPress sites proxied through Cloudflare when the edge CDN and your origin web server disagree on whether the request is already encrypted. The client bounces endlessly between `https://yourdomain.com` and `https://yourdomain.com` until the browser aborts after ~20 consecutive `301`/`302` hops.

## Quick Diagnostics

| Symptom / Cause | Verification | Immediate Fix |
|---|---|---|
| Cloudflare SSL/TLS set to **Flexible** while origin forces HTTPS | `curl -I https://yourdomain.com` loops `301` | Switch Cloudflare SSL/TLS mode to **Full (Strict)** |
| WordPress unaware of HTTPS behind reverse proxy | `$_SERVER['HTTPS']` is unset in PHP | Map `HTTP_X_FORWARDED_PROTO` to `HTTPS=on` in `wp-config.php` |
| Conflicting `www` vs non-`www` rules in `.htaccess` and WordPress | `WP_HOME` uses `www` while server redirects to apex | Align `WP_HOME`, `WP_SITEURL`, and Nginx/Apache rules |
| Cloudflare "Always Use HTTPS" + origin HTTP-to-HTTPS redirect | Inspect `Location` header in `curl -IL` | Let Cloudflare handle edge redirect or fix proxy headers |

## Root Cause & Technical Mechanics

When Cloudflare proxies a domain (orange cloud enabled), it terminates the visitor's TLS session at the edge and opens a second connection to your origin server.

In **Flexible** SSL/TLS mode, Cloudflare connects to your origin over **unencrypted HTTP (port 80)** even when the visitor requested `https://`. Your origin server or WordPress sees a port 80 request, assumes the visitor is on HTTP, and replies with `301 Moved Permanently` to `https://yourdomain.com`. Cloudflare forwards that redirect to the browser, the browser retries `https://yourdomain.com`, Cloudflare hits port 80 again, and the loop repeats indefinitely.

A secondary cause occurs even in **Full** mode when an internal reverse proxy forwards HTTP without setting `HTTPS=on` for PHP, causing WordPress's `is_ssl()` check to return `false` and trigger a self-redirect.

## Step-by-Step Solution

### Step 1: Inspect the Redirect Headers With `curl`

Run `curl` against your domain to confirm the exact `301`/`302` loop and see which server header (`Server: cloudflare` vs origin) is issuing the redirect:

```bash
curl -sI https://yourdomain.com | grep -iE "HTTP/|location:|server:|cf-ray:"
```

If you see `HTTP/2 301` with `location: https://yourdomain.com/` pointing right back to the same HTTPS URL, you have confirmed the edge-to-origin SSL loop.

### Step 2: Set Cloudflare SSL/TLS Mode to Full (Strict)

1. Log in to the **Cloudflare Dashboard** and select your domain.
2. Navigate to **SSL/TLS > Overview**.
3. Change the encryption mode from **Flexible** to **Full (Strict)** (if your origin has a valid Let's Encrypt or Cloudflare Origin CA certificate) or **Full** (if your origin uses a self-signed certificate).

Never leave a production WordPress site on **Flexible** or **Off**.

### Step 3: Teach WordPress to Trust Reverse Proxy HTTPS Headers

If your origin sits behind an internal reverse proxy or Apache/Nginx still reports non-SSL to PHP, edit `wp-config.php` and insert the following snippet **above** `/* That's all, stop editing! Happy publishing. */`:

```php
// Recognize HTTPS terminated by Cloudflare or an upstream reverse proxy
if (
    (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && strpos($_SERVER['HTTP_X_FORWARDED_PROTO'], 'https') !== false) ||
    (isset($_SERVER['HTTP_CF_VISITOR']) && strpos($_SERVER['HTTP_CF_VISITOR'], '"scheme":"https"') !== false)
) {
    $_SERVER['HTTPS'] = 'on';
}

define('WP_HOME', 'https://yourdomain.com');
define('WP_SITEURL', 'https://yourdomain.com');
```

Also verify `WP_HOME` and `WP_SITEURL` match the exact canonical host (`www` vs non-`www`) configured in your `.htaccess` or Nginx `server` block.

### Step 4: Purge Edge and Origin Caches, Then Verify

Browsers and Cloudflare cache `301` redirects aggressively. Purge Cloudflare (**Caching > Configuration > Purge Everything**) and any WordPress page/object cache (`wp cache flush`), then verify from the terminal:

```bash
curl -sIL --max-redirs 5 https://yourdomain.com | grep -iE "HTTP/|location:"
```

You should see a clean `HTTP/2 200` response (or at most one canonical `301` followed by `200`).

## Frequently Asked Questions

### Why does the error disappear when I pause Cloudflare (grey cloud)?
Pausing Cloudflare bypasses the CDN proxy so the browser hits your origin directly on port 443, proving the origin certificate works and confirming the loop came from Flexible SSL or proxy header mismatch.

### Can a Cloudflare Page Rule or Redirect Rule cause `ERR_TOO_MANY_REDIRECTS`?
Yes. If a Page Rule forces `http://` to `https://` while another rule or `.htaccess` forces the opposite (`www` vs apex), they loop. Keep canonical redirects in one place.

### Do I still need an SSL certificate on my origin server if I use Cloudflare?
Yes. **Full (Strict)** requires a valid origin certificate. You can generate a free 15-year **Cloudflare Origin CA** certificate under **SSL/TLS > Origin Server**.

## Prevention Advice

- **Standardize on Full (Strict) SSL:** Install a Let's Encrypt or Cloudflare Origin CA certificate on every origin server before enabling Cloudflare proxy mode.
- **Avoid duplicate HTTPS plugins:** Remove WordPress plugins like "Really Simple SSL" once server-level HTTPS and `WP_HOME`/`WP_SITEURL` are properly configured.
- **Match canonical hostnames everywhere:** Ensure WordPress Settings, `.htaccess`/Nginx redirects, and Cloudflare Page Rules agree on `https://` and `www` vs apex.
- **Test redirects with `curl -IL`:** Always verify redirect chains from the command line after changing SSL or DNS proxy settings.

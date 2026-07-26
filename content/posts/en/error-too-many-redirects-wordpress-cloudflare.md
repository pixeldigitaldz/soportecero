---
title: "How to Fix ERR_TOO_MANY_REDIRECTS Loop in WordPress with Cloudflare SSL"
description: "Fix the infinite HTTPS redirection loop in WordPress hosted behind Cloudflare by configuring SSL/TLS mode to Full (Strict) and setting reverse proxy headers."
category: "Web & Code"
tags: ["WordPress", "Cloudflare", "SSL"]
readTime: "4 min"
date: "2026-07-28"
---

The `ERR_TOO_MANY_REDIRECTS` error (or infinite redirect loop) occurs on WordPress sites hosted behind Cloudflare when the CDN proxy and origin web server enter a cycle of conflicting HTTP/HTTPS redirect responses.

## 🔍 Quick Diagnostics

| Symptom | Root Cause | Solution |
|---|---|---|
| Browser displays `ERR_TOO_MANY_REDIRECTS` when attempting to open site | Cloudflare is set to "Flexible" SSL mode, sending unencrypted HTTP to origin while WordPress forces HTTP to HTTPS redirect | Change Cloudflare SSL/TLS mode to "Full" or "Full (Strict)" and update HTTPS proxy detection in `wp-config.php` |

## 🚀 How to Fix the Error Step-by-Step

### Step 1: Change Cloudflare SSL/TLS Encryption Mode

1. Log into your **Cloudflare Dashboard**.
2. Select your domain and navigate to **SSL/TLS** > **Overview**.
3. Change the encryption mode from **Flexible** to **Full** or **Full (Strict)**.

*(Flexible mode connects to your origin server over HTTP. If WordPress enforces HTTPS, it will reply with a 301 redirect back to HTTPS, triggering a loop).*

### Step 2: Configure Reverse Proxy HTTPS Headers in wp-config.php

Edit your WordPress site's `wp-config.php` file and place the following code snippet above the line `/* That's all, stop editing! Happy publishing. */`:

```php
// Detect Cloudflare reverse proxy HTTPS header
if (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') {
    $_SERVER['HTTPS'] = 'on';
}

define('WP_HOME', 'https://yourdomain.com');
define('WP_SITEURL', 'https://yourdomain.com');
```

### Step 3: Purge Cache and Verify Site

1. In the Cloudflare dashboard, go to **Caching** > **Configuration** and click **Purge Everything**.
2. Clear your web browser cache or test the site in an Incognito/Private window.
3. If using WordPress caching plugins (e.g., WP Rocket or LiteSpeed Cache), purge the plugin cache as well.

## 🛡️ Prevention Advice

- **Never Use Flexible SSL in Production**: Always configure Cloudflare SSL/TLS encryption mode to **Full** or **Full (Strict)** by installing an SSL certificate (such as Let's Encrypt or a Cloudflare Origin CA certificate) on your origin server.
- **Avoid Overlapping Redirect Rules**: When turning on Cloudflare's "Always Use HTTPS", ensure you don't have duplicate or conflicting HTTP-to-HTTPS redirect rules in `.htaccess` or Nginx.
- **Install Cloudflare Official Plugin**: Use the official WordPress Cloudflare plugin to properly handle client IP restoration and cache invalidation.

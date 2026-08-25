---
title: "How to Fix Infinite HTTP to HTTPS Redirect Loops (ERR_TOO_MANY_REDIRECTS)"
description: "Learn how to resolve ERR_TOO_MANY_REDIRECTS loops across Cloudflare, Nginx, Apache, and WordPress when enforcing HTTPS."
category: "Web & Code"
tags: ["HTTPS", "SSL", "Cloudflare", "Nginx", "WordPress", "SysAdmin"]
readTime: "5 min"
date: "2026-06-25"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Cloudflare SSL mode set to 'Flexible' while origin server forces HTTPS redirects** | Switch Cloudflare SSL/TLS encryption mode to 'Full' or 'Full (Strict)' |
| **Missing X-Forwarded-Proto headers causing WordPress / Nginx to mistakenly identify HTTPS requests as HTTP** | Configure `fastcgi_param HTTPS on;` and check `$_SERVER['HTTP_X_FORWARDED_PROTO']` |

The `ERR_TOO_MANY_REDIRECTS` exception occurs when a browser enters an unresolved loop of HTTP and HTTPS redirection cycles. This condition is most frequently triggered by synchronization mismatches between an edge reverse proxy (such as Cloudflare) and an origin web server (Nginx/Apache/WordPress).

## 🚀 Step-by-Step Solution

### Step 1: Set Cloudflare Encryption to Full (Strict)
If Cloudflare is set to **Flexible**, it queries your backend over unencrypted HTTP (port 80). If your origin server enforces HTTPS, an infinite redirect loop forms:
1. Log into your **Cloudflare Dashboard**.
2. Navigate to **SSL/TLS > Overview**.
3. Change encryption setting from *Flexible* to **Full** or **Full (Strict)**.

### Step 2: Configure Proxy Header Recognition in WordPress
Instruct WordPress to recognize secure edge connections forwarded by proxies:
```php
// Add at top of wp-config.php before require_once wp-settings.php:
if (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') {
    $_SERVER['HTTPS'] = 'on';
}
```

### Step 3: Establish Clean Server Directives in Nginx
Ensure port 80 redirects cleanly without triggering self-referential loops on port 443:
```nginx
# HTTP server block (Port 80) -> Redirect to HTTPS
server {
    listen 80;
    server_name mysite.com www.mysite.com;
    return 301 https://$host$request_uri;
}

# HTTPS server block (Port 443) -> Serve application
server {
    listen 443 ssl http2;
    server_name mysite.com www.mysite.com;

    ssl_certificate /etc/letsencrypt/live/mysite.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mysite.com/privkey.pem;

    location / {
        proxy_set_header X-Forwarded-Proto https;
        proxy_pass http://localhost:3000;
    }
}
```

### Step 4: Clear Cached 301 Redirects in Browser
HTTP 301 Permanent Redirects are aggressively cached by client browsers:
1. Verify behavior inside a Private / Incognito window.
2. Purge browser cached images and files.

## 🛡️ Prevention Advice
- **Enable HTTP Strict Transport Security (HSTS):** Once HTTPS stability is validated, enable HSTS headers to instruct browsers to connect directly over HTTPS.
- **Synchronize WordPress Home/Site URLs:** Ensure both *WordPress Address (URL)* and *Site Address (URL)* under *Settings > General* explicitly specify `https://`.

## ❓ Frequently Asked Questions (FAQ)

### Why does Cloudflare Flexible SSL create loops?
Visitors request HTTPS from Cloudflare, Cloudflare requests HTTP from the origin, the origin issues a 301 to HTTPS, and Cloudflare restarts the identical cycle indefinitely.

### How do I trace redirection hops from the terminal?
Run `curl -IL https://mysite.com` to inspect every HTTP response status header across the connection chain.

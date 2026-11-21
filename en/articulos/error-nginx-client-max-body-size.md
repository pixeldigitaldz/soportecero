---
title: How to Fix 413 Request Entity Too Large and 403 Forbidden Nginx Errors
description: >-
  Learn how to fix 413 request entity too large and 403 forbidden nginx errors. Adjust client_max_body_size and fix file permissions in minutes.
category: Systems & Servers
tags:
  - Nginx
  - Sysadmin
  - Web
readTime: 5 min
date: '2026-07-03'
---

Two of the most common HTTP errors encountered when deploying web applications behind Nginx are **413 Request Entity Too Large** and **403 Forbidden**. A `413` status blocks file uploads or large JSON payloads that exceed Nginx's default 1 MB request body ceiling, while a `403` status indicates the Nginx worker process cannot traverse directories, read target files, or resolve a valid `index` file.

## Quick Diagnostics

| Error | Cause | Solution |
|---|---|---|
| **413 Request Entity Too Large** | `client_max_body_size` defaults to `1m` | Set `client_max_body_size 64M;` in `http`, `server`, or `location` |
| **413 Request Entity Too Large** | Upstream PHP-FPM or app server limit is lower | Align `upload_max_filesize` and `post_max_size` in `php.ini` |
| **403 Forbidden** | Missing `x` (traverse) bit on dirs or `r` on files | Set `755` on directories, `644` on files, and proper owner |
| **403 Forbidden** | Missing `index` file or SELinux context block | Verify `index index.php index.html;` and `restorecon` context |

## Root Cause & Technical Mechanics

In Nginx, the `ngx_http_core_module` inspects the incoming `Content-Length` header (or accumulates streamed chunks for `Transfer-Encoding: chunked`) against `client_max_body_size` before forwarding the request to an upstream proxy or FastCGI worker. If the payload exceeds the configured threshold—which defaults to `1m` if omitted—Nginx immediately terminates the request and returns `413`. Even after raising Nginx's limit, backends such as PHP-FPM (`post_max_size`) or Express (`body-parser`) enforce independent limits that can reject the same upload downstream.

For **403 Forbidden**, Nginx worker processes run as an unprivileged user (typically `www-data` on Debian/Ubuntu or `nginx` on RHEL/Rocky). At the Linux VFS layer, the worker needs read (`r`) permission on the served file *and* execute/search (`x`) permission on **every parent directory** from `/` down to the web root. If a site lives under `/home/deploy/app/dist` and `/home/deploy` has mode `700`, Nginx cannot traverse into it and logs `Permission denied` alongside a `403` response. A `403` also occurs when a client requests a directory URL without a matching `index` file while `autoindex` is `off`.

## Step-by-Step Solution

### Step 1: Increase `client_max_body_size` in Nginx

Edit `/etc/nginx/nginx.conf` (for a global setting) or your site file under `/etc/nginx/sites-available/`:

```nginx
server {
    listen 80;
    server_name example.com;

    # Allow request bodies up to 64 MB
    client_max_body_size 64M;

    location /api/upload {
        # Optional stricter or larger per-route override
        client_max_body_size 128M;
        proxy_pass http://127.0.0.1:3000;
    }
}
```

### Step 2: Align Upstream Application Limits (PHP-FPM / Node.js)

If Nginx proxies to PHP-FPM, update `/etc/php/8.2/fpm/php.ini` (adjusting for your PHP version) so `post_max_size` is at least equal to `upload_max_filesize`:

```ini
upload_max_filesize = 64M
post_max_size = 64M
memory_limit = 256M
```

### Step 3: Resolve 403 Forbidden Ownership and Directory Traversal Bits

Verify which user Nginx workers run as (`ps aux | grep nginx`), then apply ownership and POSIX permissions across your document root:

```bash
sudo chown -R www-data:www-data /var/www/html
sudo find /var/www/html -type d -exec chmod 755 {} +
sudo find /var/www/html -type f -exec chmod 644 {} +
```

Confirm your `server` block declares the expected entry file (`index index.html index.php;`). On RHEL/Rocky Linux with SELinux enforcing, restore the web context:

```bash
sudo restorecon -Rv /var/www/html
```

### Step 4: Validate Syntax, Reload, and Verify

Test the configuration before reloading so a syntax typo never drops live traffic:

```bash
sudo nginx -t && sudo systemctl reload nginx
sudo systemctl restart php8.2-fpm
```

Verify the `403` fix and inspect the error log if any request still fails:

```bash
curl -I http://localhost/
sudo tail -n 20 /var/log/nginx/error.log
```

## Frequently Asked Questions

### Why is setting `client_max_body_size 0;` dangerous in production?
Setting `client_max_body_size 0` disables body size checks entirely. Attackers can send multi-gigabyte POST requests to exhaust disk space in `client_body_temp_path` or tie up worker connections.

### Why do I still get a 413 error after updating `nginx.conf`?
Check two places: another `client_max_body_size` directive in a more specific `location` block overriding your `server` block, or an upstream CDN/load balancer (such as Cloudflare's 100 MB free-tier upload limit) rejecting the request before it reaches Nginx.

### Why does Nginx return 403 when serving files from `/home/user/site`?
Because user home directories commonly default to `0700` or `0750`. Even if `site/` is `0755`, the `www-data` user cannot traverse `/home/user` without `o+x` (`chmod 711 /home/user`) or moving the web root to `/var/www/`.

## Prevention Advice

- Keep `client_max_body_size` scoped to specific upload endpoints (`/upload`, `/wp-admin`) rather than raising it globally to hundreds of megabytes.
- Deploy static and PHP sites under `/var/www/` rather than `/home/` to avoid home-directory traversal blocks and SELinux mismatches.
- Always run `sudo nginx -t` in CI/CD deployment scripts before executing `systemctl reload nginx`.
- Monitor `/var/log/nginx/error.log` for `client intended to send too large body` and `directory index of "..." is forbidden` entries after each release.

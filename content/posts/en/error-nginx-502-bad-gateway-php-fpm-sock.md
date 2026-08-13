---
title: "[FIXED] Error 502 Bad Gateway in Nginx with PHP-FPM"
description: "Nginx returning 502 Bad Gateway while processing PHP requests? Learn how to fix PHP-FPM socket path mismatches and permissions in 3 steps."
category: "Systems & Servers"
tags: ["Nginx", "PHP-FPM", "Sysadmin", "Linux"]
readTime: "4 min"
date: "2026-08-12"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **php-fpm daemon service stopped or not started** | Start PHP daemon: `sudo systemctl start php-fpm` (or `php8.2-fpm`) |
| **Insufficient permissions on UNIX socket /var/run/php/php-fpm.sock** | Change socket owner to `www-data:www-data` in `/etc/php/fpm/pool.d/www.conf` |


The **`502 Bad Gateway`** error on Nginx web servers using PHP-FPM occurs when Nginx acts as a reverse proxy but fails to establish a socket connection with the PHP backend process. The error log at `/var/log/nginx/error.log` usually states:
`connect() to unix:/run/php/php8.2-fpm.sock failed (2: No such file or directory)` or `Connection refused`.

> **Quick Solution (1 Minute):**
> 1. Restart your active PHP-FPM service:
>    `sudo systemctl restart php8.2-fpm`
> 2. Ensure your Nginx `fastcgi_pass` directive matches your exact installed PHP socket version.

## 🚀 Step-by-Step Fixes

### Step 1: Check PHP-FPM Daemon Status
Verify that PHP-FPM is active and running:

```bash
sudo systemctl status php8.2-fpm
```
If status reports `inactive` or `failed`, enable and start it:
```bash
sudo systemctl enable --now php8.2-fpm
```

### Step 2: Verify Exact Socket (`.sock`) Path
Check the active socket location created by PHP:

```bash
ls -la /run/php/
```
Expected output: `php8.2-fpm.sock` or `php8.3-fpm.sock`.

Open your Nginx site configuration file at `/etc/nginx/sites-available/yourdomain.conf`:
```nginx
location ~ \.php$ {
    include snippets/fastcgi-php.conf;
    # MUST match your active .sock file path:
    fastcgi_pass unix:/run/php/php8.2-fpm.sock;
}
```

### Step 3: Fix PHP-FPM Socket Permissions
If the `.sock` file exists but Nginx returns `Permission denied` in its logs:

Edit your PHP-FPM pool configuration:
```bash
sudo nano /etc/php/8.2/fpm/pool.d/www.conf
```
Ensure the socket owner matches Nginx (`www-data`):
```ini
listen.owner = www-data
listen.group = www-data
listen.mode = 0660
```
Restart services:
```bash
sudo systemctl restart php8.2-fpm
sudo systemctl restart nginx
```

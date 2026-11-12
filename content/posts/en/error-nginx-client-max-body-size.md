---
title: How to Fix 413 Request Entity Too Large and 403 Forbidden Nginx Errors
description: >-
  Learn how to fix 413 request entity too large and 403 forbidden nginx errors. Adjust client_max_body_size and fix file permissions in minutes.
category: Systems & Servers
tags:
  - Nginx
  - Sysadmin
  - Web
readTime: 3 min
date: '2026-07-03'
---

The **413 request entity too large** error in Nginx occurs when a client attempts to upload a file exceeding the default 1MB buffer limit. To fix this instantly, add or increase the `client_max_body_size 64M;` directive inside the `http`, `server`, or `location` block of `/etc/nginx/nginx.conf` and reload the service with `sudo nginx -s reload`.

Similarly, the **403 forbidden nginx** error happens when the web server process user (typically `www-data` or `nginx`) lacks read permissions on static files or execute permissions on directories. You can resolve the 403 error immediately by setting ownership and secure permissions: run `sudo chown -R www-data:www-data /var/www/html && sudo find /var/www/html -type d -exec chmod 755 {} + && sudo find /var/www/html -type f -exec chmod 644 {} +`.

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Nginx client_max_body_size directive limit below uploaded file size** | Increase limit in `nginx.conf`: `client_max_body_size 64M;` |
| **php.ini upload_max_filesize or post_max_size restricting upload size** | Update `upload_max_filesize = 64M` in PHP configuration file |

## 🚀 Step-by-Step Solution

### Step 1: Configure upload limit in Nginx
Open the global Nginx configuration file or the specific website server block configuration:
```bash
# Open main Nginx configuration file
sudo nano /etc/nginx/nginx.conf
```
Inside the `http`, `server`, or `location` block, add or modify the following directive to increase the upload limit (for example, to 64 Megabytes):
```nginx
# Allow uploads up to 64MB
client_max_body_size 64M;
```

### Step 2: Adjust PHP-FPM upload limits (if applicable)
If your website runs on PHP (such as WordPress, Drupal, or Laravel), you must align Nginx's limits with your PHP interpreter configurations:
```bash
# Open the active PHP configuration file (adjust for your active PHP version)
sudo nano /etc/php/8.2/fpm/php.ini
```
Find and edit the following variables to match your Nginx configuration limits:
```ini
upload_max_filesize = 64M
post_max_size = 64M
memory_limit = 256M
```

### Step 3: Validate syntax and restart services
Test your Nginx configuration syntax for correctness before applying changes to production:
```bash
# Test web server configuration syntax
sudo nginx -t

# Restart system services to apply the new configurations
sudo systemctl restart nginx
sudo systemctl restart php8.2-fpm
```

## 🛡️ Prevention Advice
Recommended security practices:
- Do not set the `client_max_body_size` directive to `0` (which disables size checking completely). Configuring an infinite upload limit exposes your Nginx web server to Denial of Service (DoS) attacks, allowing malicious actors to saturate your system storage by continuously uploading massive files.

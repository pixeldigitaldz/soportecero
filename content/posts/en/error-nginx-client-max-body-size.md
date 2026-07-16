---
title: "How to Fix 413 Request Entity Too Large Error in Nginx"
description: "Fix the 413 error when uploading large images or files to your web server by configuring transfer limits in Nginx and PHP."
category: "Systems & Servers"
tags: ["Nginx", "Sysadmin", "Web"]
readTime: "3 min"
date: "2026-07-03"
---

The **413 request entity too large** error on an Nginx web server occurs when a client attempts to upload a file (such as an image, a WordPress plugin, or a heavy backup) whose size exceeds the maximum upload limit configured in the web proxy settings.

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

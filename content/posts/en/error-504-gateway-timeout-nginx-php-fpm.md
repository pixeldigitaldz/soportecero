---
title: "How to Fix 504 Gateway Timeout Error in Nginx with PHP-FPM (Quickly)"
description: "Step-by-step troubleshooting guide to resolve 504 Gateway Timeout in Nginx and PHP-FPM by tuning execution timeouts and process pools."
category: "Systems & Servers"
tags: ["Nginx", "PHP-FPM", "Linux", "SysAdmin", "Servers", "WordPress"]
readTime: "5 min"
date: "2026-07-26"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **PHP script execution time exceeds Nginx fastcgi_read_timeout boundary** | Increase `fastcgi_read_timeout 300s;` in Nginx server block configuration |
| **Low max_execution_time and request_terminate_timeout in php.ini and PHP-FPM pool** | Raise `max_execution_time = 300` in `php.ini` and `request_terminate_timeout = 300s` in `www.conf` |

The `504 Gateway Timeout` error in an Nginx and PHP-FPM web server stack indicates that Nginx, operating as a reverse proxy gateway, did not receive a timely response from the upstream PHP-FPM worker process before the configured timeout interval expired.

## 🚀 Step-by-Step Solution

### Step 1: Increase Timeout Directives in Nginx Configuration
Open your site virtual host configuration file (e.g., `/etc/nginx/sites-available/mysite.conf`):
```nginx
server {
    listen 80;
    server_name mysite.com;
    root /var/www/mysite;

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php8.3-fpm.sock;

        # Increase upstream FastCGI timeout limits to 300s
        fastcgi_connect_timeout 300s;
        fastcgi_send_timeout 300s;
        fastcgi_read_timeout 300s;
        
        # Buffer optimization for large payload transfers
        fastcgi_buffer_size 128k;
        fastcgi_buffers 4 256k;
        fastcgi_busy_buffers_size 256k;
    }
}
```

### Step 2: Configure Execution Boundaries in php.ini
Update execution and memory settings inside `/etc/php/8.3/fpm/php.ini`:
```ini
; Maximum execution time in seconds
max_execution_time = 300

; Maximum input parse time
max_input_time = 300

; Memory limit for heavy data operations
memory_limit = 512M
```

### Step 3: Tune PHP-FPM Worker Pool (www.conf)
Edit your active PHP-FPM worker pool configuration file (`/etc/php/8.3/fpm/pool.d/www.conf`):
```ini
; Terminate long-running worker requests after 300 seconds
request_terminate_timeout = 300s

; Ensure adequate worker availability under concurrent load
pm = dynamic
pm.max_children = 50
pm.start_servers = 10
pm.min_spare_servers = 5
pm.max_spare_servers = 20
```

### Step 4: Test Syntax and Restart Services
Confirm configuration integrity prior to restarting server daemons:
```bash
# 1. Test Nginx syntax
sudo nginx -t

# 2. Restart PHP-FPM and Nginx daemons
sudo systemctl restart php8.3-fpm
sudo systemctl restart nginx
```

## 🛡️ Prevention Advice
- **Audit database query bottlenecks:** Unindexed SQL queries are the primary root cause of 504 timeouts. Enable the MySQL *Slow Query Log* to detect slow database queries.
- **Offload heavy jobs to background workers:** Offload email dispatch, report rendering, and video processing to background worker queues (Redis / RabbitMQ).

## ❓ Frequently Asked Questions (FAQ)

### What is the difference between 502 Bad Gateway and 504 Gateway Timeout?
A **502** error means PHP-FPM crashed or the socket is unreachable immediately. A **504** error means PHP-FPM is alive, but the worker process took too long to complete the request.

### Does Cloudflare have its own 504 timeout limit?
Yes. Cloudflare imposes a hard 100-second timeout on Free and Pro tiers. If your backend takes longer than 100 seconds, Cloudflare will return a branded 504 page.

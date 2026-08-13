---
title: "How to Fix 504 Gateway Timeout Error in Nginx with PHP-FPM (Quickly)"
description: "Step-by-step guide to diagnose and resolve 504 Gateway Timeout errors in Nginx and PHP-FPM by configuring proper timeout directives."
category: "Systems & Servers"
tags: ["Nginx", "PHP-FPM", "Sysadmin"]
readTime: "4 min"
date: "2026-07-26"
---

The **504 Gateway Timeout** error occurs when Nginx acts as a reverse proxy in front of a backend server (such as PHP-FPM) and the backend fails to respond within the configured timeout limit.

## Quick Diagnostics

| Cause | Solution |
|---|---|
| **HTTP 504 Gateway Timeout when executing long-running PHP scripts**: Nginx or PHP-FPM closes connection as request execution exceeds `fastcgi_read_timeout` or `max_execution_time` | Increase timeout values in Nginx configuration and `php.ini` / FPM pool configuration |

## 🚀 How to Fix the Error Step-by-Step

### Step 1: Increase Timeouts in Nginx Configuration

Open your site's Nginx configuration file (e.g., `/etc/nginx/sites-available/default` or `/etc/nginx/conf.d/default.conf`):

```nginx
server {
    listen 80;
    server_name example.com;

    location ~ \.php$ {
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;

        # Increase FastCGI timeout limits
        fastcgi_connect_timeout 300s;
        fastcgi_send_timeout 300s;
        fastcgi_read_timeout 300s;
    }
}
```

### Step 2: Configure Execution Limits in PHP-FPM

Adjust the execution time directives in your `php.ini` file (`/etc/php/8.2/fpm/php.ini`):

```ini
max_execution_time = 300
max_input_time = 300
memory_limit = 256M
```

Additionally, update your PHP-FPM pool configuration file (`/etc/php/8.2/fpm/pool.d/www.conf`):

```ini
request_terminate_timeout = 300s
```

### Step 3: Validate and Restart Services

Test the Nginx configuration syntax before applying changes:

```bash
sudo nginx -t
```

If the test is successful, restart Nginx and PHP-FPM:

```bash
sudo systemctl restart php8.2-fpm
sudo systemctl restart nginx
```

## 🛡️ Prevention Advice

- **Offload Heavy Tasks to Background Queues**: Use queue managers like Redis with Celery/Supervisor or Laravel Queues for long tasks like PDF generation or image processing.
- **Monitor Slow Logs**: Enable `request_slowlog_timeout` in PHP-FPM to log scripts and database queries that slow down request handling.
- **Optimize Database Queries**: Index high-frequency database tables in MySQL/PostgreSQL to prevent backend locks during HTTP requests.

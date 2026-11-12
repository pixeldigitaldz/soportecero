---
title: How to Diagnose and Fix 502 Bad Gateway Errors in Nginx Reverse Proxy
description: >-
  Learn how to troubleshoot and resolve HTTP 502 Bad Gateway errors in Nginx. Fix upstream socket
  disconnects, PHP-FPM crashes, Node.js proxy_pass configurations, and buffer overflows.
category: Systems & Servers
tags:
  - Nginx
  - Docker
  - Sysadmin
  - Node.js
  - Linux
readTime: 5 min
date: '2026-07-23'
---

An **HTTP 502 Bad Gateway** response emitted by an Nginx server operating as a reverse proxy or application gateway signifies that Nginx acted as an intermediary and received an invalid response (or no TCP/socket response at all) from the upstream application server. Common upstreams include **PHP-FPM**, **Node.js** processes (managed by PM2 or systemd), **Python WSGI/ASGI** servers (such as Gunicorn or Uvicorn), and containerized backends in Docker.

Because Nginx sits in front of your application logic, a 502 error almost always points to an upstream crash, an unmapped socket path, strict socket file permissions, or buffer saturation during large header handshakes.

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Upstream application process (PHP-FPM, Node.js, Gunicorn) is crashed or inactive** | Check service status with `systemctl status <service>` and inspect logs |
| **UNIX socket permission denied or missing `/var/run/php/*.sock` file** | Align socket user/group to `www-data` in `/etc/php/*/fpm/pool.d/www.conf` |
| **Connection refused on localhost port (`127.0.0.1:3000`)** | Verify upstream is listening on `127.0.0.1` or `0.0.0.0` with `ss -tulpn` |
| **Upstream response headers exceeding default buffer memory** | Increase `proxy_buffer_size 128k;` and `proxy_buffers 4 256k;` in `nginx.conf` |

## 🚀 Step-by-Step Implementation Guide

### Step 1: Inspect Upstream Application Daemon Status
Before modifying Nginx configuration files, verify whether your backend runtime is actively running and capable of processing connections:
```bash
# For PHP-FPM services (Debian / Ubuntu / CachyOS)
sudo systemctl status php8.2-fpm --no-pager

# For Node.js applications managed via PM2
pm2 status

# For containerized microservices in Docker
docker ps --filter "status=running"
```
If your upstream service has stopped or entered a crash loop (e.g., due to an unhandled JavaScript exception or out-of-memory kill), restart it immediately:
```bash
sudo systemctl restart php8.2-fpm
pm2 restart all
```

### Step 2: Validate UNIX Socket Paths and Ownership Permissions
When routing through a UNIX domain socket (such as FastCGI for PHP-FPM), Nginx must have read and write permissions to the `.sock` file descriptor.

Check your Nginx virtual host configuration (`/etc/nginx/sites-available/default`):
```nginx
location ~ \.php$ {
    include snippets/fastcgi-php.conf;
    fastcgi_pass unix:/run/php/php8.2-fpm.sock;
}
```
If you encounter `502 Bad Gateway (13: Permission denied)` in your error log, the socket ownership is misaligned. Verify socket permissions in `/etc/php/8.2/fpm/pool.d/www.conf`:
```ini
listen = /run/php/php8.2-fpm.sock
listen.owner = www-data
listen.group = www-data
listen.mode = 0660
```
Reload PHP-FPM (`sudo systemctl reload php8.2-fpm`) after updating pool settings.

### Step 3: Verify TCP Port Bindings for Proxy Pass Directives
If your upstream service communicates over a local network port (e.g., Express.js, NestJS, FastAPI, or Django on port 3000):
```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```
Run `ss` or `netstat` to confirm that your application process is actively listening on `127.0.0.1:3000` or `0.0.0.0:3000`:
```bash
sudo ss -tulpn | grep 3000
```
*(Warning: If your Node.js application is bound strictly to `::1` IPv6, referencing `http://127.0.0.1:3000` in Nginx will fail with `Connection refused`).*

### Step 4: Increase Nginx Upstream Header Buffers
If the backend application emits large HTTP header payloads (such as large JSON session cookies, OAuth JWT tokens, or deep proxy chains), Nginx's default 4KB or 8KB header buffer can saturate, triggering `502 Bad Gateway: upstream sent too big header while reading response header from upstream`.

Add the following buffer directives inside your `http` or `server` block:
```nginx
proxy_buffer_size 128k;
proxy_buffers 4 256k;
proxy_busy_buffers_size 256k;

fastcgi_buffer_size 128k;
fastcgi_buffers 4 256k;
fastcgi_busy_buffers_size 256k;
```
Test and reload Nginx:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Step 5: Monitor Real-Time Nginx Error Logs
To capture exact kernel diagnostic codes when replicating the issue in your browser, tail the error stream:
```bash
sudo tail -n 50 -f /var/log/nginx/error.log
```
Look for specific error descriptors such as `connect() failed (111: Connection refused)` or `recv() failed (104: Connection reset by peer)` to pinpoint the exact failure mechanism.

## 🛡️ Production Hardening & Resilience
- **Implement Process Supervisors:** Ensure backends configured with systemd define `Restart=always` and `RestartSec=3s` in their unit files. This prevents temporary unhandled exceptions from leaving Nginx disconnected.
- **Configure Upstream Health Checks and Keepalive Pools:** In high-traffic environments, define an `upstream` block with persistent connections (`keepalive 32;`) to eliminate latency caused by repeated TCP handshake teardowns.

## Frequently Asked Questions (FAQ)

### What is the technical difference between HTTP 502 and HTTP 504?
A **502 Bad Gateway** occurs when Nginx connects to the upstream but receives an immediate error, empty response, or TCP connection reset. A **504 Gateway Timeout** occurs when the upstream accepts the connection but takes longer to compute the response than permitted by `proxy_read_timeout` or `fastcgi_read_timeout`.

### Why does 502 occur specifically after updating PHP versions?
Upgrading PHP (e.g., from PHP 8.1 to PHP 8.3) creates a new socket file path (e.g., `/run/php/php8.3-fpm.sock`). If your Nginx site configuration still points to the old deprecated socket, all requests will immediately return 502.

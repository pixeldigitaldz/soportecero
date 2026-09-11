---
title: "[SOLVED] Nginx connect() failed (111: Connection refused) while connecting to upstream"
description: "Fix Nginx error 111: Connection refused on proxy_pass routes connecting to Node.js, PHP-FPM, Docker, or Python Gunicorn backends."
category: "Systems & Servers"
tags: ["Nginx","DevOps","Nodejs","Sysadmin"]
readTime: "4 min"
date: "2026-09-19"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Upstream application process (Node.js, Gunicorn, Docker) is stopped or crashed** | Inspect backend daemon status via systemctl status or docker ps |
| **Port mismatch or IPv4 vs IPv6 loopback binding collision in Nginx proxy_pass** | Point proxy_pass directly to 127.0.0.1:<port> rather than localhost |

When using Nginx as a reverse proxy in front of web applications (Next.js, Express, Django, FastAPI), users are frequently met with HTTP 502 Bad Gateway and the following line logged in `/var/log/nginx/error.log`: `connect() failed (111: Connection refused) while connecting to upstream, upstream: "http://127.0.0.1:3000/..."`. This indicates Nginx dispatched a client request to the upstream target, but no process was listening on the designated socket or TCP port.

> **Quick Solution (1 Minute):**
> 1. Check listening sockets on local ports:
>    `sudo ss -tulpn | grep -E '3000|8000|8080|9000'`
> 2. Check backend service status:
>    `sudo systemctl status my-backend`

## 🚀 Step-by-Step Solution

### Step 1: Verify Upstream Backend Process and Port Binding
Run socket inspection to confirm your application is bound to the expected port:
```bash
sudo ss -tulpn | grep LISTEN
```
If Nginx expects a backend at `http://127.0.0.1:3000` but `ss` shows no service bound to port 3000, your application crashed or failed during initial boot.

### Step 2: Eliminate localhost IPv6 Collision (Use 127.0.0.1)
In modern Linux distributions, `localhost` resolves to IPv6 `[::1]` first. If your Node.js or Python backend only listens on IPv4 (`127.0.0.1`), Nginx encounters immediate connection refusal on IPv6:
```nginx
# In your Nginx server block configuration
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

### Step 3: Verify UNIX Socket Permissions (Gunicorn / PHP-FPM)
If proxying to a UNIX socket file (`unix:/run/app.sock`), verify filesystem ownership:
```bash
ls -la /run/app.sock
```
The socket must be readable and writable by Nginx's worker user (`www-data` or `nginx`):
```bash
sudo chown www-data:www-data /run/app.sock
sudo chmod 660 /run/app.sock
sudo systemctl reload nginx
```

## 🛡️ Prevention Tips
* Deploy backend applications under systemd or PM2 with `Restart=always` to recover from unhandled exceptions.
* Configure active health checking upstream blocks to route traffic away from degraded backend instances.

## Frequently Asked Questions

### Why does error 111 trigger specifically after a machine reboot?
Nginx often boots faster than complex Dockerized apps or databases. Add `After=docker.service` or your backend unit in systemd to ensure proper boot sequencing.

### What is the technical difference between error 111 and error 110 in Nginx logs?
Error 111 (Connection refused) means a TCP RST packet was actively returned because no daemon is listening. Error 110 (Connection timed out) means packets were dropped by a firewall or routing loop.

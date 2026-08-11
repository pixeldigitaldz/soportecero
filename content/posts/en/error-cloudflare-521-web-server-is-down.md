---
title: "[FIXED] Error 521 Web Server Is Down in Cloudflare"
description: "Users seeing Cloudflare Error 521 Web Server Is Down? Step-by-step resolution for Nginx, Apache, and origin firewall IP allowlists."
category: "Systems & Servers"
tags: ["Cloudflare", "Nginx", "Apache", "Sysadmin"]
readTime: "4 min"
date: "2026-08-24"
---

The **`Error 521: Web server is down`** returned by Cloudflare's edge network occurs when Cloudflare proxies attempt to connect to your origin server IP (on ports 80 or 443), but the origin web server (Nginx / Apache) actively refused the connection or a firewall dropped the packets.

> **Quick Solution (1 Minute):**
> 1. Restart your origin web server daemon:
>    `sudo systemctl restart nginx` or `sudo systemctl restart apache2`
> 2. Allow Cloudflare IP ranges in your firewall (UFW/iptables):
>    `sudo ufw allow 80/tcp && sudo ufw allow 443/tcp`

## 🚀 Step-by-Step Fixes

### Step 1: Verify Origin Web Server Daemon Status
SSH into your origin VPS and check web server status:

```bash
# Nginx
sudo systemctl status nginx

# Apache
sudo systemctl status apache2
```
If the process has crashed, restart it immediately:
```bash
sudo systemctl restart nginx
```

### Step 2: Whitelist Cloudflare IP Ranges in Firewall
If your local firewall (UFW) or cloud security groups (AWS, Hetzner, DigitalOcean) block proxy requests, Cloudflare throws Error 521.

Ensure HTTP/HTTPS ports are open to Cloudflare:
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

### Step 3: Check Cloudflare SSL/TLS Mode Settings
If SSL is set to **Full (Strict)**, Cloudflare demands an active SSL certificate on port 443 of the origin web server.

1. Navigate to **Cloudflare Dashboard** -> **SSL/TLS**.
2. Switch mode from *Full (Strict)* to **Full** or **Flexible** to test if origin SSL configuration is the root cause.
3. Install a free Let's Encrypt certificate or Cloudflare Origin CA certificate on Nginx.

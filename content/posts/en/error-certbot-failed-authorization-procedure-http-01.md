---
title: "[FIXED] Error Certbot 'Failed authorization procedure (http-01)'"
description: "Let's Encrypt / Certbot failing SSL certificate generation due to HTTP-01 challenge failure? Fix port 80 blocks and Nginx location routes."
category: "Systems & Servers"
tags: ["Certbot", "SSL", "Nginx", "Apache", "Sysadmin"]
readTime: "4 min"
date: "2026-08-03"
---

The error **`Certbot: Failed authorization procedure. domain.com (http-01): fetching http://domain.com/.well-known/acme-challenge/...: Connection refused / Timeout`** occurs when issuing or renewing a free Let's Encrypt SSL certificate if Let's Encrypt validation servers cannot access the temporary token file generated on your web server.

> **Quick Solution (1 Minute):**
> 1. Open port 80 in your firewall: `sudo ufw allow 80/tcp`
> 2. Stop Nginx temporarily to issue via standalone mode:
>    `sudo systemctl stop nginx && sudo certbot certonly --standalone -d yourdomain.com`

## 🚀 Step-by-Step Fixes

### Step 1: Verify Port 80 Accessibility
Let's Encrypt strictly requires **port 80** to be accessible over the public internet to validate domain ownership via the `http-01` challenge, even if your site redirects traffic to HTTPS (port 443).

1. **Firewall Settings (UFW):**
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw reload
   ```
2. **Cloud Security Groups (AWS / GCP / Proxmox):**
   Ensure your cloud security rules permit inbound traffic on port `80` from `0.0.0.0/0`.

### Step 2: Configure ACME Challenge Location in Nginx
If Nginx is active, ensure the server block explicitly grants access to the hidden `.well-known/acme-challenge/` directory:

Edit `/etc/nginx/sites-available/yourdomain.conf`:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
        allow all;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}
```
Test and reload Nginx:
```bash
sudo nginx -t && sudo systemctl restart nginx
```

### Step 3: Issue via Standalone Mode
If web server routing interferes with token verification, temporarily stop your web server and run Certbot in `standalone` mode:

```bash
# 1. Stop web server
sudo systemctl stop nginx || sudo systemctl stop apache2

# 2. Issue certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# 3. Restart web server
sudo systemctl start nginx || sudo systemctl start apache2
```

---
title: How to Force Renewal of an Expired Let's Encrypt SSL Certificate with Certbot
description: >-
  Learn how to troubleshoot and force renewal of expired Let's Encrypt SSL/TLS certificates using Certbot.
  Resolve HTTP-01 challenge failures, port 80 conflicts, webroot validation, and systemd timers.
category: Systems & Servers
tags:
  - SSL
  - Let's Encrypt
  - Certbot
  - Nginx
  - Security
  - Sysadmin
readTime: 5 min
date: '2026-07-27'
---

Encountering a browser warning like `NET::ERR_CERT_DATE_INVALID` or `SEC_ERROR_EXPIRED_CERTIFICATE` on a production domain managed by **Let's Encrypt** and **Certbot** is an urgent operational incident. While Let's Encrypt certificates are designed to renew automatically every 60 days (prior to their 90-day expiration window), background renewals frequently fail silently without triggering alerts.

The root causes typically boil down to:
1. **HTTP-01 Challenge Failures:** Port 80 is blocked by a host firewall or edge reverse proxy (such as Cloudflare without proper SSL mode).
2. **Webroot Route Interception:** Nginx or Apache routing rules intercept or redirect requests to `/.well-known/acme-challenge/` to a non-existent SPA route.
3. **Inactive Systemd Timers:** The automated background `certbot.timer` unit was disabled or failed during an operating system upgrade.

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Expired certificate needing immediate manual renewal** | Force execution with `sudo certbot renew --force-renewal` |
| **Port 80 blocked or conflicting standalone web server listener** | Use webroot/nginx plugin instead of standalone: `sudo certbot renew --nginx` |
| **Nginx rewrite rules blocking `/.well-known/acme-challenge/` path** | Add an explicit unrewritten location block for ACME challenge path |
| **Systemd automated renewal timer disabled or inactive** | Enable the renewal timer: `sudo systemctl enable --now certbot.timer` |

## 🚀 Step-by-Step Implementation Guide

### Step 1: Run a Non-Destructive Dry Run Test
Before running forced renewals, execute a simulated renewal to capture the exact failure log without hitting Let's Encrypt's strict API rate limits:
```bash
sudo certbot renew --dry-run
```
Review the error output:
- `Connection refused on port 80`: Certbot cannot establish an inbound HTTP connection to verify domain ownership.
- `Unauthorized (404 Not Found)`: The validation token written to `/.well-known/acme-challenge/` was not reachable at the webroot URL.

### Step 2: Ensure Port 80 and ACME Challenge Accessibility in Nginx
Let's Encrypt's **HTTP-01 challenge** requires an open HTTP connection on port `80`. Even if your entire website runs on HTTPS (`443`), port 80 must accept the validation request before issuing a 301 redirect.

Ensure your Nginx configuration (`/etc/nginx/sites-available/default`) explicitly serves the challenge path:
```nginx
server {
    listen 80;
    server_name example.com www.example.com;

    # Allow Let's Encrypt ACME challenge to complete unredirected
    location ^~ /.well-known/acme-challenge/ {
        default_type "text/plain";
        root /var/www/html;
    }

    # Redirect all remaining traffic to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}
```
Test configuration syntax and reload Nginx:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Step 3: Force Immediate Certificate Renewal
Once the challenge route is verified, trigger an immediate forced renewal:
- **If using the native Nginx plugin:**
```bash
sudo certbot renew --nginx --force-renewal
```
- **If using the standalone method (temporarily stopping Nginx):**
```bash
# Stop web server to free up port 80
sudo systemctl stop nginx

# Run standalone ACME authentication
sudo certbot renew --standalone --force-renewal

# Restart web server immediately
sudo systemctl start nginx
```
The terminal will output:
`Congratulations, all renewals succeeded. The following certs have been renewed...`

### Step 4: Verify the New Certificate Deployment
Confirm that your web server is actively presenting the newly renewed cryptographic key:
```bash
# Inspect certificate expiration date locally
sudo certbot certificates

# Query the live SSL handshake via OpenSSL
openssl s_client -connect example.com:443 -servername example.com 2>/dev/null | openssl x509 -noout -dates
```
The `notAfter` field will now reflect an expiration date 90 days into the future.

### Step 5: Automate Background Renewals via Systemd Timer
Ensure your system will automatically renew certificates in the future without manual intervention:
```bash
# Verify the status of the automated timer
sudo systemctl status certbot.timer

# Enable and start the timer if inactive
sudo systemctl enable --now certbot.timer

# Confirm the next scheduled execution time
systemctl list-timers | grep certbot
```

## 🛡️ Production Best Practices & DNS-01 Alternative
- **Deploy Deploy Hooks for Automatic Nginx Reloading:** When Certbot automatically renews a certificate in the background, Nginx will continue serving the old certificate in memory until it receives a reload signal. Ensure `/etc/letsencrypt/cli.ini` contains `deploy-hook = systemctl reload nginx`.
- **Consider DNS-01 Challenges for Intranet / Firewalled Hosts:** If your server cannot expose port 80 publicly (e.g., internal homelabs or staging servers), use Certbot's DNS plugins (`certbot-dns-cloudflare`, `certbot-dns-route53`). DNS validation works via API TXT records and requires zero open inbound firewall ports.

## Frequently Asked Questions (FAQ)

### What are Let's Encrypt rate limits for failed renewals?
Let's Encrypt allows up to 5 failed validation attempts per account, per hostname, per hour. Always use `certbot renew --dry-run` while debugging to prevent hitting rate limit locks.

### Why does Cloudflare cause 'SSL certificate expired' errors?
If Cloudflare is in front of your domain and SSL/TLS encryption mode is set to "Flexible", Cloudflare talks to your origin server over port 80. If your origin redirects port 80 to 443 with an expired certificate, a redirect loop occurs. Set Cloudflare SSL mode to "Full (Strict)" after renewing the origin certificate.

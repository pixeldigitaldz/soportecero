---
title: '[FIXED] Error Certbot ''Failed authorization procedure (http-01)'''
description: >-
  Let's Encrypt / Certbot failing SSL certificate generation due to HTTP-01
  challenge failure? Fix port 80 blocks and Nginx location routes.
category: Systems & Servers
tags:
  - Certbot
  - SSL
  - Nginx
  - Apache
  - Sysadmin
readTime: 5 min
date: '2026-08-03'
---

The error `Certbot failed to authenticate some domains` or `Failed authorization procedure. example.com (http-01): Connection refused / Timeout / 404 Not Found` occurs when Let's Encrypt ACME validation servers attempt to fetch a temporary challenge token over **HTTP port 80** (`http://example.com/.well-known/acme-challenge/<token>`) and cannot reach it.

## Quick Diagnostics

| Symptom / Cause | Verification | Immediate Fix |
|---|---|---|
| `Timeout during connect` on port 80 | `nc -zv <server_ip> 80` from external host | Open TCP port 80 in UFW and Cloud Security Group |
| `404 Not Found` on `.well-known/acme-challenge/` | `curl -I http://example.com/.well-known/acme-challenge/test` | Fix Nginx/Apache `root` or add explicit `location` block |
| DNS `A`/`AAAA` record points to wrong IP or IPv6 | `dig +short A example.com` & `dig +short AAAA example.com` | Update DNS records or fix IPv6 `listen [::]:80` |
| Cloudflare proxy or aggressive redirect interfering | `curl -IL http://example.com/.well-known/acme-challenge/test` | Ensure challenge path is served or exempt from auth/redirects |

## Root Cause & Technical Mechanics

To issue an SSL/TLS certificate without manual DNS edits, Certbot uses the **ACME `http-01` challenge**:

1. Certbot generates a cryptographic token and places it at `<webroot>/.well-known/acme-challenge/<token>` (or spins up a temporary HTTP server in `--standalone` mode).
2. Let's Encrypt's multi-perspective validation servers resolve your domain's `A` and `AAAA` DNS records and send an HTTP `GET` request strictly to **port 80** (never port 443 initially, though Let's Encrypt will follow HTTP `301`/`302` redirects to port 443).
3. If port 80 is firewalled, your web server's IPv6 `listen [::]:80` block is missing while an `AAAA` record exists, or a reverse proxy/rewrite rule intercepts `/.well-known/acme-challenge/` and returns `404`/`403`, authorization fails immediately.

Note that even if your site is HTTPS-only, **port 80 must remain open** for `http-01` validation and automated `certbot renew` cron/systemd timers.

## Step-by-Step Solution

### Step 1: Verify DNS Resolution (IPv4 & IPv6) and Port 80 Reachability

Confirm your domain's `A` and `AAAA` records match your server's public IPs:

```bash
dig +short A example.com
dig +short AAAA example.com
```

If an `AAAA` record is published, Let's Encrypt prefers IPv6—make sure your web server listens on `[::]:80` or remove the stale `AAAA` record. Then open port 80 and 443 in your host firewall (and verify your cloud provider's Security Group allows inbound TCP/80 from `0.0.0.0/0`):

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

### Step 2: Serve `.well-known/acme-challenge/` Cleanly in Nginx

If your Nginx config proxies all traffic to an app (Node/Docker/PHP) or redirects everything, explicitly carve out `/.well-known/acme-challenge/` in `/etc/nginx/sites-available/example.com`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name example.com www.example.com;

    location ^~ /.well-known/acme-challenge/ {
        default_type "text/plain";
        root /var/www/certbot;
        allow all;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}
```

Create the webroot directory, test Nginx syntax, and reload:

```bash
sudo mkdir -p /var/www/certbot/.well-known/acme-challenge
sudo nginx -t && sudo systemctl reload nginx
```

Test reachability with a dummy file:

```bash
echo "ok" | sudo tee /var/www/certbot/.well-known/acme-challenge/ping.txt
curl -i http://example.com/.well-known/acme-challenge/ping.txt
```

Confirm it returns `HTTP/1.1 200 OK` and `ok`, then remove `ping.txt`.

### Step 3: Issue the Certificate With `--webroot` (or `--standalone`)

Use `--webroot` to issue without any web server downtime:

```bash
sudo certbot certonly --webroot -w /var/www/certbot -d example.com -d www.example.com
```

*(If no web server is running yet, you can alternatively stop Nginx/Apache briefly and run `sudo certbot certonly --standalone -d example.com`.)*

### Step 4: Verify Auto-Renewal Works

Run a dry-run renewal to confirm your `systemd` timer will succeed 60 days from now:

```bash
sudo certbot renew --dry-run
```

## Frequently Asked Questions

### Why does Certbot fail behind Cloudflare with `403` or `404`?
If Cloudflare's "Under Attack Mode", custom WAF rules, or Page Rules redirect or challenge requests to `/.well-known/acme-challenge/`, Let's Encrypt receives a Cloudflare JS challenge page instead of the token. Add a WAF/Cache rule to skip security challenges on `/.well-known/acme-challenge/*`, or use the `dns-01` Cloudflare plugin (`python3-certbot-dns-cloudflare`).

### Can I close port 80 after obtaining the certificate?
Not if you use `http-01` renewal. `certbot.timer` runs twice daily to renew certificates within 30 days of expiration and requires port 80 open. If you must keep port 80 closed, switch to the `dns-01` challenge.

### What if I need a wildcard certificate (`*.example.com`)?
Let's Encrypt does **not** allow `http-01` for wildcard domains. You must use the `dns-01` challenge with an automated DNS API plugin.

## Prevention Advice

- **Always run `certbot renew --dry-run`:** Validate renewal hooks and webroot paths right after initial issuance.
- **Keep `/.well-known/acme-challenge/` exempt from auth and proxies:** Ensure Basic Auth, IP restrictions, and reverse-proxy `proxy_pass` blocks do not intercept ACME paths.
- **Sync IPv6 `AAAA` records with Nginx `listen [::]:80`:** A forgotten `AAAA` record pointing to an unconfigured IPv6 address is one of the most common hidden causes of `http-01` timeouts.
- **Use `dns-01` for internal or firewalled hosts:** Servers without public port 80 access should authenticate via DNS TXT records instead.

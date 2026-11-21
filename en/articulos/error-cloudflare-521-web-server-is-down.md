---
title: '[FIXED] Error 521 Web Server Is Down in Cloudflare'
description: >-
  Users seeing Cloudflare Error 521 Web Server Is Down? Step-by-step resolution
  for Nginx, Apache, and origin firewall IP allowlists.
category: Systems & Servers
tags:
  - Cloudflare
  - Nginx
  - Apache
  - Sysadmin
readTime: 5 min
date: '2026-08-24'
---

Cloudflare **`Error 521: Web server is down`** means Cloudflare's edge proxy successfully resolved your DNS and reached your origin IP, but your origin server actively refused the TCP connection (`RST`) on port 80 or 443—either because the web server process stopped or a firewall rejected Cloudflare's IP ranges.

## Quick Diagnostics

| Symptom / Cause | Immediate Action |
|---|---|
| **Nginx / Apache crashed or stopped** | Check and restart: `sudo systemctl status nginx` |
| **Origin firewall (`ufw`/`iptables`/Security Group) blocks Cloudflare** | Allow Cloudflare IPv4/IPv6 ranges on ports 80 and 443 |
| **Cloudflare SSL set to `Full` / `Full (Strict)` without origin port 443** | Enable HTTPS listener on origin or install Cloudflare Origin CA cert |
| **Fail2ban or rate-limiter banned Cloudflare proxy IPs** | Whitelist Cloudflare IPs in `jail.local` and restore real visitor IP |

## Root Cause & Technical Mechanics

Unlike **Error 522** (TCP connection timeout, packets silently dropped) or **Error 520** (malformed HTTP response), **Error 521** is triggered specifically by an explicit TCP `RST` (Connection Refused) or immediate TLS/port rejection at the origin.

Commonly, one of three mechanics causes this:
1. **Dead or unbound web daemon:** Nginx, Apache, or Caddy crashed (often due to OOM) or is listening only on `127.0.0.1` instead of `0.0.0.0:443`.
2. **SSL mode mismatch:** Cloudflare's **SSL/TLS** mode is set to **Full** or **Full (Strict)**, causing Cloudflare to connect to origin port `443`, while your origin server only listens on port `80` (HTTP).
3. **Inadvertent IP blocking:** Because Cloudflare acts as a reverse proxy, all origin TCP connections originate from Cloudflare's edge IPs—not the visitor's IP. Without `mod_remoteip` or `ngx_http_realip_module`, Fail2ban or `iptables` rate-limiting sees thousands of requests from a single Cloudflare IP and bans it, triggering 521s for everyone routed through that edge node.

## Step-by-Step Solution

### Step 1: Verify the origin web server is running and listening

SSH into your origin server and confirm Nginx or Apache is active and bound to public interfaces on ports `80` and `443`:

```bash
sudo systemctl status nginx apache2 --no-pager
sudo ss -tulpn | grep -E ':80\b|:443\b'
```

If the service is stopped, inspect recent crash logs and restart it:

```bash
sudo journalctl -u nginx -n 40 --no-pager
sudo nginx -t && sudo systemctl restart nginx
```

Test locally on the origin itself to confirm both HTTP and HTTPS respond:

```bash
curl -Ik https://127.0.0.1 -H "Host: yourdomain.com"
```

### Step 2: Allow Cloudflare IP ranges in your firewall

If you restrict ports `80` and `443` by source IP (recommended for origin hardening), ensure every official Cloudflare IPv4 and IPv6 range is allowlisted. Check current UFW rules:

```bash
sudo ufw status numbered
```

You can fetch Cloudflare's current IPv4 list and allow ports `80,443` in UFW:

```bash
for ip in $(curl -s https://www.cloudflare.com/ips-v4); do
  sudo ufw allow proto tcp from "$ip" to any port 80,443 comment 'Cloudflare IPv4'
done
sudo ufw reload
```

Also verify cloud-level firewalls (AWS Security Groups, Hetzner Cloud Firewall, DigitalOcean Firewalls) allow inbound TCP `80` and `443` from Cloudflare.

### Step 3: Check Fail2ban and restore real visitor IPs

Check if Fail2ban accidentally jailed a Cloudflare edge IP:

```bash
sudo fail2ban-client status
```

To prevent this permanently in Nginx, configure `ngx_http_realip_module` in `/etc/nginx/conf.d/cloudflare-realip.conf` using `set_real_ip_from <cloudflare-cidr>;` and `real_ip_header CF-Connecting-IP;`, then reload Nginx.

### Step 4: Verify Cloudflare SSL/TLS encryption mode

In the **Cloudflare Dashboard** → **SSL/TLS** → **Overview**:
- If your origin has a valid Let's Encrypt or **Cloudflare Origin CA** certificate on port `443`, use **Full (Strict)**.
- If your origin only listens on port `80` temporarily, switching to **Flexible** will confirm whether port `443` rejection was causing the 521 (though you should install an Origin CA cert and return to **Full (Strict)** for production security).

## Frequently Asked Questions

**Why do I only see Error 521 intermittently or in certain regions?**
Intermittent 521s usually mean Fail2ban, ModSecurity, or an upstream rate-limiter banned *some* of Cloudflare's edge IP blocks while others remain unbanned. Whitelist all Cloudflare IPs in your security tools.

**How is Error 521 different from Error 522?**
Error 521 means the origin actively refused the connection (`TCP RST`). Error 522 means Cloudflare sent a `TCP SYN` and waited ~15 seconds without receiving a `SYN-ACK` (typically a `DROP` firewall rule or overloaded kernel listen backlog).

**Can I bypass Cloudflare to test if my origin is actually up?**
Yes. Run `curl -Iv --resolve yourdomain.com:443:YOUR_ORIGIN_IP https://yourdomain.com` from your local machine to test the origin directly without modifying DNS.

## Prevention Advice

- **Automate Cloudflare IP syncs:** Schedule a weekly cron job to refresh Cloudflare's `/ips-v4` and `/ips-v6` lists in UFW/iptables and Nginx `realip` configs.
- **Use Cloudflare Origin CA certificates:** They are free, valid for up to 15 years, and eliminate Let's Encrypt renewal failures behind proxied DNS.
- **Monitor origin memory:** Set up swap or systemd `Restart=on-failure` on `nginx`/`apache2` so traffic spikes do not leave the daemon dead after an OOM kill.
- **Always extract `CF-Connecting-IP`:** Configure your web server and WAF to inspect the real client IP rather than rate-limiting Cloudflare's proxy nodes.

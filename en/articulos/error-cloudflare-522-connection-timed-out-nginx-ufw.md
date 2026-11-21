---
title: Cloudflare Error 522 Connection Timed Out in Nginx and UFW
description: >-
  Technical guide to diagnosing and fixing Cloudflare Error 522 (Connection Timed Out) on Linux origin servers running Nginx, UFW, iptables, and TCP keepalive tuning.
category: Systems & Servers
tags:
  - Cloudflare
  - Nginx
  - UFW
  - Linux
readTime: 7 min
date: '2026-11-21'
---

**`Error 522: Connection timed out`** occurs when Cloudflare's edge proxy attempts to open or reuse a TCP connection to your origin server (usually on port `80` or `443`) and receives no response within the allowed timeout window. Unlike Error 521—where the origin actively refuses the connection with a `TCP RST` packet—Error 522 means `SYN` packets or HTTP requests are being silently dropped or stalled in a saturated queue.

## Quick Diagnostics

| Cause | Solution |
|---|---|
| **Cloudflare edge IPs blocked or rate-limited by UFW / Fail2Ban** | Whitelist official Cloudflare IPv4/IPv6 ranges on port `443` and restore real client IPs |
| **Exhausted Nginx `worker_connections` or low `keepalive_timeout`** | Increase `worker_connections`, kernel `somaxconn`, and set `keepalive_timeout 75s` |
| **Stale origin IP address in Cloudflare DNS records** | Verify the server's public IP with `curl -4 ifconfig.me` and update `A` / `AAAA` records |
| **Network interface stall or unresponsive upstream socket** | Inspect listening sockets with `ss -tulpn` and test direct origin reachability |

---

## Root Cause & Technical Mechanics of Error 522

Cloudflare enforces two strict timeout thresholds when communicating with your origin server:

1. **Initial TCP Handshake Timeout (15 seconds):** When a Cloudflare edge node sends a `TCP SYN` packet to your origin IP, it expects a `SYN-ACK` within 15 seconds. If a stateful firewall configured with a `DROP` policy (such as `UFW`, `iptables`, or cloud security groups) discards the packet silently, Cloudflare surfaces an `Error 522`.
2. **HTTP Response & Keepalive Timeout (90 seconds):** Once the TCP handshake succeeds, the origin must send the initial HTTP response bytes within 90 seconds. Additionally, if Nginx closes an idle `keepalive` socket aggressively while Cloudflare is simultaneously reusing it, a race condition occurs and the edge times out waiting for a reply.

### Common Production Triggers

* **Fail2Ban or Nginx rate-limiting false positives:** Without `set_real_ip_from` and `real_ip_header CF-Connecting-IP`, Nginx sees every visitor as coming from Cloudflare's edge IPs. Rate limiters (`limit_req_zone`) or Fail2Ban jails eventually ban Cloudflare itself.
* **Kernel `SYN` backlog saturation:** During traffic bursts, default Linux limits for `net.core.somaxconn` and `net.ipv4.tcp_max_syn_backlog` fill up rapidly, causing the kernel to silently drop incoming `SYN` packets from Cloudflare.

---

## Step-by-Step Solution on the Origin Server

### Step 1: Test Direct Origin Reachability Bypassing Cloudflare

From an external machine, test whether your origin responds directly on port `443` using `--resolve` to simulate the exact domain `Host` header:

```bash
curl -I --resolve soportecero.com:443:YOUR_ORIGIN_IP https://soportecero.com/
```

If this direct request hangs and times out, the issue lies in your hosting provider's network firewall, an incorrect DNS IP, or a stalled Nginx/application process. If it responds immediately with `200 OK`, your origin is specifically blocking or throttling Cloudflare's edge IPs.

### Step 2: Whitelist Official Cloudflare IP Ranges in UFW

Ensure no local firewall rule drops or rate-limits Cloudflare edge nodes. Allow all official Cloudflare IPv4 ranges on ports `80` and `443`:

```bash
for ip in $(curl -s https://www.cloudflare.com/ips-v4); do
  sudo ufw allow proto tcp from "$ip" to any port 80,443 comment 'Cloudflare Edge'
done
sudo ufw reload
```

If your DNS includes an `AAAA` record, repeat the loop against `https://www.cloudflare.com/ips-v6`.

### Step 3: Restore Visitor Real IPs in Nginx

Create `/etc/nginx/conf.d/cloudflare-realip.conf` so Nginx logs and rate-limits the actual end-user IP instead of Cloudflare's proxy addresses:

```nginx
set_real_ip_from 173.245.48.0/20;
set_real_ip_from 103.21.244.0/22;
set_real_ip_from 103.22.200.0/22;
set_real_ip_from 103.31.4.0/22;
set_real_ip_from 141.101.64.0/18;
set_real_ip_from 108.162.192.0/18;
set_real_ip_from 190.93.240.0/20;
set_real_ip_from 188.114.96.0/20;
set_real_ip_from 197.234.240.0/22;
set_real_ip_from 198.41.128.0/17;
real_ip_header CF-Connecting-IP;
```

Validate the configuration and reload Nginx:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Step 4: Tune Nginx Keepalive and Linux Kernel TCP Queues

Set a balanced `keepalive_timeout` in `/etc/nginx/nginx.conf` to prevent premature socket closures during Cloudflare connection reuse:

```nginx
keepalive_timeout 75s;
keepalive_requests 1000;
```

Then raise the kernel listen backlog in `/etc/sysctl.d/99-network-tuning.conf`:

```ini
net.core.somaxconn = 4096
net.ipv4.tcp_max_syn_backlog = 4096
```

Apply the kernel parameters immediately:

```bash
sudo sysctl --system
```

---

## Frequently Asked Questions

### What is the difference between Cloudflare Error 521 and Error 522?
In Error 521, the origin server actively refuses the connection by sending a `TCP RST` packet (usually because the web server daemon is stopped). In Error 522, the origin never responds within the 15-second TCP handshake or 90-second HTTP timeout window, typically due to silent firewall `DROP` rules or queue exhaustion.

### Does disabling the Cloudflare proxy (grey cloud) fix Error 522?
Switching to DNS-only mode bypasses Cloudflare's proxy layer, so the Cloudflare 522 error page disappears. However, if your origin firewall or web server is actually unreachable or overloaded, visitors will still encounter a browser-level `ERR_CONNECTION_TIMED_OUT`.

---

## Prevention Advice

* Automate weekly updates of Cloudflare's IP list in both your firewall and Nginx `set_real_ip_from` config via a scheduled cron job.
* Enable Cloudflare Authenticated Origin Pulls (mTLS) so your origin only accepts TLS handshakes from verified Cloudflare edge certificates.
* Monitor TCP socket states and listen-queue overflows using `ss -s` and `nstat -az TcpExtListenDrops` during traffic spikes.

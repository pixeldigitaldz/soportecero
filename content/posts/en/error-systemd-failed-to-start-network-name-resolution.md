---
title: "[SOLVED] Linux DNS Failure: 'Could not resolve host' / systemd-resolved"
description: "Learn how to repair broken DNS name resolution and systemd-resolved daemon failures in Ubuntu, Debian, and Arch Linux."
category: "Systems & Servers"
tags: ["systemd", "DNS", "Linux", "SysAdmin", "Ubuntu", "Networking"]
readTime: "5 min"
date: "2026-06-25"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Broken symlink at /etc/resolv.conf pointing to an inactive systemd-resolved stub file** | Recreate symlink pointing to `/run/systemd/resolve/stub-resolv.conf` or apply static nameservers |
| **systemd-resolved unit in failed state due to configuration errors or port 53 collision** | Restart daemon with `sudo systemctl restart systemd-resolved` and declare upstream DNS |

The systemic failure `Temporary failure in name resolution`, `Could not resolve host: google.com` or `Failed to start Network Name Resolution` in Linux occurs when the local domain resolver daemon or `/etc/resolv.conf` loses valid upstream nameserver configurations, halting outbound network connections requiring hostname resolution.

## 🚀 Step-by-Step Solution

### Step 1: Restore Immediate Connectivity via Static Nameservers
If your server cannot fetch packages due to missing nameservers, inject temporary fallback resolvers:
```bash
# Direct public Cloudflare and Google nameservers
echo -e "nameserver 1.1.1.1\nnameserver 8.8.8.8" | sudo tee /etc/resolv.conf
```
Verify connectivity:
```bash
ping -c 3 google.com
```

### Step 2: Reconstruct Official systemd-resolved Symlink
On modern Linux distributions, `/etc/resolv.conf` must link directly to the runtime stub resolver:
```bash
# 1. Remove broken symlink or stale file
sudo rm -f /etc/resolv.conf

# 2. Re-establish official stub symlink
sudo ln -s /run/systemd/resolve/stub-resolv.conf /etc/resolv.conf

# 3. Restart and enable resolver daemon
sudo systemctl restart systemd-resolved
sudo systemctl enable systemd-resolved
```

### Step 3: Configure Upstream Resolvers in resolved.conf
Open your master configuration file (`/etc/systemd/resolved.conf`):
```ini
[Resolve]
DNS=1.1.1.1 8.8.8.8
FallbackDNS=1.0.0.1 8.8.4.4
Domains=~.
DNSSEC=allow-downgrade
```
Restart daemon to load new nameserver bindings:
```bash
sudo systemctl restart systemd-resolved
```

### Step 4: Verify Resolution State with resolvectl
Confirm that active network interfaces hold valid DNS assignments:
```bash
# Query active DNS resolver telemetry
resolvectl status
```

## 🛡️ Prevention Advice
- **Prevent NetworkManager collisions:** Ensure NetworkManager delegates DNS lookups to systemd-resolved by adding `dns=systemd-resolved` in `/etc/NetworkManager/NetworkManager.conf`.
- **Lock resolv.conf during emergencies:** If third-party daemons keep overwriting your configuration, enforce immutability with `sudo chattr +i /etc/resolv.conf`.

## ❓ Frequently Asked Questions (FAQ)

### Why does ping 8.8.8.8 succeed while ping google.com fails?
Because low-level IP routing is functional, but the Application layer hostname-to-IP translation (DNS) subsystem is offline.

### What is the role of 127.0.0.53 in resolv.conf?
`127.0.0.53` is the local stub listener managed by systemd-resolved to provide local caching and DNSSEC validation.

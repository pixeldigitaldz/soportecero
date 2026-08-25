---
title: "How to Fix DNS_PROBE_FINISHED_NXDOMAIN Error in Your Local Network"
description: "Learn how to resolve DNS_PROBE_FINISHED_NXDOMAIN in Windows, Linux, and macOS by flushing DNS cache and switching DNS resolvers."
category: "Web & Code"
tags: ["DNS", "Networking", "Windows", "Linux", "Chrome", "SysAdmin"]
readTime: "5 min"
date: "2026-06-25"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Stale or corrupted DNS resolver cache in operating system or web browser** | Flush DNS cache via `ipconfig /flushdns` on Windows or `resolvectl flush-caches` on Linux |
| **ISP default DNS resolvers offline or failing hostname translation lookups** | Switch primary nameservers to Cloudflare (`1.1.1.1`) or Google (`8.8.8.8`) |

The error `DNS_PROBE_FINISHED_NXDOMAIN` (Non-Existent Domain) signifies that the Domain Name System resolver could not translate the requested hostname into a valid IP address. This typically arises from corrupted local DNS cache entries, outdated hostfile overrides, or upstream nameserver lookup failures.

## 🚀 Step-by-Step Solution

### Step 1: Flush Operating System DNS Cache
Purge stale IP records from local memory:
```bash
# On Windows (Admin Command Prompt):
ipconfig /flushdns

# On Linux (systemd-resolved):
sudo resolvectl flush-caches

# On macOS:
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
```

### Step 2: Clear Internal Browser Host Cache
Chromium-based browsers maintain independent DNS lookup caches:
1. Open your browser and navigate to `chrome://net-internals/#dns`.
2. Click **Clear host cache**.
3. Navigate to `chrome://net-internals/#sockets` and click **Flush socket pools**.

### Step 3: Switch to Reliable Public DNS Resolvers
Replace unresponsive ISP nameservers with high-performance Anycast resolvers:
- **Cloudflare DNS**: Primary `1.1.1.1` | Secondary `1.0.0.1`
- **Google Public DNS**: Primary `8.8.8.8` | Secondary `8.8.4.4`

On Linux, apply in `/etc/systemd/resolved.conf`:
```ini
[Resolve]
DNS=1.1.1.1 8.8.8.8
FallbackDNS=1.0.0.1 8.8.4.4
```
Restart daemon: `sudo systemctl restart systemd-resolved`.

### Step 4: Verify Local Hosts File Integrity
Ensure no stale testing records are hardcoded inside:
- Windows: `C:\Windows\System32\drivers\etc\hosts`
- Linux / macOS: `/etc/hosts`

## 🛡️ Prevention Advice
- **Enable DNS over HTTPS (DoH):** Protect DNS lookups against ISP transparent caching and DNS hijacking by enabling secure DNS in browser settings.
- **Audit domain propagation:** If you manage the domain, use tools like *whatsmydns.net* to verify authoritative A/CNAME record distribution.

## ❓ Frequently Asked Questions (FAQ)

### What does NXDOMAIN stand for?
NXDOMAIN stands for Non-Existent Domain, an RFC-standard response from authoritative nameservers indicating the requested host has no registered IP records.

### Can rebooting my router fix NXDOMAIN?
Yes. Residential routers cache local DNS responses. A power cycle clears corrupt gateway lookup tables.

---
title: 'Linux DNS Failure: ''Could not resolve host'' / systemd-resolved'
description: >-
  Learn how to repair broken DNS name resolution and systemd-resolved daemon
  failures in Ubuntu, Debian, and Arch Linux.
category: Systems & Servers
tags:
  - systemd
  - DNS
  - Linux
  - SysAdmin
  - Ubuntu
  - Networking
readTime: 5 min
date: '2026-06-25'
---

When Linux servers or workstations suddenly fail with `Temporary failure in name resolution`, `Could not resolve host`, or `Failed to start Network Name Resolution` (`systemd-resolved.service`), outbound connections by hostname break even though raw IP traffic still routes normally. Restoring DNS requires repairing the `/etc/resolv.conf` symlink, clearing port 53 collisions, and verifying upstream resolvers via `resolvectl`.

## Quick Diagnostics

| Cause | Symptom | Solution |
|---|---|---|
| **Broken `/etc/resolv.conf` symlink** | `ping 1.1.1.1` works; `ping google.com` fails | Relink `/etc/resolv.conf` to `/run/systemd/resolve/stub-resolv.conf` |
| **Port 53 listener conflict** | `systemd-resolved` fails with `Address already in use` | Stop `dnsmasq`/`bind9` or set `DNSStubListener=no` |
| **Empty or stale DHCP DNS leases** | `resolvectl status` shows no `Current DNS Server` | Configure `DNS=` and `FallbackDNS=` in `resolved.conf` |
| **Corrupted `nsswitch.conf` order** | `resolvectl query` works, but `curl` fails | Ensure `resolve [!UNAVAIL=return] dns` in `/etc/nsswitch.conf` |

## Root Cause & Technical Mechanics

Modern Ubuntu, Debian, and Arch systems route DNS lookups through two cooperating layers: the GNU C Library Name Service Switch (`/etc/nsswitch.conf`) and the `systemd-resolved` daemon.

By default, `systemd-resolved` binds a local caching stub listener on `127.0.0.53:53` and exposes its dynamically generated configuration at `/run/systemd/resolve/stub-resolv.conf` (or `resolv.conf` for direct upstream servers). When `/etc/resolv.conf` is replaced by a static file, deleted during a container build, or points to a stale target, glibc falls back to `127.0.0.1:53` or fails with `EAI_AGAIN` (`Temporary failure in name resolution`). Conversely, if `dnsmasq`, `pihole-FTL`, or `named` already binds `0.0.0.0:53`, `systemd-resolved` crashes on startup with `Failed to start Network Name Resolution` because its stub socket cannot bind port 53.

## Step-by-Step Solution

### Step 1: Inspect `systemd-resolved` Logs and Port 53 Bindings

Check the unit status and journal logs to see whether `systemd-resolved` is crashing or missing upstream servers:

```bash
sudo systemctl status systemd-resolved --no-pager
sudo journalctl -u systemd-resolved -n 30 --no-pager
sudo ss -tulnp | grep ':53 '
```

If another daemon (such as `dnsmasq`) holds port 53 and you intend to keep it, disable the systemd stub listener in `/etc/systemd/resolved.conf` (`DNSStubListener=no`) and point `/etc/resolv.conf` to `/run/systemd/resolve/resolv.conf`.

### Step 2: Restore Emergency Connectivity (If Downloading Packages)

If the machine is completely offline for DNS and you need to install missing packages first, inject temporary resolvers:

```bash
printf "nameserver 1.1.1.1\nnameserver 8.8.8.8\n" | sudo tee /etc/resolv.conf
```

### Step 3: Repair the `/etc/resolv.conf` Symlink and Upstream Resolvers

Remove any stale static file and recreate the canonical symlink to `systemd-resolved`:

```bash
sudo rm -f /etc/resolv.conf
sudo ln -s /run/systemd/resolve/stub-resolv.conf /etc/resolv.conf
```

Next, declare deterministic upstream and fallback resolvers in `/etc/systemd/resolved.conf` (or a drop-in `/etc/systemd/resolved.conf.d/dns.conf`):

```ini
[Resolve]
DNS=1.1.1.1 9.9.9.9
FallbackDNS=8.8.8.8 1.0.0.1
DNSSEC=allow-downgrade
```

Enable and restart the daemon:

```bash
sudo systemctl enable --now systemd-resolved
sudo systemctl restart systemd-resolved
```

### Step 4: Verify Resolution with `resolvectl` and `getent`

Confirm both the systemd resolver and glibc NSS stack resolve hostnames cleanly:

```bash
resolvectl status
resolvectl query github.com
getent hosts github.com
```

## Frequently Asked Questions

### Why does `ping 8.8.8.8` succeed while `ping google.com` fails?
`ping 8.8.8.8` tests Layer 3 IP routing directly without name lookup. When it succeeds while hostnames fail, your default gateway and NIC are healthy, and the fault lies strictly in DNS resolution (`/etc/resolv.conf`, `systemd-resolved`, or UDP/TCP port 53 firewall rules).

### What is `127.0.0.53` inside `/etc/resolv.conf`?
`127.0.0.53` is the loopback IP where `systemd-resolved` listens for local DNS queries, providing in-memory caching, per-interface split-DNS routing (for VPNs), and optional DNSSEC/DNS-over-TLS validation.

### Why did `resolvectl query` work while `curl` still failed?
`resolvectl` talks directly to `systemd-resolved` over D-Bus, whereas `curl` and `apt` use glibc's `getaddrinfo()`. If `/etc/nsswitch.conf` lacks `resolve` or `dns` on the `hosts:` line, applications fail even when `systemd-resolved` is healthy.

## Prevention Advice

- Configure NetworkManager to cooperate rather than compete by setting `dns=systemd-resolved` in `/etc/NetworkManager/NetworkManager.conf`.
- Use drop-in files under `/etc/systemd/resolved.conf.d/` instead of editing `/etc/systemd/resolved.conf` directly so package upgrades never overwrite your settings.
- In Docker or cloud-init templates, verify that `/etc/resolv.conf` is not overwritten with `127.0.0.53` inside chroot environments where `systemd-resolved` is not running.
- Allow outbound UDP and TCP port `53` (and TCP `853` if using DNS-over-TLS) in `ufw` or `nftables` egress rules.

---
title: 'Error: iptables failed: No chain/target/match by that name in Docker'
description: 'How to fix the Docker network error iptables failed No chain target match by that name when starting containers after restarting UFW or Firewalld.'
category: 'Systems & Servers'
date: '2026-08-23'
readTime: '3 min'
tags: ['Docker', 'Linux', 'Networking']
---

The error `iptables failed: iptables --wait -t nat -A DOCKER ... No chain/target/match by that name` occurs when the Linux firewall daemon (UFW, Firewalld, or raw iptables) is reloaded while the Docker daemon is running, flushing the active `DOCKER` and `DOCKER-USER` routing chains from the kernel NAT table.

When attempting to bind ports for a new container (`-p 8080:80`), Docker fails immediately because the required packet routing chains no longer exist.

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **UFW or Firewalld reloaded after Docker started** | Restart the Docker service with `sudo systemctl restart docker` |
| **Mismatch between iptables-legacy and nftables** | Switch active alternative with `sudo update-alternatives --config iptables` |
| **Missing kernel NAT routing modules** | Manually load modules using `sudo modprobe ip_tables && sudo modprobe iptable_nat` |

## Step-by-Step Solution

**Restart Docker daemon to restore NAT chains**
The most effective and immediate fix is restarting the Docker service so it can re-inject its network filtering rules:
```bash
sudo systemctl restart docker
```
Verify container launch:
```bash
docker compose up -d
```

**Order UFW and Docker service restarts**
If you frequently manage firewall rules with UFW on Ubuntu/Debian, always reload Docker immediately after modifying UFW:
```bash
sudo ufw reload && sudo systemctl restart docker
```

**Check iptables backend configuration**
On modern Linux distributions (Debian 12+, Ubuntu 24.04, RHEL 9), verify that iptables points to the consistent `iptables-nft` or `iptables-legacy` binary:
```bash
sudo update-alternatives --config iptables
```
Select the default option aligned with your distro standard.

**Load essential Linux networking kernel modules**
If running inside a cloud VPS or unprivileged Proxmox LXC container:
```bash
sudo modprobe ip_tables
sudo modprobe iptable_nat
sudo modprobe iptable_filter
```

## Prevention Tips
- **Use DOCKER-USER chain:** Never insert custom iptables rules directly into the `DOCKER` chain. Always place custom ingress restrictions inside `DOCKER-USER`.
- **Reverse proxy architecture:** Consider exposing only standard 80/443 ports via a dedicated reverse proxy (Nginx, Traefik, Caddy) rather than publishing dozens of arbitrary port bindings directly.

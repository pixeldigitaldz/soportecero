---
title: 'Error: iptables failed: No chain/target/match by that name in Docker'
description: 'How to fix the Docker network error iptables failed No chain target match by that name when starting containers after restarting UFW or Firewalld.'
category: 'Systems & Servers'
tags: ['Docker', 'Linux', 'Networking']
readTime: '5 min'
date: '2026-08-23'
---

The Docker engine error `iptables failed: iptables --wait -t nat -A DOCKER ...: iptables: No chain/target/match by that name` happens when the Linux firewall (`ufw`, `firewalld`, or a manual `iptables -F`) flushes the kernel's `nat` and `filter` tables while `dockerd` is still running, wiping out Docker's custom routing chains.

## Quick Diagnostics

| Symptom / Cause | Immediate Action |
|---|---|
| **Firewall reloaded (`ufw reload` / `firewalld`) after Docker boot** | Restart Docker daemon: `sudo systemctl restart docker` |
| **Distro upgraded to `nftables` while Docker expects `legacy`** | Align backend via `sudo update-alternatives --config iptables` |
| **Kernel NAT/netfilter modules missing (VPS/LXC)** | Load modules: `sudo modprobe iptable_nat xt_conntrack` |
| **Custom bridge network corrupted after crash** | Prune/recreate network after restarting `dockerd` |

## Root Cause & Technical Mechanics

When `dockerd` starts, it programmatically creates custom netfilter chains—specifically `DOCKER`, `DOCKER-ISOLATION-STAGE-1`, `DOCKER-ISOLATION-STAGE-2`, and `DOCKER-USER` in the `filter` table, plus the `DOCKER` chain in the `nat` table—to handle port publishing (`-p 8080:80`) and container masquerading.

Unlike `systemd` units that declare ordering dependencies, `ufw reload` or `systemctl restart firewalld` resets all netfilter chains to a clean baseline without notifying `dockerd`. Docker caches its internal network state in memory and assumes those chains still exist. When you subsequently run `docker compose up -d`, `dockerd` issues `iptables -t nat -A DOCKER -p tcp --dport 8080 ...`, the kernel rejects the append because the `DOCKER` chain is gone, and container startup aborts immediately.

## Step-by-Step Solution

### Step 1: Confirm the missing chains in the kernel tables

Inspect the `nat` and `filter` tables to verify whether the `DOCKER` chains were wiped:

```bash
sudo iptables -t nat -L DOCKER -n
sudo iptables -L DOCKER-USER -n
```

If either command returns `iptables: No chain/target/match by that name`, the firewall flush removed Docker's rules.

### Step 2: Restart the Docker daemon to re-inject chains

Restarting `dockerd` forces it to rebuild all bridge chains and port-forwarding rules for running containers:

```bash
sudo systemctl restart docker
```

Verify that the `DOCKER` chains are restored and launch your stack:

```bash
sudo iptables -t nat -L DOCKER -n
docker compose up -d
```

*(Note: If you use `firewalld` on RHEL/Fedora/Rocky, reload `firewalld` first, then restart `docker`: `sudo firewall-cmd --reload && sudo systemctl restart docker`.)*

### Step 3: Align `iptables-nft` vs `iptables-legacy` backend

On Debian 12+, Ubuntu 24.04, and Alpine/WSL2 environments, a mismatch between `iptables` CLI alternatives and kernel netfilter tables can also trigger this error. Check which backend is active:

```bash
iptables --version
sudo update-alternatives --config iptables
```

Select `iptables-nft` on modern kernels (5.10+) unless you are inside an older container host that strictly requires `iptables-legacy`, then restart `docker`.

### Step 4: Load missing kernel modules (VPS / Proxmox LXC)

If restarting Docker still fails with `No chain/target/match by that name`, check whether the required netfilter kernel modules are loaded:

```bash
sudo modprobe ip_tables
sudo modprobe iptable_nat
sudo modprobe iptable_filter
sudo modprobe xt_nat
sudo modprobe br_netfilter
lsmod | grep -E "iptable|br_netfilter|xt_nat"
```

Persist them across reboots by adding their names to `/etc/modules-load.d/docker-net.conf`.

## Frequently Asked Questions

**Does `sudo systemctl restart docker` stop my running containers?**
Yes, unless you have `"live-restore": true` enabled in `/etc/docker/daemon.json`. With `live-restore`, `dockerd` restarts without terminating running container processes, though brief network re-initialization still occurs.

**Why does UFW bypass my rules for Docker containers even when UFW is enabled?**
Docker inserts DNAT rules into the `PREROUTING` and `DOCKER` chains, which evaluate before UFW's `INPUT` chain. To restrict access to published container ports, place rules in the `DOCKER-USER` chain or bind ports to `127.0.0.1:8080:80`.

**Can I disable Docker's iptables management completely?**
You can set `"iptables": false` in `/etc/docker/daemon.json`, but doing so breaks outbound NAT and `-p` port publishing for containers unless you manually write every masquerade and forwarding rule yourself.

## Prevention Advice

- **Chain your firewall reloads:** Always run `sudo ufw reload && sudo systemctl restart docker` (or use a systemd `PartOf=firewalld.service` drop-in) so Docker never runs against flushed tables.
- **Put custom rules in `DOCKER-USER`:** Docker explicitly preserves `DOCKER-USER` on startup; never insert custom rules directly into the `DOCKER` chain.
- **Bind internal services to localhost:** Use `127.0.0.1:PORT:PORT` behind a reverse proxy (Nginx, Caddy, or Traefik) to minimize raw `nat` chain churn.
- **Keep `iptables` consistent:** Ensure `iptables` and `ip6tables` point to the same backend (`nft` or `legacy`).

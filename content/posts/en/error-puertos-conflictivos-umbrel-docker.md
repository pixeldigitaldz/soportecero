---
title: How to Resolve Port Conflict Errors in Umbrel OS and Docker
description: >-
  Learn how to resolve port binding errors when installing custom containers or
  services that clash with Umbrel's default web proxy.
category: Systems & Servers
tags:
  - Docker
  - Umbrel
  - Sysadmin
readTime: 5 min
date: '2026-07-27'
---

The Docker error `Bind for 0.0.0.0:80 failed: port is already allocated` (or `listen tcp4 :80: bind: address already in use`) on **Umbrel OS** occurs when a custom container or host service tries to claim ports `80`, `443`, or `53` that Umbrel's core web proxy and DNS stack already hold.

## Quick Diagnostics

| Symptom / Cause | Immediate Action |
|---|---|
| **Custom container maps `- "80:80"` or `- "443:443"`** | Remap host side in `docker-compose.yml` (e.g., `"8085:80"`) |
| **Two Umbrel apps requesting the same host port** | Inspect `docker ps` ports and reassign the custom app |
| **Host `nginx` or `apache2` installed alongside Umbrel** | Stop/disable conflicting host daemon (`sudo systemctl disable --now nginx`) |
| **Port 53 conflict with Pi-hole / AdGuard Home** | Disable `DNSStubListener` in `/etc/systemd/resolved.conf` |

## Root Cause & Technical Mechanics

Umbrel OS runs an integrated reverse proxy and authentication gateway on the host's TCP ports `80` and `443` to serve the Umbrel dashboard (`umbrel.local`) and route traffic to installed apps over internal Docker bridge networks. Each official Umbrel app inside `~/umbrel/app-data/` is assigned a unique internal port by the Umbrel app manager to avoid collisions.

When you manually deploy a third-party `docker-compose.yml` stack (such as Portainer, Nginx Proxy Manager, or a custom web app) with standard `ports: - "80:80"`, the Linux kernel's network stack rejects the `bind()` syscall because `0.0.0.0:80` already has an active listening socket owned by Umbrel's proxy or another container. Similarly, deploying DNS sinks like AdGuard Home on port `53` often collides with `systemd-resolved`'s local stub listener on `127.0.0.53:53`.

## Step-by-Step Solution

### Step 1: Identify the exact process or container holding the port

Connect to your Umbrel node over SSH and inspect both host sockets and Docker port mappings:

```bash
sudo ss -tulpn | grep -E ':80\b|:443\b|:8080\b'
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

Note which process owns the port. If it belongs to `umbrel` or `app_proxy`, **do not kill it**—doing so will break your Umbrel dashboard and app routing.

### Step 2: Remap the host port in your custom `docker-compose.yml`

In Docker Compose port syntax (`HOST_PORT:CONTAINER_PORT`), only the left-hand side binds to the Umbrel host. Keep the container's internal port unchanged and move the host port to an unused high port (such as `8085` or `8443`):

```yaml
services:
  custom-web:
    image: nginx:alpine
    container_name: custom-web
    restart: unless-stopped
    ports:
      - "8085:80"
      - "8443:443"
    networks:
      - custom_isolated_net

networks:
  custom_isolated_net:
    driver: bridge
```

If you are fixing a port `53` DNS conflict for a custom Pi-hole/AdGuard container, bind only to your Umbrel's LAN IP (e.g., `192.168.1.50:53:53/udp`) or disable `systemd-resolved`'s stub listener cleanly.

### Step 3: Recreate the stack and verify port binding

Apply the updated Compose file and confirm the container starts without errors:

```bash
docker compose down
docker compose up -d
docker compose ps
```

Verify the new port is listening and serving HTTP traffic:

```bash
curl -I http://localhost:8085
```

## Frequently Asked Questions

**Can I change Umbrel's own dashboard port away from 80?**
It is strongly discouraged. Umbrel's `umbrel-os` scripts and app store updates expect the core proxy on ports 80/443 and will overwrite manual edits during OS updates. Always move your custom container's host port instead.

**What if I need a custom container accessible on port 80 with a domain name?**
Keep the custom container on an unprivileged port like `127.0.0.1:8085:80`, or run a dedicated reverse proxy (like Cloudflare Tunnel `cloudflared` or Tailscale Serve) that forwards external HTTPS traffic directly to `localhost:8085` without touching host port `80`.

**Why does `docker ps` show a port conflict even after I stopped the old container?**
Check for `docker-proxy` zombie processes or another stopped/restarting Compose project still reserving the port. Run `docker ps -a` and `sudo ss -tulpn | grep <port>` to spot lingering listeners.

## Prevention Advice

- **Maintain a port registry:** Keep a simple note or comment block listing every custom host port (`8085`, `8090`, `9443`) you assign outside Umbrel's App Store.
- **Bind internal services to `127.0.0.1`:** If a container only needs to be reached via Cloudflare Tunnel or a local reverse proxy, use `"127.0.0.1:8085:80"` instead of exposing `0.0.0.0`.
- **Use isolated bridge networks:** Declare a dedicated `bridge` network per custom stack rather than attaching containers to Umbrel's internal `umbrel_main_network`.
- **Back up custom Compose files outside `~/umbrel`:** Store custom stacks in `~/custom-stacks/` so Umbrel OS upgrades never touch them.

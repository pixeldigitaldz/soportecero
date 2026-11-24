---
title: Cloudflare Tunnel Error 502 Bad Gateway in cloudflared and Docker
description: >-
  Technical guide to fix Error 502 Bad Gateway and Unable to reach the origin service in Cloudflare Tunnel (cloudflared) with Docker, local HTTPS, and Nginx.
category: Systems & Servers
tags:
  - Cloudflare
  - Cloudflared
  - Docker
  - Nginx
readTime: 7 min
date: '2026-11-23'
---

An **`Error 502 Bad Gateway`** behind **Cloudflare Tunnel (`cloudflared`)**—often paired in logs with `Unable to reach the origin service` or `connection refused`—means Cloudflare's edge can reach your `cloudflared` daemon, but `cloudflared` **cannot connect to your local origin service**. Unlike external firewall 522 errors, this failure happens entirely inside your local host or Docker network.

## Quick Diagnostics

| Cause | Solution |
|---|---|
| **`cloudflared` in Docker pointing to `localhost` or `127.0.0.1`** | Point to the Docker service name (e.g., `http://nginx:80`) on a shared bridge network |
| **Self-signed local HTTPS certificate rejected (`x509`)** | Switch origin URL to internal `http://` or enable `noTLSVerify: true` |
| **Origin virtual host expects a specific `Host` header** | Set `httpHostHeader` or `originServerName` in the tunnel ingress rule |
| **Service bound only to IPv6 (`[::1]`) or wrong container port** | Inspect listening sockets with `ss -tulpn` and use the internal container port |

---

## How `cloudflared` Routing Works and Why 502 Happens

When a visitor hits your domain, Cloudflare routes the request over an encrypted tunnel to your `cloudflared` daemon. From there, `cloudflared` acts as a local reverse proxy and opens a connection to the origin URL defined in your **Public Hostname** (such as `http://localhost:8080` or `https://app:443`).

Three root causes account for almost all `502 Bad Gateway` errors in tunnel setups:

1. **Docker network isolation:** When `cloudflared` runs inside a Docker bridge container, `localhost` refers to the `cloudflared` container itself—not the host machine or sibling containers.
2. **Strict origin TLS verification:** If the tunnel target uses `https://` against a local service with a self-signed or mismatched certificate (such as Proxmox, Portainer, or internal Nginx), `cloudflared` aborts with `x509: certificate signed by unknown authority` and returns `502`.
3. **Host port vs. container port confusion:** In Docker Compose, if a service maps `8080:3000`, other containers on the Docker network must connect to internal port **`3000`**, not `8080`.

---

## Step-by-Step Solution for Cloudflared and Docker

### Step 1: Read the Exact Origin Failure in `cloudflared` Logs

Inspect the daemon logs to see whether the failure is TCP connection refusal or TLS validation:

```bash
# If running cloudflared as a Linux systemd service:
sudo journalctl -u cloudflared -n 50 --no-pager

# If running cloudflared inside Docker:
docker logs --tail 50 cloudflared
```

Look for `ERR` lines such as `dial tcp 127.0.0.1:8080: connect: connection refused` (network/port mismatch) or `x509` / `remote error: tls` (local TLS certificate rejection).

### Step 2: Place `cloudflared` and Your App on a Shared Docker Network

Ensure `cloudflared` and the target container share a user-defined bridge network, and configure the tunnel origin using the **service name and internal port**:

```yaml
services:
  cloudflared:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel run
    environment:
      - TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN}
    networks:
      - tunnel_net

  app:
    image: nginx:alpine
    # Internal port is 80; in Cloudflare Zero Trust set origin to: http://app:80
    networks:
      - tunnel_net

networks:
  tunnel_net:
    driver: bridge
```

In **Cloudflare Zero Trust → Networks → Tunnels → Public Hostname**, update the origin service URL from `http://localhost:8080` to **`http://app:80`**.

### Step 3: Fix `x509` TLS Errors on Local HTTPS Origins (Proxmox, Portainer, Nginx)

If your local backend requires HTTPS with a self-signed certificate (e.g., Proxmox on `:8006` or Portainer on `:9443`):

1. **Cloud-managed tunnel:** Open your Public Hostname → **Additional application settings → TLS** → enable **No TLS Verify**.
2. **Locally-managed `config.yml`:** Add `noTLSVerify: true` under `originRequest`:

```yaml
tunnel: YOUR-TUNNEL-ID
credentials-file: /etc/cloudflared/YOUR-TUNNEL-ID.json

ingress:
  - hostname: panel.yourdomain.com
    service: https://127.0.0.1:8006
    originRequest:
      noTLSVerify: true
      httpHostHeader: panel.yourdomain.com
  - service: http_status:404
```

Restart the service to apply changes:

```bash
sudo systemctl restart cloudflared
```

### Step 4: Verify Reachability from the Same Network Context as `cloudflared`

Test the exact origin URL from the environment where `cloudflared` runs:

```bash
# Native Linux host:
curl -I http://127.0.0.1:3000

# Inside Docker network:
docker exec cloudflared wget -qO- --spider http://app:80 && echo "OK"
```

---

## Frequently Asked Questions

### Is `http://` between `cloudflared` and my local container insecure?
No, as long as both run on the same host or private Docker network. Traffic from visitors to `cloudflared` remains end-to-end encrypted over Cloudflare's tunnel; the final hop (`http://app:80`) stays strictly local and avoids unnecessary self-signed TLS errors.

### Why do I get a 502 when the app works fine via `http://SERVER_IP:PORT` in my browser?
Your browser connects through the host-mapped port (e.g., `8080`), whereas a containerized `cloudflared` needs the container service name and internal listening port (e.g., `3000`), or your app is bound only to `127.0.0.1` instead of `0.0.0.0`.

---

## Prevention Advice

* Use explicit service names on a dedicated Docker bridge network (`tunnel_net`) instead of exposing unnecessary host ports to the public internet.
* Set `httpHostHeader` whenever forwarding tunnel traffic to name-based VirtualHosts in Nginx or Apache.
* Keep `cloudflared` updated periodically (`cloudflared version`) to retain QUIC/HTTP2 protocol compatibility with Cloudflare's edge.

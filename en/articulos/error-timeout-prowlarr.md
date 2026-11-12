---
title: How to Fix Timeout and Connection Failures in Prowlarr with Private Indexers
description: >-
  Learn how to fix HTTP timeout errors (Request timed out) in Prowlarr and Radarr.
  Deploy FlareSolverr proxies, configure Docker container DNS, and adjust HTTP timeout thresholds.
category: Systems & Servers
tags:
  - Prowlarr
  - Radarr
  - Docker
  - Linux
  - Networking
readTime: 5 min
date: '2026-07-27'
---

Encountering an `HTTP request timed out` or `Resource temporarily unavailable: Test failed for Indexer` error when connecting **Prowlarr**, **Radarr**, or **Sonarr** to private torrent trackers or Usenet indexers is a common issue in automated home media lab configurations.

When Prowlarr attempts to test an indexer or dispatch automated search queries, the connection is aborted if an HTTP response is not returned within the application's default deadline (typically 30 seconds). This latency or total rejection stems from three primary infrastructure issues:
1. **Cloudflare Anti-Bot Challenges:** The target tracker has enabled Cloudflare Turnstile, JavaScript challenges, or DDoS protection, silently dropping raw automated API queries from Prowlarr's user-agent.
2. **Docker Internal DNS Latency:** Docker's embedded DNS server (`127.0.0.11`) experiences upstream query timeouts resolving international tracker top-level domains.
3. **VPN Routing / Split Tunneling Collisions:** When Prowlarr is routed through a VPN container (such as Gluetun), misconfigured MTU packet sizes or DNS leaks stall TCP handshakes.

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Indexer protected by Cloudflare Turnstile or Cloudflare DDoS challenge** | Deploy a **FlareSolverr** proxy container and link via Prowlarr Indexer Proxy |
| **Prowlarr default 30-second timeout too short for saturated trackers** | Increase `HTTP Timeout` to 60 or 90 seconds in Prowlarr Settings > General |
| **Docker embedded DNS failing to resolve tracker hostnames** | Specify explicit upstream DNS servers (`1.1.1.1`, `8.8.8.8`) in `docker-compose.yml` |
| **VPN network interface dropping fragmented packets** | Tune WireGuard/OpenVPN MTU in Gluetun (`FIREWALL_OUTBOUND_SUBNETS`) |

## 🚀 Step-by-Step Implementation Guide

### Step 1: Deploy FlareSolverr to Bypass Cloudflare Protection
If your indexer works in a standard web browser but fails inside Prowlarr with HTTP 403 or Timeout, Cloudflare's bot management is challenging the connection. Deploy **FlareSolverr**, a headless browser proxy that solves JavaScript challenges and passes session cookies back to Prowlarr:

Add FlareSolverr to your `docker-compose.yml` file:
```yaml
services:
  flaresolverr:
    image: ghcr.io/flaresolverr/flaresolverr:latest
    container_name: flaresolverr
    environment:
      - LOG_LEVEL=info
      - CAPTCHA_SOLVER=none
      - TZ=UTC
    ports:
      - "8191:8191"
    restart: unless-stopped
    networks:
      - media-network
```
Bring the service up:
```bash
docker compose up -d flaresolverr
```

### Step 2: Configure the Proxy in the Prowlarr Dashboard
1. Open the Prowlarr web interface (`http://localhost:9696`).
2. Navigate to **Settings** > **Indexers**.
3. Under the **Indexer Proxies** section, click the **+ (Add)** button and select **FlareSolverr**.
4. Configure the parameters:
   - **Name:** `FlareSolverr Proxy`
   - **Host:** `http://flaresolverr:8191` (if running in the same Docker network) or `http://<host-ip>:8191`
   - **Tags:** Enter a custom tag, such as `flaresolverr`.
5. Click **Test** to verify connection, then click **Save**.
6. Open your failing indexer's settings and add the `flaresolverr` tag to its configuration so all traffic routes through the headless solver.

### Step 3: Configure Explicit DNS in Docker Compose
If the indexer timeout occurs before reaching the tracker's servers, Docker's internal DNS resolver (`127.0.0.11`) may be failing to resolve public domain records through your local router:
```yaml
services:
  prowlarr:
    image: lscr.io/linuxserver/prowlarr:latest
    container_name: prowlarr
    dns:
      - 1.1.1.1
      - 8.8.8.8
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=UTC
    networks:
      - media-network
```
Restart the container with `docker compose up -d --force-recreate prowlarr`.

### Step 4: Increase Prowlarr System HTTP Timeout Settings
For heavily congested private trackers or slow overseas mirrors:
1. In Prowlarr, go to **Settings** > **General**.
2. Toggle on **Show Advanced**.
3. Locate the **HTTP Timeout** setting under the **Proxy & Networking** section.
4. Increase the timeout from `30` seconds to `60` or `90` seconds.
5. Click **Save Changes**.

## 🛡️ Production Best Practices & Network Stability
- **Isolate FlareSolverr Usage via Tags:** Do not apply the FlareSolverr proxy globally to every indexer. Running every search query through a headless Chromium instance increases CPU utilization and memory overhead. Tag only indexers that actively enforce Cloudflare challenges.
- **Ensure Proper Subnet Routing with VPNs:** If Prowlarr routes through a VPN container like **Gluetun**, make sure your local LAN subnets (e.g., `192.168.1.0/24`) are added to the VPN firewall's inbound/outbound exceptions so Sonarr and Radarr can communicate with Prowlarr over the local network.

## Frequently Asked Questions (FAQ)

### Why does FlareSolverr log 'Challenge not detected' when an indexer times out?
If FlareSolverr reports that no challenge was detected yet Prowlarr times out, the tracker is either undergoing server maintenance, experiencing downtime, or blocking the VPN IP address range assigned by your provider.

### How do I test indexer connectivity from inside the Prowlarr container?
Open a terminal inside the container: `docker exec -it prowlarr curl -Iv https://tracker-domain.com`. This immediately isolates whether the timeout is caused by DNS resolution, TLS handshakes, or application logic.

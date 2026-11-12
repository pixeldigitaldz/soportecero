---
title: How to Fix Connection Refused Error Between Prowlarr and qBittorrent in Docker
description: >-
  Technical guide to resolving the 'Connection Refused' error between Prowlarr and qBittorrent in Docker Compose, bridge networks, and Gluetun VPN stacks.
category: Web & Code
tags:
  - Prowlarr
  - Docker
  - qBittorrent
readTime: 8 min
date: '2026-07-27'
---

When configuring qBittorrent as a Download Client in Prowlarr (or companion `*arr` applications like Sonarr and Radarr), clicking the **Test** button frequently fails with one of the following error messages:

```text
Test failed: Unable to connect to qBittorrent, Connection refused (127.0.0.1:8080)
```
or:
```text
Test failed: Resource temporarily unavailable (qbittorrent:8080) / Connection refused
```

This failure rarely indicates that qBittorrent has crashed. Instead, it stems from architectural boundaries in Docker's virtual networking model, WebUI security mechanisms (Cross-Site Request Forgery and Host header validation) in modern qBittorrent releases, or VPN routing layers (such as Gluetun) where container network stacks are shared.

---

## Architectural Analysis and Root Cause

To establish a reliable TCP connection between both containers, it is critical to trace how Docker handles internal packet routing, network namespaces, and service discovery:

1. **The `localhost` / `127.0.0.1` Pitfall in Containerized Environments:** Every Docker container is provisioned with an isolated Network Namespace. When you enter `localhost:8080` in Prowlarr's configuration, Prowlarr attempts to bind a socket to its own internal loopback interface (`lo`). Because qBittorrent is running in an entirely separate namespace, nothing is listening on port 8080 within Prowlarr's container, causing the Linux kernel to immediately return a TCP RST packet (`ECONNREFUSED`).
2. **Default Bridge vs User-Defined Bridge Networks:** Containers started via `docker run` without custom network parameters attach to Docker's default `bridge`. Within this legacy default network, Docker's embedded DNS server (`127.0.0.11`) **is disabled**. Automatic service discovery by container name is exclusively supported on custom user-defined bridge networks created via `docker compose` or `docker network create`.
3. **qBittorrent WebUI Security Policies:** Contemporary qBittorrent builds enforce CSRF protection and Host header validation. When an automated service like Prowlarr sends an HTTP request with `Host: qbittorrent:8080` without an established session token, qBittorrent's embedded web server rejects the call or drops the connection unless local subnet exceptions are explicitly configured.
4. **Shared Network Stacks via VPN (Gluetun):** In privacy-focused homelab architectures, qBittorrent often shares the network namespace of a VPN container (`network_mode: "service:gluetun"`). In this configuration, qBittorrent lacks an independent virtual Ethernet interface (`eth0`) and has no addressable DNS hostname of its own. Other containers must communicate through the VPN service name (`gluetun`), and WebUI ports must be bound to the VPN container.

---

## Laboratory Diagnosis and Inspection

Use this diagnostic matrix to pinpoint your specific failure mode:

| Error Symptom in Prowlarr | Identified Root Cause | Technical Resolution |
|---|---|---|
| `Connection refused (127.0.0.1:8080)` | Loopback address specified instead of Docker internal DNS name. | Set Host to `qbittorrent` (or `gluetun`) in Prowlarr settings. |
| `Name or service not known: qbittorrent` | Containers belong to isolated Docker networks or default bridge network. | Join both containers to a common user-defined bridge network in `docker-compose.yml`. |
| `Connection refused` (qBittorrent routed via Gluetun) | Prowlarr targets `qbittorrent:8080` while the network stack belongs to `gluetun`. | Point Host to `gluetun` and expose port `8080:8080` under the Gluetun service. |
| `Unauthorized / Test failed: Unauthorized` | Incorrect credentials or subnet authentication enforcement in qBittorrent. | Whitelist Docker internal subnets in qBittorrent or reset WebUI credentials. |
| `403 Forbidden` / Connection drops | CSRF protection or Host header validation active in qBittorrent WebUI. | Disable Host header validation and CSRF for local subnets in `qBittorrent.conf`. |

### Network Inspection Commands

Run these commands on the Docker host to verify network membership and test TCP socket reachability:

```bash
# 1. Inspect Docker network assignments for both containers
docker inspect -f '{{json .NetworkSettings.Networks}}' prowlarr | jq .
docker inspect -f '{{json .NetworkSettings.Networks}}' qbittorrent | jq .

# 2. Test DNS resolution and TCP port reachability from inside Prowlarr
docker exec -it prowlarr nc -zv qbittorrent 8080
# Or using curl:
docker exec -it prowlarr curl -I -m 5 http://qbittorrent:8080/api/v2/app/webapiVersion

# 3. Verify listening ports inside the qBittorrent container
docker exec -it qbittorrent ss -tulpn
```

---

## Step-by-Step Implementation Guide

### Step 1: Configure a Shared Bridge Network in Docker Compose

When running Prowlarr and qBittorrent within the same Compose project, establish a dedicated bridge network:

```yaml
version: '3.8'

services:
  qbittorrent:
    image: lscr.io/linuxserver/qbittorrent:latest
    container_name: qbittorrent
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=UTC
      - WEBUI_PORT=8080
    ports:
      - "8080:8080"
      - "6881:6881"
      - "6881:6881/udp"
    volumes:
      - ./qbittorrent/config:/config
      - /data/torrents:/downloads
    networks:
      - arr-net
    restart: unless-stopped

  prowlarr:
    image: lscr.io/linuxserver/prowlarr:latest
    container_name: prowlarr
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=UTC
    ports:
      - "9696:9696"
    volumes:
      - ./prowlarr/config:/config
    networks:
      - arr-net
    restart: unless-stopped

networks:
  arr-net:
    name: arr-net
    driver: bridge
```

If the applications reside in separate `docker-compose.yml` stacks, create an external network on the host:

```bash
# Create shared bridge network once
docker network create arr-net
```

Then reference it in both Compose files:

```yaml
networks:
  arr-net:
    external: true
```

### Step 2: Disable CSRF and Host Header Validation in qBittorrent

1. Open the qBittorrent WebUI in your browser (`http://HOST_IP:8080`).
2. Navigate to **Options** (gear icon or `Alt+O`) > **Web UI** tab.
3. In the **Security** section, uncheck:
   * **Enable Cross-Site Request Forgery (CSRF) protection**.
   * **Enable Host header validation**.
4. In the field **Bypass authentication for clients on local subnets**, enter Docker's internal subnet pools:
   ```text
   172.16.0.0/12, 192.168.0.0/16, 10.0.0.0/8
   ```
5. Save your settings. If the WebUI is inaccessible, stop the container and edit `qBittorrent.conf` directly:

```ini
[Preferences]
WebUI\CSRFProtection=false
WebUI\HostHeaderValidation=false
WebUI\LocalHostAuth=false
WebUI\AuthSubnetWhitelist=172.16.0.0/12, 192.168.0.0/16
```

### Step 3: Configure Download Client Settings in Prowlarr

1. Access the Prowlarr web interface (`http://HOST_IP:9696`).
2. Go to **Settings** > **Download Clients** > click **+** and select **qBittorrent**.
3. Fill in the connection parameters:
   * **Name:** `qBittorrent`
   * **Enable:** Checked
   * **Host:** `qbittorrent` (exact Docker service or container name)
   * **Port:** `8080` (internal WebUI port)
   * **Use SSL:** Unchecked
   * **Username:** Configured qBittorrent username (default: `admin`)
   * **Password:** Configured password
4. Click **Test**. You should receive a green confirmation banner. Click **Save**.

---

## Edge Case Troubleshooting

### Edge Case 1: qBittorrent Routed Through Gluetun VPN

When qBittorrent routes traffic through Gluetun using `network_mode: "service:gluetun"`:

1. qBittorrent **cannot publish its own ports**; all port bindings must be declared under `gluetun`.
2. Communication must target the `gluetun` service name rather than `qbittorrent`.

**Production Compose Configuration:**

```yaml
services:
  gluetun:
    image: qmcgaw/gluetun
    container_name: gluetun
    cap_add:
      - NET_ADMIN
    devices:
      - /dev/net/tun:/dev/net/tun
    ports:
      - "8080:8080" # qBittorrent WebUI bound to Gluetun
      - "6881:6881"
      - "6881:6881/udp"
    environment:
      - VPN_SERVICE_PROVIDER=airvpn
      - VPN_TYPE=wireguard
    networks:
      - arr-net

  qbittorrent:
    image: lscr.io/linuxserver/qbittorrent:latest
    container_name: qbittorrent
    network_mode: "service:gluetun"
    depends_on:
      - gluetun
    volumes:
      - ./qbittorrent/config:/config
      - /data/torrents:/downloads
```

**Prowlarr Configuration Adjustment:** Set **Host** to `gluetun` and **Port** to `8080`.

---

## Frequently Asked Questions

### Why do I get Connection Refused when the WebUI opens fine in my desktop browser?
Your desktop browser reaches qBittorrent via your LAN IP and the host's forwarded port (`http://192.168.1.50:8080`). Prowlarr runs within an isolated container network. Attempting to use `localhost` or LAN IPs without proper NAT hairpinning causes the connection to fail.

### Is it safe to disable CSRF protection on the qBittorrent WebUI?
Yes, provided the WebUI is not forwarded directly to the public Internet via router port forwarding. Within an isolated Docker bridge network or behind a reverse proxy with authentication, disabling CSRF is the standard operational pattern required by REST API integrations.

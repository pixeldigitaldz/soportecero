---
title: "How to Fix Connection Refused Error Between Prowlarr and qBittorrent in Docker"
description: "Learn how to resolve the 'Connection Refused' error by configuring Docker's internal networks correctly for your automation applications."
category: "Web & Code"
tags: ["Prowlarr", "Docker", "qBittorrent"]
readTime: "4 min"
date: "2026-07-27"
---

The `Connection Refused` or `Test failed: Connection refused` error when trying to link Prowlarr to qBittorrent in Docker occurs because both services run in isolated containers that do not share the same virtual logical Docker network, or because qBittorrent rejects external requests due to incorrect WebUI API access settings.

## 🚀 Step-by-Step Solution

### Step 1: Configure a shared network in your Docker Compose file
If your containers cannot resolve each other using their service names, define a dedicated bridge network in your `docker-compose.yml` file:
```yaml
# Define a common bridge network in your compose
networks:
  arr-network:
    driver: bridge
```
Ensure both the `prowlarr` and `qbittorrent` services are assigned to this network:
```yaml
services:
  prowlarr:
    ...
    networks:
      - arr-network
  qbittorrent:
    ...
    networks:
      - arr-network
```

### Step 2: Disable CSRF protection and bypass local authentication in qBittorrent
qBittorrent's security engine will block API calls originating from other containers within the private network unless you configure WebUI access rules:
1. Log in to the qBittorrent WebUI.
2. Go to **Options** > **WebUI**.
3. Uncheck the box **Enable Cross-Site Request Forgery (CSRF) protection**.
4. In the field **Bypass authentication for clients on local subnets**, enter your Docker network subnets:
```plaintext
172.16.0.0/12, 192.168.0.0/16
```

### Step 3: Use the container service name as the host address
When configuring the Torrent client inside the Prowlarr panel, never use `localhost` or `127.0.0.1`. Instead, enter the exact Docker container service name:
```plaintext
Host: qbittorrent
Port: 8080
```

## 🛡️ Prevention Advice
Recommended security practices:
- Do not expose your qBittorrent WebUI or Prowlarr API ports directly to the public Internet without a strong, custom access password. If you want remote access to your services, deploy a secure VPN tunnel (such as WireGuard or Tailscale) instead of executing port forwarding rules on your home router, securing your downloads from unauthorized access.

---
title: "Fix: Error starting userland proxy: bind: address already in use in Docker"
description: "Learn how to find and terminate processes occupying conflicting network ports (80, 443, 3000, 8080) in Linux and Docker Compose."
category: "Systems & Servers"
tags: ["Docker", "Linux", "Ports", "SysAdmin", "Networking", "DevOps"]
readTime: "5 min"
date: "2026-06-25"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Host system daemon (e.g. Apache, Nginx, or Node.js) already listening on target port** | Identify process PID using `sudo lsof -i :<port>` or `ss -tulpn` and terminate service |
| **Orphaned Docker container or stale userland proxy retaining port allocation** | Stop container via `docker stop <id>` or restart Docker daemon `systemctl restart docker` |

When launching containers via `docker run` or `docker compose up`, the exception `driver failed programming external connectivity on endpoint ...: Error starting userland proxy: listen tcp 0.0.0.0:80: bind: address already in use` indicates the requested host TCP port is already allocated by an active process.

## 🚀 Step-by-Step Solution

### Step 1: Discover Blocking Process PID
Pinpoint the exact application binding the port:
```bash
# Method 1: Using lsof (example inspecting port 80)
sudo lsof -i :80

# Method 2: Using socket statistics (ss)
sudo ss -tulpn | grep :80
```

### Step 2: Terminate or Stop the Conflicting Host Service
If a native host service is binding the port:
```bash
# If Apache or Nginx is installed on host:
sudo systemctl stop nginx
sudo systemctl stop apache2

# If occupied by an unmanaged binary, terminate via PID:
sudo kill -15 <PID>
# Force kill if unresponsive:
sudo kill -9 <PID>
```

### Step 3: Identify Background Docker Containers Retaining the Port
Inspect running and stopped container instances holding published ports:
```bash
# List containers publishing target port
docker ps -a --filter "publish=80"

# Stop and purge conflicting container
docker stop <container_id>
docker rm <container_id>
```

### Step 4: Remap Host Ports in docker-compose.yml
If both services must run simultaneously, alter the external host port mapping:
```yaml
services:
  my-app:
    image: nginx:alpine
    ports:
      # Map host port 8080 to container internal port 80
      - "8080:80"
    restart: unless-stopped
```

## 🛡️ Prevention Advice
- **Leverage internal bridge networks:** Avoid exposing ports directly to the host when inter-container traffic can communicate over custom bridge networks by container hostname.
- **Audit port assignments:** Maintain a centralized port allocation table for multi-tenant VPS deployments.

## ❓ Frequently Asked Questions (FAQ)

### Why does lsof return empty yet Docker reports address in use?
Stale iptables NAT rules or hung `docker-proxy` daemons can linger after kernel panics. Running `sudo systemctl restart docker` purges orphaned socket locks.

### Can multiple containers bind to port 80 internally?
Yes. Each container possesses an independent network namespace. Only host-level port bindings must remain strictly unique.

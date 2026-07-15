---
title: "How to Resolve Port Conflict Errors in Umbrel OS and Docker"
description: "Learn how to resolve port binding errors when installing custom containers or services that clash with Umbrel's default web proxy."
category: "Systems & Servers"
tags: ["Docker", "Umbrel", "Sysadmin"]
readTime: "4 min"
date: "2026-08-01"
---

The port binding error (`bind: address already in use` or `port already allocated`) when attempting to start a custom container in Umbrel OS occurs because the platform's internal web proxy (based on Nginx or Traefik) has already reserved ports 80 and 443 to manage the app store interface and secure dashboard access.

## 🚀 Step-by-Step Solution

### Step 1: Identify which process or container is using the port
Before modifying any compose files, connect to your Umbrel via SSH and identify precisely which service is binding to the target port:
```bash
# Locate processes listening on the conflicting port (e.g., port 80)
sudo lsof -i :80

# List active Docker container port mappings
docker ps --format "table {{.ID}}\t{{.Names}}\t{{.Ports}}"
```

### Step 2: Update port mapping in your docker-compose.yml file
Do not attempt to kill or remove processes belonging to Umbrel's native dashboard. Instead, modify the port mapping of the container you want to deploy, changing its host-facing port to an unallocated one (e.g., change `80:80` to `8085:80`):
```yaml
services:
  app-custom:
    image: nginx:alpine
    ports:
      # Map free host port 8085 to container port 80
      - "8085:80"
```

### Step 3: Recreate and start the container
Apply the configuration changes by recreating the container:
```bash
# Bring the container stack down and recreate it in detached mode
docker compose down && docker compose up -d
```

## 🛡️ Prevention Advice
Recommended security practices:
- Avoid modifying Umbrel's main system Docker network interfaces (`docker0` or the native host network) when running custom third-party applications. Always declare isolated bridge networks (`bridge`) within your custom Compose files. This prevents accidental port and DNS routing conflicts, keeping your Bitcoin node and server applications fully secure.

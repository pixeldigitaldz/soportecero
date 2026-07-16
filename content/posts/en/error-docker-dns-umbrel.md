---
title: "Fix: Internet Connection Loss due to DNS Failure in Docker (Umbrel OS)"
description: "Learn how to resolve the network block where your containers in Umbrel lose access to the outside due to conflicts with the internal DNS resolver."
category: "Systems & Servers"
tags: ["Umbrel", "Docker", "DNS"]
readTime: "4 min"
date: "2026-07-27"
---

A very common critical failure in home servers based on the **Umbrel OS** ecosystem occurs when Docker containers (such as Sonarr or your nodes) suddenly stop downloading updates or lose connection to external servers, throwing `Temporary failure in name resolution` errors. This happens because the Docker daemon loses the route to the local DNS resolver of the host operating system.

## 🚀 Step-by-Step Solution

### Step 1: Verify the internal network block
Access your Umbrel server via SSH and enter the affected container to check if it responds to a direct numerical ping but fails to resolve text names:
```bash
# Test direct Google IP (If it responds, there is internet but no DNS)
docker exec -it nombre_contenedor ping -c 3 8.8.8.8
```

### Step 2: Force global public DNS in the Docker configuration

To bypass Umbrel's routing blocks, we can define static and immutable DNS servers for the entire Docker engine. Edit the global configuration file:
```bash
sudo nano /etc/docker/daemon.json
```

Add or merge the following lines with the stable DNS of Cloudflare and Google inside the JSON object:
```json
{
  "dns": ["1.1.1.1", "8.8.8.8"]
}
```

Save the file (`Ctrl + O`, `Enter`) and close the editor (`Ctrl + X`).

### Step 3: Restart the Docker service

Apply a forced restart to the system service so it brings up all network interfaces with the new injected DNS:
```bash
sudo systemctl restart docker
```

## 🛡️ Prevention Advice

Recommended security practices:
- Avoid manually modifying the `/etc/resolv.conf` file directly in Umbrel OS, as this file is dynamically managed by the system and will be completely overwritten upon every physical reboot of your Mini PC or Raspberry Pi, erasing your fixes.

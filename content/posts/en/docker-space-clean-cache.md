---
title: "How to Free Disk Space by Cleaning Docker Cache and Orphaned Containers"
description: "Complete guide to reclaiming gigabytes in /var/lib/docker by pruning BuildKit cache, unused images, and dangling volumes."
category: "Systems & Servers"
tags: ["Docker", "Linux", "DevOps", "SysAdmin", "Storage"]
readTime: "5 min"
date: "2026-06-25"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **/var/lib/docker directory bloated by stale BuildKit layers and dangling container images** | Execute `docker system prune -a --volumes` to reclaim unallocated storage |
| **Massive container JSON log files accumulating inside /var/lib/docker/containers/** | Configure log rotation limits in `/etc/docker/daemon.json` and truncate logs |

Unchecked growth of `/var/lib/docker` on Linux hosts frequently results in catastrophic `no space left on device` errors. Docker retains unreferenced intermediate build layers, cached BuildKit state, stopped containers, and unattached anonymous volumes by default.

## 🚀 Step-by-Step Solution

### Step 1: Inspect Docker Storage Footprint
Examine the breakdown of disk usage across your Docker engine:
```bash
# Display summary of images, containers, and volumes
docker system df

# Display itemized consumption breakdown
docker system df -v
```

### Step 2: Prune Unused Images, Containers, and Build State
Execute a comprehensive cleanup of resources not actively tied to running containers:
```bash
# Remove stopped containers, unreferenced networks, and all unused images
docker system prune -a --force

# Purge legacy BuildKit build cache specifically
docker builder prune -a --force
```

### Step 3: Remove Orphaned (Dangling) Volumes
Anonymous storage volumes detached from deleted containers persist indefinitely unless explicitly cleaned:
```bash
# List dangling volumes
docker volume ls -qf dangling=true

# Purge all detached volumes
docker volume prune --force
```

### Step 4: Truncate and Constrain Container Log Files
If container logging has accumulated gigabytes of raw JSON logs:
```bash
# Truncate active JSON log files without taking down services
sudo sh -c 'truncate -s 0 /var/lib/docker/containers/*/*-json.log'
```
Enforce automatic log rotation in `/etc/docker/daemon.json`:
```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "3"
  }
}
```
Reload the Docker daemon to activate log capping:
```bash
sudo systemctl restart docker
```

## 🛡️ Prevention Advice
- **Schedule periodic maintenance:** Set up a weekly cron task running `docker system prune -f` on development and CI/CD servers.
- **Always invoke --rm on one-off containers:** Run testing containers with `docker run --rm` so they self-destruct upon termination.

## ❓ Frequently Asked Questions (FAQ)

### Will docker system prune -a delete databases in active containers?
No. Actively running containers and their attached volumes are completely safe. Always use named volumes for critical persistent data.

### How do I relocate /var/lib/docker to a dedicated drive?
Set the `"data-root": "/mnt/storage/docker"` parameter in `/etc/docker/daemon.json` and restart the service after copying existing files.

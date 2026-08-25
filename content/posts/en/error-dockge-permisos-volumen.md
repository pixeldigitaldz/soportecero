---
title: "Resolving: Permission Denied Error in Docker Compose Volumes"
description: "Learn how to solve EACCES and Permission Denied errors in Docker Compose and Dockge shared volume binds step by step."
category: "Systems & Servers"
tags: ["Docker", "Dockge", "Linux", "Permissions", "Docker Compose", "DevOps"]
readTime: "5 min"
date: "2026-07-27"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Container internal process UID/GID does not match directory ownership on host** | Adjust host folder ownership via `sudo chown -R 1000:1000 /path/data` or set `user: "1000:1000"` |
| **SELinux / AppArmor security context blocking write access to bind mount** | Append volume flag `:z` or `:Z` in `docker-compose.yml` |

The recurring error `EACCES: permission denied`, `touch: cannot touch '/data/...': Permission denied` or `failed to open stream: Permission denied` in applications managed via Dockge or Docker Compose arises when the container internal runtime user (such as `node` UID 1000 or `www-data` UID 33) lacks write permissions on the mounted host filesystem path.

## 🚀 Step-by-Step Solution

### Step 1: Identify the Container Process UID/GID
Determine the exact user identity executing inside the container image:
```bash
# Inspect container user identity
docker run --rm <image_name> id
```
Common image user mappings:
- **Node.js**: UID `1000`, GID `1000` (`node` user).
- **Nginx / PHP-FPM**: UID `33`, GID `33` (`www-data` user).
- **PostgreSQL**: UID `999` (`postgres` user).

### Step 2: Adjust Host Directory Ownership and Permissions
Update directory ownership on the host machine to match the container process UID:
```bash
# For containers running as UID 1000 (Dockge / Node):
sudo chown -R 1000:1000 /opt/dockge/stacks/my-stack/data

# Grant standard read/write/execute permissions
sudo chmod -R 775 /opt/dockge/stacks/my-stack/data
```

### Step 3: Specify User Context in docker-compose.yml
Pass your host user IDs into the service configuration:
```yaml
services:
  my-app:
    image: my-app:latest
    user: "${UID:-1000}:${GID:-1000}"
    volumes:
      - ./data:/app/data:z
    restart: unless-stopped
```
*Note:* The `:z` suffix properly assigns SELinux labels on Fedora, RHEL, and Rocky Linux systems.

### Step 4: Recreate Container and Verify Logs
Apply changes and monitor execution:
```bash
# Recreate container stack
docker compose down && docker compose up -d

# Check logs for write confirmation
docker compose logs -f
```

## 🛡️ Prevention Advice
- **Avoid blanket chmod 777:** While `chmod 777` resolves permission blocks, it leaves directories world-writable. Prefer targeted `chown` alignment.
- **Utilize PUID/PGID parameters:** For images supporting LinuxServer.io init scripts, define `PUID=1000` and `PGID=1000` in service environment variables.

## ❓ Frequently Asked Questions (FAQ)

### What is the difference between :z and :Z volume flags?
The `:z` flag shares the SELinux label across containers, whereas `:Z` establishes a private label restricted to a single container instance.

### How do I check my Linux user ID?
Run `id -u` for user ID and `id -g` for group ID in your terminal.

---
title: "Fix: Permission Denied Error in Docker Compose Volumes"
description: "Learn how to troubleshoot read and write failures in local folders mounted as volumes in Linux Docker containers."
category: "Systems & Servers"
tags: ["Docker", "Linux", "Servers"]
readTime: "4 min"
date: "2026-07-27"
---

The `io.containerd.runc.v2: OCI runtime create failed: permission denied` error or internal failures where a container (such as Nginx, Plex, or an indexer) cannot save its configuration occur because the internal user of the container does not have Linux file system permissions to write to the host folder mounted in the `volumes:` section.

## 🚀 Step-by-Step Solution

### Step 1: Find the UID and GID of the container
Many containers allow you to specify which system user they should run as using environment variables in the `docker-compose.yml` file. Check the container's documentation for the `PUID` and `PGID` variables.

### Step 2: Identify your local user
In your server's terminal, execute the command to view the identifier of your current user:
```bash
id
```

You will see something like `uid=1000(rodolfo) gid=1000(rodolfo)`. Take note of those numbers.

### Step 3: Fix the folder permissions on the Host
If you mounted a local folder to `./config`, you must assign ownership to the correct user of your Linux system so that Docker can interact with it:
```bash
# Change owner to user 1000
sudo chown -R 1000:1000 ./config

# Ensure standard read and write permissions
sudo chmod -R 755 ./config
```

### Step 4: Restart the container
Apply a forced restart so that the Docker daemon applies the new disk configuration:
```bash
docker compose down && docker compose up -d
```

## 🛡️ Prevention Advice

Recommended security practices:
* Never use chmod 777 globally to solve Docker issues. Giving global write and execute permissions to anyone exposes your server, allowing any compromised process to modify root files on your operating system.

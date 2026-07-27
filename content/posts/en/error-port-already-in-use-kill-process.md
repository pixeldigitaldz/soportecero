---
title: How to Fix 'Port Already in Use' Error and Kill Process on Linux & macOS
description: >-
  Learn how to quickly identify and terminate processes locking TCP/UDP network
  ports (EADDRINUSE) in Linux and macOS systems.
category: Systems & Servers
tags:
  - Linux
  - Sysadmin
  - Networking
readTime: 3 min
date: '2026-07-27'
---

The `EADDRINUSE: address already in use` error occurs when a web server (Nginx, Apache), application runtime (Node.js, Python, Go), or Docker container attempts to bind to a TCP/UDP network port that is already held by another running process.

## 🔍 Quick Diagnostics

| Symptom | Root Cause | Solution |
| :--- | :--- | :--- |
| Server startup fails with `EADDRINUSE :::3000` or `bind: address already in use` | A background node/python script or orphaned dev server is bound to the port | Locate the PID using `lsof` or `ss` and terminate the process |
| Port instantly becomes occupied again right after killing the PID | A systemd unit or Docker container restart policy is resurrecting the process | Stop the supervising daemon (`systemctl stop` or `docker stop`) |
| Socket remains stuck in `TIME_WAIT` state after stopping application | Socket closed ungracefully without enabling `SO_REUSEADDR` flag | Wait for TCP socket timeout or configure `SO_REUSEADDR` in code |

## 🚀 Step-by-Step Solution

### Step 1: Locate the Process ID (PID) Holding the Port
Use command-line networking tools to find which application process is bound to the target port (e.g., port `3000` or `8080`):

```bash
# Method 1: Using lsof (LiSt Open Files)
sudo lsof -i :3000

# Sample output:
# COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
# node    14205 user   23u  IPv6 128941      0t0  TCP *:3000 (LISTEN)

# Method 2: Using ss (Socket Statistics)
sudo ss -tulpn | grep :3000

# Method 3: Using fuser
sudo fuser 3000/tcp
```

### Step 2: Gracefully or Forcefully Terminate the Process
Once you have the PID (e.g., `14205`), send a graceful termination signal (`SIGTERM`) to release network sockets cleanly. If the process is unresponsive, issue a forceful `SIGKILL`:

```bash
# Terminate gracefully (SIGTERM)
kill 14205

# Force immediate termination if unresponsive (SIGKILL)
kill -9 14205

# Or kill the port occupant directly in one command using fuser:
sudo fuser -k 3000/tcp
```

### Step 3: Handle Auto-Restarting Services (systemd & Docker)
If the process respawns automatically, it is managed by a supervisor service.

For **systemd** services:
```bash
# Inspect service controlling the port
sudo systemctl status <service-name>

# Stop the service
sudo systemctl stop <service-name>
```

For **Docker** containers:
```bash
# List containers binding local ports
docker ps --format "table {{.ID}}\t{{.Names}}\t{{.Ports}}"

# Stop the container blocking the port
docker stop <container-name>
```

## 🛡️ Prevention Advice

Recommended practices for clean network socket management:
- **Implement Graceful Shutdowns in Code**: Capture `SIGINT` and `SIGTERM` signals in your app code (Node.js, Express, Go) to close HTTP listeners and database connections cleanly before exiting.
- **Enable Socket Reuse (`SO_REUSEADDR`)**: When writing TCP network servers, set the `SO_REUSEADDR` socket option to allow immediate rebinding without waiting for `TIME_WAIT` timeouts during rapid development restarts.
- **Use Dynamic Port Fallbacks**: Use environment variables (`PORT=3001 npm start`) or automatic port detection during local development to avoid port conflicts with host services.

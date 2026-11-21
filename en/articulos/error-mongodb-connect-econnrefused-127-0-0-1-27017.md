---
title: 'How to Fix ''connect ECONNREFUSED 127.0.0.1:27017'' in MongoDB'
description: >-
  Learn how to fix connect ECONNREFUSED errors in MongoDB by starting mongod
  services, resolving socket locks, and setting bindIp.
category: Web & Code
tags:
  - MongoDB
  - Node.js
  - Mongoose
  - Databases
  - Linux
  - DevOps
readTime: '6 min'
date: '2026-06-25'
---

The error `MongooseServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017` (or `MongoNetworkError: connect ECONNREFUSED ::1:27017`) means your application's MongoDB driver sent a TCP `SYN` packet to port `27017` on loopback, and the operating system kernel immediately replied with `RST` because no `mongod` process was listening on that address and port.

## Quick Diagnostics

| Symptom / Cause | Immediate Action |
|---|---|
| **`mongod` service stopped or not enabled on boot** | Run `sudo systemctl start mongod && sudo systemctl enable mongod` |
| **Node.js 17+ resolving `localhost` to IPv6 `::1`** | Use `127.0.0.1:27017` in URI or enable `net.ipv6: true` |
| **`mongod` crashing with `status=14/EXIT_FAILURE`** | Fix `/var/lib/mongodb` ownership and remove stale `mongod.lock` |
| **App running inside Docker targeting `127.0.0.1`** | Point URI to the Docker Compose service name (e.g., `mongodb://mongo:27017`) |

## Root Cause & Technical Mechanics

`ECONNREFUSED` is a network-layer rejection, not an authentication failure. Three distinct mechanisms trigger it in local and production environments:

1. **Crashed or Inactive `mongod` Daemon:** After an unclean shutdown or OOM kill, `mongod` may fail to restart if the `mongodb` system user lost ownership of `/var/lib/mongodb`, `/tmp/mongodb-27017.sock`, or `/var/log/mongodb/mongod.log`, or if WiredTiger detects inconsistent journal files.
2. **IPv4 vs. IPv6 Loopback Mismatch (Node.js 17+):** Starting with Node.js 17, `dns.lookup()` respects OS DNS order rather than forcing IPv4 first. On many Linux, macOS, and Windows systems, `localhost` resolves to `::1` (IPv6), while MongoDB's default `/etc/mongod.conf` only binds to `127.0.0.1` (IPv4).
3. **Container Loopback Isolation:** Inside a Docker container, `127.0.0.1` refers to that container's own network namespace—not the host machine or a sibling MongoDB container.

## Step-by-Step Solution

### 1. Check `mongod` Service Status and Listening Sockets

Verify whether `mongod` is running and actually bound to port `27017`:

```bash
sudo systemctl status mongod --no-pager
ss -tlnp | grep 27017
```

If `mongod` is inactive, start it and enable automatic boot startup:

```bash
sudo systemctl start mongod
sudo systemctl enable mongod
```

### 2. Inspect Logs for Startup Crashes (`status=14` or WiredTiger Errors)

If `systemctl start mongod` fails immediately, read the last 40 lines of the MongoDB log:

```bash
sudo tail -n 40 /var/log/mongodb/mongod.log
```

If you see permission denied errors or `WiredTiger error`, restore ownership on the data, log, and socket paths, then restart:

```bash
sudo chown -R mongodb:mongodb /var/lib/mongodb /var/log/mongodb
sudo rm -f /tmp/mongodb-27017.sock
sudo systemctl restart mongod
```

If a dirty shutdown corrupted the lockfile, run a WiredTiger repair as the `mongodb` user (never as `root`, or file ownership will break again):

```bash
sudo -u mongodb mongod --repair --dbpath /var/lib/mongodb
sudo systemctl start mongod
```

### 3. Verify `net.bindIp` in `/etc/mongod.conf`

Open `/etc/mongod.conf` and confirm the network block listens on `127.0.0.1` (or `127.0.0.1,::1` if your app uses IPv6 `localhost`):

```yaml
net:
  port: 27017
  bindIp: 127.0.0.1
```

In your Node.js/Mongoose `.env` file, prefer explicit IPv4 loopback to avoid Node.js IPv6 resolution surprises:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/myapp
```

### 4. Verify End-to-End Connectivity

Test the local socket directly using `mongosh`:

```bash
mongosh "mongodb://127.0.0.1:27017" --eval "db.runCommand({ ping: 1 })"
```

A healthy daemon returns `{ ok: 1 }`.

## Frequently Asked Questions

### Why does `ECONNREFUSED ::1:27017` happen when MongoDB is clearly running?
Your Node.js runtime resolved `localhost` to IPv6 `::1`, whereas `mongod` is only listening on IPv4 `127.0.0.1`. Changing your connection string from `localhost` to `127.0.0.1` fixes this immediately.

### How do I fix `ECONNREFUSED 127.0.0.1:27017` inside Docker Compose?
Containers do not share `127.0.0.1`. Define both services on the same Compose network and set your connection string to `mongodb://mongo:27017/myapp` (replacing `mongo` with your database service key in `docker-compose.yml`).

### What causes `mongod` to stop randomly on a 1 GB VPS?
The Linux OOM killer terminates `mongod` when WiredTiger's cache (by default 50% of RAM minus 1 GB, or 256 MB minimum) collides with Node.js memory spikes. Adding a 2 GB swap file and setting `storage.wiredTiger.engineConfig.cacheSizeGB: 0.25` prevents sudden kills.

## Prevention Advice

- **Never run `mongod --repair` as `root`:** Always prefix with `sudo -u mongodb` so newly created WiredTiger files remain readable by the systemd service.
- **Avoid `bindIp: 0.0.0.0` without auth:** If you must accept remote connections, always enable `security.authorization: enabled` and restrict port `27017` via `ufw` or security groups.
- **Keep at least 1 GB of free disk space:** WiredTiger refuses to start or halts writes if root/data partition free space drops below critical thresholds.
- **Add Mongoose `serverSelectionTimeoutMS`:** Set `serverSelectionTimeoutMS: 5000` in development so connection failures surface in 5 seconds instead of hanging for 30 seconds.

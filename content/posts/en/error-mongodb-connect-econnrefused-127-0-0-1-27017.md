---
title: "[SOLVED] How to Fix 'connect ECONNREFUSED 127.0.0.1:27017' in MongoDB"
description: "Learn how to fix connect ECONNREFUSED errors in MongoDB by starting mongod services, resolving socket locks, and setting bindIp."
category: "Web & Code"
tags: ["MongoDB", "Node.js", "Mongoose", "Databases", "Linux", "DevOps"]
readTime: "5 min"
date: "2026-06-25"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **MongoDB server daemon (mongod) stopped or failed to launch on startup** | Start and enable daemon: `sudo systemctl start mongod && sudo systemctl enable mongod` |
| **Corrupted data directory permissions or orphaned lockfile in /var/lib/mongodb** | Restore ownership with `sudo chown -R mongodb:mongodb /var/lib/mongodb` and run repair |

The exception `MongooseServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017` or `MongoNetworkError: failed to connect to server [localhost:27017]` in Node.js / Express applications indicates that the client attempted a TCP socket connection on port 27017, but no active MongoDB daemon was listening.

## 🚀 Step-by-Step Solution

### Step 1: Inspect and Start MongoDB Daemon
Check whether the `mongod` systemd unit is healthy:
```bash
# Inspect daemon status
sudo systemctl status mongod

# Start service if inactive
sudo systemctl start mongod

# Enable persistent boot start
sudo systemctl enable mongod
```

### Step 2: Fix Data and Log Directory Permissions
Abrupt system halts can leave database storage directories locked or misattributed:
```bash
# Restore ownership to system 'mongodb' user
sudo chown -R mongodb:mongodb /var/lib/mongodb
sudo chown -R mongodb:mongodb /var/log/mongodb

# Set standard directory access
sudo chmod -R 755 /var/lib/mongodb
```

### Step 3: Validate Network Binding in mongod.conf
Inspect your master configuration file (`/etc/mongod.conf`):
```yaml
# /etc/mongod.conf
net:
  port: 27017
  bindIp: 127.0.0.1  # Localhost binding
```
Restart daemon to apply configuration changes:
```bash
sudo systemctl restart mongod
```

### Step 4: Verify Local Database Connectivity
Confirm socket responsiveness via the official Mongo shell:
```bash
mongosh "mongodb://127.0.0.1:27017"
```

## 🛡️ Prevention Advice
- **Never expose 0.0.0.0 without active authentication:** Exposing port 27017 to public networks without `security.authorization: enabled` risks automated database scraping and ransomware encryption.
- **Monitor disk capacity:** MongoDB halts the WiredTiger engine if free storage falls below 100MB.

## ❓ Frequently Asked Questions (FAQ)

### What does status=14/EXIT_FAILURE mean on mongod startup?
Exit code 14 indicates permission failures or stale `mongod.lock` files. Run `sudo mongod --repair --dbpath /var/lib/mongodb` and restart the service.

### Why does my Docker app fail connecting to 127.0.0.1?
Inside a container, `127.0.0.1` references the container loopback interface. Reference your MongoDB container by service name defined in `docker-compose.yml`.

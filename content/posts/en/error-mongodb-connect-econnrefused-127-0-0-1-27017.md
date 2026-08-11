---
title: "[FIXED] Error 'connect ECONNREFUSED 127.0.0.1:27017' in MongoDB"
description: "Node.js or Mongoose backend failing to connect to MongoDB due to ECONNREFUSED 27017? Step-by-step resolution for mongod daemon and IP binding."
category: "Web & Code"
tags: ["MongoDB", "Node.js", "Express", "Database"]
readTime: "4 min"
date: "2026-08-22"
---

The error **`connect ECONNREFUSED 127.0.0.1:27017`** or `MongooseServerSelectionError: connect ECONNREFUSED` occurs when your Node.js application or database client attempts to connect to MongoDB, but the **`mongod` service daemon is stopped** or listening strictly on an unmapped network interface.

> **Quick Solution (1 Minute):**
> 1. Start the MongoDB service daemon:
>    `sudo systemctl enable --now mongod`
> 2. Change connection string hostname from `localhost` to explicit IP `127.0.0.1`:
>    `mongodb://127.0.0.1:27017/mydatabase`

## 🚀 Step-by-Step Fixes

### Step 1: Check `mongod` Service Daemon Status
Ensure the MongoDB background service is active:

```bash
sudo systemctl status mongod
```
If the status displays `inactive` or `failed`, enable and start the daemon:
```bash
sudo systemctl enable --now mongod
```

### Step 2: Replace `localhost` with `127.0.0.1` in Mongoose
Node.js v17+ resolves `localhost` to IPv6 (`::1`) first. If MongoDB listens on IPv4 only, connection attempts will be rejected.

Update your Mongoose database connection file:
* ❌ **Before:** `mongoose.connect('mongodb://localhost:27017/myapp');`
* ✅ **After:** `mongoose.connect('mongodb://127.0.0.1:27017/myapp');`

### Step 3: Check `bindIp` in `mongod.conf`
Inspect `/etc/mongod.conf`:
```yaml
net:
  port: 27017
  bindIp: 127.0.0.1
```
Restart MongoDB after applying config edits:
```bash
sudo systemctl restart mongod
```

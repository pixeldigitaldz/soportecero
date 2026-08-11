---
title: "[FIXED] Error 'curl: (7) Failed to connect to localhost port'"
description: "Getting curl connection refused error (7) testing local web APIs? Step-by-step resolution for IPv6 binding and localhost port listening."
category: "Web & Code"
tags: ["cURL", "Node.js", "API", "Linux"]
readTime: "4 min"
date: "2026-08-14"
---

The error **`curl: (7) Failed to connect to localhost port 3000: Connection refused`** occurs when the `curl` CLI tool attempts to reach a local service endpoint, but no process is actively listening on that port or the server is bound strictly to IPv6 (`::1`) rather than IPv4 (`127.0.0.1`).

> **Quick Solution (1 Minute):**
> 1. Ensure your backend app is active in a separate terminal.
> 2. Pass the explicit IPv4 address instead of the hostname `localhost`:
>    `curl http://127.0.0.1:3000`

## 🚀 Step-by-Step Fixes

### Step 1: Verify Port Listening Status
Check if your target port is open using `ss`:

```bash
sudo ss -tulpn | grep :3000
```
If nothing returns, your backend process (Node.js, Python, Go) is not running. Start your dev server before issuing cURL requests.

### Step 2: Resolve IPv6 vs IPv4 Hostname Conflict
On modern Linux distributions, `localhost` resolves to `::1` (IPv6) first. If your server app listens exclusively on `127.0.0.1` (IPv4), cURL fails upon trying IPv6.

**Option A: Force cURL IPv4 mode:**
```bash
curl -4 http://localhost:3000
```

**Option B: Use loopback IP directly:**
```bash
curl http://127.0.0.1:3000
```

### Step 3: Configure Host Binding in Your Backend Code
Ensure your application binds to `0.0.0.0` or `127.0.0.1`:

* **Express.js (Node.js):**
  ```javascript
  app.listen(3000, '0.0.0.0', () => {
    console.log('Server running on port 3000');
  });
  ```
* **FastAPI / Uvicorn (Python):**
  ```bash
  uvicorn main:app --host 0.0.0.0 --port 3000
  ```

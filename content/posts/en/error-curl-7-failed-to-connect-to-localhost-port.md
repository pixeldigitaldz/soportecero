---
title: '[FIXED] Error ''curl: (7) Failed to connect to localhost port'''
description: >-
  Getting curl connection refused error (7) testing local web APIs? Step-by-step
  resolution for IPv6 binding and localhost port listening.
category: Web & Code
tags:
  - cURL
  - Node.js
  - API
  - Linux
readTime: 5 min
date: '2026-08-14'
---

The error **`curl: (7) Failed to connect to localhost port 3000: Connection refused`** (exit code `7`) occurs when `curl` resolves `localhost` and sends a TCP `SYN` packet, but the kernel immediately replies with `RST` because no process is listening on that specific IP family and port.

## Quick Diagnostics

| Symptom / Cause | Immediate Action |
|---|---|
| **Backend dev server not running or crashed** | Start server and verify socket with `ss -tulpn \| grep :3000` |
| **Server listens on `127.0.0.1` (IPv4) while `curl` tries `::1` (IPv6)** | Test with `curl -4 http://localhost:3000` or `http://127.0.0.1:3000` |
| **App inside Docker binds to `127.0.0.1` instead of `0.0.0.0`** | Bind container app to `0.0.0.0` so `-p` port forwarding works |
| **Wrong port or container port not published** | Check `docker ps` and `APP_PORT` environment variables |

## Root Cause & Technical Mechanics

On modern Linux, macOS, and Windows systems, `/etc/hosts` maps `localhost` to both `127.0.0.1` (IPv4) and `::1` (IPv6). When `curl` resolves `localhost` via `getaddrinfo()`, it often attempts `::1` first (or races IPv6/IPv4 via Happy Eyeballs depending on build flags). If your Node.js, Python, or Go server explicitly bound only to `127.0.0.1:3000`—or if Node.js v17+ flipped DNS resolution order to `verbatim`—the `::1` socket has no listener and returns `ECONNREFUSED`.

A second major cause is **container loopback isolation**. Inside a Docker container, `127.0.0.1` refers to the container's own private network namespace—not the host's loopback. If Vite, Flask, or Express binds to `127.0.0.1:3000` inside the container, Docker's `docker-proxy` on the host cannot forward traffic into it, resulting in `curl: (7)` or `Empty reply from server` on the host.

## Step-by-Step Solution

### Step 1: Inspect active listening sockets and address families

Check exactly which IP address (`127.0.0.1`, `::1`, `0.0.0.0`, or `*`) and port your process is bound to:

```bash
sudo ss -tulpn | grep :3000
```

Look closely at the `Local Address:Port` column:
- `127.0.0.1:3000`: Listening on IPv4 loopback only.
- `[::1]:3000`: Listening on IPv6 loopback only.
- `0.0.0.0:3000` or `*:3000`: Listening on all interfaces (IPv4, or dual-stack IPv4/IPv6).
- No output: The service is not running or is listening on a different port.

### Step 2: Test IPv4 vs IPv6 resolution explicitly

Run `curl` in verbose mode to see the exact IP address it tries to reach:

```bash
curl -v http://localhost:3000
```

If verbose output shows `Trying [::1]:3000... connect to ::1 port 3000 failed: Connection refused`, force IPv4 or target `127.0.0.1` directly:

```bash
curl -4 http://localhost:3000
curl http://127.0.0.1:3000
```

### Step 3: Fix host binding in your server or Docker container

Update your application's listen address so it accepts connections consistently (especially inside Docker or WSL2):

- **Node.js / Express:**
  ```javascript
  app.listen(3000, '0.0.0.0', () => {
    console.log('Listening on 0.0.0.0:3000');
  });
  ```
- **Vite / Next.js dev servers:**
  ```bash
  npm run dev -- --host 0.0.0.0 --port 3000
  ```
- **Python (FastAPI / Uvicorn or Flask):**
  ```bash
  uvicorn main:app --host 0.0.0.0 --port 3000
  # or: flask run --host=0.0.0.0 --port=3000
  ```

After restarting the service, verify with `ss -tulpn | grep :3000` and `curl -I http://localhost:3000` (expecting `HTTP/1.1 200 OK` or your API's status code).

## Frequently Asked Questions

**Why does `curl localhost:3000` fail in GitHub Actions or CI pipelines right after starting my server?**
The CI runner executes `curl` milliseconds after launching the background server (`node server.js &`), before the process finishes binding the port. Add a retry loop such as `curl --retry 10 --retry-delay 1 --retry-connrefused http://127.0.0.1:3000`.

**Why did this start happening after upgrading to Node.js 18 or 20?**
Starting in Node.js 17, `dns.setDefaultResultOrder` changed from `ipv4first` to `verbatim`, meaning `localhost` often resolves to `::1` before `127.0.0.1`. Binding servers to `0.0.0.0` or `::` avoids mismatches.

**My server is listening on `127.0.0.1:3000` on my host, why does a Docker container get `curl: (7)`?**
Inside a container, `localhost` is the container itself, not the host machine. Use `http://host.docker.internal:3000` (with `extra_hosts: ["host.docker.internal:host-gateway"]` on Linux) and bind the host service to `0.0.0.0` or the `docker0` bridge IP.

## Prevention Advice

- **Use `127.0.0.1` in local healthchecks:** Prefer `http://127.0.0.1:<port>` in scripts and Docker `HEALTHCHECK` directives to avoid IPv6/IPv4 `localhost` ambiguity.
- **Bind containerized apps to `0.0.0.0`:** Always configure `--host 0.0.0.0` in Dockerfiles and Compose commands.
- **Use `--retry-connrefused` in automation:** Pair `curl` with `--retry-connrefused` when polling freshly booted services.
- **Verify `/etc/hosts`:** Ensure `127.0.0.1 localhost` is present and not commented out.

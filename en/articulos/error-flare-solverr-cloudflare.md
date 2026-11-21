---
title: 'Resolving: FlareSolverr Timeout Error when Bypassing Cloudflare Challenges'
description: >-
  Learn how to troubleshoot timeout errors and unresolved challenges when
  configuring FlareSolverr with download managers and automation tools.
category: Systems & Servers
tags:
  - Docker
  - Cloudflare
  - FlareSolverr
readTime: 6 min
date: '2026-07-27'
---

When **FlareSolverr** fails while integrating with Prowlarr, Jackett, or custom scraping workflows—throwing `Error: Error solving the challenge. Timeout after 60.0 seconds` or `Challenge could not be resolved`—the headless browser inside the container failed to pass Cloudflare's JS or Turnstile verification before the request deadline expired. This typically stems from outdated Chromium/undetected-chromedriver signatures, low IP reputation, or insufficient container timeouts.

## Quick Diagnostics

| Symptom / Cause | Immediate Action |
|---|---|
| **Outdated FlareSolverr browser fingerprint** | Pull the latest image: `ghcr.io/flaresolverr/flaresolverr:latest` |
| **Container hits 60s timeout on slow ARM/NAS hardware** | Increase `maxTimeout` in API payload or `BROWSER_TIMEOUT` env var |
| **Cloudflare Turnstile / interactive checkbox loop** | Route container traffic through a clean residential/ISP proxy |
| **Missing shared memory (`/dev/shm`) crashing Chromium** | Mount `shm_size: '2gb'` in `docker-compose.yml` |

## Root Cause & Technical Mechanics

FlareSolverr operates as an HTTP proxy server wrapping headless **Chromium** via `undetected-chromedriver` and Selenium. When a client (such as Prowlarr) sends a `POST /v1` request, FlareSolverr spawns a browser tab, navigates to the target URL, waits for Cloudflare's `cf_clearance` cookie to be issued after JavaScript execution, and returns the HTML and cookies to the caller.

Timeouts occur when any of three layers break down:
1. **TLS & Browser Fingerprint Detection:** Cloudflare continuously updates its Bot Management and Turnstile heuristics—inspecting JA3/JA4 TLS fingerprints, `navigator.webdriver` flags, Canvas/WebGL entropy, and Chromium version headers. Running a FlareSolverr container that is even a few months old exposes an outdated Chromium build that Cloudflare traps in an infinite Turnstile verification loop until FlareSolverr's timer expires.
2. **IP Reputation & Datacenter ASN Blocking:** If your server runs on a VPS/cloud provider (AWS, Hetzner, DigitalOcean) or behind a commercial VPN exit node with a flagged ASN, Cloudflare escalates from a passive JS challenge to an interactive Turnstile or hard `403` block that headless automation cannot solve natively.
3. **Resource Starvation & `/dev/shm` Exhaustion:** Docker defaults `/dev/shm` to `64MB`. Chromium tabs inside FlareSolverr frequently crash or stall rendering heavy challenge scripts when `/dev/shm` fills up on low-power NAS devices (Raspberry Pi, Synology).

## Step-by-Step Solution

### 1. Update FlareSolverr to the Latest GHCR Image
Ensure you are pulling from the official GitHub Container Registry (`ghcr.io`), as older Docker Hub mirrors may lag behind:
```bash
docker stop flaresolverr && docker rm flaresolverr
docker pull ghcr.io/flaresolverr/flaresolverr:latest
```

### 2. Redeploy with Increased Shared Memory and Debug Logging
Launch the container with `shm_size` increased (`--shm-size=2g`), explicit timezone alignment, and `LOG_LEVEL=debug` for diagnostics:
```bash
docker run -d \
  --name=flaresolverr \
  -p 8191:8191 \
  --shm-size=2g \
  -e LOG_LEVEL=debug \
  -e TZ=UTC \
  --restart unless-stopped \
  ghcr.io/flaresolverr/flaresolverr:latest
```

*(Note: FlareSolverr v3+ removed third-party `CAPTCHA_SOLVER` integrations like hCaptcha/2Captcha; do not rely on deprecated `CAPTCHA_SOLVER` environment variables.)*

### 3. Test with an Explicit `maxTimeout` and Inspect Logs
Send a direct test request to the FlareSolverr API with a 90-second `maxTimeout` (`90000` ms) to isolate whether Prowlarr/Jackett or FlareSolverr itself is timing out:
```bash
curl -s -X POST http://localhost:8191/v1 \
  -H "Content-Type: application/json" \
  -d '{"cmd": "request.get", "url": "https://nowsecure.nl", "maxTimeout": 90000}' | jq .status,.message
```

Watch the container logs in real time to see if Chromium is hanging on Turnstile or crashing:
```bash
docker logs -f --tail 50 flaresolverr
```

### 4. Route Through a Clean Proxy (If Your IP/ASN Is Flagged)
If `docker logs` shows Cloudflare repeatedly serving Turnstile challenges on a datacenter IP, pass a clean HTTP/SOCKS5 proxy via environment variable or per-request JSON:
```bash
-e PROXY=http://user:password@proxy-ip:port
```

## Frequently Asked Questions

**Why does `CAPTCHA_SOLVER=hcaptcha` not solve Turnstile challenges anymore?**
Modern FlareSolverr (v3.x) deprecated external captcha solver hooks because Cloudflare migrated most sites from hCaptcha to **Turnstile**, which evaluates behavioral telemetry and IP reputation rather than image puzzles.

**Why does FlareSolverr work on my home PC but time out on my Hetzner/OVH VPS?**
Cloudflare scores datacenter ASNs (Hetzner, OVH, AWS) much more strictly than residential ISPs, often presenting unsolvable Turnstile loops to headless browsers originating from datacenter IPs.

**What should `maxTimeout` be set to in Prowlarr or Jackett?**
Set the indexer's FlareSolverr timeout to at least `60000`–`120000` ms (`60`–`120` seconds) so Prowlarr does not close the HTTP socket before FlareSolverr finishes solving.

## Prevention Advice

* Automate container updates with **Watchtower** or scheduled `docker compose pull && docker compose up -d` so Chromium fingerprints stay current.
* Allocate `--shm-size=2g` (or `shm_size: '2gb'` in Compose) to prevent silent Chromium tab crashes during heavy JS challenges.
* Avoid running FlareSolverr over shared public VPN endpoints that are heavily abused and blacklisted by Cloudflare.

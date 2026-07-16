---
title: "How to Resolve Timeout Failures When Connecting Prowlarr or Radarr with Private Indexers"
description: "Definitive solution to connection errors and timeouts between automated media managers and private torrent or Usenet indexers."
category: "Systems & Servers"
tags: ["Prowlarr", "Radarr", "Docker"]
readTime: "4 min"
date: "2026-08-04"
---

The `Timeout` or connection timed out error in tools like Prowlarr, Radarr, or Sonarr occurs when the managers attempt to sync or perform a search on a private indexer and the request does not receive a response within the time limit (usually 30 seconds).

This is primarily due to blocks by Cloudflare's security challenge on the tracker indexer, or name resolution (DNS) issues within the internal network of your Docker containers.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Implementar FlareSolverr (Para evadir bloqueos de Cloudflare)
If the private indexer uses Cloudflare protection, your automation apps will be rejected immediately.
1. Bring up a **FlareSolverr** container in your Docker Compose file or local server:
```yaml
  flaresolverr:
    image: ghcr.io/flaresolverr/flaresolverr:latest
    container_name: flaresolverr
    environment:
      - LOG_LEVEL=info
    ports:
      - 8191:8191
    restart: unless-stopped
```
2. In your Prowlarr panel, go to Settings > Tags. Add a tag for FlareSolverr pointing to your local IP on port 8191 (e.g., http://192.168.1.100:8191).
3. Assign that same tag to the configuration of the indexer that is failing.

### Paso 2: Ajustar el tiempo de espera (Timeout) en la interfaz
If the tracker is simply slow to respond due to saturation, increase the default limit in the app:
1. In Prowlarr or Radarr, go to Settings > General.
2. Activate the advanced options (Show Advanced Options).
3. Search for the System HTTP Timeout parameter and raise it from 30 to 60 or 90 seconds. Save changes.

## 🛡️ Consejo de Prevención
Recommended security practices:
- If you use a VPN for your downloads, make sure Prowlarr and Radarr have static routes configured so they do not lose communication with the local network (LAN) of your home or home server.

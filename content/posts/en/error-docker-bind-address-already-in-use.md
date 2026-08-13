---
title: 'How to fix: Error starting userland proxy: bind: address already in use in Docker'
description: 'How to fix the port already in use error in Docker step by step on Linux and Windows.'
category: 'Systems & Servers'
date: '2026-08-12'
readTime: '3 min'
tags: ['Docker', 'Linux', 'Networking']
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Another service is using the port (e.g. Nginx/Apache)** | Stop the service or change the port in Docker (`docker-compose.yml`) |
| **Zombie container holding the port** | Restart the Docker service or kill the process |
| **Docker Desktop conflict (Windows/Mac)** | Restart Docker Desktop or WSL2 |

## Step-by-Step Solution

**Find which process is using the port**
On Linux, run the following command to see which application is occupying the port (change `80` to your conflicting port):
```bash
sudo netstat -tulpn | grep :80
```
Or using `lsof`:
```bash
sudo lsof -i :80
```

**Stop the conflicting service**
If you find that Apache or Nginx are running natively and occupying port 80, stop them:
```bash
sudo systemctl stop apache2
sudo systemctl disable apache2
```

**Kill the process if necessary**
If it's a zombie process, you can kill it using its PID (the number given by the previous command):
```bash
sudo kill -9 <PID>
```

**Change the port in your Docker Compose**
If you cannot stop the native service, simply change the port Docker exposes by editing your `docker-compose.yml`:
```yaml
ports:
  - "8080:80" # Change the left port (host)
```
Then start the container again:
```bash
docker-compose up -d
```

## Prevention Tips
- **Port Allocation:** Use a reverse proxy like Traefik or Nginx Proxy Manager on ports 80/443 and expose the rest of the containers internally.
- **Monitoring:** Check which ports are in use on your server before deploying a new stack using `netstat` or `ss`.
- **Regular Cleanup:** Run `docker system prune` to clean up orphan networks and containers that might be blocking resources.

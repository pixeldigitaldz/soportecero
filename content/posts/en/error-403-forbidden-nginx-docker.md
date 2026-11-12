---
title: How to Fix 403 Forbidden Nginx Errors in Docker (File Permissions & Volume Mounts)
description: >-
  Learn how to fix 403 Forbidden Nginx errors in Docker containers. Troubleshoot mounted volume
  permissions, UID 101/82 ownership, missing index directives, and SELinux relabeling.
category: Systems & Servers
tags:
  - Nginx
  - Docker
  - Linux
  - Sysadmin
  - DevOps
readTime: 5 min
date: '2026-07-21'
---

Encountering an `HTTP 403 Forbidden` error when accessing an Nginx instance running inside a Docker container is one of the most frequent friction points in modern web infrastructure deployments. Unlike an HTTP 404 error (which signals that an upstream route or file is missing), a 403 status confirms that Nginx successfully mapped the requested URI to a physical directory or file path on disk, but the operating system kernel denied the worker process permission to read or execute the resource.

In containerized architectures, this denial stems from host-container user namespace mismatches (UID/GID disparities), incorrect directory traversal permissions, missing `index.html` entrypoints without directory indexing (`autoindex`), or host security modules like SELinux.

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Host volume lacks directory execute (`+x`) or file read (`+r`) permissions** | Apply standard web server permissions: `chmod 755` on dirs and `chmod 644` on files |
| **User ID mismatch between host files and container Nginx process (UID 101/82)** | Align ownership with `chown -R 101:101 /host/path` (Alpine Nginx UID) |
| **Missing default index file when directory autoindex is disabled** | Create `index.html` or configure `index index.html index.php;` in server block |
| **SELinux blocking container engine access to host bind mount** | Append the `:Z` private unshared or `:z` shared mount flag in volume declarations |

## 🚀 Step-by-Step Implementation Guide

### Step 1: Audit and Realign Host Filesystem Permissions
Inside the official Nginx container images:
- **Alpine-based images (`nginx:alpine`):** The `nginx` worker process runs under UID `101` (group `101`).
- **Debian-based images (`nginx:latest`):** The `nginx` worker process runs under UID `101` or `www-data` (UID `33`).

For Nginx to serve files from a bind mount, every parent directory in the path must have execute (`+x`) permissions for world/other users, and the served files must be world-readable:
```bash
# Set directories to 755 (rwxr-xr-x) for directory traversal
sudo find /var/www/my-site -type d -exec chmod 755 {} +

# Set files to 644 (rw-r--r--) for non-privileged read access
sudo find /var/www/my-site -type f -exec chmod 644 {} +

# Optional: Directly match Nginx's internal container UID
sudo chown -R 101:101 /var/www/my-site
```

### Step 2: Validate the Nginx Configuration and Index Entrypoints
If your `nginx.conf` or virtual host configuration defines a `root` directory without an `index` directive, or if the physical file specified does not exist in the mounted folder, Nginx attempts to generate a directory listing. Because directory listing is disabled by default (`autoindex off;`), Nginx emits a 403 Forbidden response.

Inspect your virtual host configuration block:
```nginx
server {
    listen 80;
    server_name example.com;
    root /usr/share/nginx/html;

    # Enforce valid index fallback sequence
    index index.html index.htm index.php;

    location / {
        try_files $uri $uri/ /index.html =404;
    }
}
```
Verify that the entrypoint file in your host directory matches exact case sensitivity: Linux treats `index.html`, `Index.html`, and `INDEX.HTML` as completely separate files.

### Step 3: Configure Safe SELinux Bind Mount Relabeling
On Red Hat Enterprise Linux (RHEL), AlmaLinux, Rocky Linux, or Fedora, SELinux prevents container processes running in the `container_t` security domain from reading host files unless the files carry the `container_file_t` label.

If you are using Docker Compose, append the `:Z` flag to your volume mount to automatically relabel the directory:
```yaml
services:
  web:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - /var/www/my-site:/usr/share/nginx/html:Z
    restart: unless-stopped
```
*(Technical note: `:Z` configures a private unshared label dedicated to this specific container, while `:z` allows shared read-write access among multiple containers).*

### Step 4: Verify Live Container Permissions via Interactive Exec
To confirm that the worker process can read the mounted files inside the container context:
```bash
# Open a shell inside the running container as the unprivileged user
docker exec -it <container_name_or_id> su -s /bin/sh nginx -c "ls -la /usr/share/nginx/html"
```
If this command successfully lists the directory contents, your permissions are correctly aligned and the 403 error is resolved.

## 🛡️ Security Best Practices
- **Never Run `chmod -R 777`:** Setting universal read/write/execute permissions exposes your host system to arbitrary file modification if an application running inside the container is compromised via remote code execution. Stick to `755` for directories and `644` for files.
- **Run Containers as Non-Root:** Ensure your application stack drops root privileges inside the container, utilizing specific service accounts (`UID 1000`, `101`, or `33`).

## Frequently Asked Questions (FAQ)

### Why does docker-compose return 403 even when chmod 777 was applied?
If parent directories on the host leading up to your bind mount (e.g., `/home/username/projects`) lack execute (`+x`) permissions for other users, the container worker process cannot traverse the directory tree, causing a 403 error regardless of permissions inside the final folder.

### What is the error log signature for Nginx directory listing denial?
Inspecting container logs via `docker logs <container_id>` will show:
`directory index of "/usr/share/nginx/html/" is forbidden, client: ..., request: "GET / HTTP/1.1"`.

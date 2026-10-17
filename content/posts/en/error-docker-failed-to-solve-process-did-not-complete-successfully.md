---
title: "[FIXED] Docker Error 'failed to solve: process did not complete successfully'"
description: "Step-by-step troubleshooting guide to diagnose and fix the Docker build error 'failed to solve: process did not complete successfully: exit code' in Buildx."
category: "Systems & Servers"
date: "2026-10-17"
readTime: "4 min"
tags: ["Docker", "DevOps", "Linux"]
---

The error `ERROR: failed to solve: process "/bin/sh -c..." did not complete successfully: exit code: 1` is one of the most common and puzzling build failures encountered in Docker BuildKit (Buildx). This error message is merely a generic wrapper stating that a command executed by an instruction inside your `Dockerfile` returned a non-zero exit status.

Because BuildKit defaults to an interactive terminal UI that folds background stdout/stderr streams, the true root cause—such as a broken `apt-get` repository, an unhandled `npm` dependency conflict, out-of-memory limits, or architecture mismatches—remains hidden unless specifically queried.

## Quick Diagnostics

| Root Cause | Recommended Fix |
|---|---|
| **Chained `RUN` commands with `&&` masking the failing step** | Run build with `docker build --progress=plain --no-cache .` to expose full verbose logs |
| **Engine incompatibility with modern base images (e.g., Debian Bookworm)** | Update Docker Engine or pin the base image tag to a legacy release (e.g., `bullseye`) |
| **Missing package, deprecated name, or unsynchronized repository index** | Ensure `apt-get update` runs before install commands and verify package names for target architecture |
| **Oversized build context triggering timeouts or OOM killer (exit code 137)** | Add a `.dockerignore` file excluding `node_modules`, `.git`, and local binary build artifacts |

## Step-by-Step Solution

### Step 1: Run the build in plain progress mode to expose raw logs
By default, BuildKit's TUI collapses multi-line outputs. Force plain-text output without cache to pinpoint the exact failure stream:
```bash
docker build --progress=plain --no-cache -t my-app:latest .
```
Inspect the lines immediately preceding the final `failed to solve` line. You will find the actual tool error, such as `E: Unable to locate package`, `npm ERR! code ENOENT`, or a missing compiler dependency.

### Step 2: Break down chained RUN statements into single directives
When a `Dockerfile` bundles multiple operations into one line:
```dockerfile
# Hard to isolate when a middle step fails
RUN apt-get update && apt-get install -y python3-pip curl && pip install -r requirements.txt
```
Temporarily split each task into its own `RUN` instruction to isolate the exact failing binary:
```dockerfile
RUN apt-get update
RUN apt-get install -y python3-pip curl
RUN pip install --no-cache-dir -r requirements.txt
```
Once you resolve the underlying problem, you can safely re-chain them to minimize final image layers.

### Step 3: Prevent context bloat using a strict .dockerignore
If your build crashes with `exit code: 137` (OOMKilled) or `context canceled`, Docker is likely attempting to ingest massive local directories into the build daemon. Place a `.dockerignore` file in your repository root:
```text
.git
.github
node_modules
dist
build
*.log
.env
.venv
```
This substantially speeds up build initiation and prevents incompatible host-compiled binaries from contaminating the container filesystem.

### Step 4: Enforce target architecture and base image pinning
If developing on an Apple Silicon or ARM64 host while deploying to an x86_64 cloud instance, native binaries compiled inside `/bin/sh` may fail silently. Explicitly define the target platform or pin the distribution:
```dockerfile
# Explicitly pin target platform for x86 architectures
FROM --platform=linux/amd64 python:3.11-slim-bookworm

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "app.py"]
```

## Prevention Tips
- **Version pinning:** Avoid floating tags like `latest` in production Dockerfiles; pin exact version digests or stable tags (e.g., `node:20.18-alpine3.20`).
- **Clean package caches within the same layer:** Always pair repository updates and package installations with cache pruning (`apt-get update && apt-get install -y pkg && rm -rf /var/lib/apt/lists/*`) to ensure deterministic builds.
- **Automated linting:** Run `hadolint` as part of your pre-commit hooks or CI/CD pipelines to catch bad practices before testing builds.

## Frequently Asked Questions

### Why does RUN apt-get install return exit code 100?
In Debian/Ubuntu environments, exit code 100 typically means the package list is stale (you must run `apt-get update` in the same `RUN` command) or an outdated Docker daemon is running on a host whose kernel syscalls conflict with modern glibc versions in Debian 12 Bookworm.

### What is the advantage of docker buildx over traditional docker build?
Buildx is the next-generation Docker CLI plugin backed by BuildKit. It provides concurrent stage execution, multi-platform emulation, and advanced cache backends, requiring `--progress=plain` for uninterrupted terminal debugging.

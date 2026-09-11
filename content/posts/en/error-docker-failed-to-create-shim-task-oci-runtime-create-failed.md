---
title: "[SOLVED] Error Docker: failed to create shim task: OCI runtime create failed"
description: "How to fix failed to create shim task OCI runtime create failed executable file not found when launching Docker containers."
category: "Systems & Servers"
tags: ["Docker","DevOps","Containers","Linux"]
readTime: "4 min"
date: "2026-09-11"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **ENTRYPOINT or CMD binary missing inside container image or lacks execution rights** | Verify absolute binary path and apply chmod +x in Dockerfile |
| **Windows CRLF line endings present in entrypoint.sh shell script** | Convert entrypoint script to Unix LF format with dos2unix entrypoint.sh |

When running `docker run` or `docker compose up`, containerd may abort container execution with `failed to create shim task: OCI runtime create failed: runc create failed: unable to start container process: exec: "...": executable file not found in $PATH`. This fatal error prevents container startup because the Linux host kernel cannot invoke the binary or script defined in `ENTRYPOINT` or `CMD`.

> **Quick Solution (1 Minute):**
> 1. Strip Windows CRLF line endings from your startup script:
>    `dos2unix entrypoint.sh`
> 2. Ensure executable permissions before building image:
>    `chmod +x entrypoint.sh && docker build -t my-app .`

## 🚀 Step-by-Step Solution

### Step 1: Convert Windows CRLF Line Endings to Unix LF
If your `entrypoint.sh` script was touched on Windows or committed with Git core.autocrlf enabled, carriage returns (`\r`) corrupt the shebang line. Linux tries to resolve `/bin/sh\r`, failing instantly:
```bash
# Install dos2unix and sanitize the startup script
sudo apt-get install -y dos2unix
dos2unix entrypoint.sh
```

### Step 2: Grant Explicit Execution Permissions in Dockerfile
Ensure execution permissions are permanently baked into the image layers during docker build:
```dockerfile
# Inside your Dockerfile
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
```

### Step 3: Validate Shebang and Alpine Linux Compatibility
Check that your script's shebang calls an interpreter installed in the base image. Alpine Linux does not bundle `/bin/bash` by default, requiring `/bin/sh`:
```bash
#!/bin/sh
set -e
exec "$@"
```
When using JSON exec syntax in `ENTRYPOINT ["entrypoint.sh"]`, always provide the absolute path (`["/usr/local/bin/entrypoint.sh"]`) or ensure the target directory is in `$PATH`.

## 🛡️ Prevention Tips
* Maintain a root `.gitattributes` with `* text eol=lf` to block CRLF pollution across developer environments.
* Verify dependency on glibc vs musl libc when switching container base images from Debian to Alpine.

## Frequently Asked Questions

### Why does this error specifically hit Alpine-based Docker images?
Alpine uses musl libc instead of glibc. Compiled binaries and scripts with dynamic dependencies targeting GNU glibc will fail with executable file not found unless libc6-compat or gcompat is installed.

### How do I debug a crashing container that exits before inspection?
Override the container entrypoint by launching a raw shell: `docker run --rm -it --entrypoint /bin/sh my-image`.

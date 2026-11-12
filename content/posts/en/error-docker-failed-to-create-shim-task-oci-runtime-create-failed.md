---
title: 'Error Docker: failed to create shim task: OCI runtime create failed'
description: >-
  Comprehensive guide to resolving the 'failed to create shim task: OCI runtime create failed: executable file not found' error in Docker, containerd, and Alpine Linux.
category: Systems & Servers
tags:
  - Docker
  - DevOps
  - Containers
  - Linux
readTime: 8 min
date: '2026-09-11'
---

When executing `docker run` or `docker compose up`, the containerd daemon can abruptly abort container execution with the following message:

```text
failed to create shim task: OCI runtime create failed: runc create failed: unable to start container process: exec: "/entrypoint.sh": executable file not found in $PATH: unknown
```

Even when developers verify that the file physically exists inside the image or repository, the container enters an immediate `Exit 127` state. This failure stems from a breakdown between the Open Container Initiative (OCI) runtime (`runc`), the Linux kernel (`execve` system call), and the binary architecture of the target file.

---

## Architectural Analysis and Root Cause

To understand why Docker reports a file not found error despite the file being visible inside the container layer, it is essential to trace the Linux container execution pipeline:

1. **The Role of `containerd-shim` and `runc`:** Docker does not invoke containers directly; it delegates execution to `containerd`, which spawns a dedicated, lightweight `containerd-shim` process for each container. The shim invokes `runc`, the reference OCI runtime implementation.
2. **The `execve` System Call:** Inside `runc`, after setting up Linux namespaces (PID, Mount, Network, IPC) and performing `pivot_root` on the Overlay2 filesystem, the runtime executes `execve(const char *filename, char *const argv[], char *const envp[])`.
3. **Triggering `ENOENT` (Error 2):** The Linux kernel returns `ENOENT` ("No such file or directory") under three distinct scenarios:
   * **Missing Shebang Interpreter:** If a shell script declares `#!/bin/sh\r` (due to Windows CRLF carriage returns) or `#!/bin/bash` in an Alpine Linux image that lacks Bash, the kernel does not complain about the script itself. Instead, it fails to locate the specified interpreter binary, returning `ENOENT`.
   * **Missing ELF Dynamic Linker:** If a compiled binary (in Go with CGO, Rust, C++, or Node.js native addons) was dynamically linked against `glibc` (`/lib64/ld-linux-x86-64.so.2`) and runs inside an Alpine Linux container (which relies on `musl libc`), the kernel attempts to load the ELF interpreter specified in the binary header. Because `/lib64/ld-linux-x86-64.so.2` does not exist in Alpine, `execve` returns `ENOENT`, producing the confusing `executable file not found in $PATH` error message.
   * **Relative Path Omission in `$PATH`:** Using `ENTRYPOINT ["entrypoint.sh"]` rather than an absolute path (`/entrypoint.sh` or `/usr/local/bin/entrypoint.sh`) fails when the current `WORKDIR` is not explicitly exported in the container's `$PATH`.

---

## Laboratory Diagnosis and Inspection

Before modifying Dockerfiles or pipeline configurations, use this diagnostic matrix to isolate the root cause:

| Error Signature | Underlying Root Cause | Technical Mitigation Strategy |
|---|---|---|
| `exec: "/entrypoint.sh": executable file not found in $PATH` (Shell script) | Windows CRLF line endings (`\r\n`) or missing execute permissions (`chmod +x`). | Convert line terminators with `dos2unix` and apply `chmod 755` before building. |
| `exec: "bash": executable file not found in $PATH` | Minimal base image (Alpine Linux, BusyBox, Scratch) lacks the Bash interpreter. | Change shebang to `#!/bin/sh` or install `bash` package via apk. |
| `exec: "./app": executable file not found in $PATH` (Compiled binary) | ABI incompatibility: binary dynamically linked against `glibc` executed in `musl libc` environment. | Compile static binary (`CGO_ENABLED=0`) or install `gcompat` / `libc6-compat` in Alpine. |
| `exec: "entrypoint.sh": executable file not found in $PATH` | Exec syntax with relative path outside container `$PATH`. | Specify canonical absolute path: `ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]`. |
| `runc create failed: ... Permission denied` | Missing executable bit (+x) in the Overlay2 container image layer. | Add explicit `RUN chmod +x /path/to/script` instruction in Dockerfile. |

### Diagnostic Commands

Inspect the offending files on your host and within the container image:

```bash
# 1. Check file line terminators (must return 'ASCII text', NOT 'with CRLF line terminators')
file entrypoint.sh

# 2. Inspect the shebang line for hidden carriage return characters
head -n 1 entrypoint.sh | cat -v

# 3. For compiled binaries, inspect the required ELF dynamic linker
readelf -l app | grep "program interpreter"

# 4. Interactively probe the container filesystem by overriding the entrypoint
docker run --rm -it --entrypoint /bin/sh my-image:tag
```

---

## Step-by-Step Implementation Guide

### Step 1: Sanitize CRLF Carriage Returns (Windows to Unix)

If the script was authored on Windows or checked out with Git's `core.autocrlf` enabled, convert line endings to POSIX-compliant Line Feeds (LF):

```bash
# Option A: Using dos2unix on Debian/Ubuntu
sudo apt-get update && sudo apt-get install -y dos2unix
dos2unix entrypoint.sh

# Option B: Using sed directly in bash
sed -i 's/\r$//' entrypoint.sh
```

Enforce strict line ending preservation across multi-platform teams by creating a `.gitattributes` file in your repository root:

```gitattributes
# Enforce LF endings on shell scripts and Docker configuration
*.sh text eol=lf
Dockerfile text eol=lf
docker-compose*.yml text eol=lf
```

### Step 2: Ensure Shebang and Shell Compatibility

In lightweight container images such as Alpine Linux (`alpine:3.20`), `/bin/bash` does not exist by default; `/bin/sh` links to BusyBox `ash`.

Ensure scripts use POSIX-compliant syntax and standard shebangs:

```bash
#!/bin/sh
set -eu

echo "Initializing containerized application..."
exec "$@"
```

If your entrypoint relies on Bash-specific constructs (arrays, `[[ ... ]]`, process substitution), install `bash` explicitly in the Dockerfile:

```dockerfile
FROM alpine:3.20

# Install bash if scripts require non-POSIX extensions
RUN apk add --no-cache bash ca-certificates

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["start"]
```

### Step 3: Resolve Dynamic Linker Mismatches (glibc vs musl)

When building in Go, Rust, or C++ on Ubuntu or Debian and copying the output into an Alpine runtime container, the dynamic loader will fail.

#### For Golang Applications:
Produce an entirely static, dependency-free binary by disabling CGO:

```bash
# Compile fully static self-contained binary
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o app main.go
```

#### For CGO-Dependent or Third-Party Binaries:
If the binary requires `glibc` libraries, install Alpine's binary compatibility layer:

```dockerfile
FROM alpine:3.20

# Install glibc binary compatibility layer for Alpine
RUN apk add --no-cache gcompat libc6-compat

WORKDIR /app
COPY app /app/app
RUN chmod +x /app/app

ENTRYPOINT ["/app/app"]
```

Alternatively, switch your runtime stage to `debian:bookworm-slim` to match the compilation toolchain:

```dockerfile
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY app /app/app
RUN chmod +x /app/app

ENTRYPOINT ["/app/app"]
```

### Step 4: Validate Exec Syntax and File Permissions

The OCI specification recommends the JSON array syntax for `ENTRYPOINT` and `CMD`:

```dockerfile
# RECOMMENDED: Canonical absolute path and JSON array syntax
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod 755 /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

# AVOID: Relative paths that depend on WORKDIR resolution
# ENTRYPOINT ["entrypoint.sh"]
```

When using bind mounts in local development (`-v $(pwd):/app`), verify that the host script retains executable permissions:

```bash
chmod +x ./entrypoint.sh
```

---

## Edge Case Troubleshooting

### Edge Case 1: Bind Mount Overrides in Docker Compose

A common pitfall occurs when the Dockerfile installs and permissions `/app/entrypoint.sh`, but `docker-compose.yml` mounts the current host directory directly over `/app`:

```yaml
services:
  web:
    build: .
    volumes:
      # If host entrypoint.sh has CRLF or lacks +x, it masks the image build layer
      - .:/app
```

**Solution:** Mount directories selectively or mask the script with an anonymous volume:

```yaml
services:
  web:
    build: .
    volumes:
      - .:/app
      - /app/entrypoint.sh
```

### Edge Case 2: CPU Architecture Mismatch (AMD64 vs ARM64)

Deploying images built on Apple Silicon (M-series) or ARM64 cloud instances to AMD64 hosts without multi-arch emulation produces `exec format error` or `executable file not found`.

Inspect the image architecture and build for the target platform using Docker Buildx:

```bash
# Check image architecture metadata
docker inspect --format '{{.Architecture}}' my-image:tag

# Build targeted multi-architecture image
docker buildx build --platform linux/amd64 -t my-image:tag . --load
```

---

## Frequently Asked Questions

### Why does `docker logs` output nothing when this error occurs?
Because the container process never spawns. The failure takes place during `runc`'s `execve` call before standard output (`stdout`) and standard error (`stderr`) file descriptors can be bound to the container application.

### What is the difference between Shell syntax and Exec syntax in Dockerfile ENTRYPOINT?
Exec syntax (`["binary", "arg1"]`) executes the program directly as PID 1, ensuring proper delivery of UNIX signals (`SIGTERM`, `SIGINT`). Shell syntax (`ENTRYPOINT binary arg1`) wraps execution in `/bin/sh -c`, which mandates the existence of `/bin/sh` in the base image.

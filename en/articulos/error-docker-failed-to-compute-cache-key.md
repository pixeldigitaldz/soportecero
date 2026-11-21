---
title: '[FIXED] Error ''failed to compute cache key'' in Docker Build'
description: >-
  Getting the 'failed to compute cache key' error during docker build?
  Step-by-step guide to fix file path resolution and Dockerfile build contexts.
category: Systems & Servers
tags:
  - Docker
  - DevOps
  - Sysadmin
readTime: 5 min
date: '2026-08-03'
---

The BuildKit error `failed to compute cache key: failed to calculate checksum of ref ...: "/path/to/file": not found` (or `failed to walk: lstat ...: no such file or directory`) aborts `docker build` when a `COPY` or `ADD` instruction references a file or folder that does not exist inside the build context sent to the Docker daemon.

## Quick Diagnostics

| Symptom / Cause | Verification | Immediate Fix |
|---|---|---|
| Build command run from wrong working directory | `ls -la` vs `COPY` source path in `Dockerfile` | Run `docker build -f path/to/Dockerfile .` from project root |
| `.dockerignore` excludes a required file or directory | `cat .dockerignore` | Remove the exclusion or add `!path/to/file` |
| Case mismatch on Linux filesystems (`App.js` vs `app.js`) | `ls -la` inside source directory | Match exact capitalization in `Dockerfile` |
| Broken symlink or file outside build context (`../shared`) | `ls -l` on target file | Move context up to parent directory or copy files in |

## Root Cause & Technical Mechanics

When Docker builds an image with **BuildKit**, it does not read files arbitrarily from your host filesystem. Instead, the CLI packages only the **build context**—the directory passed as the final argument to `docker build` (commonly `.`)—filtered by `.dockerignore`.

Before running a `COPY` or `ADD` layer, BuildKit computes a content-addressed **cache key** by hashing the metadata and checksums (`lstat` + digest) of every matched source file in that context snapshot. If the target path is absent, BuildKit aborts with `failed to compute cache key ... not found`.

Common culprits include:
- Running `docker build .` inside a `docker/` subfolder while `COPY package.json .` expects the repo root.
- Overly broad `.dockerignore` rules (`*`, `*.json`, `build/`) stripping files needed by `COPY`.
- Relative parent paths like `COPY ../common .`, which BuildKit forbids because `../` escapes the context root.
- Multi-stage `COPY --from=builder` referencing a path never generated in the builder stage.

## Step-by-Step Solution

### Step 1: Verify the Build Context Root and `-f` Flag

If your `Dockerfile` lives in a subdirectory (e.g., `deploy/Dockerfile`) while your application source lives at the repository root, run `docker build` from the **root** and pass `-f` to locate the `Dockerfile`:

```bash
# Run from the repository root, NOT inside deploy/
docker build -t my-app:latest -f deploy/Dockerfile .
```

If you need files from a sibling directory in a monorepo, pass the parent folder as the context:

```bash
docker build -t my-service:latest -f services/api/Dockerfile .
```

### Step 2: Inspect `.dockerignore` Rules

Check whether `.dockerignore` is filtering out files your `Dockerfile` explicitly copies:

```bash
cat .dockerignore
```

If `.dockerignore` contains `*` (an allow-list pattern) or broad ignores like `dist/`, `*.env`, or `config/`, add explicit negated exceptions (`!`) for files required in the image:

```plaintext
*
!package.json
!package-lock.json
!src/
```

Note that if a parent directory is ignored (e.g., `config/`), a negated child rule (`!config/prod.json`) will **not** work unless you un-ignore the parent directory first or avoid ignoring the whole directory.

### Step 3: Check Case Sensitivity and Multi-Stage Paths

Linux containers and BuildKit contexts are strictly case-sensitive (`App.js` != `app.js`). Verify exact filenames and inspect multi-stage builder outputs:

```bash
find . -maxdepth 3 -iname "app.js"
docker build --target builder -t debug-builder .
docker run --rm debug-builder ls -la /app
```

### Step 4: Verify the Clean Build

```bash
docker build --progress=plain --no-cache -t my-app:latest .
```

## Frequently Asked Questions

### Why does `docker build` fail on Linux CI/CD when it worked on my Mac or Windows laptop?
macOS (APFS) and Windows (NTFS) are case-insensitive by default, whereas Linux CI runners (Ubuntu/Alpine) are strictly case-sensitive. A `COPY Config.json .` instruction will fail on Linux if the file is named `config.json` in Git.

### How can I see exactly which files Docker is including in the build context?
You can inspect the context by running a minimal diagnostic container or checking `docker build` with a temporary `RUN ls -la` step, or by testing `.dockerignore` exclusions with `rsync --dry-run` / `tar`.

### Does `COPY ../shared` ever work in a Dockerfile?
No. Docker prohibits `COPY` or `ADD` from traversing above the build context root. To share code across services, set the build context to the common parent directory (or use Docker Compose `additional_contexts` in Buildx).

## Prevention Advice

- **Standardize `docker build` from the repo root:** Keep build commands in a `Makefile`, `package.json` script, or `compose.yaml` with `context: .` and `dockerfile: path/to/Dockerfile`.
- **Use explicit `.dockerignore` allow-lists carefully:** When ignoring directories, verify with `git ls-files` that no required build artifacts or lockfiles are masked.
- **Avoid symlinks pointing outside the repo:** Docker's context tar stream does not follow symlinks that resolve outside the context root; copy or vendor shared assets instead.
- **Pin `WORKDIR` explicitly in multi-stage builds:** Always declare `WORKDIR /app` in every `FROM` stage so `COPY --from=...` paths never rely on implicit defaults.

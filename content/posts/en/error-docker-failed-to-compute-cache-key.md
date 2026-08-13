---
title: "[FIXED] Error 'failed to compute cache key' in Docker Build"
description: "Getting the 'failed to compute cache key' error during docker build? Step-by-step guide to fix file path resolution and Dockerfile build contexts."
category: "Systems & Servers"
tags: ["Docker", "DevOps", "Sysadmin"]
readTime: "4 min"
date: "2026-08-03"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Source path in Dockerfile COPY/ADD instruction does not exist** | Verify exact local file path and check `.dockerignore` file |
| **Docker build context pointing to incorrect working directory** | Run `docker build` ensuring proper trailing `.` context syntax |


The error **`failed to compute cache key: failed to walk: lstat ...: no such file or directory`** during `docker build` occurs when a `COPY` or `ADD` instruction in your `Dockerfile` references a local file or directory that does not exist within the **Docker build context**.

> **Quick Solution (1 Minute):**
> 1. Verify the source file path exists inside the directory where you run `docker build .`
> 2. Check if the file is ignored in `.dockerignore`.
> 3. Specify the root context explicitly when building from subfolders: `docker build -f docker/Dockerfile .`

## 🚀 Step-by-Step Troubleshooting

### Step 1: Understand the Docker Build Context
When you execute `docker build -t my-image .`, the trailing dot `.` defines the **build context**. Docker packages and sends files in that directory to the Docker daemon.

If your `Dockerfile` has:
```dockerfile
COPY package.json ./
```
Targeting a file outside the current working folder will cause `failed to compute cache key`.

**Fix:** Move to your project root or adjust your build command context:
```bash
docker build -t my-app:latest -f ./docker/Dockerfile .
```

### Step 2: Check `.dockerignore` Exclusions
Open the `.dockerignore` file in your root folder. If an ignored rule matches a file targeted by `COPY`:
```plaintext
src/config.json
```
Docker excludes it from the context, throwing the `failed to compute cache key` error.

**Fix:** Remove the rule or add an exception prefix `!`:
```plaintext
!src/config.json
```

### Step 3: Check File Case Sensitivity (Linux)
Linux filesystems are case-sensitive. If your file is named `App.js` but your `Dockerfile` has:
```dockerfile
COPY app.js ./
```
Docker fails to locate `app.js`. Update the filename to match exact capitalization.

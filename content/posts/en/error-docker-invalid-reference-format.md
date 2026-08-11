---
title: "[FIXED] Error 'invalid reference format' in Docker"
description: "Getting 'docker: invalid reference format' running docker run or build? Learn how to fix quote syntax, capitalization, and volume paths."
category: "Systems & Servers"
tags: ["Docker", "DevOps", "Sysadmin", "Linux"]
readTime: "3 min"
date: "2026-08-18"
---

The error **`docker: invalid reference format`** (or `invalid reference format: repository name must be lowercase`) occurs when executing `docker run`, `docker pull`, or `docker build` commands with malformed quotes, uppercase characters in image names, or invalid volume syntax (`-v`).

> **Quick Solution (1 Minute):**
> 1. Ensure image names use **lowercase** letters exclusively (`my-app:latest`, not `My-App:latest`).
> 2. On Windows PowerShell, use `"${PWD}"` quotes instead of `'$(pwd)'`.

## 🚀 Step-by-Step Fixes

### Step 1: Use Lowercase Repository & Image Names
Docker strictly enforces lowercase names for image repositories:

* ❌ **Incorrect:** `docker run -d MyCompany/Backend:v1`
* ✅ **Correct:** `docker run -d mycompany/backend:v1`

### Step 2: Fix Volume Mounting Syntax Across OS Shells

Copying Linux commands directly into Windows shell environments often triggers this error:

* **Linux / macOS (Bash / Zsh):**
  ```bash
  docker run -v $(pwd):/app my-image:latest
  ```
* **Windows PowerShell:**
  ```powershell
  docker run -v "${PWD}:/app" my-image:latest
  ```
* **Windows CMD:**
  ```cmd
  docker run -v "%cd%:/app" my-image:latest
  ```

### Step 3: Check Multiline Backslash Escapes
In multiline shell scripts, trailing whitespace after a backslash `\` breaks the command:

```bash
docker run -d \
  --name my-container \
  -p 8080:80 \
  nginx:alpine
```
Ensure no spaces follow any trailing `\` escape character.

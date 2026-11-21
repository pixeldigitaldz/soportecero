---
title: '[FIXED] Error ''invalid reference format'' in Docker'
description: >-
  Getting 'docker: invalid reference format' running docker run or build? Learn
  how to fix quote syntax, capitalization, and volume paths.
category: Systems & Servers
tags:
  - Docker
  - DevOps
  - Sysadmin
  - Linux
readTime: 5 min
date: '2026-08-18'
---

The error `docker: invalid reference format` (or `invalid reference format: repository name must be lowercase`) aborts `docker run`, `docker pull`, `docker tag`, or `docker build` before a container is ever created. It means the Docker CLI's image-reference parser rejected the positional argument it interpreted as the image name—either because the repository name violates OCI naming rules or because a shell syntax mistake shifted a flag value into the image position.

## Quick Diagnostics

| Symptom / Cause | Immediate Action |
|---|---|
| **Uppercase letters in image or tag name** | Convert repository name to lowercase: `mycompany/api:v1` |
| **Unquoted spaces in `-v` volume mount path** | Wrap the entire mount mapping in double quotes: `-v "/path with spaces:/app"` |
| **Wrong working-directory variable for OS shell** | Use `$(pwd)` in Bash, `"${PWD}"` in PowerShell, `"%cd%"` in CMD |
| **Trailing space after `\` in multiline command** | Remove any whitespace after `\` or join lines into one command |

## Root Cause & Technical Mechanics

The Docker CLI parses every `docker run [OPTIONS] IMAGE [COMMAND]` invocation strictly. Everything after the options must begin with a valid OCI image reference matching `[registry/][namespace/]repository[:tag|@digest]`. Under the OCI Distribution Specification, repository names only allow lowercase ASCII letters, digits, and separators (`.`, `_`, `-`). Any uppercase character immediately fails regex validation.

More subtly, `invalid reference format` is often a **shell tokenization bug** rather than an image-naming mistake. For example:
* If a path passed to `-v /Users/John Doe/app:/app` is unquoted, the shell splits it on the space. `-v` consumes `/Users/John`, and the parser treats `Doe/app:/app` as the `IMAGE` argument—which fails reference validation because of the uppercase `D` and colon placement.
* On Windows PowerShell, `$(pwd)` returns a `PathInfo` object or fails inside unquoted strings, while copying smart/curly quotes (`“` `”`) from a blog or chat tool passes literal Unicode quote characters into the image string.
* In multiline Bash scripts, a single space after a line-continuation backslash (`\ `) cancels the escape, prematurely terminating `docker run` and turning the next line's flags or image into invalid tokens.

## Step-by-Step Solution

### 1. Enforce Lowercase OCI Repository Names
Verify that your image repository and namespace contain zero uppercase characters:
```bash
# Incorrect (fails with invalid reference format)
docker build -t MyOrg/WebApp:Latest .

# Correct
docker build -t myorg/webapp:latest .
```
*(Note: Tags after the colon technically allow uppercase letters, though lowercase is standard; repository names before the colon strictly forbid uppercase.)*

### 2. Use Correct Shell-Specific Path Expansion and Quoting
Always quote bind-mount paths and match the current-directory syntax to your active shell:

* **Linux / macOS (Bash or Zsh):**
  ```bash
  docker run --rm -v "$(pwd):/app" -w /app node:22-alpine node -v
  ```
* **Windows PowerShell:**
  ```powershell
  docker run --rm -v "${PWD}:/app" -w /app node:22-alpine node -v
  ```
* **Windows Command Prompt (CMD):**
  ```cmd
  docker run --rm -v "%cd%:/app" -w /app node:22-alpine node -v
  ```

### 3. Inspect Multiline Scripts for Trailing Whitespace or Smart Quotes
If you are running a multiline command from a script or documentation, strip trailing spaces after backslashes and check for non-ASCII quotes:
```bash
# Inspect invisible spaces after backslashes
cat -A run-container.sh
```
Any line ending in `\ $` instead of `\$` has a trailing space that breaks line continuation. Remove the trailing spaces so every backslash is immediately followed by a newline:
```bash
docker run -d \
  --name app-server \
  -p 8080:80 \
  -v "${HOME}/data:/data" \
  nginx:alpine
```

### 4. Verify Variable Expansion Before Running Docker
When using shell variables like `$IMAGE_NAME` or `$CI_COMMIT_SHA`, echo the full command first to ensure no variable is empty:
```bash
echo "docker run --rm ${IMAGE_REPO}:${IMAGE_TAG}"
```
If `$IMAGE_REPO` is empty, `docker run :latest` triggers `invalid reference format`.

## Frequently Asked Questions

**Why does `docker run -v $(pwd):/app` fail when my folder name has a space?**
Without double quotes around `"$(pwd):/app"`, Bash performs word splitting on the expanded path. Wrapping the entire `-v` argument in double quotes keeps it as a single token.

**Can `docker compose` also throw `invalid reference format`?**
Yes. In `compose.yaml`, if an `image:` field references an unset `.env` variable like `image: ${REGISTRY}/api:${TAG}` and `REGISTRY` is empty, Compose passes `/api:` to the daemon, triggering the exact same parser error.

**Why did copying a working command from Notion or Slack trigger this error?**
Rich-text editors often auto-convert straight ASCII quotes (`"`) into typographic curly quotes (`“` or `”`) and hyphens into en-dashes (`–`). Docker rejects those characters.

## Prevention Advice

* Always quote bind mounts (`-v "$(pwd):/workspace"`) and environment variable expansions (`"${IMAGE}:${TAG}"`) in shell scripts.
* Enable `set -u` (`nounset`) in Bash deployment scripts so unset image or tag variables fail immediately instead of passing malformed references to Docker.
* Move complex `docker run` invocations with multiple mounts and flags into a `compose.yaml` file to eliminate shell-escaping differences across macOS, Linux, and Windows.

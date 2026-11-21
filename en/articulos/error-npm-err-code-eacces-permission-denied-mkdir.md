---
title: '[FIXED] Error ''npm ERR! code EACCES permission denied'' in Linux'
description: >-
  Getting npm EACCES permission denied errors installing global packages? Learn
  how to fix npm directory permissions without using sudo.
category: Web & Code
tags:
  - Node.js
  - npm
  - Linux
readTime: 5 min
date: '2026-08-03'
---

The error `npm ERR! code EACCES` (`EACCES: permission denied, mkdir '/usr/local/lib/node_modules/...'`) occurs when `npm install -g` attempts to write global packages or binaries into root-owned system directories while running under an unprivileged user account.

## Quick Diagnostics

| Symptom / Cause | Immediate Action |
|---|---|
| **`EACCES` on `/usr/local/lib/node_modules`** | Point npm's `prefix` to a user-owned folder (`~/.npm-global`) |
| **Using system-packaged Node.js (`apt install nodejs`)** | Switch to **nvm** or **fnm** so Node lives inside `$HOME` |
| **`EACCES` inside a local project's `node_modules`** | Reclaim ownership with `sudo chown -R $USER:$USER .` |
| **`EACCES` on `~/.npm` cache directory** | Fix cache ownership: `sudo chown -R $(id -u):$(id -g) ~/.npm` |

## Root Cause & Technical Mechanics

When Node.js is installed via a system package manager (`apt`, `dnf`, or the official tarball extracted into `/usr/local`), npm's default global `prefix` resolves to `/usr/local`. Consequently, `npm install -g <pkg>` tries to create subdirectories under `/usr/local/lib/node_modules` and symlinks in `/usr/local/bin`, both of which are owned by `root:root` with `0755` permissions.

Running `sudo npm install -g` appears to bypass the error, but it introduces two serious side effects: first, arbitrary `postinstall` lifecycle scripts inside third-party npm packages execute with full root privileges; second, npm writes root-owned cache files into `~/.npm` (preserving `$HOME` under `sudo`), which subsequently triggers `EACCES` errors even on local `npm install` commands.

## Step-by-Step Solution

### Step 1: Check your current npm prefix and cache ownership

Verify where npm is trying to install global packages and whether your local cache has root-owned files:

```bash
npm config get prefix
ls -ld /usr/local/lib/node_modules ~/.npm 2>/dev/null
```

If `prefix` is `/usr/local` or `/usr`, do not `chmod 777` system folders—move the prefix to your home directory or use a Node version manager instead.

### Step 2: Reconfigure npm's global prefix to `$HOME` (Quick Fix)

Create a dedicated user-writable directory and configure npm to use it:

```bash
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
```

Add `~/.npm-global/bin` to your shell `PATH`. For Bash (`~/.bashrc`) or Zsh (`~/.zshrc`):

```bash
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

If you previously ran `sudo npm`, repair ownership of your npm cache as well:

```bash
sudo chown -R "$(id -u):$(id -g)" "$HOME/.npm"
```

Verify global installation works without `sudo`:

```bash
npm install -g typescript
which tsc
```

`which tsc` should return `/home/<user>/.npm-global/bin/tsc`.

### Step 3: Switch to nvm for isolated Node environments (Recommended)

For long-term development, **nvm** (Node Version Manager) installs Node.js, npm, and all global packages entirely inside `~/.nvm`, eliminating root permission conflicts across Node versions:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install --lts
nvm use --lts
```

Confirm that both `node` and `npm` now resolve inside `$HOME/.nvm`:

```bash
which node
npm config get prefix
```

## Frequently Asked Questions

**Why did `npm install` fail with `EACCES` inside my own project folder?**
If you ran `sudo npm install` earlier or cloned/extracted files as root, `node_modules` or `package-lock.json` is owned by `root`. Run `sudo chown -R "$(id -u):$(id -g)" .` inside your project root to restore ownership.

**Is `chmod -R 777 /usr/local/lib/node_modules` a safe fix?**
No. Making system directories world-writable allows any local process or unprivileged service user to tamper with global binaries executed by other users or root.

**What if I still get `EACCES` in CI/CD or Docker containers?**
In Docker images where the container runs as a non-root user (`USER node`), ensure `ENV NPM_CONFIG_PREFIX=/home/node/.npm-global` and `PATH` are set before running `npm install -g`, or run `chown -R node:node /app` after `COPY`.

## Prevention Advice

- **Never run `sudo npm install`:** Use a user-local prefix (`~/.npm-global`) or a version manager like `nvm`, `fnm`, or `volta`.
- **Use `npx` for one-off CLI tools:** Running `npx create-vite` or `npx eslint` avoids polluting global `node_modules` altogether.
- **Audit `.npmrc` settings:** Keep `prefix=${HOME}/.npm-global` in `~/.npmrc` if you rely on distro-packaged Node.js.
- **Set `USER` cleanly in Dockerfiles:** Match file ownership with `COPY --chown=node:node` in containerized Node.js builds.

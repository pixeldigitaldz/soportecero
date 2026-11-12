---
title: How to Fix NPM EACCES Permission Denied Errors in Linux and macOS
description: >-
  Learn how to fix NPM EACCES permission denied errors when installing global and local packages.
  Reconfigure custom npm prefixes, repair node_modules ownership, and avoid dangerous sudo usage.
category: Web & Code
tags:
  - NPM
  - NodeJS
  - Linux
  - JavaScript
  - DevOps
readTime: 5 min
date: '2026-07-27'
---

Encountering an `npm ERR! code EACCES` or `npm ERR! syscall mkdir: Error: EACCES: permission denied, access '/usr/local/lib/node_modules'` error while installing global packages (`npm install -g`) or local project dependencies is one of the most common stumbling blocks in JavaScript and TypeScript development.

This error occurs because the standard system package installation directory on Linux and macOS (`/usr/local/lib` or `/usr/lib`) is owned exclusively by the `root` administrative account. When developers attempt to bypass this error by prefixing commands with `sudo npm install -g`, they inadvertently create severe security vulnerabilities and corrupt local project permissions.

Understanding how to properly isolate NPM's global prefix in your personal user directory or manage Node.js runtimes using a version manager like **NVM** eliminates permission friction permanently.

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Global NPM prefix defaults to root-owned system directories (`/usr/local/lib`)** | Reconfigure NPM prefix to user-writable path: `npm config set prefix '~/.npm-global'` |
| **Local project `node_modules` owned by root due to accidental prior `sudo` use** | Reclaim project ownership: `sudo chown -R $USER:$USER .` |
| **Corrupted or root-owned NPM cache directory (`~/.npm`)** | Fix cache ownership with `sudo chown -R $USER:$USER ~/.npm` |
| **System-wide Node.js package installed via apt/pacman without user isolation** | Use Node Version Manager (NVM) or Fast Node Manager (fnm) for isolated environments |

## 🚀 Step-by-Step Implementation Guide

### Method 1: Reconfigure NPM's Global Prefix to Your User Directory
If you prefer using your operating system's system-installed Node.js package, redirect NPM's global directory to a user-owned path in your home folder:

1. Create a dedicated directory for your global packages:
```bash
mkdir -p ~/.npm-global
```
2. Instruct NPM to install all future global modules into this folder:
```bash
npm config set prefix '~/.npm-global'
```
3. Export the newly created bin directory to your shell search path. Append the path declaration to your shell configuration profile (`~/.bashrc` or `~/.zshrc`):
```bash
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.bashrc
```
4. Reload your shell environment into active memory:
```bash
source ~/.bashrc
```
5. Test a global package installation without `sudo`:
```bash
npm install -g firebase-tools
```
The binary will install cleanly into `~/.npm-global/bin/firebase` and run immediately.

### Method 2: Repair Local Project Permissions
If you encounter `EACCES: permission denied` when running a standard local `npm install` inside a project, a prior command was likely executed with `sudo`, leaving the `node_modules` folder or `package-lock.json` owned by root:
```bash
# Reclaim ownership of all project files for your current active user
sudo chown -R $(whoami):$(id -gn) .

# Reclaim ownership of the global npm cache
sudo chown -R $(whoami):$(id -gn) ~/.npm

# Cleanly reinstall dependencies
rm -rf node_modules
npm install
```

### Method 3: Adopt Node Version Manager (NVM) (Recommended Standard)
The industry standard approach for professional Node.js development is to manage runtimes with **NVM (Node Version Manager)** or **fnm**. Version managers install complete Node.js environments inside `~/.nvm/`, where your personal user account inherently possesses complete read, write, and execute permissions:
```bash
# Install NVM via the official curl installer
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Reload shell configuration
source ~/.bashrc

# Install and activate the latest Node.js Long-Term Support (LTS) release
nvm install --lts
nvm use --lts
```
With NVM active, `npm install -g <package>` operates seamlessly without requiring custom prefix overrides or elevated root permissions.

## 🛡️ Security Best Practices
- **Never Run `sudo npm install`:** Executing NPM installations with superuser privileges grants third-party npm package maintainers and lifecycle scripts (`preinstall`, `install`, `postinstall`) full root execution access on your operating system. A compromised dependency could inject malicious binaries into `/usr/bin` or exfiltrate your SSH keys.
- **Audit Project Dependencies:** Always run `npm audit` periodically to identify known Common Vulnerabilities and Exposures (CVEs) across your dependency graph.

## Frequently Asked Questions (FAQ)

### Why does 'sudo npm install -g' cause problems later on?
Running `sudo npm install -g` creates files owned by root inside your personal `~/.npm` cache directory. Subsequent non-sudo installations will then fail with `EACCES` because your normal user account cannot write lockfiles or cached tarballs to those root-owned directories.

### How do I check where NPM is currently installing global packages?
Run `npm config get prefix` and `npm root -g`. If the output points to `/usr` or `/usr/local`, you are using root-restricted system paths and should apply Method 1 or Method 3.

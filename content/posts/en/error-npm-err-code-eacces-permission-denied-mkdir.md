---
title: "[FIXED] Error 'npm ERR! code EACCES permission denied' in Linux"
description: "Getting npm EACCES permission denied errors installing global packages? Learn how to fix npm directory permissions without using sudo."
category: "Web & Code"
tags: ["Node.js", "npm", "Linux"]
readTime: "4 min"
date: "2026-08-03"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Running global npm install without write permissions to /usr/local/lib/node_modules** | Change default global npm directory to user home directory |
| **Project directory ownership belonging to root user** | Run `sudo chown -R $USER:$USER .` in project root directory |


The error **`npm ERR! code EACCES permission denied`** (or `EACCES: permission denied, access '/usr/local/lib/node_modules'`) occurs when trying to install global packages via `npm install -g <package>`. It happens because system Node directories are owned by `root`, preventing regular users from writing to them.

> **Quick Solution (Recommended):**
> Change npm's default global directory to your home folder:
> ```bash
> mkdir ~/.npm-global
> npm config set prefix '~/.npm-global'
> echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc && source ~/.bashrc
> ```

## 🚀 Step-by-Step Fixes (Without sudo)

### Method 1: Reconfigure NPM Default Global Directory
Running `sudo npm` creates security vulnerabilities and corrupts folder permissions for non-root users.

1. **Create a global package folder in your HOME directory:**
   ```bash
   mkdir -p ~/.npm-global
   ```

2. **Configure npm to use the new directory:**
   ```bash
   npm config set prefix '~/.npm-global'
   ```

3. **Append the new binary path to environment PATH:**
   For Bash (`~/.bashrc`):
   ```bash
   echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
   source ~/.bashrc
   ```
   For Zsh (`~/.zshrc`):
   ```bash
   echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc
   source ~/.zshrc
   ```

4. **Verify global installation:**
   ```bash
   npm install -g typescript ts-node
   ```

### Method 2: Use Node Version Manager (NVM)
NVM is the industry standard for managing Node.js environments. It installs Node versions inside the user's home directory, completely isolating permissions.

```bash
# Install NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Reload terminal
source ~/.bashrc

# Install Node LTS
nvm install --lts
```

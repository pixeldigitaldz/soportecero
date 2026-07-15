---
title: "How to Fix Corrupt PGP Signature and Invalid Key Errors in CachyOS"
description: "Learn how to reset and update Pacman keyring keys to fix invalid PGP signature errors on CachyOS and Arch Linux."
category: "Systems & Servers"
tags: ["CachyOS", "Arch Linux", "Pacman"]
readTime: "4 min"
date: "2026-07-18"
---

The Pacman critical error `key "..." could not be looked up remotely` or `signature from "..." is invalid` in CachyOS and Arch Linux-based distributions occurs when the local cryptographic keyring gets outdated or corrupt, preventing secure package update installation.

## 🚀 Step-by-Step Solution

### Step 1: Clean the Pacman package cache
The first step is to remove any partially downloaded or corrupt packages from your local storage:
```bash
# Completely clear Pacman's package cache
sudo pacman -Scc
```

### Step 2: Rebuild the Pacman keyring
To repair broken descriptors in your local security database, initialize Pacman's keyring from scratch:
```bash
# Delete the corrupted local GnuPG keyring directory
sudo rm -rf /etc/pacman.d/gnupg

# Initialize a clean security keyring
sudo pacman-key --init

# Populate the keyring with default Arch and CachyOS keys
sudo pacman-key --populate archlinux cachyos
```

### Step 3: Manually update official keys
Once the keyring is rebuilt, install the updated key packages directly to renew cryptographic expiration dates:
```bash
# Install the latest keyring packages directly
sudo pacman -Sy archlinux-keyring cachyos-keyring

# Perform a full system update
sudo pacman -Syu
```

## 🛡️ Prevention Advice
Recommended security practices:
- Do not disable signature verification in `/etc/pacman.conf` by changing `SigLevel = Required Database Optional` to `TrustAll` or `Never`. Doing so exposes your system to silent malware installations from modified or MITM packages.

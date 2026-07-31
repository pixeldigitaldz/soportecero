---
title: How to Fix archlinux-keyring Out-of-Date Error in Arch Linux & Pacman
description: >-
  A quick-start guide to resolve PGP signature verification failures and update the archlinux-keyring package on Arch Linux, Manjaro, and CachyOS.
category: Systems & Servers
tags:
  - Arch Linux
  - Pacman
  - Sysadmin
readTime: 4 min
date: '2026-08-04'
---

When performing a system update or installing packages on Arch Linux and its derivatives (such as CachyOS, EndeavourOS, or Manjaro) using `pacman -Syu`, users frequently encounter errors like `error: signature from "Developer Name <email>" is unknown trust` or `error: package is invalid or corrupted (invalid PGP signature)`. This error occurs because developer GPG signing keys expire or get rotated over time, leaving the local `archlinux-keyring` unable to verify newly signed package manifests.

## 🔍 Quick Diagnostics

| Symptom | Root Cause | Solution |
| :--- | :--- | :--- |
| `error: signature from "..." is unknown trust` or `invalid or corrupted package` during pacman operations | Developer PGP keys have changed or local keyring database hasn't been updated in months | Isolate and update `archlinux-keyring` first, then reset the local GPG trust store |
| Pacman fails to download repository `.sig` files or reports invalid timestamps | System clock is out of sync or pacman mirrorlist is outdated | Enable NTP time synchronization using `systemd-timesyncd` and refresh mirror rankings |
| Running `pacman -Sy archlinux-keyring` also fails due to broken PGP signatures | The local PGP key database (`/etc/pacman.d/gnupg`) is corrupted or damaged | Purge local GPG key directory, re-initialize pacman keys, and populate master keys |

## 🚀 Step-by-Step Solution

### Step 1: Synchronize System Clock (NTP)
PGP key verification relies heavily on accurate timestamps. If your system clock has drifted, pacman will reject legitimate developer signatures:

```bash
# Enable NTP system clock synchronization
sudo systemctl enable --now systemd-timesyncd

# Confirm system clock accuracy
timedatectl status
```

### Step 2: Update `archlinux-keyring` Independently
Before attempting a full system upgrade (`pacman -Syu`), force an isolated update of the master GPG keyring package:

```bash
# Sync package databases and update ONLY archlinux-keyring
sudo pacman -Sy archlinux-keyring

# For CachyOS or Manjaro users, update distro-specific keyrings as well:
# sudo pacman -Sy cachyos-keyring
# sudo pacman -Sy manjaro-keyring

# Once the keyring update succeeds, execute full system upgrade:
sudo pacman -Syu
```

### Step 3: Rebuild Corrupted GPG Keyring Database
If updating `archlinux-keyring` standalone fails with unknown trust errors, purge and re-initialize the `/etc/pacman.d/gnupg` trust store:

```bash
# 1. Remove corrupted local keyring directory
sudo rm -rf /etc/pacman.d/gnupg

# 2. Re-initialize Pacman keyring structure
sudo pacman-key --init

# 3. Populate default Arch Linux master keys
sudo pacman-key --populate archlinux

# For CachyOS / Manjaro users, populate distro keys:
# sudo pacman-key --populate cachyos

# 4. Refresh keys from PGP keyservers
sudo pacman-key --refresh-keys

# 5. Clear cached package archives and run upgrade
sudo pacman -Sc --noconfirm
sudo pacman -Syu
```

## 🛡️ Prevention Advice

- **Update Your System Regularly**: On rolling release distributions like Arch Linux, neglecting system updates for several months drastically increases the likelihood of keyring trust drift.
- **Enable Automated Keyring Sync Timers**: Enable `archlinux-keyring-wkd-sync.timer` if available on your system to fetch key updates periodically via Web Key Directory (WKD):
  ```bash
  sudo systemctl enable --now archlinux-keyring-wkd-sync.timer
  ```
- **Never Set `SigLevel = Never` in `/etc/pacman.conf`**: Bypassing PGP signature checks entirely disables package integrity verification, leaving your system vulnerable to tampered or malicious binaries.

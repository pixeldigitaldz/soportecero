---
title: "How to Safely Clean Pacman Package Cache in CachyOS and Arch Linux"
description: "Learn how to free disk space in CachyOS and Arch Linux by pruning Pacman and Yay cache using paccache, pacman -Sc, and systemd automation."
category: "Systems & Servers"
tags: ["CachyOS", "Arch Linux", "Pacman", "Linux", "SysAdmin", "Storage"]
readTime: "5 min"
date: "2026-06-25"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **/var/lib/pacman and /var/cache/pacman/pkg directories accumulating dozens of package revisions** | Prune obsolete package tarballs while retaining the latest 2 versions via `sudo paccache -r` |
| **AUR build cache bloating user directories (~/.cache/yay or ~/.cache/paru)** | Clean AUR cache using `yay -Sc --aur` or purge `~/.cache/yay` |

In CachyOS and Arch Linux environments, the Pacman package manager never automatically purges downloaded `.pkg.tar.zst` archive binaries from `/var/cache/pacman/pkg/`. Over time, this directory routinely swells to 20GB-50GB, triggering low storage warnings on root partitions.

## 🚀 Step-by-Step Solution

### Step 1: Measure Current Pacman Cache Footprint
Evaluate exact disk utilization:
```bash
# Inspect storage footprint of the Pacman cache
du -sh /var/cache/pacman/pkg/
```

### Step 2: Prune Obsolete Versions Safely Using paccache
The official `paccache` utility (from `pacman-contrib`) clears obsolete revisions while preserving safety rollbacks:
```bash
# 1. Ensure pacman-contrib is installed
sudo pacman -S pacman-contrib --noconfirm

# 2. Retain only the 2 most recent package versions
sudo paccache -r -k 2

# 3. Purge cached files for uninstalled packages
sudo paccache -ruk0
```

### Step 3: Comprehensive Cache Flush (For Emergency Space Reclamation)
When immediate disk recovery is mandatory:
```bash
# Purge uninstalled package archives
sudo pacman -Sc --noconfirm

# Purge ALL cached archives completely
sudo pacman -Scc --noconfirm
```

### Step 4: Clear AUR Build Repositories (Yay / Paru)
AUR helpers compile binaries inside user home directories:
```bash
# If using Yay:
yay -Sc --aur --noconfirm
rm -rf ~/.cache/yay/*

# If using Paru:
paru -Scc --noconfirm
```

## 🛡️ Prevention Advice
- **Enable automated systemd cache cleanup:** Activate the built-in systemd timer for automated weekly pruning:
```bash
sudo systemctl enable --now paccache.timer
```
- **Prune orphaned dependencies regularly:** Remove detached packages via `sudo pacman -Rns $(pacman -Qtdq)`.

## ❓ Frequently Asked Questions (FAQ)

### Why does Pacman retain all downloaded tarballs?
To allow instant offline package downgrades (`pacman -U /var/cache/pacman/pkg/pkgname-old.pkg.tar.zst`) if an upstream package update introduces regressions.

### Is paccache.timer safe for production machines?
Yes. The service runs weekly in the background, keeping the 3 most recent package versions intact for stability.

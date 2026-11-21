---
title: How to Safely Clean Pacman Package Cache in CachyOS and Arch Linux
description: >-
  Learn how to free disk space in CachyOS and Arch Linux by pruning Pacman and
  Yay cache using paccache, pacman -Sc, and systemd automation.
category: Systems & Servers
tags:
  - CachyOS
  - Arch Linux
  - Pacman
  - Linux
  - SysAdmin
  - Storage
readTime: '5 min'
date: '2026-06-25'
---

In CachyOS, Arch Linux, and EndeavourOS, `pacman` downloads compressed `.pkg.tar.zst` archives and their `.sig` signatures into `/var/cache/pacman/pkg/` during every `pacman -Syu` upgrade, but it never deletes old revisions automatically. On an active rolling-release workstation, this cache routinely balloons to 25 GB–60 GB and can fill the root (`/`) partition, causing failed kernel upgrades or broken initramfs generation.

## Quick Diagnostics

| Symptom / Cause | Immediate Action |
|---|---|
| **`/var/cache/pacman/pkg/` consuming tens of gigabytes** | Keep last 2 versions with `sudo paccache -rk2` |
| **Removed packages still sitting in cache** | Purge uninstalled tarballs via `sudo paccache -ruk0` |
| **AUR helpers (`paru` / `yay`) hoarding Git & build artifacts** | Clear `~/.cache/paru/clone` or `~/.cache/yay` |
| **Partial `.part` downloads blocking disk space** | Delete incomplete downloads with `sudo rm -f /var/cache/pacman/pkg/*.part` |

## Root Cause & Technical Mechanics

Pacman retains every historical package tarball intentionally so you can perform an offline downgrade (`sudo pacman -U /var/cache/pacman/pkg/<pkg>-<oldver>.pkg.tar.zst`) if a rolling update breaks a GPU driver, Mesa build, or bootloader.

Unlike `apt` or `dnf`, which often purge intermediate package archives by default, Arch-based distributions delegate cache retention to the administrator. CachyOS compounds cache growth slightly faster than vanilla Arch because it ships architecture-optimized repositories (`cachyos-v3`, `cachyos-v4`, `cachyos-znver4`) alongside frequent kernel (`linux-cachyos`) and compiler updates. Additionally, AUR helpers like `paru` (default on CachyOS) and `yay` clone full Git repositories and compile Rust/C++ targets inside `~/.cache/`, which `pacman` commands never touch.

## Step-by-Step Solution

### 1. Measure Current Cache and Root Partition Usage

Check available root space and inspect the exact footprint of both the system cache and your AUR cache:

```bash
df -h /
sudo du -sh /var/cache/pacman/pkg/
du -sh ~/.cache/paru/ ~/.cache/yay/ 2>/dev/null
```

### 2. Prune Old Versions Safely with `paccache`

Install `pacman-contrib` (if not already present) and use `paccache` so you always retain the two most recent versions of installed packages for emergency rollbacks:

```bash
sudo pacman -S --needed pacman-contrib
sudo paccache -rk2
sudo paccache -ruk0
```

- `-rk2` removes all cached versions except the latest 2 for currently installed packages.
- `-ruk0` removes all cached versions of packages that are no longer installed on the system.

Verify how much space was reclaimed:

```bash
sudo du -sh /var/cache/pacman/pkg/
```

### 3. Clean AUR Helper Build Caches (`paru` / `yay`)

If you use `paru` (standard in CachyOS) or `yay`, prune stale source clones and compiled `.pkg.tar.zst` artifacts from your home directory:

```bash
# For Paru users:
paru -Sc

# For Yay users:
yay -Sc --aur
```

If `du -sh ~/.cache/paru/clone` still shows several gigabytes of orphaned Git repositories (common with `-git` AUR packages), remove the clone directory safely:

```bash
rm -rf ~/.cache/paru/clone/*
```

### 4. Emergency Full Cache Flush (Low-Disk Recovery)

Only if your root filesystem is at 99%–100% capacity and `paccache -rk2` is not enough, purge all cached packages completely:

```bash
sudo pacman -Scc
```

Confirm with `y` when prompted. Note that afterward, offline downgrades will require re-downloading from mirrors or the Arch Linux Archive.

### 5. Automate Weekly Pruning with `paccache.timer`

Enable the built-in systemd timer so `paccache` runs automatically every week (retaining 3 versions by default):

```bash
sudo systemctl enable --now paccache.timer
systemctl status paccache.timer
```

## Frequently Asked Questions

### Will deleting `/var/cache/pacman/pkg/` break currently installed programs?
No. Installed binaries, libraries, and configuration files live in `/usr/`, `/etc/`, and `/var/lib/pacman/local/`. The `/var/cache/pacman/pkg/` directory only stores compressed installation archives.

### Why shouldn't I run `rm -rf /var/cache/pacman/pkg/*` directly?
Deleting everything manually removes any fallback `.pkg.tar.zst` files needed for recovery and can also delete `download-*` temporary directories if a pacman lock is active. Using `paccache -rk2` or `pacman -Scc` is safer and respects pacman's directory structure.

### Does `paccache` clean `/var/lib/pacman/sync/`?
No. `/var/lib/pacman/sync/` holds repository metadata databases (`.db` files), which are small (typically under 100 MB) and required for `pacman -Ss` searches.

## Prevention Advice

- **Keep `paccache.timer` active:** Weekly automated pruning prevents multi-gigabyte surprises without losing rollback protection.
- **Remove orphaned dependencies:** Periodically run `pacman -Qtdq` to list unneeded build/runtime dependencies and remove them with `sudo pacman -Rns $(pacman -Qtdq)`.
- **Use a Pacman hook for automatic cleanup:** Drop a `/etc/pacman.d/hooks/clean_package_cache.hook` file to trigger `/usr/bin/paccache -rk2` after every `Upgrade` or `Remove` transaction.
- **Watch `/boot` separately:** If you use `systemd-boot` on CachyOS, old kernels do not live in `/var/cache/pacman/pkg/`—they are managed by `mkinitcpio` and `sdboot-manage`.

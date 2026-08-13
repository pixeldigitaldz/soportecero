---
title: How to Fix GameMode and MangoHud Not Working in Linux Gaming
description: >-
  Fix common issues where Feral GameMode or MangoHud fails to activate, display
  overlay stats, or boost performance in Linux gaming.
category: Gaming Tech
tags:
  - Linux
  - Gaming
  - Performance
readTime: 4 min
date: '2026-07-27'
---

Feral GameMode (`gamemoded`) and MangoHud are essential tools for gaming on Linux: GameMode dynamically tweaks CPU governors, I/O priorities, and GPU power states, while MangoHud provides a customizable Vulkan/OpenGL overlay to monitor FPS, frame times, temperatures, and hardware load. However, missing 32-bit libraries, systemd DBus session mismatches, or invalid launch syntax can cause either tool to fail silently.

## Quick Diagnostics

| Cause | Solution |
|---|---|
| **MangoHud overlay does not display in Steam games**: Missing 32-bit multilib MangoHud packages (`lib32-mangohud`) or improper launch options | Use `mangohud %command%` and install 32-bit compatibility libraries |
| **`gamemoded` fails to set the CPU governor to `performance`**: `gamemoded.service` user unit is disabled or missing DBus permissions | Enable `gamemoded` user service via systemd and verify with `gamemoded -t` |
| **Game crashes on startup with MangoHud under Wayland compositors**: Vulkan implicit layer incompatibility or conflicting overlay hooks | Set explicit Vulkan layers and clean up `MangoHud.conf` settings |

## 🚀 Step-by-Step Solution

### Step 1: Verify and Enable the GameMode Daemon (`gamemoded`)
Ensure that the `gamemoded` daemon is installed and running under your current user session:

```bash
# Check the systemd user service status
systemctl --user status gamemoded.service

# Enable and start the user service if it is inactive
systemctl --user enable --now gamemoded.service

# Run the official GameMode self-diagnostic tool
gamemoded -t
```
*(If the CPU governor test fails, ensure `dbus` and `cpupower` utilities are installed on your distribution).*

### Step 2: Install Both 32-bit and 64-bit MangoHud Libraries
Legacy titles and 32-bit Windows games running through Proton require MangoHud libraries compiled for both architectures (`x86` and `x86_64`):

```bash
# On Arch Linux / CachyOS / Manjaro:
sudo pacman -S mangohud lib32-mangohud gamemode lib32-gamemode

# On Ubuntu / Debian / Pop!_OS:
sudo apt install mangohud gamemode mangohud:i386
```

### Step 3: Configure Steam and Lutris Launch Options
In Steam, right-click your game > *Properties* > *General* > *Launch Options*, and input the following command string:

```bash
# Recommended command combination for GameMode + MangoHud
gamemoderun mangohud %command%

# Force inline MangoHud configuration using environment variables
MANGOHUD=1 MANGOHUD_CONFIG=cpu_temp,gpu_temp,fps,fps_limit=144 gamemoderun %command%
```

### Step 4: Create and Tune MangoHud Configuration File
Customize layout settings and fix Wayland overlay glitches by managing the user config file:

```bash
# Create configuration directory
mkdir -p ~/.config/MangoHud/

# Edit or create MangoHud.conf
nano ~/.config/MangoHud/MangoHud.conf
```

Add the following optimized configuration settings:
```ini
legacy_layout=false
gpu_stats
gpu_temp
cpu_stats
cpu_temp
fps
frametime=1
toggle_hud=Shift_R+F12
no_display
```
*(Note: The `no_display` option launches MangoHud hidden by default; press `Right Shift + F12` in-game to toggle the overlay).*

## 🛡️ Prevention Advice

Recommended practices to maintain overlay stability:
- **Avoid Overlapping Overlays**: Running Discord overlays (Vencord), VKBasalt, or OBS game capture simultaneously with MangoHud can cause micro-stuttering or Vulkan surface creation errors.
- **Flatpak Permission Overrides**: If running Steam or Heroic Launcher via Flatpak, grant DBus permissions so applications can communicate with GameMode: `flatpak override --user --talk-name=org.freedesktop.gamemode com.valvesoftware.Steam`.

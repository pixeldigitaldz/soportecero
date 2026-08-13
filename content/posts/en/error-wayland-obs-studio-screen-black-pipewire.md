---
title: How to Fix OBS Studio Black Screen under Wayland and PipeWire
description: >-
  A complete technical guide to resolve black screen capture issues in OBS Studio using Wayland, PipeWire, and XDG Desktop Portal on Linux.
category: Gaming Tech
tags:
  - OBS
  - Wayland
  - Linux
readTime: 4 min
date: '2026-08-02'
---

When running OBS Studio on modern Linux distributions powered by Wayland display servers (such as GNOME, KDE Plasma, Hyprland, or Sway), users frequently encounter a black screen when adding a "Screen Capture" or "Window Capture" source. Unlike legacy X11, Wayland security policies prevent applications from directly reading raw framebuffer memory, relying instead on **PipeWire** media streams routed through **XDG Desktop Portal**.

## Quick Diagnostics

| Cause | Solution |
|---|---|
| **"Screen Capture (PipeWire)" source shows a completely black frame or fails to open selection prompt**: The `xdg-desktop-portal` service or desktop-specific portal backend is missing or crashed | Install the appropriate portal backend (GNOME/KDE/Hyprland) and restart user systemd services |
| **PipeWire capture option does not appear in the OBS Studio sources menu**: Missing `obs-xdg-portal` plugin or OBS is being forced to run under Xwayland/X11 compatibility mode | Install the OBS portal integration module and launch OBS natively under Wayland |
| **Screen selection dialog appears, but OBS displays a frozen black preview rectangle**: PipeWire permission mismatch or stale portal session after display resolution changes | Restart the `pipewire` and `wireplumber` user services without rebooting the system |

## 🚀 Step-by-Step Solution

### Step 1: Install XDG Desktop Portal and Desktop Backends
For OBS to request screen captures from Wayland, both the core portal daemon and your specific desktop compositor backend must be present:

```bash
# On Arch Linux / Manjaro / CachyOS
sudo pacman -S xdg-desktop-portal pipewire wireplumber

# Install your specific desktop environment backend:
# For GNOME:
sudo pacman -S xdg-desktop-portal-gnome
# For KDE Plasma:
sudo pacman -S xdg-desktop-portal-kde
# For Hyprland / Sway / wlroots:
sudo pacman -S xdg-desktop-portal-hyprland # or xdg-desktop-portal-wlr

# On Ubuntu / Debian / Pop!_OS
sudo apt install xdg-desktop-portal pipewire xdg-desktop-portal-gnome
```

### Step 2: Restart Portal and PipeWire User Services
If portals were recently installed or experienced a daemon socket disconnect, restart the corresponding `systemd` user units:

```bash
# Restart the PipeWire audio/video daemon and WirePlumber session manager
systemctl --user restart pipewire wireplumber

# Reset the XDG Desktop Portal daemon
systemctl --user stop xdg-desktop-portal
systemctl --user start xdg-desktop-portal
```

### Step 3: Enforce Native Wayland Execution in OBS Studio
Launching OBS Studio with environment variables forcing X11 fallback (`QT_QPA_PLATFORM=xcb`) will break PipeWire portal integration. Pass the Wayland platform flag explicitly:

```bash
# Launch OBS using native Wayland Qt platform plugin
QT_QPA_PLATFORM=wayland obs

# For Flatpak installations of OBS Studio, grant wayland socket access:
flatpak override --user --socket=wayland com.obsproject.Studio
```

Inside OBS Studio, remove legacy "Screen Capture (XSHM)" or "Window Capture (Xcomposite)" sources, then add a new **Screen Capture (PipeWire)** source. The system will prompt a native portal dialog asking you to select the screen or window to stream.

## 🛡️ Prevention Advice

- **Avoid Forcing Xwayland on OBS**: Run OBS with native Wayland/Qt6 flags to prevent frame pacing issues, stuttering, and duplicate cursor artifacts.
- **Configure Portal Configuration Files**: On wlroots compositors (Sway/Hyprland), define explicit portal handlers in `~/.config/xdg-desktop-portal/portals.conf` to prevent backend collisions between GNOME and wlroots portals.
- **Keep Flatpak Permissions Updated**: If running OBS via Flatpak, keep runtime dependencies up to date with `flatpak update` to ensure portal DBus interface compatibility.

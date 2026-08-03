---
title: "[FIXED] NVIDIA Wayland Gaming Stuttering & Flickering in Linux"
description: "Experiencing screen flickering or stuttering with NVIDIA GPUs on Wayland compositors (KDE 6, Hyprland, GNOME)? Enable Explicit Sync & DRM modeset."
category: "Gaming Tech"
tags: ["NVIDIA", "Wayland", "Gaming", "Linux"]
readTime: "4 min"
date: "2026-08-03"
---

Visual **flickering, stuttering, and frame out-of-order issues** when gaming on Linux with **NVIDIA graphics cards under Wayland compositors** (KDE Plasma 6, Hyprland, GNOME) stems from buffer synchronization mismatches between the proprietary display driver and the Wayland compositor windowing system.

> **Quick Solution (1 Minute):**
> 1. Update to **NVIDIA Driver 555.58** or newer (`linux-explicit-synchronization-v1` support).
> 2. Add `nvidia-drm.modeset=1` to kernel boot parameters.
> 3. Add `GBM_BACKEND=nvidia-drm` to `/etc/environment`.

## 🚀 Step-by-Step Optimization

### Step 1: Install NVIDIA 555+ Drivers (Explicit Sync Support)
Explicit Sync protocol support was introduced in the **NVIDIA 555** driver branch, eliminating implicit buffer ordering lag.

* **Arch Linux / CachyOS:**
  ```bash
  sudo pacman -Syu nvidia-dkms nvidia-utils
  ```
* **Ubuntu / Pop!_OS:**
  ```bash
  sudo ubuntu-drivers install
  ```

### Step 2: Enable DRM Kernel Modesetting (`nvidia-drm.modeset=1`)
Ensure the kernel loads DRM modesetting upon boot by editing `/etc/default/grub`:

```plaintext
GRUB_CMDLINE_LINUX_DEFAULT="quiet splash nvidia-drm.modeset=1 nvidia-drm.fbdev=1"
```
Rebuild GRUB configuration:
```bash
sudo update-grub  # Ubuntu/Debian
# OR
sudo grub-mkconfig -o /boot/grub/grub.cfg  # Arch Linux
```

### Step 3: Configure Environment Variables
Edit `/etc/environment`:
```bash
GBM_BACKEND=nvidia-drm
__GLX_VENDOR_LIBRARY_NAME=nvidia
ELECTRON_OZONE_PLATFORM_HINT=wayland
LIBVA_DRIVER_NAME=nvidia
```
Restart your display manager or reboot to apply changes.

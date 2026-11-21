---
title: '[FIXED] NVIDIA Wayland Gaming Stuttering & Flickering in Linux'
description: >-
  Experiencing screen flickering or stuttering with NVIDIA GPUs on Wayland
  compositors (KDE 6, Hyprland, GNOME)? Enable Explicit Sync & DRM modeset.
category: Gaming Tech
tags:
  - NVIDIA
  - Wayland
  - Gaming
  - Linux
readTime: 6 min
date: '2026-08-03'
---

Visual flickering, out-of-order frames, and micro-stuttering when gaming on Linux with NVIDIA GPUs under Wayland compositors—such as KDE Plasma 6, Hyprland, or GNOME Mutter—occur when the display driver and the compositor disagree on buffer readiness. Because XWayland and Wayland historically relied on implicit synchronization while NVIDIA's proprietary driver enforces explicit fence-based synchronization, frames are frequently scanned out before the GPU finishes rendering them.

## Quick Diagnostics

| Symptom / Cause | Immediate Action |
|---|---|
| **NVIDIA driver older than 555.58** | Upgrade to driver branch `555+` or `560+` with `linux-drm-syncobj-v1` support |
| **Missing DRM kernel modesetting** | Add `nvidia-drm.modeset=1` and `nvidia-drm.fbdev=1` to kernel boot parameters |
| **XWayland / Electron flickering** | Update `xorg-xwayland` to `24.1+` and compositor to Explicit Sync-capable release |
| **Incorrect GBM backend selection** | Export `GBM_BACKEND=nvidia-drm` and `__GLX_VENDOR_LIBRARY_NAME=nvidia` |

## Root Cause & Technical Mechanics

On Linux, open-source Mesa drivers (AMD and Intel) traditionally used **implicit synchronization**, where the kernel tracks buffer dependencies internally via `dma_buf` reservations. When an application submits a frame to the Wayland compositor, the kernel automatically blocks scanout until the GPU signals completion.

NVIDIA's proprietary kernel module (`nvidia-drm.ko`), however, is architected around **explicit synchronization**. Under explicit sync, the client and compositor exchange explicit timeline sync objects (`drm_syncobj`) via the Wayland `linux-drm-syncobj-v1` protocol. Prior to NVIDIA driver `555.58` and XWayland `24.1`, the Wayland protocol stack lacked standardized explicit sync primitives for X11-bridged games. As a result, XWayland submitted buffers to the compositor without waiting for NVIDIA's GPU command queue to flush, causing the compositor to display incomplete or previous backbuffers—producing severe frame-order jitter, black flashes, and tearing in DXVK/VKD3D titles.

Additionally, if `nvidia-drm.modeset=1` is omitted from the kernel command line, `nvidia-drm` refuses to expose atomic modesetting and PRIME display offload capabilities, forcing compositors into slow software-copy fallbacks.

## Step-by-Step Solution

### 1. Upgrade to NVIDIA 555+ and Explicit Sync Packages
Ensure your system has the proprietary or open-kernel NVIDIA driver `555.58` (or newer), `xorg-xwayland` `24.1+`, and a compositor with `linux-drm-syncobj-v1` merged (KDE Plasma 6.1+, GNOME 46.1+, or Hyprland 0.41+).

On Arch Linux or CachyOS:
```bash
sudo pacman -Syu nvidia-open-dkms nvidia-utils lib32-nvidia-utils xorg-xwayland
```

On Ubuntu or Pop!_OS:
```bash
sudo apt update && sudo ubuntu-drivers install
```

Verify the installed driver version and XWayland release:
```bash
nvidia-smi --query-gpu=driver_version --format=csv,noheader
Xwayland -version 2>&1 | head -n 2
```

### 2. Enable DRM Kernel Modesetting and Framebuffer Support
Edit `/etc/default/grub` and append `nvidia-drm.modeset=1` and `nvidia-drm.fbdev=1` to `GRUB_CMDLINE_LINUX_DEFAULT`:

```plaintext
GRUB_CMDLINE_LINUX_DEFAULT="quiet splash nvidia-drm.modeset=1 nvidia-drm.fbdev=1"
```

Regenerate the GRUB configuration (or systemd-boot entries if applicable):
```bash
# Ubuntu / Debian
sudo update-grub

# Arch Linux
sudo grub-mkconfig -o /boot/grub/grub.cfg
```

After rebooting, confirm both kernel parameters are active:
```bash
cat /sys/module/nvidia_drm/parameters/modeset
cat /sys/module/nvidia_drm/parameters/fbdev
```
Both commands must return `Y`.

### 3. Configure Wayland & GBM Environment Variables
Add the following variables to `/etc/environment` so that GBM allocation, GLX routing, and Electron/Chromium apps use the native Wayland + NVIDIA path:

```plaintext
GBM_BACKEND=nvidia-drm
__GLX_VENDOR_LIBRARY_NAME=nvidia
ELECTRON_OZONE_PLATFORM_HINT=wayland
LIBVA_DRIVER_NAME=nvidia
```

If you are on Hyprland, also verify that your `hyprland.conf` does not disable explicit sync (`render:explicit_sync = 1` or `2` auto). Reboot your session and verify Wayland protocol support:
```bash
wayland-info | grep -i syncobj
```
Seeing `linux_drm_syncobj_manager_v1` confirms the compositor and driver are actively negotiating explicit timeline fences.

## Frequently Asked Questions

**Does Explicit Sync work with NVIDIA's proprietary module as well as `nvidia-open`?**
Yes. Both the closed-source proprietary module and the `nvidia-open` kernel module support `linux-drm-syncobj-v1` starting in the `555` series. For Turing (RTX 20-series) and newer GPUs, NVIDIA recommends `nvidia-open`.

**Why does flickering still happen in one specific Electron app like Discord?**
Electron applications default to XWayland unless Ozone Wayland is enabled. Setting `ELECTRON_OZONE_PLATFORM_HINT=wayland` forces native Wayland rendering, bypassing XWayland buffer translation entirely.

**Should I disable VRR (G-Sync) on Wayland if stuttering persists?**
Only temporarily for testing. With `nvidia-drm.modeset=1` and driver `560+`, single-monitor VRR works reliably on KDE Plasma 6 and Hyprland, though multi-monitor mixed-refresh setups may still require disabling VRR on secondary displays.

## Prevention Advice

* Keep `nvidia-utils`, `lib32-nvidia-utils`, and `xorg-xwayland` synchronized during system updates to avoid ABI mismatches.
* Avoid forcing `WLR_NO_HARDWARE_CURSORS=1` on modern compositors unless you specifically observe an invisible cursor, as newer `nvidia-drm.fbdev=1` configurations handle hardware cursor planes natively.
* Add `nvidia`, `nvidia_modeset`, `nvidia_uvm`, and `nvidia_drm` to your initramfs (`mkinitcpio.conf` or `dracut`) for early KMS initialization before the display manager starts.

---
title: 'Fix: DX11 feature level 10.0 is required to run the engine (Proton/Linux)'
description: 'How to fix the DirectX 11 error in Linux using Steam Play (Proton), Lutris or Heroic Games Launcher.'
category: 'Gaming Tech'
date: '2026-08-14'
readTime: '3 min'
tags: ['Proton', 'Linux Gaming', 'Steam']
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Vulkan/DXVK not installed or inactive** | Use the `PROTON_USE_WINED3D=1` environment variable or install Vulkan dependencies |
| **Outdated graphics drivers** | Update Mesa (AMD/Intel) or Nvidia Drivers |
| **Old Proton version** | Switch to Proton GE or the latest Steam Experimental version |

## Step-by-Step Solution

**Update the Proton version to Proton GE**
The error usually occurs because the game tries to look for native DirectX libraries. Proton uses DXVK to translate DX11 to Vulkan. First, try forcing compatibility. Use the **ProtonUp-Qt** application to install the latest version of **Proton GE**. Then restart Steam and assign it to the game from *Properties > Compatibility*.

**Try using WINED3D as an alternative**
If your graphics card doesn't support Vulkan correctly (very old GPUs), you can force Proton to use OpenGL instead of Vulkan:
In Steam, go to the game properties, and in *Launch Options* write:
```bash
PROTON_USE_WINED3D=1 %command%
```

**Install Vulkan packages (Arch/Ubuntu Users)**
You may be missing the 32-bit Vulkan libraries on your system.
For Ubuntu/Mint:
```bash
sudo apt install libvulkan1 libvulkan1:i386 mesa-vulkan-drivers mesa-vulkan-drivers:i386
```
For Arch Linux:
```bash
sudo pacman -S vulkan-radeon lib32-vulkan-radeon vulkan-icd-loader lib32-vulkan-icd-loader
```
*(Use `nvidia-utils lib32-nvidia-utils` if you use NVIDIA).*

**Verify your graphics card Vulkan support**
If you run the following command and get errors, it means your GPU is not rendering Vulkan properly:
```bash
vulkaninfo | grep "GPU id"
```

## Prevention Tips
- **Constant updates:** Always keep your Mesa or NVIDIA drivers up to date using a PPA (on Ubuntu) or regular updates (Arch/Fedora).
- **Diagnostic tools:** Use `mangohud` to verify if a game is running under DXVK or OpenGL.

---
title: How to Fix Diablo IV Out of Video Memory (VRAM) Crashes and FPS Drops
description: >-
  Learn how to fix Diablo IV 'Out of GPU Memory' crashes, inventory stuttering, and severe FPS drops.
  Optimize texture streaming pools, manage shared VRAM fallback paging, and configure VKD3D on Linux.
category: Gaming Tech
tags:
  - Gaming
  - Diablo IV
  - VRAM
  - GPU
  - Windows
  - Linux
readTime: 5 min
date: '2026-07-27'
---

Encountering a fatal `Out of GPU Memory` dialog or experiencing severe single-digit framerate drops when opening town portals, opening inventory screens, or traversing major hub zones (such as Kyovashad or Cerrigar) in **Diablo IV** is a notorious issue affecting both Windows and Linux PC gamers.

This performance collapse occurs because the Diablo IV proprietary graphics engine utilizes an aggressive, un-throttled **virtual texture streaming architecture**. On GPUs equipped with 8 GB to 12 GB of dedicated Video RAM (VRAM), high-resolution mipmaps and uncompressed UI assets quickly saturate physical video memory. When VRAM fills completely, Windows (via WDDM) and the Linux kernel begin paging active textures into system RAM over the PCI Express bus. This causes immediate PCIe bus saturation, causing frametimes to skyrocket from 8 ms to over 300 ms.

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Ultra texture quality saturating 8 GB / 12 GB physical VRAM capacity** | Reduce Texture Quality to **Medium** or **High** in display options |
| **DirectX 12 host-visible memory paging bottlenecks on Linux/Proton** | Configure `VKD3D_CONFIG=upload_hvv %command%` in Steam Launch Options |
| **Vulkan/Direct3D 12 memory leaks during extended town portal transitions** | Enable FSR / DLSS Balanced mode and cap foreground framerates |
| **Windows paging file too small to accommodate VRAM overflow spills** | Set Windows virtual memory paging file to a fixed size of 16 GB to 32 GB |

## 🚀 Step-by-Step Implementation Guide

### Step 1: Adjust Texture Quality and Disable Memory-Heavy Shaders
The single most impactful adjustment is stepping down texture resolution. While Diablo IV labels "High" and "Ultra" similarly in marketing materials, the Ultra texture pack requires over 14 GB of dedicated VRAM:
1. Launch Diablo IV and open **Options** > **Graphics**.
2. Set **Texture Quality** to **Medium** (for 6 GB - 8 GB GPUs) or **High** (for 10 GB - 12 GB GPUs). Never select Ultra unless your graphics card carries 16 GB+ of physical VRAM.
3. Lower **Shadow Quality** to High or Medium.
4. Disable **Screen Space Reflections (SSR)** and set **Clutter Density** to Medium.
5. Set an in-game **Max Foreground FPS** cap corresponding to your display refresh rate (e.g., 120 FPS or 144 FPS). Capping the framerate prevents the rendering pipeline from requesting unbounded frame buffers.

### Step 2: Configure Upscaling (DLSS / FSR / XeSS) in Balanced Mode
Temporal upscaling reduces the internal rendering resolution, dramatically decreasing the size of framebuffers and geometry render targets held in physical VRAM:
1. In the Graphics menu, enable your preferred upscaler:
   - **NVIDIA:** DLSS (Deep Learning Super Sampling)
   - **AMD:** FSR 2 / FSR 3 (FidelityFX Super Resolution)
   - **Intel:** XeSS
2. Select **Balanced** or **Quality** mode.
3. Set **Sharpening** between 5 and 7 to maintain crisp asset edges while freeing up to 2.5 GB of active VRAM.

### Step 3: Optimize VKD3D-Proton Memory Allocation on Linux / Steam Deck
If playing Diablo IV on Linux (via Steam, Lutris, or the Heroic Games Launcher), the VKD3D-Proton translation layer must manage host-visible video memory (HVV) efficiently across Vulkan queues.

Add the following environment variables to your Steam or Lutris launch parameters:
```bash
VKD3D_CONFIG=upload_hvv DXVK_ASYNC=1 %command%
```
*(Technical note: `upload_hvv` instructs VKD3D to utilize Resizable BAR / Smart Access Memory for staging buffers, significantly accelerating texture uploads between system RAM and GPU VRAM).*

### Step 4: Expand the Windows System Paging File (Virtual Memory)
When the game engine experiences brief memory spikes, Windows must have sufficient storage space on an NVMe SSD to swap overflow pages without hard-crashing:
1. Press `Windows Key + R`, type `sysdm.cpl`, and press **Enter**.
2. Navigate to the **Advanced** tab and click **Settings** under *Performance*.
3. Go to the **Advanced** tab and click **Change** under *Virtual memory*.
4. Uncheck *Automatically manage paging file size for all drives*.
5. Select your fastest NVMe SSD (typically `C:`), choose **Custom size**, and set both **Initial size** and **Maximum size** to `16384` (16 GB) or `24576` (24 GB).
6. Click **Set**, then **OK**, and restart Windows.

## 🛡️ Best Practices & System Stability
- **Avoid Misleading 'DedicatedSegmentSize' Registry Hacks:** Never follow internet guides advocating creating a fake `DedicatedSegmentSize` DWORD in `HKEY_LOCAL_MACHINE\SOFTWARE\Intel\GMM`. Modifying this registry key merely alters the dummy number reported to old diagnostic tools; it does not add physical VRAM and can destabilize GPU driver memory allocation routines.
- **Enable Resizable BAR (ReBAR) in BIOS:** Ensure Resizable BAR (AMD Smart Access Memory) is enabled in your motherboard's UEFI firmware. ReBAR allows the CPU to access the entire GPU VRAM pool simultaneously rather than in small 256 MB chunks.

## Frequently Asked Questions (FAQ)

### Why does Diablo IV stutter specifically when opening the inventory or map?
The inventory and vendor interfaces render high-resolution 3D models and uncompressed 2D asset cards on top of the live 3D world. If your VRAM is already saturated, loading these interface assets immediately forces a massive memory swap, triggering an instantaneous 200 ms to 500 ms stutter.

### Can disabling Ray Tracing prevent VRAM crashes?
Yes. Enabling Ray Tracing (Ray Traced Foliage, Shadows, and Reflections) increases VRAM consumption by 3 GB to 4.5 GB due to Bounding Volume Hierarchy (BVH) structures. Keeping Ray Tracing disabled is essential on GPUs with 8 GB to 12 GB of VRAM.

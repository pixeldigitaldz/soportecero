---
title: "[SOLVED] DXGI_ERROR_DEVICE_HUNG in Proton & Steam Games on Linux"
description: "Step-by-step resolution for the fatal DXGI_ERROR_DEVICE_HUNG crash in DirectX 11 & 12 titles running through Proton and VKD3D on Linux."
category: "Gaming Tech"
tags: ["Proton","Steam","Linux","Vulkan"]
readTime: "4 min"
date: "2026-09-27"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **GPU driver kernel timeout (TDR) triggered during intense graphics workload bursts** | Configure VKD3D synchronization flags and set PROTON_ENABLE_NVAPI=1 |
| **VRAM saturation or unstable GPU memory overclocks under Linux translation layers** | Lower texture quality by one preset and test against Proton Experimental / GE |

While gaming on Linux via Steam Proton (playing Cyberpunk 2077, Elden Ring, or Apex Legends), the screen suddenly freezes followed by an Unreal Engine / DirectX dialogue reporting: `Fatal error: The GPU device has been suspended or hung: DXGI_ERROR_DEVICE_HUNG (0x887A0006)`. This crash occurs when the Linux graphics stack fails to receive a timely response from the GPU execution ring.

> **Quick Solution (1 Minute):**
> 1. Add launch options in Steam game properties:
>    `VKD3D_CONFIG=no_upload_hvv %command%`
> 2. For NVIDIA GPUs, enable native NVAPI bridges:
>    `PROTON_ENABLE_NVAPI=1 %command%`

## 🚀 Step-by-Step Solution

### Step 1: Stabilize VKD3D-Proton Translation Pipeline
VKD3D bridges DirectX 12 calls directly into Vulkan. Stabilize memory transfers by appending this launch flag under Steam Game -> *Properties* -> *General* -> *Launch Options*:
```bash
VKD3D_CONFIG=no_upload_hvv %command%
```

### Step 2: Configure Proton Concurrency Synchronization
Resolve worker thread lockups by steering synchronization to Linux kernel futexes:
```bash
PROTON_NO_ESYNC=1 PROTON_USE_FSYNC=1 %command%
```

### Step 3: Mitigate VRAM Overflow and Clock Instabilities
The `DEVICE_HUNG` exception frequently erupts when games surpass 98% of dedicated video memory:
1. Drop Texture Quality from *Ultra* down to *High* to prevent swapping onto system RAM.
2. Disable Ray Tracing features on cards with 8 GB or less VRAM.
3. If running custom clock profiles (via CoreCtrl or GWE), revert to factory power curves.

## 🛡️ Prevention Tips
* Keep your graphics stack on modern driver releases (NVIDIA 555+ with Explicit Sync or Mesa 24+).
* Test problematic titles against community-curated Proton GE builds via ProtonUp-Qt.

## Frequently Asked Questions

### What does error code 0x887A0006 signify under the hood?
It is the DirectX hexadecimal definition for DXGI_ERROR_DEVICE_HUNG, signaling that the GPU hardware failed to respond to the driver commands within the expected watchdog window.

### How does this issue appear in system kernel logs?
On AMD Radeon it prints `amdgpu: ring gfx timeout` inside `dmesg`, whereas on NVIDIA it logs kernel Xid error events.

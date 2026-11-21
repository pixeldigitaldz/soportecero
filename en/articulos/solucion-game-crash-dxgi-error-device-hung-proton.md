---
title: 'DXGI_ERROR_DEVICE_HUNG in Proton & Steam Games on Linux'
description: >-
  Step-by-step resolution for the fatal DXGI_ERROR_DEVICE_HUNG crash in DirectX
  11 & 12 titles running through Proton and VKD3D on Linux.
category: Gaming Tech
tags:
  - Proton
  - Steam
  - Linux
  - Vulkan
readTime: 6 min
date: '2026-09-27'
---

While running DirectX 11 or DirectX 12 titles on Linux via Steam Proton—such as *Cyberpunk 2077*, *Elden Ring*, or *Helldivers 2*—the screen can freeze for several seconds before crashing with `Fatal error: The GPU device has been suspended or hung: DXGI_ERROR_DEVICE_HUNG (0x887A0006)`. This error indicates that the GPU execution ring stopped responding to the Linux kernel driver within its watchdog timeout window.

## Quick Diagnostics

| Cause | Symptom | Solution |
|---|---|---|
| **VKD3D-Proton HVV memory stall** | Crash during texture streaming or heavy DX12 scenes | Pass `VKD3D_CONFIG=no_upload_hvv %command%` |
| **ESYNC / FSYNC thread deadlock** | Random freezes in CPU-bound multi-threaded engines | Force `PROTON_NO_ESYNC=1 PROTON_USE_FSYNC=1` |
| **VRAM oversubscription / TDR** | Crash when GPU memory exceeds 95% capacity | Lower texture preset and disable Ray Tracing |
| **Corrupted Vulkan shader cache** | Immediate crash on level load or after driver update | Purge Steam's `shadercache` folder for the AppID |

## Root Cause & Technical Mechanics

On Windows, the DirectX Graphics Infrastructure (DXGI) relies on Timeout Detection and Recovery (TDR) to reset a stalled GPU queue after roughly two seconds. On Linux, Proton translates Direct3D calls into Vulkan using **DXVK** (for DX9–DX11) and **VKD3D-Proton** (for DX12).

When a Vulkan command buffer stalls on the GPU—due to an illegal shader instruction, page fault, or PCIe BAR exhaustion—the Linux kernel graphics driver (`amdgpu` or `nvidia`) aborts the hung ring buffer and returns `VK_ERROR_DEVICE_LOST` to VKD3D-Proton or DXVK. The translation layer maps that Vulkan device loss directly to `DXGI_ERROR_DEVICE_HUNG (0x887A0006)` so the Windows game binary reports a familiar error dialog. A particularly common trigger on modern GPUs with Resizable BAR enabled is VKD3D-Proton's Host-Visible VRAM (`upload_hvv`) heap, which can exhaust or fragment PCIe-mapped memory under heavy streaming workloads.

## Step-by-Step Solution

### Step 1: Inspect Kernel GPU Ring Logs

Before tweaking launch options, confirm whether the kernel driver logged a GPU hang or page fault during the crash:

```bash
# Check AMD or NVIDIA kernel driver ring timeouts
sudo dmesg -T | grep -iE "amdgpu|NVRM|Xid|ring.*timeout|fault"
```

If you see `amdgpu: ring gfx_0.0.0 timeout` or `NVRM: Xid (PCI:...): 109` / `31`, the GPU hardware queue genuinely stalled under the workload.

### Step 2: Disable Host-Visible VRAM Upload Heaps in VKD3D-Proton

In Steam, right-click the game, open **Properties > General > Launch Options**, and force VKD3D-Proton to stage uploads through standard system memory rather than host-visible VRAM:

```bash
VKD3D_CONFIG=no_upload_hvv %command%
```

If you are on an NVIDIA GPU and the game uses DLSS or Reflex, combine this with NVAPI support:

```bash
VKD3D_CONFIG=no_upload_hvv PROTON_ENABLE_NVAPI=1 %command%
```

### Step 3: Stabilize Thread Synchronization and Clear Shader Caches

Worker thread contention between Wine and Vulkan can trigger command-queue timeouts. Switch synchronization to kernel futexes (`FSYNC`), or test without `ESYNC`:

```bash
VKD3D_CONFIG=no_upload_hvv PROTON_NO_ESYNC=1 PROTON_USE_FSYNC=1 %command%
```

If crashes started immediately after a Mesa or NVIDIA driver upgrade, purge the game's precompiled shader cache (replace `<AppID>` with the game's Steam ID):

```bash
rm -rf ~/.local/share/Steam/steamapps/shadercache/<AppID>
```

### Step 4: Eliminate VRAM Saturation and Unstable Overclocks

Unlike Windows WDDM, Linux Vulkan drivers are less forgiving when a game allocates past physical VRAM limits into shared system RAM:

1. Lower **Texture Quality** by one tier (for example, from *Ultra* to *High*) and disable **Ray Tracing** on 8 GB GPUs.
2. Reset any aggressive GPU undervolts or VRAM overclocks in CoreCtrl, LACT, or GreenWithEnvy back to stock frequency/voltage curves.

### Step 5: Verify Vulkan Health and Runtime Behavior

Confirm your Vulkan ICD and driver versions are healthy, then launch the game with the DXVK/VKD3D HUD to monitor VRAM usage and shader compilation:

```bash
vulkaninfo --summary
```

Add `DXVK_HUD=memory,compiler` temporarily to your Steam launch options to verify that VRAM allocation stays below physical capacity during gameplay.

## Frequently Asked Questions

### What is the difference between `DXGI_ERROR_DEVICE_HUNG` and `DXGI_ERROR_DEVICE_REMOVED`?
`DXGI_ERROR_DEVICE_HUNG` (`0x887A0006`) means the GPU stopped responding to commands within the timeout window, whereas `DXGI_ERROR_DEVICE_REMOVED` (`0x887A0005`) indicates the device reset completed or the GPU was logically disconnected from the driver.

### Why does `VKD3D_CONFIG=no_upload_hvv` fix crashes on 8 GB GPUs?
With Resizable BAR enabled, VKD3D-Proton places upload buffers in host-visible VRAM. On 8 GB cards, games that stream large textures can exhaust that shared pool, causing allocation failures and GPU page faults.

### Should I switch to Proton Experimental or GE-Proton?
Yes. Both Proton Experimental and community **GE-Proton** (installed via ProtonUp-Qt) ship newer VKD3D-Proton and DXVK builds with game-specific shader workarounds that often resolve `0x887A0006` without manual flags.

## Prevention Advice

- Keep your graphics stack current—at least Mesa 24.x+ for AMD/Intel or NVIDIA driver 555+ with Explicit Sync support on Wayland.
- Avoid stacking third-party overlays (such as Discord, MangoHud, and Steam Overlay simultaneously) if a DX12 title is prone to Vulkan swapchain stalls.
- Enable `PROTON_LOG=1 %command%` only while debugging so you can inspect `~/steam-<AppID>.log` for exact DXVK/VKD3D error lines.
- Test new GPU undervolts with a Vulkan stress test rather than assuming Windows-stable offsets are stable under Linux compute/graphics queues.

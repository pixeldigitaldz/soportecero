---
title: "How to Fix [drm:amdgpu_job_timedout] and AMD GPU Hang Crashes in Linux"
description: "Is your game crashing on Linux with [drm:amdgpu_job_timedout] ring gfx_0.0.0 timeout? Learn how to stabilize AMDGPU kernel parameters, Mesa RADV, and PCIe power states."
category: "Gaming Tech"
tags: ["Linux Gaming", "AMDGPU", "Mesa", "Vulkan", "Steam"]
readTime: "5 min"
date: "2026-09-24"
---

During demanding gaming sessions on Linux using Proton, Wine, or native **Vulkan** engines, owners of AMD Radeon graphics cards (RX 5000, 6000, 7000 series, or Steam Deck) frequently encounter sudden screen freezes followed by a crash to desktop. Inspecting system kernel messages via `dmesg` reveals the underlying hardware scheduler fault: **`[drm:amdgpu_job_timedout] ring gfx_0.0.0 timeout`** followed by **`[drm:amdgpu_device_gpu_recover] *ERROR* GPU reset failed`**.

This error occurs when a graphic command submitted to the GPU's execution ring fails to finish before the Linux kernel's Direct Rendering Manager (DRM) scheduler timeout expires. Common triggers include overly aggressive dynamic power management (DPM) states, race conditions in Mesa's RADV Vulkan compiler during complex ray tracing shaders, or PCIe bus voltage dips under sudden compute bursts.

## Quick Diagnostics

| Cause | Solution |
|---|---|
| **Aggressive DPM clock gating causing voltage drops and gfx ring timeout** | Disable runtime power management with kernel parameters (`amdgpu.dpm=1 amdgpu.runpm=0`) |
| **Vulkan shader compiler timeouts under complex DirectX 12 (VKD3D) workloads** | Set launch options in Steam: `RADV_DEBUG=noaccel,llvm %command%` or update Mesa to the latest stable branch |

## 🚀 Step-by-Step Fixes

### Step 1: Verify the exact GPU hang signature in dmesg

Immediately following a game freeze or desktop crash, open a terminal window and filter the kernel buffer to confirm the AMDGPU scheduler failure:

```bash
# Filter recent dmesg logs for GPU timeouts
sudo dmesg -T | grep -E "amdgpu_job_timedout|GPU reset|ring gfx"
```

If the terminal displays messages matching:
```text
[drm:amdgpu_job_timedout [amdgpu]] *ERROR* ring gfx_0.0.0 timeout, signaled seq=...
[drm:amdgpu_device_gpu_recover [amdgpu]] *ERROR* GPU reset failed
```
Your issue is definitely confirmed as a driver/hardware scheduler timeout rather than an ordinary game script bug.

### Step 2: Configure Kernel Parameters to stabilize AMDGPU DPM

On desktop distributions such as Arch Linux, Bazzite, Fedora, or Ubuntu, runtime power management can cause the GPU to throttle down voltages prematurely between frame rendering cycles:

1. Open your bootloader configuration file with root privileges:
   ```bash
   sudo nano /etc/default/grub
   ```

2. Locate `GRUB_CMDLINE_LINUX_DEFAULT` and append the following parameters inside the quotes:
   ```text
   amdgpu.dpm=1 amdgpu.runpm=0
   ```
   - `amdgpu.dpm=1`: Enforces deterministic dynamic power state transitions.
   - `amdgpu.runpm=0`: Disables runtime deep power sleep on dedicated desktop Radeon cards.

3. Regenerate the boot configuration for your distribution:
   ```bash
   # On Debian, Ubuntu, and Pop!_OS:
   sudo update-grub

   # On Arch Linux, EndeavourOS, and CachyOS:
   sudo grub-mkconfig -o /boot/grub/grub.cfg

   # On Fedora (UEFI systems):
   sudo grub2-mkconfig -o /etc/grub2-efi.cfg
   ```

### Step 3: Set Steam launch options for Vulkan and VKD3D-Proton

While Mesa's ACO shader compiler is fast, certain complex shaders in DirectX 12 games can overwhelm the execution ring. You can configure safer fallback parameters on a per-game basis in Steam (`Properties` -> `Launch Options`):

```bash
RADV_DEBUG=noaccel,llvm %command%
```
Or for DirectX 12 titles encountering buffer synchronization hangs:

```bash
VKD3D_CONFIG=no_upload_hwwrite,dxr11 %command%
```

### Step 4: Disable PCIe Active State Power Management (ASPM)

PCIe ASPM powers down the bus link to conserve energy when the graphics card enters brief idle periods. On certain motherboards, the latency required to wake the PCIe bus back to Full Speed exceeds the driver's timeout threshold:

Add the following kernel option to `/etc/default/grub`:
```text
pcie_aspm=off
```
Regenerate your GRUB configuration and restart the PC. This maintains PCIe bus lanes at full operational readiness with zero power switching delay.

## Prevention Advice

Recommended security practices:
- Regularly update `mesa` and `vulkan-radeon` packages from trusted repositories (such as Kisak PPA on Ubuntu or Mesa-git on Arch).
- Ensure your power supply unit (PSU) uses dedicated, separate 8-pin 12V PCIe power cables directly from the PSU rather than daisy-chained / pigtail splitters.
- If you applied GPU overclocking or undervolting via CoreCtrl, restore default voltage and frequency curves to eliminate power delivery instabilities.

## Frequently Asked Questions

### Does this error mean my AMD graphics card is physically failing?
In over 95% of cases, this is strictly a software or firmware scheduling issue involving driver timeouts, kernel power management policies, or PCIe ASPM delays.

### Does this problem happen on both Wayland and X11?
Yes, but recent Wayland protocols with Explicit Sync (introduced in Linux 6.8+ and Wayland Protocols 1.34) have significantly mitigated implicit synchronization hangs on Mesa drivers.

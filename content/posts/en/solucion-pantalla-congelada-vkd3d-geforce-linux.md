---
title: 'Screen Freezing in DirectX 12 Games with NVIDIA & VKD3D on Linux'
description: >-
  Resolve hard screen freezes and desktop crashes in DirectX 12 games running
  through VKD3D-Proton on NVIDIA GeForce graphics cards on Linux.
category: Gaming Tech
tags:
  - NVIDIA
  - Gaming
  - Linux
  - Vulkan
readTime: 5 min
date: '2026-10-05'
---

When running DirectX 12 titles (such as *Cyberpunk 2077*, *Elden Ring*, or *Forza Horizon 5*) on Linux via Proton and **VKD3D-Proton**, NVIDIA GeForce users frequently experience hard frame freezes where the game image locks solid while background audio and mouse/controller inputs continue working—or the entire Wayland/X11 desktop stalls until a TTY switch or hard reboot.

## Quick Diagnostics

| Symptom / Cause | Verification | Immediate Fix |
|---|---|---|
| Driver older than 555 lacking Explicit Sync on Wayland | `nvidia-smi` & `echo $XDG_SESSION_TYPE` | Upgrade to NVIDIA **555.58 / 560+** with `xorg-xwayland` 24.1+ |
| Async compute/graphics Vulkan queue deadlock in VKD3D | `dmesg -T \| grep -iE "NVRM\|Xid"` | Add `VKD3D_CONFIG=single_queue %command%` in Steam |
| GPU VRAM exhaustion or Resizable BAR / GSP firmware stall | `nvidia-smi dmon -s mu` | Cap pre-rendered frames with `__GL_MaxFramesAllowed=1` |
| Corrupt VKD3D shader cache or Proton prefix mismatch | Game freezes on level load or RT toggle | Clear `shadercache` and switch to Proton Experimental |

## Root Cause & Technical Mechanics

VKD3D-Proton translates Direct3D 12 API calls into **Vulkan**. Unlike DirectX 11 (DXVK), DirectX 12 exposes explicit command queues (`DIRECT`, `COMPUTE`, `COPY`) and low-level resource barriers. On NVIDIA GeForce GPUs on Linux, freezes stem from three subsystems:

1. **Implicit vs. Explicit Sync deadlocks:** Prior to NVIDIA **555** (`linux-drm-syncobj-v1` support), Wayland/XWayland relied on implicit sync. Under heavy DX12 frame pacing, the compositor and driver could desynchronize over buffer ownership, stalling the Vulkan swapchain queue indefinitely.
2. **Multi-queue contention:** Concurrent async compute shaders (ray tracing denoising, volumetric fog) alongside the main graphics queue can hit semaphore deadlocks (`Xid 13`/`31`/`109` in `dmesg`) on Turing, Ampere, and Ada GPUs, freezing rendering while CPU audio keeps playing.
3. **GSP Firmware & VRAM pressure:** Overcommitting 8 GB VRAM with DX12 RT or Frame Generation spills allocations over PCIe into system RAM, triggering multi-second driver timeouts.

## Step-by-Step Solution

### Step 1: Verify Your NVIDIA Driver Branch and Kernel Logs

Check your active driver version and inspect the kernel ring buffer for NVIDIA `Xid` GPU fault codes:

```bash
nvidia-smi
sudo dmesg -T | grep -iE "NVRM|Xid|vulkan" | tail -n 20
```

If your driver is older than **555.58**, upgrade to the **560+** or **565+** production branch via your distro's repository (and ensure `xwayland` is >= `24.1` and Wayland compositor supports `linux-drm-syncobj-v1`, such as KDE Plasma 6.1+ or GNOME 46.1+).

### Step 2: Force Single-Queue Execution in VKD3D-Proton

Eliminate asynchronous compute/graphics queue deadlocks by instructing VKD3D-Proton to serialize D3D12 command queues onto a single Vulkan graphics queue. In **Steam > Game Properties > Launch Options**, set:

```bash
VKD3D_CONFIG=single_queue %command%
```

If you also want to prevent speculative swapchain buffering from exhausting VRAM, cap max pre-rendered frames to `1`:

```bash
__GL_MaxFramesAllowed=1 VKD3D_CONFIG=single_queue %command%
```

### Step 3: Disable GSP Firmware Temporarily (If `Xid` Errors Persist)

If `dmesg` still shows `NVRM: Xid` hangs on proprietary closed-source NVIDIA modules, test disabling GSP firmware offload in `/etc/modprobe.d/nvidia-gsp.conf`:

```bash
echo "options nvidia NVreg_EnableGpuFirmware=0" | sudo tee /etc/modprobe.d/nvidia-gsp.conf
sudo update-initramfs -u   # Use 'sudo dracut --force' on Fedora/RHEL
```

Reboot and test the game again. *(Note: the `nvidia-open` kernel module requires GSP and ignores `NVreg_EnableGpuFirmware=0`.)*

### Step 4: Verify Frame Pacing and GPU Health

Launch the game with MangoHud enabled (`MANGOHUD=1`) or monitor GPU utilization and VRAM in a second terminal or SSH session:

```bash
nvidia-smi dmon -s pucvmet -d 2
```

Confirm VRAM usage remains below 95% of physical card capacity and no new `Xid` messages appear in `dmesg`.

## Frequently Asked Questions

### Why does game audio keep playing when the screen is frozen?
Audio mixing (FMOD/Wwise/PipeWire) runs on separate CPU threads. When the Vulkan presentation queue or GPU scheduler deadlocks, only the graphics pipeline halts while CPU-side audio and game logic loops continue until a synchronization barrier blocks them.

### Does `VKD3D_CONFIG=single_queue` reduce FPS?
In most DX12 titles, the FPS impact is under 1–3% because NVIDIA's hardware scheduler already serializes many async compute workloads internally, while completely eliminating multi-queue semaphore hangs.

### Should I use DX11 mode instead of DX12 if the game offers a choice?
If a game supports both DX11 (via DXVK) and DX12 (via VKD3D-Proton) and you do not need DX12-exclusive features like Ray Tracing, DXVK is often more mature and exhibits lower VRAM overhead on 8 GB GeForce cards.

## Prevention Advice

- **Keep Proton and Mesa/Vulkan ICDs updated:** Use **Proton Experimental** or recent **Proton-GE** releases, which ship the latest VKD3D-Proton NVIDIA workarounds.
- **Avoid exceeding physical VRAM:** Lower texture quality or disable Ray Tracing on 8 GB GPUs; DX12 allocates aggressively and Linux VRAM eviction is less forgiving than Windows WDDM.
- **Use X11 as a fallback:** If your distro ships an older compositor without Explicit Sync (`wp_linux_drm_syncobj_manager_v1`), test an X11 session to isolate Wayland presentation bugs.
- **Lock PowerMizer to Prefer Maximum Performance** during gaming sessions via `nvidia-settings -a "[gpu:0]/GpuPowerMizerMode=1"` to prevent aggressive clock-state transitions mid-frame.

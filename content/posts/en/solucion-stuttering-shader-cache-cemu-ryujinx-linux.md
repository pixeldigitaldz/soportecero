---
title: 'Fix Shader Cache Stuttering & Lag in Cemu & Ryujinx on Linux'
description: >-
  Eliminate frame drops and micro-stutter during live shader compilation in
  Ryujinx, Cemu, and RPCS3 emulators on Linux using Mesa and Vulkan.
category: Gaming Tech
tags:
  - Gaming
  - Linux
  - Vulkan
  - Emulation
readTime: '6 min'
date: '2026-09-25'
---

Severe frame-time spikes (100 ms–800 ms freezes) whenever a new particle effect, weapon swing, or area loads in **Cemu**, **Ryujinx**, or **RPCS3** on Linux are caused by **synchronous shader and pipeline compilation**. Every time the emulated console requests a shader program your host GPU has never seen before, the emulator's render thread stalls until Mesa or the Nvidia driver compiles it into native GPU machine code.

## Quick Diagnostics

| Symptom / Cause | Immediate Action |
|---|---|
| **Freezes on first-time effects or camera pans** | Switch graphics backend to **Vulkan** and enable **Async shader compile** |
| **Stutters returning after playing other games** | Increase `MESA_SHADER_CACHE_MAX_SIZE=10G` to stop cache eviction |
| **Slow shader compilation on AMD Radeon (RADV)** | Ensure Mesa ACO compiler is active (default, verify no `LLVM` override) |
| **Nvidia OpenGL/Vulkan cache wiping old titles** | Set `__GL_SHADER_DISK_CACHE_SKIP_CLEANUP=1` |

## Root Cause & Technical Mechanics

Consoles like the Wii U (GX2), Nintendo Switch (NVN), and PS3 (RSX) ship precompiled shaders tailored strictly for their fixed console GPUs. Because your Linux PC or Steam Deck runs a completely different GPU architecture (AMD RDNA, Intel Arc, or Nvidia Ada/Ampere), the emulator must translate guest shader bytecode into SPIR-V, and your Vulkan driver must compile that SPIR-V into native ISA binaries at runtime.

Two Linux-specific pitfalls worsen this stutter:
1. **Synchronous Pipeline Creation:** If an emulator calls `vkCreateGraphicsPipelines` synchronously on the main render thread, frame presentation halts completely until compilation finishes.
2. **Aggressive Driver Cache Eviction:** By default, Mesa's disk shader cache (`~/.cache/mesa_shader_cache_db` or `mesa_shader_cache`) caps total storage at **1 GB**. Playing two or three large games fills that 1 GB quota and silently evicts your older emulator pipelines, forcing endless recompilation.

## Step-by-Step Solution

### 1. Enable Asynchronous Shader Compilation in Your Emulator

Switch from OpenGL to **Vulkan** and offload pipeline compilation to background worker threads:

- **Cemu:** Open *Options -> General Settings -> Graphics*:
  - Graphics API: `Vulkan`
  - Check **Async shader compile** (requires Vulkan).
- **Ryujinx:** Open *Options -> Settings -> Graphics*:
  - Graphics Backend: `Vulkan`
  - Enable **Shader Cache** and **Enable Macro HLE**.
- **RPCS3:** Open *Config -> GPU*:
  - Renderer: `Vulkan`
  - Shader Mode: **Async (multi threaded)** with **Shader Interpreter** fallback if desired.

### 2. Expand Mesa and Nvidia Disk Shader Cache Limits

Prevent the GPU driver from deleting compiled pipelines by raising the disk cache cap to 10 GB. Add the appropriate variables to `/etc/environment` (system-wide) or your emulator's launch command:

```bash
# For AMD & Intel (Mesa RADV / ANV)
MESA_SHADER_CACHE_MAX_SIZE=10G

# For Nvidia proprietary drivers
__GL_SHADER_DISK_CACHE_SIZE=10737418240
__GL_SHADER_DISK_CACHE_SKIP_CLEANUP=1
```

If launching via Steam (such as Cemu or Ryujinx added as a non-Steam game on Steam Deck), paste them directly into **Launch Options**:

```bash
MESA_SHADER_CACHE_MAX_SIZE=10G %command%
```

### 3. Verify Mesa ACO Compiler on AMD GPUs

On AMD Radeon GPUs, Mesa's **ACO** shader compiler is orders of magnitude faster than the legacy LLVM backend. Verify your system isn't overriding it with `RADV_DEBUG=llvm`:

```bash
env | grep -i RADV
vulkaninfo --summary | grep -E "deviceName|driverInfo"
```

Ensure `RADV_DEBUG=llvm` is not set anywhere in `/etc/environment` or `~/.bashrc`.

### 4. Confirm Cache Persistence on Disk

Play for 5 minutes in an area with heavy effects, then verify that your Mesa or Nvidia cache directory is actively growing and not blocked by read-only permissions:

```bash
du -sh ~/.cache/mesa_shader_cache* ~/.nv/GLCache 2>/dev/null
```

## Frequently Asked Questions

### Does Asynchronous Shader Compilation cause visual bugs?
Temporarily, yes. Instead of freezing the whole screen while compiling a fire or explosion shader, the frame renders immediately and that specific effect pops in a few frames later. Once cached to disk, it renders instantaneously on every future run.

### Should I download pre-built shader caches from the internet?
Be cautious: Vulkan pipeline caches are tied closely to exact GPU hardware IDs, Mesa/Nvidia driver versions, and emulator revisions. Using mismatched third-party caches often causes crashes or corrupted textures, whereas building your own with Vulkan + Async takes only minutes.

### Why did my shader cache reset after a system update on SteamOS or CachyOS?
Major Mesa or Nvidia driver upgrades change internal compiler structures, invalidating old binary caches so the driver safely rebuilds compatible pipelines.

## Prevention Advice

- **Always choose Vulkan over OpenGL:** Modern Linux emulators achieve dramatically lower shader compile times and better multi-threading under Vulkan.
- **Avoid clearing `~/.cache/` blindly:** Cleaning your entire user cache folder deletes Mesa and emulator shader caches, bringing back initial stuttering.
- **Monitor disk space on `/home`:** Ensure your home partition has at least 15 GB free when setting a 10 GB `MESA_SHADER_CACHE_MAX_SIZE` limit.
- **Use Flatpak overrides if needed:** If running Ryujinx or Cemu as a Flatpak, grant cache env vars via `flatpak override --user --env=MESA_SHADER_CACHE_MAX_SIZE=10G <app-id>`.

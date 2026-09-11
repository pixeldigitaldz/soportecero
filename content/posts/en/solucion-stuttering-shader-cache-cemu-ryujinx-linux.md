---
title: "[SOLVED] Fix Shader Cache Stuttering & Lag in Cemu & Ryujinx on Linux"
description: "Eliminate frame drops and micro-stutter during live shader compilation in Ryujinx, Cemu, and RPCS3 emulators on Linux using Mesa and Vulkan."
category: "Gaming Tech"
tags: ["Gaming","Linux","Vulkan","Emulation"]
readTime: "4 min"
date: "2026-09-25"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Real-time compilation of graphics pipelines when new assets/effects appear on screen** | Enable Asynchronous Shader Compilation in emulator graphics preferences |
| **Driver-level shader cache size limits in Mesa or Nvidia forcing cache evictions** | Set MESA_SHADER_CACHE_MAX_SIZE=10G and leverage the RADV/ACO backend |

When playing emulation titles through modern software like Ryujinx, Cemu, or RPCS3 on Linux (Steam Deck, Arch, Bazzite, Fedora), players frequently endure disruptive micro-stutters whenever encountering new visual effects or entering new game areas. This performance hitching is caused by real-time shader compilation stalling the graphics render pipeline.

> **Quick Solution (1 Minute):**
> 1. Enable high-speed ACO compiler on AMD GPUs:
>    `export RADV_PERFTEST=aco`
> 2. Expand driver shader cache disk limits:
>    `export MESA_SHADER_CACHE_MAX_SIZE=10G`

## 🚀 Step-by-Step Solution

### Step 1: Enable Asynchronous Shader Compilation in Emulator Settings
Asynchronous compilation offloads shader processing to background worker threads rather than holding up frame presentation:
- **Cemu:** Navigate to *Options* -> *General Settings* -> *Graphics* tab -> Check **Async shader compile**.
- **Ryujinx:** In *Options* -> *Settings* -> *Graphics* -> Turn on **Enable Shader Cache** and enable **Backend Multithreading**.

### Step 2: Leverage Valve ACO Shader Compiler for AMD Radeon
The ACO compiler inside open-source Mesa drivers compiles Vulkan instructions significantly faster than traditional LLVM:
```bash
# Configure in system environment or launch options
export RADV_PERFTEST=aco
```

### Step 3: Increase Driver Shader Cache Disk Storage Limits
Default Mesa configurations may cap disk shader storage at 1GB, evicting compiled caches when switching between titles. Expand this threshold to 10GB:
```bash
# Append to /etc/environment or ~/.bashrc
export MESA_SHADER_CACHE_MAX_SIZE=10G
export __GL_SHADER_DISK_CACHE_SKIP_CLEANUP=1
```
For Nvidia GeForce users, configure `__GL_SHADER_DISK_CACHE_SIZE=10737418240` to prevent premature cache invalidation.

## 🛡️ Prevention Tips
* Keep precompiled shader pipelines intact; avoid clearing your emulator's cache folder during routine minor updates.
* Always prioritize Vulkan over OpenGL for modern Linux emulation workloads.

## Frequently Asked Questions

### Why is stutter heaviest during the first 15 minutes of gameplay?
The emulator translates console bytecode into host GPU machine code upon first encounter. Once saved to disk cache, subsequent replays of the same assets run completely stutter-free.

### Does async shader compilation produce visual glitches?
Briefly, yes. You may see pop-in where a special effect appears a fraction of a second late rather than freezing your whole screen to compile it.

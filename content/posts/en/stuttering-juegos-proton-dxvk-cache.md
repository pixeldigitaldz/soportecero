---
title: How to Fix Graphics Stuttering in Linux Games Using DXVK Pipeline Caching
description: >-
  Learn how to eliminate Direct3D to Vulkan translation stuttering in Linux gaming.
  Configure DXVK state caches, Valve ACO shader compiler, and Vulkan Graphics Pipeline Library.
category: Gaming Tech
tags:
  - Linux
  - Gaming
  - DXVK
  - Proton
  - Vulkan
readTime: 5 min
date: '2026-07-27'
---

Running Windows games on Linux using Valve's **Proton** or standalone **Wine** requires translating Microsoft Direct3D 9, 10, and 11 API draw calls into cross-platform **Vulkan** commands via the **DXVK** runtime translation layer. When launching a title for the first time or entering a newly rendered map, the graphics driver must compile thousands of specialized vertex, pixel, and compute shaders on demand.

During synchronous compilation, the rendering pipeline pauses for a few milliseconds whenever a new visual asset (such as an explosion, dynamic lighting shift, or enemy particle effect) appears on screen. This results in jarring frametime spikes—commonly known as **shader stuttering**—even on high-end hardware with high average FPS.

Configuring DXVK state caching, pairing it with modern Vulkan Graphics Pipeline Library (GPL) features, and fine-tuning Valve's **ACO compiler** resolves this stuttering permanently.

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Real-time synchronous shader compiling stalling CPU/GPU queues** | Enable the Vulkan Graphics Pipeline Library (GPL) or use `DXVK_ASYNC=1` in Proton-GE |
| **Corrupted or invalidated DXVK state cache file in game prefix** | Remove stale `.dxvk-cache` file located in the game's Wine prefix directory |
| **Outdated Mesa graphics driver lacking fast ACO compiler optimizations** | Upgrade Mesa to version 23.3+ (RADV ACO is active by default) |
| **Steam Shader Pre-Caching disabled in global client preferences** | Enable background shader pre-caching in Steam > Settings > Downloads |

## 🚀 Step-by-Step Implementation Guide

### Step 1: Enable Asynchronous Shader Compilation (Proton-GE / DXVK-Async)
If you play on older hardware or run legacy titles on systems lacking the Vulkan GPL extension, standard DXVK can be patched to compile shaders asynchronously in background worker threads:
1. Ensure your game is configured to run with **GE-Proton** (Proton-GE), which integrates async patches.
2. Open Steam, right-click your game, select **Properties**, and enter the following launch option:
```bash
DXVK_ASYNC=1 %command%
```
*(Explanation: `DXVK_ASYNC=1` instructs the translation layer to skip drawing an uncompiled object for a brief frame rather than stalling the entire render loop, completely eliminating stutter).*

### Step 2: Leverage Native Vulkan Graphics Pipeline Library (GPL)
On modern drivers (Mesa 23.1+ for AMD/Intel and driver 535+ for NVIDIA), native GPL support supersedes the need for async patches by allowing the GPU to compile pipeline parts in parallel without visual pop-in.

To verify and enforce optimal pipeline caching in DXVK:
1. Create or edit a local `dxvk.conf` file in the game's executable directory:
```ini
# dxvk.conf configuration profile
dxvk.enableGraphicsPipelineLibrary = True
dxvk.numCompilerThreads = 0
dxvk.tearFree = False
```
*(Setting `dxvk.numCompilerThreads = 0` instructs DXVK to automatically utilize all available physical CPU cores for parallel background shader compilation).*
2. In Steam Launch Options, append:
```bash
__GL_SHADER_DISK_CACHE_SKIP_CLEANUP=1 %command%
```

### Step 3: Optimize the AMD Mesa RADV Compiler (ACO)
On AMD Radeon graphics cards, the open-source **RADV** driver uses Valve's custom **ACO (AMD Compiler)** backend. ACO was engineered specifically for gaming workloads and compiles shaders up to 3× faster than legacy LLVM backends:
```bash
# Verify that ACO is active on your Mesa driver
RADV_PERFTEST=gpl %command%
```
If you encounter visual anomalies in older titles, you can test switching compilers temporarily:
```bash
RADV_DEBUG=llvm %command%
```

### Step 4: Clear Corrupted Prefix Cache Files
If a game patch updates rendering assets, your accumulated `.dxvk-cache` file may contain outdated pipeline entries that cause continuous micro-stuttering:
```bash
# Locate and remove the state cache within your Steam prefix
find ~/.local/share/Steam/steamapps/compatdata/ -name "*.dxvk-cache"
rm ~/.local/share/Steam/steamapps/compatdata/<APP_ID>/pfx/*.dxvk-cache
```
The game will regenerate a fresh, clean state cache upon the next launch.

## 🛡️ Best Practices & System Maintenance
- **Do Not Run Automated Cleaners on GPU Cache Directories:** Operating system cleaners often treat `~/.cache/mesa_shader_cache` or `~/.nv/ComputeCache` as junk files. Deleting these folders forces the GPU to compile every asset from scratch in your next gaming session.
- **Enable Background Shader Processing in Steam:** In Steam > Settings > Downloads, keep **Allow background processing of Vulkan shaders** toggled ON. Steam will download pre-compiled pipeline caches from other players with identical hardware, compiling them while your computer is idle.

## Frequently Asked Questions (FAQ)

### Is DXVK_ASYNC safe to use in multiplayer games with anti-cheat?
In competitive multiplayer games equipped with kernel-level or memory-scanning anti-cheat (such as Easy Anti-Cheat or BattlEye), running patched async DXVK libraries can occasionally trigger anti-tamper warnings. It is best to use standard upstream Proton with native GPL in competitive multiplayer titles.

### Why do games stutter after updating my graphics driver?
Whenever you update your GPU driver (Mesa or NVIDIA), the driver's internal shader binary format changes. The driver must discard old compiled machine code and rebuild its disk cache, causing brief stuttering during the first few minutes of gameplay.

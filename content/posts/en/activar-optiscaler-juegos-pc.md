---
title: How to Activate OptiScaler in PC Games Without Native DLSS Support
description: >-
  Learn how to force modern image upscaling and improve your FPS on older
  graphics cards using OptiScaler via manual library configurations and Wine overrides.
category: Gaming Tech
tags:
  - OptiScaler
  - Gaming
  - Proton
  - Linux
  - DLSS
readTime: 5 min
date: '2026-07-16'
---

If you are a PC gamer with legacy hardware or use optimized Linux-based gaming platforms (such as CachyOS, Bazzite, or SteamOS), maximizing frames per second (FPS) in demanding titles like *Cyberpunk 2077* or *Diablo IV* is essential. However, proprietary upscaling technologies like NVIDIA DLSS are hardware-locked to RTX series graphics cards, leaving GTX and older Radeon cards unsupported.

This is where **OptiScaler** comes in. OptiScaler is an open-source middleware wrapper that intercepts native DLSS (NVNGX) API calls at the DirectX/Vulkan boundary and translates them into vendor-agnostic technologies such as AMD FidelityFX Super Resolution (FSR 2.2 / FSR 3.1) or Intel XeSS. This enables high-performance spatial and temporal upscaling on GPUs that do not natively feature proprietary Tensor cores.

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Missing OptiScaler DLL wrapper or incorrect injection path** | Copy `dxgi.dll` and `nvngx.dll` into the directory containing the primary game `.exe` |
| **Proton/Wine ignoring custom DLLs in Linux prefix** | Configure `WINEDLLOVERRIDES="dxgi=n,b" %command%` in Steam Launch Options |
| **DirectX 12 hook collision with third-party overlays (MangoHud/RivaTuner)** | Disable conflicting hooks or load OptiScaler ahead of monitoring overlays |

## 🚀 Step-by-Step Implementation Guide

### Step 1: Download and Verify the OptiScaler Release
Download the latest verified release from the official OptiScaler GitHub repository. The release archive contains the core wrapper libraries:
- `dxgi.dll`: Intercepts the DirectX Graphics Infrastructure presentation loop.
- `nvngx.dll`: Emulates NVIDIA's DLSS backend integration layer.
- `optiscaler.ini`: The central configuration file for setting upscaler backends (FSR 3.1, XeSS, or native spatial upscalers).

### Step 2: Deploy Wrapper Files to the Game Directory
Locate your game's root installation folder where the actual 64-bit game binary resides (ensure you place the files in the directory with the real binary, not a launcher executable):
```bash
# Example directory structure for Steam games on Linux:
~/.local/share/Steam/steamapps/common/Cyberpunk 2077/bin/x64/
```
Extract `dxgi.dll`, `nvngx.dll`, and `optiscaler.ini` directly into this folder adjacent to the game executable.

### Step 3: Configure Wine/Proton DLL Overrides
On Windows, DirectX applications automatically check the local application directory for DLLs before scanning system directories (`System32`). Under Wine or Valve's Proton on Linux, however, the Wine runtime prioritizes internal built-in libraries over custom files unless explicitly instructed otherwise.

To force Wine to load your local OptiScaler wrapper:
1. Open Steam, right-click your game, and select **Properties**.
2. Navigate to the **General** tab and locate the **Launch Options** field.
3. Add the following override command:
```bash
WINEDLLOVERRIDES="dxgi=n,b;nvngx=n,b" %command%
```
*(Explanation: `n,b` instructs the Wine loader to attempt `native` first, falling back to `builtin` only if the local file fails to load).*

### Step 4: Fine-Tune Upscaling Backend in optiscaler.ini
Open `optiscaler.ini` with any standard text editor to configure runtime behavior:
```ini
[General]
; Set backend: Auto, FSR2.2, FSR3.1, or XeSS
Dx12Upscaler = FSR3.1
Dx11Upscaler = FSR3.1
OutputScaling = false

[FSR3]
; Enable native camera jitter detection
Velocity = auto
```

### Step 5: Activate DLSS in the In-Game Graphics Settings
Launch the game normally. Open the in-game display or graphics settings. The DLSS option will now appear enabled and selectable, regardless of whether your physical GPU is manufactured by AMD, Intel, or NVIDIA. Select **Quality** or **Balanced** mode to achieve significant framerate improvements while retaining sharp native-like visuals.

## 🛡️ Prevention and Anti-Cheat Advisory
- **Single-Player and Co-Op Only:** Because OptiScaler hooks runtime DirectX and Vulkan memory structures, never run it in games protected by kernel-level anti-cheat engines (such as Easy Anti-Cheat, BattlEye, or Ricochet). Anti-cheat software may detect memory hooking as third-party injection and trigger an account ban.
- **Backup Original Files:** Always verify game file integrity via Steam or your launcher if you decide to remove OptiScaler.

## Frequently Asked Questions (FAQ)

### Can OptiScaler induce input lag or frame pacing stutter?
When configured with temporal upscalers like FSR 3 or XeSS, input latency is identical to native rendering at the internal render resolution. However, ensure V-Sync and framerate limiters are coordinated in your GPU driver control panel to maintain smooth frametime delivery.

### Does OptiScaler support frame generation on GTX 10-series or RX 5000 GPUs?
Yes, when combined with FSR 3.1 frame generation modules, OptiScaler can synthesize intermediate frames even on older hardware architectures that lack hardware optical flow accelerators.

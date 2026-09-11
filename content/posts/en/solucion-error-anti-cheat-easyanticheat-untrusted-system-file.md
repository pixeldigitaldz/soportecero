---
title: "[SOLVED] Easy Anti-Cheat Error: Untrusted system file in Windows & Linux Proton"
description: "How to fix the Untrusted system file crash from Easy Anti-Cheat when launching Apex Legends, Fortnite, or Elden Ring."
category: "Gaming Tech"
tags: ["Gaming","AntiCheat","Steam","Windows"]
readTime: "4 min"
date: "2026-10-01"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Modified or unsigned third-party DLLs injected by overlay software (ReShade, RTSS, recording tools)** | Disable active capture overlays or remove injected DLL wrappers from game binaries |
| **Corrupted system DLLs in Windows or outdated Proton EasyAntiCheat Runtime on Linux** | Run sfc /scannow on Windows or verify integrity of game files inside Steam |

When launching multiplayer titles defended by Easy Anti-Cheat (EAC), the boot process halts with a popup warning: `Easy Anti-Cheat - Untrusted system file (C:\...\file.dll)`. The anticheat kernel driver detected an unrecognized checksum or missing digital signature on the specified library and blocked execution to prevent memory injection attacks.

> **Quick Solution (1 Minute):**
> 1. On Windows, run system integrity verification:
>    `sfc /scannow`
> 2. Inside Steam, verify game assets:
>    *Properties -> Installed Files -> Verify integrity of game files*

## 🚀 Step-by-Step Solution

### Step 1: Audit the File Path Flagged in the EAC Modal
Examine the exact absolute path specified in the alert:
- If pointing to `System32` or `SysWOW64`, an OS component has failed digital signature verification.
- If pointing to your game directory or screen recording tooling (OBS, RivaTuner, Overwolf, Discord), an external injection hook is triggering the heuristic filter.

### Step 2: Disable Screen Overlays and Graphics Injection Tools
Completely terminate ambient utility programs prior to launching:
1. **RivaTuner Statistics Server (RTSS):** Lower application detection level to *None* or exclude the game executable.
2. **ReShade:** Remove custom `dxgi.dll` or `d3d11.dll` wrappers from the game folder.
3. Turn off Discord and NVIDIA GeForce Experience game overlays.

### Step 3: Repair Easy Anti-Cheat Service or Steam Runtime
On Windows:
1. Navigate to the game's directory and enter the `EasyAntiCheat` subfolder.
2. Right-click `EasyAntiCheat_Setup.exe` and choose *Run as Administrator*.
3. Choose your game in the selector and click **Repair Service**.

On Linux / Steam Deck:
Ensure the tool **Proton EasyAntiCheat Runtime** is downloaded and up to date in your Steam library.

## 🛡️ Prevention Tips
* Ensure Microsoft Visual C++ Redistributable 2015-2022 runtimes are up to date.
* Never manually download loose DLLs from internet mirrors into Windows system folders.

## Frequently Asked Questions

### Why does EAC flag legitimate Windows libraries like crypt32.dll?
A corrupted Windows Update can break local certificate catalog validations. Fix with `DISM /Online /Cleanup-Image /RestoreHealth` followed by `sfc /scannow`.

### Does Easy Anti-Cheat support Proton on Linux?
Yes, if the studio enabled Wine/Proton EAC support server-side and the Steam user has installed the Proton EasyAntiCheat Runtime.

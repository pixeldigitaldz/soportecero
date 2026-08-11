---
title: "[FIXED] Overwatch 2 Crashing on Linux / Steam Deck"
description: "Overwatch 2 crashing or freezing on Linux/Steam Deck under Proton? Step-by-step resolution for MangoHud conflicts and DXVK shader caches."
category: "Gaming Tech"
tags: ["Gaming", "Linux", "Steam Deck", "Proton", "Overwatch 2"]
readTime: "4 min"
date: "2026-08-16"
---

Unexpected **crashes or freezes playing Overwatch 2** on Linux (CachyOS, Arch, Ubuntu, Fedora) or Steam Deck via Proton are primarily triggered by synchronous DXVK shader compilation, incompatible performance overlays like MangoHud, or missing codecs in standard Proton builds.

> **Quick Solution (1 Minute):**
> 1. Set Steam Launch Options for Overwatch 2:
>    `MANGOHUD=0 %command%`
> 2. Switch compatibility tool to **GE-Proton** (Proton GloriousEggroll).

## 🚀 Step-by-Step Fixes

### Step 1: Disable MangoHud Overlay
Performance metric overlays can interfere with anti-cheat hooks and DXVK window initialization.

1. Open Steam -> Library -> Right-click **Overwatch 2** -> **Properties**.
2. Under **General**, navigate to **Launch Options** and enter:
```bash
MANGOHUD=0 %command%
```

### Step 2: Use GE-Proton (GloriousEggroll)
Standard Proton releases may crash during Battle.net media/video playback.

1. Launch **ProtonUp-Qt** (available via Discover store on Steam Deck or package managers).
2. Download the latest **GE-Proton** build (e.g., `GE-Proton9-10`).
3. In Steam, go to Overwatch 2 Properties -> **Compatibility** -> Check "Force the use of a specific Steam Play compatibility tool" -> Select `GE-Proton`.

### Step 3: Clear Corrupted DXVK Shader Cache
If crashes occur immediately upon joining a match:

Purge the cached shaders directory for Overwatch 2:
```bash
rm -rf ~/.steam/steam/steamapps/shadercache/2357570
```
*(App ID `2357570` corresponds to Overwatch 2 on Steam).*

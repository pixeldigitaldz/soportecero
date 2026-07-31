---
title: How to Fix Mouse Cursor Misalignment and Scaling Issues in Proton on Wayland
description: >-
  A technical guide to resolve mouse cursor misalignment, off-target clicking, and Xwayland fractional scaling blurriness in Steam Proton games on Wayland.
category: Gaming Tech
tags:
  - Proton
  - Wayland
  - Gaming
readTime: 4 min
date: '2026-08-04'
---

When running Windows games on Linux using Steam Proton under a Wayland display compositor with **fractional scaling** enabled (e.g., 125%, 150%, or 175% on 1440p or 4K displays), gamers frequently experience severe mouse cursor desynchronization. Common symptoms include the mouse pointer clicking several inches away from targeted UI elements, blurry rendering caused by Xwayland software upscale, or failure of the game window to lock and confine the mouse cursor during gameplay.

## 🔍 Quick Diagnostics

| Symptom | Root Cause | Solution |
| :--- | :--- | :--- |
| Mouse clicks hit off-target relative to the visible cursor position | Xwayland applies bitmap scaling to the game window while Wine interprets raw unscaled cursor coordinates | Set Xwayland legacy application scaling to "Apply scaling themselves" or force zero scaling |
| Game window appears blurry at native resolution when desktop display scaling is not 100% | Compositor forces Xwayland to render at a lower resolution and stretch pixels | Enable native Wayland driver support in Wine (Wine 9.0+ / Proton GE) via environment flags |
| Mouse cursor drifts out of game window into second monitor in multi-display setups | Missing `relative-pointer` or `pointer-constraints` protocol support in older Xwayland layers | Enable `PROTON_ENABLE_WAYLAND=1` or configure mouse warp overrides in Wine registry |

## 🚀 Step-by-Step Solution

### Step 1: Configure Desktop Xwayland Scaling Behavior
In desktop environments like KDE Plasma or GNOME, ensure legacy X11/Xwayland applications handle scaling internally rather than letting the compositor stretch the window buffer:

On **KDE Plasma**:
1. Open *System Settings > Display & Monitor > Display Configuration*.
2. Under **"Legacy Applications (X11)"**, select **"Apply scaling themselves"** instead of "Scaled by the system".

On **GNOME / Hyprland**:
For Hyprland users, add explicit zero-scaling rules to your configuration file:
```ini
# In hyprland.conf
xwayland {
    force_zero_scaling = true
}
```

### Step 2: Enable Native Wayland Driver in Proton GE / Proton Experimental
Starting with Wine 9.0 and modern Proton builds (GE-Proton 9+ or Proton Experimental), games can bypass Xwayland entirely and run using native Wayland window surfaces, eliminating cursor offsets:

Open **Steam > Game Properties > Launch Options** and enter the following environment flags:

```bash
# Enable experimental native Wayland driver in Proton GE 9+ / Wine 9.0+:
PROTON_ENABLE_WAYLAND=1 %command%

# Optional: Unset DISPLAY to prevent fallback to Xwayland sockets:
DISPLAY= PROTON_ENABLE_WAYLAND=1 %command%
```

### Step 3: Configure Mouse Confinement in Wine Registry (Wineprefix)
If a specific title keeps losing cursor lock when switching between cutscenes and gameplay, enforce hardware mouse warping inside the game's Steam `compatdata` directory:

```bash
# Locate game AppID (example: 1086940 for Baldur's Gate 3)
WINEPREFIX=~/.steam/steam/steamapps/compatdata/1086940/pfx winecfg
```
In the **Graphics** tab of `winecfg`:
1. Check **"Automatically capture the mouse in full-screen windows"**.
2. Uncheck **"Allow the window manager to decorate the windows"** if window borders interfere.

Alternatively, inject the registry key directly via terminal:
```bash
WINEPREFIX=~/.steam/steam/steamapps/compatdata/<APPID>/pfx reg add "HKCU\\Software\\Wine\\DirectInput" /v "MouseWarpOverride" /d "force" /f
```

## 🛡️ Prevention Advice

- **Always Match Native Game Resolutions**: When using desktop fractional scaling (e.g., 150%), set the in-game display resolution to your display's native pixel count (e.g., 3840x2160) and adjust UI scale using built-in FSR or DLSS settings.
- **Keep Proton-GE Updated**: Use tools like `ProtonUp-Qt` to stay on the latest GE-Proton releases, which include active patches for Wayland's `relative-pointer-v1` and `pointer-constraints-v1` protocols.
- **Disable Conflicting Overlays**: Turn off third-party overlays (Discord overlay, old MangoHud versions using X11 hooks) that might disrupt Xwayland cursor projection coordinates.

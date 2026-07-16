---
title: "How to Activate OptiScaler in PC Games Without Native DLSS Support"
description: "Learn how to force modern image upscaling and improve your FPS on older graphics cards using OptiScaler via manual library configurations."
category: "Gaming Tech"
tags: ["OptiScaler", "Gaming", "Proton"]
readTime: "4 min"
date: "2026-07-16"
---

If you are a PC gamer with modest hardware or use optimized Linux-based operating systems (such as CachyOS or Bazzite), increasing frames per second (FPS) in demanding titles like Diablo IV is a priority. However, technologies like DLSS are locked for older generation graphics cards.

This is where **OptiScaler** comes in, an open-source mod and wrapper that intercepts DLSS rendering calls and translates them into open technologies like FSR 3 or XeSS. This allows smart upscaling to be enabled in games that did not originally support it on your hardware.

## 🚀 Cómo activar OptiScaler paso a paso

### Paso 1: Descargar los archivos del mod
Go to the official OptiScaler repository on GitHub and download the latest stable version (usually a packed `.zip` file). The critical file we need is `dxgi.dll` or `nvngx.dll`.

### Paso 2: Colocar las librerías en la ruta del juego
Open the root folder where the main executable (`.exe`) of your video game is installed. Copy and paste the downloaded files (`dxgi.dll` and the configuration file `optiscaler.ini`) right there.

### Paso 3: Configurar el entorno de ejecución (Ejemplo en Steam / Linux / Proton)
If you play on Windows, the game will load the `.dll` file automatically upon opening. But if you are using Steam on Linux with Proton, you must force the system to load that custom library natively.

1. Open Steam, right-click on the game and select **Properties**.
2. Under the **General** tab, go to the **Launch Options** section.
3. Paste exactly the following command line:
```bash
WINEDLLOVERRIDES="dxgi=n,b" %command%
```

### Paso 4: Ajustar los modos dentro del juego
Launch the video game in the conventional way. Go to the graphics settings menu. You will notice that the NVIDIA DLSS option is now enabled for selection, even if you have a card from another brand. Enable it in Quality or Balanced mode to enjoy a massive performance boost without losing visual sharpness.

## 🛡️ Consejo de Prevención
Recommended safety practices:
- Since OptiScaler injects and modifies dynamic libraries at runtime, use it only in single-player or cooperative modes. Avoid using it in competitive multiplayer titles with strict kernel-level anti-cheat systems (such as Valve Anti-Cheat or Easy Anti-Cheat), as they could misinterpret the mod as a malicious program and ban your account.

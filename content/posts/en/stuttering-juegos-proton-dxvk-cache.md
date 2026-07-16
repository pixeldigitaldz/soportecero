---
title: "How to fix graphics stuttering in Linux games using DXVK cache"
description: "Learn how to mitigate graphical stuttering when translating DirectX to Vulkan by configuring asynchronous shader compilation in your PC games."
category: "Gaming Tech"
tags: ["Linux", "Gaming", "DXVK", "Proton"]
readTime: "4 min"
date: "2026-08-09"
---

Graphic stuttering when playing Windows titles on Linux through Proton or Wine occurs because the games' DirectX graphics calls are translated to the open Vulkan API in real time using the DXVK library. This generates a CPU consumption spike to compile each new texture shader the first time it is displayed on screen.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Activar la compilación asíncrona de shaders en Proton/Steam
If you play titles running under DirectX 11 or DirectX 9, you can tell DXVK to load shaders asynchronously in the background by adding variables to Steam launch options:
```bash
# Activar la traducción gráfica asíncrona de fondo
DXVK_ASYNC=1 %command%
```

### Paso 2: Configurar la compilación de shaders por hardware (GPL)
On modern NVIDIA and AMD drivers (with support for the Vulkan *Graphics Pipeline Library* extension), add environmental variables to speed up rendering:
```bash
# Forzar compilación paralela de la GPU
dxvk.enableGraphicsPipelineLibrary = True __GL_SHADER_DISK_CACHE_SKIP_CLEANUP=1 %command%
```

### Paso 3: Optimizar los controladores de video Mesa
If you use AMD graphics cards, make sure to enable the high-performance texture shader RADV compiler:
```bash
# Forzar el compilador RADV en lugar de opciones antiguas
RADV_PERFTEST=aco %command%
```

## 🛡️ Consejo de Prevención

Recommended security practices:
- Avoid repeatedly deleting GPU shader cache folders (`~/.nv` or `~/.cache`) using automatic system cleaning tools before starting your games. Deleting these temporary files will force your graphics card to recompile all three-dimensional elements from scratch, reintroducing the annoying FPS stutters in your next game session.

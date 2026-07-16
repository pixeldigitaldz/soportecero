---
title: "How to Eliminate Stuttering When Playing DirectX Titles on Linux by Optimizing DXVK Cache"
description: "Learn how to configure graphical translation environment variables to compile shaders in the background and stabilize your frame rates."
category: "Gaming Tech"
tags: ["Linux", "Gaming", "DXVK"]
readTime: "3 min"
date: "2026-08-02"
---

The image stuttering (*stuttering*) when launching a Windows game on Linux using Proton occurs because DirectX graphics calls must be translated to the open **Vulkan** API in real time using a library called DXVK. Every time you enter a new area or an enemy casts an ability, the game freezes for a few milliseconds while compiling the shader for the first time.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Habilitar la compilación de shaders en paralelo (GPL)
If you have modern graphics drivers (recent NVIDIA or AMD Mesa), you can activate the *Graphics Pipeline Library (GPL)* feature, which compiles shaders invisibly before they appear on screen.
1. Open the game properties in Steam.
2. In the **Launch Options** bar, add the following magic line of variables:
```bash
dxvk.enableGraphicsPipelineLibrary = True __GL_SHADER_DISK_CACHE_SKIP_CLEANUP=1 %command%
```

### Paso 2: Asignar un espacio ilimitado para la caché en el disco SSD
By default, video drivers limit the cache folder size to 1GB or 2GB. When it fills up, the system deletes old shaders and generates stuttering again. Modify your operating system limits by adding these lines in your terminal so that the GPU retains all texture learning:
```bash
echo "export EXTRA_LDFLAGS=\"-Wl,-O1 -Wl,--as-needed\"" >> ~/.bashrc
source ~/.bashrc
```

## 🛡️ Consejo de Prevención

Recommended security practices:
- When using performance distributions like CachyOS, avoid clearing system temporary files in bulk with automatic tools before playing. Deleting the `.nv` or `.cache` folder from your user directory will destroy weeks of previous shader compilation for your favorite games, forcing your video card to start the annoying stuttering process from scratch in the next game session.

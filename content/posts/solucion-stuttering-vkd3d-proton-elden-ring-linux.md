---
title: "[SOLUCIONADO] Stuttering y Caída de FPS en Elden Ring con VKD3D en Linux"
description: "¿Elden Ring sufre tirones (stuttering) o caídas bruscas de FPS en Linux o Steam Deck? Solución paso a paso para VKD3D-Proton y DirectX 12."
category: "Gaming Tech"
tags: ["Gaming", "Linux", "Steam Deck", "Proton", "VKD3D", "Elden Ring"]
readTime: "4 min"
date: "2026-08-26"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Tirones (stuttering) por compilación de shaders VKD3D DirectX 12** | Usar Proton-GE actualizado e incluir `VKD3D_CONFIG=single_queue %command%` |
| **Límite de memoria caché de shaders por defecto saturado** | Aumentar el tamaño de la caché de Vulkan agregando `__GL_SHADER_DISK_CACHE_SKIP_CLEANUP=1` |


El **`stuttering` (tirones de imagen) y las caídas de cuadros por segundo (FPS)** en Elden Ring al ejecutarse en sistemas Linux (CachyOS, Arch, Ubuntu, Fedora) o Steam Deck provienen del procesamiento síncrono del compilador de traducción de DirectX 12 a Vulkan (**VKD3D-Proton**) y la gestión de memoria VRAM en controladores gráficos.

> **Solución Rápida (1 Minuto):**
> Añade la siguiente variable de entorno en las Opciones de Lanzamiento de Steam para Elden Ring:
> `VKD3D_CONFIG=no_upload_hacks RADV_PERFTEST=gsw %command%`

## 🚀 Cómo solucionar el stuttering en Elden Ring paso a paso

### Paso 1: Configurar variables de ajuste de VKD3D-Proton
DirectX 12 requiere una compilación intensiva de tuberías (*pipeline state objects*). Al usar VKD3D, las optimizaciones de transferencia de memoria reducen los tirones durante la exploración del mapa abierto:

1. Abre Steam -> Clic derecho en **Elden Ring** -> **Propiedades**.
2. En los **Parámetros de lanzamiento**, añade:
```bash
VKD3D_CONFIG=no_upload_hacks %command%
```

### Paso 2: Activar la compilación de Shaders en segundo plano (Mesa RADV / NVIDIA)
Si utilizas tarjetas gráficas AMD (controladores Mesa RADV) o NVIDIA:

* **Para GPUs AMD:** Habilita el compilador de shaders ultra-rápido ACO:
  ```bash
  RADV_PERFTEST=aco VKD3D_CONFIG=no_upload_hacks %command%
  ```
* **Para GPUs NVIDIA:** Aumenta el límite de la caché de shaders en `/etc/environment`:
  ```bash
  __GL_SHADER_DISK_CACHE_SKIP_CLEANUP=1
  ```

### Paso 3: Usar GE-Proton (Bleeding Edge)
Las versiones optimizadas de Proton-GE incorporan parches específicos de VKD3D para corregir cuellos de botella en la memoria de video de juegos de FromSoftware:

1. Abre **ProtonUp-Qt** e instala la última versión de `GE-Proton`.
2. En Steam -> Propiedades de Elden Ring -> **Compatibilidad** -> Selecciona `GE-Proton`.

## 🛡️ Consejo de Prevención y Rendimiento
* No desactives la opción de precarga de shaders (*Shader Pre-compilation*) en las preferencias globales de Steam.

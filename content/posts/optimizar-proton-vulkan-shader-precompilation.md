---
title: "Cómo optimizar la precompilación de shaders de Vulkan en Steam Proton"
description: "Elimina el stuttering y acelera la carga de shaders en juegos DirectX 11 y 12 usando Proton, DXVK y RADV/Nvidia en Linux."
category: "Gaming Tech"
tags: ["Gaming", "Linux", "Proton", "Vulkan", "DXVK", "Steam Deck"]
readTime: "5 min"
date: "2026-07-27"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Tartamudeo (stuttering) al entrar en nuevas zonas por compilación síncrona de shaders** | Activar compilación en segundo plano en Steam y habilitar GPL (Graphics Pipeline Library) |
| **Caché de shaders de Vulkan corrupta o saturada en disco** | Limpiar el directorio `shadercache` y activar `RADV_PERFTEST=gpl` o `DXVK_ASYNC=1` |

Al jugar en Linux mediante Steam Proton, el tartamudeo o caída abrupta de fotogramas (stuttering) durante los primeros minutos de juego se debe a que el controlador gráfico está traduciendo llamadas de DirectX a código binario Vulkan (SPIR-V) en tiempo real (just-in-time). Si la GPU espera a que la CPU compile el sombreador antes de dibujar el fotograma, se genera una congelación perceptible.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Activar el procesamiento de Shaders en segundo plano en Steam
Steam incluye un sistema oficial para descargar y precompilar cachés de shaders compartidas:
1. Abre **Steam > Parámetros > Descargas** (Settings > Downloads).
2. En la sección **Sombreador previo al almacenamiento en caché** (Shader Pre-caching), marca las opciones:
   - *Habilitar sombreadores previos al almacenamiento en caché*.
   - *Permitir el procesamiento de sombreadores de Vulkan en segundo plano*.
3. Esto descargará paquetes de shaders precompilados por otros usuarios con tu misma GPU.

### Paso 2: Habilitar Graphics Pipeline Library (GPL) en controladores Mesa (AMD / Intel)
Los controladores abiertos RADV (Mesa 23.1+) y Nvidia (driver 535+) soportan GPL, permitiendo compilar sombreadores de forma ultra-rápida sin pausas:
```bash
# Comprobar la versión de Mesa instalada
glxinfo -B | grep -i "OpenGL version"

# En AMD: Asegurar que GPL está activo en las opciones de lanzamiento de Steam:
RADV_PERFTEST=gpl %command%
```

### Paso 3: Limpiar cachés de shaders corruptas
Si un juego sigue sufriendo tirones tras una actualización de controladores o parches del juego, elimina la caché local para forzar su regeneración limpia:
```bash
# Localizar y borrar la carpeta shadercache del juego (reemplaza <AppID> por el ID del juego)
rm -rf ~/.local/share/Steam/steamapps/shadercache/<AppID>

# En Steam Deck / Flatpak:
rm -rf ~/.var/app/com.valvesoftware.Steam/.local/share/Steam/steamapps/shadercache/<AppID>
```

### Paso 4: Optimizar la memoria de caché con variables de entorno de Mesa / DXVK
Aumenta el tamaño máximo de la caché de shaders en disco para evitar que el sistema borre sombreadores antiguos:
```bash
# Parámetros recomendados en las propiedades del juego en Steam:
__GL_SHADER_DISK_CACHE_SKIP_CLEANUP=1 MESA_SHADER_CACHE_MAX_SIZE=16G %command%
```

## 🛡️ Consejos de Prevención
- **Instala juegos en discos SSD NVMe:** La velocidad de lectura de la caché de shaders afecta directamente el tiempo de carga de texturas y niveles.
- **Mantén actualizados los drivers Mesa / Nvidia:** Cada versión de Mesa introduce optimizaciones críticas en la compilación de pipelines Vulkan.

## ❓ Preguntas Frecuentes (FAQ)

### ¿Qué diferencia hay entre DXVK Async y Vulkan GPL?
DXVK Async no dibuja el objeto hasta que el shader está listo (provocando parpadeo visual pero 0 tirones). Vulkan GPL es el estándar oficial del consorcio Khronos que compila al vuelo sin artefactos visuales ni tirones.

### ¿Dónde puedo ver el AppID de un juego de Steam?
En la URL de la tienda del juego en Steam (los números tras `/app/`) o en las propiedades del juego en tu biblioteca dentro de *Actualizaciones*.

---
title: "Cómo optimizar la precompilación de shaders de Vulkan en Steam Proton"
description: "Elimina los tirones al jugar títulos DirectX en Linux optimizando y activando el procesamiento en segundo plano de shaders de Vulkan."
category: "Gaming Tech"
tags: ["Gaming", "Linux", "Proton"]
readTime: "4 min"
date: "2026-08-08"
---

Los tirones gráficos repentinos (*shuttering*) e interrupciones al jugar títulos modernos en Linux bajo Steam Proton suelen deberse a la precompilación activa en tiempo de ejecución de shaders de Vulkan. El procesador compila los nuevos modelos gráficos en tiempo real mientras juegas, provocando una caída drástica e instantánea de la tasa de FPS.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Activar el procesamiento en segundo plano de Shaders en Steam
Configura Steam para que compile de forma asíncrona y en segundo plano todos los recursos gráficos antes de que ejecutes el juego:
1. Abre Steam y navega a **Parámetros** > **Precompilación de sombreadores**.
2. Asegura que la casilla **Habilitar precompilación de sombreadores (Shader Pre-caching)** esté marcada.
3. Activa la opción **Permitir procesamiento de sombreadores de Vulkan en segundo plano**.

### Paso 2: Utilizar DXVK Async para juegos DirectX 11
Para títulos basados en DirectX 11, puedes forzar a DXVK a compilar shaders de forma asíncrona añadiendo parámetros de lanzamiento específicos en tu juego de Steam:
```bash
# Establecer la directiva de compilación asíncrona para el juego en Steam
dxvk.enableAsync = true
```
*(Haz clic derecho en el juego > Propiedades > General > Parámetros de lanzamiento e ingresa):*
```plaintext
PROTON_ASYNC=1 %command%
```

### Paso 3: Limpiar cachés de sombreadores corruptos
Si los tirones persisten, purga la caché antigua de sombreadores de Vulkan para forzar una reconstrucción limpia y estable de las texturas de tus tarjetas gráficas NVIDIA o AMD:
```bash
# Eliminar el directorio de caché de sombreadores de Steam
rm -rf ~/.steam/steam/steamapps/shadercache/*
```

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
- No utilices la bandera `PROTON_ASYNC=1` en juegos competitivos online multijugador que cuenten con sistemas antitrampas restrictivos a nivel de kernel (como Easy Anti-Cheat o BattlEye). La inyección asíncrona altera la cadencia nativa de dibujado de frames de la librería del juego, lo que puede ser interpretado por los algoritmos del detector de trampas como un intento de manipulación visual del cliente, resultando en el bloqueo permanente de tu cuenta de jugador.

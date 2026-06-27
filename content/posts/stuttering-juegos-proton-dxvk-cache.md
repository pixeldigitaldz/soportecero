---
title: "Cómo eliminar los tirones (stuttering) de gráficos en juegos de Linux usando caché de DXVK"
description: "Aprende a mitigar el tartamudeo gráfico al traducir DirectX a Vulkan configurando la compilación asíncrona de shaders en tus juegos de PC."
category: "Gaming Tech"
tags: ["Linux", "Gaming", "DXVK", "Proton"]
readTime: "4 min"
date: "2026-06-27"
---

El tartamudeo gráfico o *stuttering* al jugar títulos de Windows en Linux a través de Proton o Wine ocurre porque las llamadas de gráficos DirectX de los juegos se traducen a la API abierta Vulkan en tiempo real mediante la librería DXVK. Esto genera un pico de consumo en el procesador para compilar cada nuevo sombreador de texturas la primera vez que se presenta en pantalla.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Activar la compilación asíncrona de shaders en Proton/Steam
Si juegas títulos que corren bajo DirectX 11 o DirectX 9, puedes ordenarle a DXVK que cargue los shaders de forma asíncrona en segundo plano agregando variables en los parámetros de lanzamiento de Steam:
```bash
# Activar la traducción gráfica asíncrona de fondo
DXVK_ASYNC=1 %command%
```

### Paso 2: Configurar la compilación de shaders por hardware (GPL)
En controladores modernos de NVIDIA y AMD (con soporte para la extensión Vulkan *Graphics Pipeline Library*), añade las variables de entorno para agilizar la renderización:
```bash
# Forzar compilación paralela de la GPU
dxvk.enableGraphicsPipelineLibrary = True __GL_SHADER_DISK_CACHE_SKIP_CLEANUP=1 %command%
```

### Paso 3: Optimizar los controladores de video Mesa
Si usas tarjetas gráficas AMD, asegúrate de habilitar el compilador RADV de sombreadores de texturas de alto rendimiento:
```bash
# Forzar el compilador RADV en lugar de opciones antiguas
RADV_PERFTEST=aco %command%
```

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
- Evita borrar de forma recurrente las carpetas de caché de sombreadores de la GPU (`~/.nv` o `~/.cache`) mediante herramientas automáticas de limpieza del sistema antes de iniciar tus juegos. Eliminar estos archivos temporales obligará a tu tarjeta gráfica a compilar nuevamente todos los elementos tridimensionales desde cero, reintroduciendo los molestos tirones de FPS en tu próxima partida de juego.

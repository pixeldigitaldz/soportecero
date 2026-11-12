---
title: >-
  Cómo eliminar los tirones (stuttering) de gráficos en juegos de Linux usando
  caché de DXVK
description: >-
  Aprende a mitigar el tartamudeo gráfico al traducir DirectX a Vulkan
  configurando la compilación asíncrona de shaders en tus juegos de PC.
category: Gaming Tech
tags:
  - Linux
  - Gaming
  - DXVK
  - Proton
readTime: 7 min
date: '2026-06-27'
---
El tartamudeo gráfico o *stuttering* al jugar títulos de Windows en Linux a través de Proton o Wine ocurre porque las llamadas de gráficos DirectX de los juegos se traducen a la API abierta Vulkan en tiempo real mediante la librería DXVK. Esto genera un pico de consumo en el procesador para compilar cada nuevo sombreador de texturas la primera vez que se presenta en pantalla.

## Análisis de Arquitectura y Causa Raíz

En la arquitectura de ejecución de videojuegos de Windows sobre sistemas operativos **Linux**, la capa de compatibilidad se fundamenta en **Wine** y **Proton**, complementados por traductores de llamadas gráficas en tiempo real como **DXVK** (que traduce Direct3D 9, 10 y 11 hacia la API moderna de **Vulkan**) y **VKD3D-Proton** (que traduce llamadas de Direct3D 12 hacia Vulkan).

El fallo de rendimiento, congelamiento (*freeze*) o cierre abrupto (*crash*) responde a cuellos de botella en la canalización de renderizado (*graphics pipeline*):
1. **Compilación asíncrona de shaders y tartamudeo (Shader Stuttering):** Los juegos diseñados para DirectX asumen que los shaders compilados en formato HLSL pueden instanciarse en la GPU de inmediato. Sin embargo, Vulkan requiere compilar los shaders hacia código binario intermedio **SPIR-V** y luego hacia el formato nativo del hardware del controlador gráfico (Mesa RADV para AMD, o el controlador privativo de NVIDIA). Si esta compilación ocurre en el mismo hilo de renderizado que dibuja los cuadros por segundo, la GPU se bloquea esperando instrucciones, provocando microparones abruptos en el frametime.
2. **Sincronización explícita y compositores Wayland:** Con la transición de X11 hacia el protocolo de servidor gráfico **Wayland**, la gestión de los buffers de intercambio (*swapchains*) dependía históricamente de la sincronización implícita del kernel. Cuando los controladores gráficos envían fotogramas desfasados antes de que la GPU complete la renderización del buffer anterior, se genera desgarro visual (*screen tearing*), fotogramas fuera de orden o bloqueos completos en compositores como KWin o Mutter.
3. **Agotamiento de VRAM y límites de memoria del subsistema DRM:** Cuando un título exige más memoria de video de la físicamente integrada en la tarjeta gráfica, el subsistema de administración de memoria de video del kernel (`amdgpu` o `nvidia-modeset`) se ve forzado a realizar swapping de texturas hacia la memoria RAM del sistema a través del bus PCIe. Esta transferencia a velocidades muy inferiores satura el ancho de banda del bus, culminando en caídas masivas de FPS o en un error fatal `VK_ERROR_DEVICE_LOST` emitido por el driver.

## Entorno de Laboratorio y Diagnóstico

Antes de aplicar cualquier cambio destructivo o reiniciar servicios en un entorno de producción, es fundamental ejecutar una matriz de diagnóstico preliminar para identificar la capa exacta donde ocurre el fallo:

| Causa | Solución |
|---|---|
| **Compilación de shaders DXVK sucediendo en tiempo real durante la partida** | Enable the Vulkan Graphics Pipeline Library (GPL) or use `DXVK_ASYNC=1` in Proton-GE |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Verificar la detección de la GPU y capacidades de Vulkan
vulkaninfo --summary

# 2. Inspeccionar mensajes del kernel en busca de errores del controlador gráfico
sudo dmesg -T | grep -E "(amdgpu|nvidia|drm|gpu|hang)" | tail -n 25

# 3. Comprobar la versión activa de los controladores de renderizado Mesa / NVIDIA
glxinfo -B | grep -E "(OpenGL renderer|OpenGL core profile version)"
```

- `vulkaninfo --summary` extrae un reporte conciso de las instancias, capas de validación y extensiones disponibles en el hardware gráfico sin saturar la pantalla con miles de líneas.
- El comando `dmesg` con el flag `-T` traduce las marcas de tiempo del buffer del kernel a fechas legibles por humanos, permitiendo identificar al instante si se produjo un reinicio de la GPU (*GPU hang/reset*) por sobrecalentamiento o caída del driver.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

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

## 🛡️ Consejos de Prevención

Prácticas de seguridad recomendadas:
- Evita borrar de forma recurrente las carpetas de caché de sombreadores de la GPU (`~/.nv` o `~/.cache`) mediante herramientas automáticas de limpieza del sistema antes de iniciar tus juegos. Eliminar estos archivos temporales obligará a tu tarjeta gráfica a compilar nuevamente todos los elementos tridimensionales desde cero, reintroduciendo los molestos tirones de FPS en tu próxima partida de juego.

---
title: Solución a tirones y stuttering por Shader Cache en Cemu y Ryujinx en Linux
description: >-
  Elimina los microtirones y congelamientos al compilar shaders en emuladores
  como Ryujinx, Cemu y RPCS3 en Linux con controladores Mesa y Vulkan.
category: Gaming Tech
tags:
  - Gaming
  - Linux
  - Vulkan
  - Emuladores
readTime: 7 min
date: '2026-09-25'
---
Al ejecutar títulos exigentes en emuladores modernos (como Ryujinx, Cemu o RPCS3) sobre distribuciones Linux (Steam Deck, Arch Linux, Bazzite, Ubuntu), es habitual experimentar microcongelamientos (*stuttering*) cada vez que un personaje lanza una habilidad o aparece una cinemática. Esto se debe a la compilación en tiempo real de pipelines de sombreado (*shader compilation stutter*).

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
| **Compilación de sombreadores en tiempo real al renderizar nuevos efectos por primera vez** | Enable Asynchronous Shader Compilation in emulator graphics preferences |

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

En las opciones del emulador, activa la compilación asíncrona para que los sombreadores se construyan en hilos secundarios de la CPU en lugar de congelar el renderizado:
- **Cemu:** Entra en *Options* -> *General Settings* -> pestaña *Graphics* -> Marca **Async shader compile**.
- **Ryujinx:** En *Options* -> *Settings* -> *Graphics* -> Habilita **Enable Shader Cache** y activa **Backend Multithreading**.

### Paso 2: Configurar el compilador ACO de Mesa (GPUs AMD Radeon)
El compilador de shaders **ACO** de la comunidad de Valve/Mesa compila instrucciones Vulkan hasta 3 veces más rápido que LLVM. Asegúrate de tener los controladores Mesa actualizados y define en tus variables de entorno:
```bash
# Añade a tu archivo de inicio ~/.profile o ejecútalo en Steam
export RADV_PERFTEST=aco
```

### Paso 3: Aumentar el límite de almacenamiento de la caché de shaders
Por defecto, Mesa puede limitar la caché de sombreadores a 1 GB, provocando que los juegos expulsen shaders antiguos cuando juegas a varios títulos. Amplía el límite a 10 GB:
```bash
# En /etc/environment o ~/.bashrc
export MESA_SHADER_CACHE_MAX_SIZE=10G
export __GL_SHADER_DISK_CACHE_SKIP_CLEANUP=1
```
En GPUs NVIDIA, asegúrate de activar el control de caché en el panel de control o mediante `__GL_SHADER_DISK_CACHE_SIZE=10737418240`.

## 🛡️ Consejos de Prevención

* No borres las carpetas `shader_cache` de tus emuladores al actualizar versiones a menos que un cambio de arquitectura de renderizado lo requiera explícitamente.
* Utiliza el backend gráfico Vulkan en lugar de OpenGL en Linux para un rendimiento multihilo superior.

## Preguntas Frecuentes

### ¿Es normal que el emulador dé tirones durante los primeros minutos de juego?
Sí, durante la primera partida el emulador debe traducir los shaders de la consola a instrucciones legibles por tu tarjeta gráfica. Con la compilación asíncrona activa, los tirones se reemplazan por la aparición momentánea de texturas sin bloquear la tasa de cuadros.

### ¿Cómo compruebo si Vulkan está utilizando el compilador ACO en mi Steam Deck?
Ejecuta el juego con la variable `vulkaninfo | grep -i drivername` o lanza el emulador desde la terminal con `MESA_VK_DEVICE_SELECT=...`.

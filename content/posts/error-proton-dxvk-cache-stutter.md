---
title: >-
  Cómo eliminar los tirones al jugar títulos DirectX en Linux optimizando la
  caché de DXVK
description: >-
  Aprende a configurar las variables de entorno de traducción gráfica para
  compilar shaders en segundo plano y estabilizar tus fotogramas.
category: Gaming Tech
tags:
  - Linux
  - Gaming
  - DXVK
readTime: 7 min
date: '2026-06-27'
---
El tartamudeo de la imagen (*stuttering*) al iniciar un juego de Windows en Linux mediante Proton ocurre porque las llamadas de gráficos de DirectX deben traducirse a la API abierta **Vulkan** en tiempo real mediante una librería llamada DXVK. Cada vez que entras a una zona nueva o un enemigo lanza una habilidad, el juego se congela unos milisegundos mientras compila el sombreador por primera vez.

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
| **Caché de compilación de shaders DXVK desincronizada o dañada** | Enable Vulkan Graphics Pipeline Library (GPL) in Mesa or NVIDIA drivers |

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

Si tienes controladores gráficos modernos (NVIDIA o AMD Mesa recientes), puedes activar la característica *Graphics Pipeline Library (GPL)*, que compila los shaders de forma invisible antes de que aparezcan en pantalla.
1. Abre las propiedades del juego en Steam.
2. En la barra de **Parámetros de lanzamiento**, añade la siguiente línea mágica de variables:
```bash
dxvk.enableGraphicsPipelineLibrary = True __GL_SHADER_DISK_CACHE_SKIP_CLEANUP=1 %command%
```

### Paso 2: Asignar un espacio ilimitado para la caché en el disco SSD

Por defecto, los controladores de video limitan el tamaño de la carpeta de caché a 1GB o 2GB. Cuando se llena, el sistema borra los shaders viejos y vuelve a generar tirones. Modifica los límites de tu sistema operativo añadiendo estas líneas en tu terminal para que la GPU retenga todo el aprendizaje de texturas:
```bash
echo "export EXTRA_LDFLAGS=\"-Wl,-O1 -Wl,--as-needed\"" >> ~/.bashrc
source ~/.bashrc
```

## 🛡️ Consejos de Prevención

Prácticas de seguridad recomendadas:
- Al usar distribuciones de rendimiento como CachyOS, evita limpiar los archivos temporales del sistema de forma masiva con herramientas automáticas antes de jugar. Borrar la carpeta `.nv` o `.cache` de tu directorio de usuario destruirá semanas de compilación previa de tus juegos favoritos, obligando a tu tarjeta de video a empezar el molesto proceso de tartamudeo desde cero en la siguiente partida.

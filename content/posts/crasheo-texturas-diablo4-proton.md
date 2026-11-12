---
title: Solución al crasheo por carga de texturas en Diablo IV bajo Linux (Proton)
description: >-
  Aprende a solucionar el error Out of Memory y los cierres al cargar texturas
  en Diablo IV jugando en Linux con Steam Proton y Battle.net.
category: Gaming Tech
tags:
  - Diablo 4
  - Proton
  - Linux
  - Gaming
  - Vulkan
  - VKD3D
readTime: 8 min
date: '2026-06-25'
---
El cierre inesperado de Diablo IV en Linux (a menudo con el error `Fenris Error` o `Out of Memory - The application ran out of video memory`) ocurre debido a la alta demanda de memoria de video (VRAM) y memoria RAM física que requiere el motor de Blizzard al cargar paquetes de texturas de alta resolución mediante la capa de traducción Direct3D 12 a Vulkan (VKD3D-Proton).

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
| **Saturación y fragmentación de VRAM al cargar texturas en calidad Ultra con VKD3D** | Reducir calidad de texturas a Alto/Medio y aplicar `VKD3D_CONFIG=no_upload_hvv` |

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

El paquete de texturas Ultra de Diablo IV consume más de 16GB de VRAM en DirectX 12 nativo, lo que bajo Vulkan satura el asignador de memoria de la GPU:
1. En el menú de Diablo IV, ve a **Opciones > Gráficos**.
2. Cambia **Calidad de las texturas** de *Ultra* a **Alta** (o *Media* en GPUs con 8GB de VRAM o menos).
3. Desactiva la distorsión cromática y reduce la calidad de las sombras de contacto.

### Paso 2: Configurar parámetros de lanzamiento en Steam / Lutris
Añade variables de optimización para VKD3D y DXVK en las opciones de lanzamiento del juego:
```bash
# Parámetros recomendados para Diablo IV en Steam
VKD3D_CONFIG=no_upload_hvv PROTON_ENABLE_NVAPI=1 %command%
```
- `no_upload_hvv`: Evita que VKD3D agote el heap de memoria visible del host (Host Visible Video Memory) en GPUs modernas.

### Paso 3: Incrementar el límite de mapeo de memoria en el Kernel (max_map_count)
Diablo IV crea cientos de miles de asignaciones de memoria simultáneas que pueden superar el límite por defecto de Linux:
```bash
# Comprobar el valor actual
cat /proc/sys/vm/max_map_count

# Aumentar a 1048576 de forma temporal
sudo sysctl -w vm.max_map_count=1048576

# Hacerlo permanente en /etc/sysctl.d/99-gaming.conf
echo "vm.max_map_count = 1048576" | sudo tee /etc/sysctl.d/99-gaming.conf
sudo sysctl --system
```

### Paso 4: Utilizar la versión Proton GE (GloriousEggroll) más reciente
Proton Experimental o Proton GE contienen parches específicos para corregir fugas de memoria en VKD3D:
1. Instala **ProtonUp-Qt** y descarga la versión más reciente de **GE-Proton**.
2. En las propiedades de Diablo IV en Steam, ve a *Compatibilidad* y fuerza el uso de GE-Proton.

## 🛡️ Consejos de Prevención

- **Asegura al menos 8GB-16GB de Swap:** Los picos de carga en transiciones de mazmorras pueden provocar cierres inmediatos del proceso por el OOM Killer si no existe memoria de intercambio suficiente.
- **Mantén actualizados los drivers Mesa:** Si juegas con tarjetas AMD Radeon, utiliza Mesa 24.0+ para beneficiarte del asignador de memoria mejorado de RADV.

## ❓ Preguntas Frecuentes (FAQ)

### ¿El juego funciona fluidamente en Steam Deck?
Sí, en Steam Deck se recomienda configurar texturas en calidad Media, resolución nativa con FSR en modo Calidad y limitar la tasa de cuadros a 45 FPS para mantener temperaturas estables.

### ¿Qué significa el error Fenris en Diablo IV?
Es el gestor interno de excepciones y depuración de Blizzard. Cuando se produce un desbordamiento de búfer en la GPU o falla la reserva de memoria, Fenris genera un volcado y cierra el juego.

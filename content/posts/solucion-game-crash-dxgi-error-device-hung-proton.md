---
title: Error DXGI_ERROR_DEVICE_HUNG en juegos con Proton y Steam en Linux
description: >-
  Guía para reparar el crasheo fatal DXGI_ERROR_DEVICE_HUNG al jugar títulos
  DirectX 11 y 12 a través de Proton y VKD3D en Linux.
category: Gaming Tech
tags:
  - Proton
  - Steam
  - Linux
  - Vulkan
readTime: 7 min
date: '2026-09-27'
---
Al ejecutar juegos modernos de Steam en Linux con Proton (como Cyberpunk 2077, God of War, Apex Legends o Elden Ring), el juego se congela repentinamente arrojando una ventana de error de Unreal Engine o DirectX: `Fatal error: The GPU device has been suspended or hung: DXGI_ERROR_DEVICE_HUNG (0x887A0006)`. Esto indica que el controlador gráfico perdió comunicación con el hardware de la GPU.

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
| **TDR (Timeout Detection and Recovery) del kernel de la GPU al superar el tiempo de respuesta esperado** |

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

VKD3D traduce llamadas de DirectX 12 a Vulkan. En juegos con alta demanda de ancho de banda, puedes estabilizar la canalización agregando estas directivas en las *Propiedades* del juego en Steam -> *Parámetros de lanzamiento*:
```bash
VKD3D_CONFIG=no_upload_hvv %command%
```
Esto evita que el traductor agote la memoria de intercambio de host a dispositivo en ciertas tarjetas gráficas.

### Paso 2: Ajustar la configuración de sincronización de Proton
Si el cuelgue ocurre por desincronización de hilos en procesadores multinúcleo, cambia a Proton GE (GloriousEggroll) o activa la biblioteca de sincronización `winesync` / `fsync`:
```bash
PROTON_NO_ESYNC=1 PROTON_USE_FSYNC=1 %command%
```

### Paso 3: Controlar el consumo de VRAM y la temperatura de la GPU
El error `DEVICE_HUNG` ocurre frecuentemente cuando un juego excede el 98% de la memoria VRAM física, obligando a la GPU a volcar datos en la memoria RAM lenta del sistema.
1. Entra a las opciones gráficas del juego y baja la calidad de las texturas de *Ultra* a *Alto*.
2. Desactiva el Ray Tracing si tu tarjeta dispone de 8 GB o menos de memoria VRAM.
3. Si utilizas perfiles de overclock en Linux (con programas como GreenWithEnvy o CoreCtrl), restablece los relojes a los valores de fábrica.

## Resolución de Casos Borde (Troubleshooting)

### Caso Borde 1: Restricciones de seguridad aplicadas por SELinux o AppArmor

En distribuciones de clase empresarial como Red Hat Enterprise Linux, AlmaLinux o Rocky Linux (que utilizan **SELinux** en modo Enforcing) o en Ubuntu/Debian (que implementan **AppArmor**), las políticas de confinamiento del sistema operativo pueden bloquear el acceso a archivos, sockets UNIX o puertos de red incluso cuando los permisos tradicionales `chmod 777` y el usuario `root` están en uso.

Para verificar y solventar bloqueos por contexto de seguridad:
```bash
# Consultar si SELinux generó denegaciones recientes en el log de auditoría
sudo ausearch -m avc -ts recent 2>/dev/null

# En caso de AppArmor, revisar eventos bloqueados en el diario del kernel
sudo dmesg | grep -i apparmor | tail -n 20
```
Si se confirma una denegación de contexto en SELinux, restaura el contexto de seguridad predeterminado del archivo o directorio afectado ejecutando:
```bash
# Restaurar etiquetas de contexto de seguridad recursivamente
sudo restorecon -Rv /ruta/afectada
```

### Caso Borde 2: Persistencia tras reinicio y desincronización de procesos huérfanos

En ocasiones, tras aplicar una solución en caliente en la terminal, el problema reaparece inesperadamente en el siguiente reinicio del servidor o al finalizar la sesión SSH. Esto ocurre comúnmente cuando existen procesos huérfanos (*zombie processes*) que retienen el bloqueo de archivos o sockets en memoria sin permitir que el nuevo servicio tome control del recurso.

Para identificar y limpiar procesos bloqueados de forma segura:
```bash
# Identificar qué proceso tiene abierto el descriptor de archivo o socket
sudo lsof +D /ruta/o/archivo/afectado

# Si es necesario liberar el proceso huérfano de manera ordenada (señal SIGTERM)
sudo kill -15 PID_DEL_PROCESO
```

### Verificación de Logs en Tiempo Real y Validación en Producción

Una vez aplicadas las modificaciones correctivas, valida en consola que el sistema opere con total estabilidad y sin emitir advertencias residuales:
```bash
# Monitorear registros en vivo filtrando por palabras clave de fallo
sudo journalctl -f -n 100 | grep -Ei "(error|fail|warn|critical)"

# Verificar que el código de retorno del último comando ejecutado sea exitoso (0)
echo $?
```
Un valor de retorno `0` confirma la ejecución exitosa en el estándar POSIX, garantizando que el servicio o comando ha completado su ciclo sin excepciones pendientes.

## 🛡️ Consejos de Prevención

* Actualiza regularmente tu distribución a los controladores gráficos más recientes (controladores NVIDIA 555+ con Explicit Sync o paquetes Mesa 24+).
* Comprueba si el juego funciona mejor con una versión específica de Proton seleccionándola en la pestaña *Compatibilidad* de Steam.

## Preguntas Frecuentes

### ¿Qué significa exactamente el código 0x887A0006 en DirectX?
Es el identificador hexadecimal de DXGI_ERROR_DEVICE_HUNG. Significa que el dispositivo de hardware de la tarjeta gráfica dejó de responder a comandos y el controlador lo reinició por seguridad.

### ¿Funciona este error igual en tarjetas AMD que en NVIDIA?
En AMD suele registrarse en dmesg como "amdgpu: ring gfx timeout". En NVIDIA se manifiesta con reinicio del módulo de kernel nvidia-modeset.

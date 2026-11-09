---
title: Pantalla congelada o cuelgue en juegos DirectX 12 con NVIDIA en Linux
description: >-
  Soluciona los congelamientos y caídas a escritorio en juegos DirectX 12 que
  utilizan VKD3D-Proton con tarjetas gráficas NVIDIA GeForce en Linux.
category: Gaming Tech
tags:
  - NVIDIA
  - Gaming
  - Linux
  - Vulkan
readTime: 7 min
date: '2026-10-05'
---
Al ejecutar títulos modernos DirectX 12 (Cyberpunk 2077, Star Wars Jedi: Survivor, Forza Horizon 5) sobre Linux con tarjetas NVIDIA GeForce, es frecuente que el juego se congele por completo tras unos minutos de partida mientras el audio continúa reproduciéndose de fondo. Este bloqueo lo causa un desajuste en el gestor de memoria Vulkan de VKD3D al comunicarse con el controlador privativo de NVIDIA.

## Contexto de Arquitectura y Causa Raíz del Fallo

En la arquitectura de ejecución de videojuegos de Windows sobre sistemas operativos **Linux**, la capa de compatibilidad se fundamenta en **Wine** y **Proton**, complementados por traductores de llamadas gráficas en tiempo real como **DXVK** (que traduce Direct3D 9, 10 y 11 hacia la API moderna de **Vulkan**) y **VKD3D-Proton** (que traduce llamadas de Direct3D 12 hacia Vulkan).

El fallo de rendimiento, congelamiento (*freeze*) o cierre abrupto (*crash*) responde a cuellos de botella en la canalización de renderizado (*graphics pipeline*):
1. **Compilación asíncrona de shaders y tartamudeo (Shader Stuttering):** Los juegos diseñados para DirectX asumen que los shaders compilados en formato HLSL pueden instanciarse en la GPU de inmediato. Sin embargo, Vulkan requiere compilar los shaders hacia código binario intermedio **SPIR-V** y luego hacia el formato nativo del hardware del controlador gráfico (Mesa RADV para AMD, o el controlador privativo de NVIDIA). Si esta compilación ocurre en el mismo hilo de renderizado que dibuja los cuadros por segundo, la GPU se bloquea esperando instrucciones, provocando microparones abruptos en el frametime.
2. **Sincronización explícita y compositores Wayland:** Con la transición de X11 hacia el protocolo de servidor gráfico **Wayland**, la gestión de los buffers de intercambio (*swapchains*) dependía históricamente de la sincronización implícita del kernel. Cuando los controladores gráficos envían fotogramas desfasados antes de que la GPU complete la renderización del buffer anterior, se genera desgarro visual (*screen tearing*), fotogramas fuera de orden o bloqueos completos en compositores como KWin o Mutter.
3. **Agotamiento de VRAM y límites de memoria del subsistema DRM:** Cuando un título exige más memoria de video de la físicamente integrada en la tarjeta gráfica, el subsistema de administración de memoria de video del kernel (`amdgpu` o `nvidia-modeset`) se ve forzado a realizar swapping de texturas hacia la memoria RAM del sistema a través del bus PCIe. Esta transferencia a velocidades muy inferiores satura el ancho de banda del bus, culminando en caídas masivas de FPS o en un error fatal `VK_ERROR_DEVICE_LOST` emitido por el driver.

## Entorno de Laboratorio y Diagnóstico Previo

Antes de aplicar cualquier cambio destructivo o reiniciar servicios en un entorno de producción, es fundamental ejecutar una matriz de diagnóstico preliminar para identificar la capa exacta donde ocurre el fallo:

| Causa | Solución |
|---|---|
| **Falta de compatibilidad de sincronización explícita (Explicit Sync) en versiones antiguas del driver NVIDIA** |

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

Las versiones anteriores a la serie 555 del driver privativo de NVIDIA presentaban problemas severos de sincronización implícita en entornos Wayland y X11, provocando congelamientos de pantalla.
```bash
# Comprobar la versión instalada
nvidia-smi
```
Asegúrate de instalar los controladores NVIDIA versión **555.58**, **560** o superior desde los repositorios oficiales de tu distribución.

### Paso 2: Estabilizar las colas de comandos de VKD3D
Algunas tarjetas de las series GTX 1000, RTX 2000 y 3000 sufren bloqueos de cola al despachar llamadas gráficas y de cómputo en paralelo. Forzar una única cola resuelve el congelamiento:
```bash
# En Parámetros de lanzamiento de Steam
VKD3D_CONFIG=single_queue %command%
```

### Paso 3: Ajustar la gestión de memoria de la GPU (__GL_MaxFramesAllowed)
Limita los fotogramas prerenderizados en la cola del controlador NVIDIA para evitar desbordamientos de memoria en el traductor:
```bash
# Configurar en Steam
__GL_MaxFramesAllowed=1 VKD3D_CONFIG=single_queue %command%
```
Esto reduce la latencia de entrada y evita que el búfer de comandos de la GPU se sature provocando el cuelgue.

## Casos Borde (Troubleshooting) y Prácticas en Producción

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

* Activa el modo de rendimiento en el panel de control de NVIDIA mediante `nvidia-settings -a "[gpu:0]/GpuPowerMizerMode=1"`.
* En entornos Wayland (KDE Plasma 6 / GNOME 46), asegúrate de que los paquetes `xwayland` y los protocolos de sincronización estén al día.

## Preguntas Frecuentes

### ¿Por qué el audio sigue sonando cuando la pantalla se congela?
Porque el hilo de audio del motor del juego opera independientemente del bucle de renderizado de la GPU. Cuando la llamada a Vulkan se bloquea en el controlador, la imagen se congela pero el motor de sonido sigue procesando.

### ¿Afecta la directiva single_queue a los fotogramas por segundo (FPS)?
La pérdida de rendimiento es prácticamente nula (menos del 1-2%), pero elimina por completo los bloqueos críticos del hilo de renderizado.

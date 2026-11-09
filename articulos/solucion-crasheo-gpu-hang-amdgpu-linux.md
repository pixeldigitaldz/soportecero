---
title: >-
  Cómo solucionar el error [drm:amdgpu_job_timedout] y congelamientos de GPU en
  Linux
description: >-
  ¿Tu juego se congela en Linux y el log dmesg muestra [drm:amdgpu_job_timedout]
  ring gfx_0.0.0 timeout? Aprende a estabilizar drivers AMDGPU, Mesa y
  parámetros de kernel.
category: Gaming Tech
tags:
  - Linux Gaming
  - AMDGPU
  - Mesa
  - Vulkan
  - Steam
readTime: 9 min
date: '2026-09-24'
---
Durante sesiones intensas de juego en Linux bajo Proton, Wine o títulos nativos con **Vulkan**, muchos usuarios de tarjetas gráficas AMD Radeon (series RX 5000, 6000, 7000 o Steam Deck) experimentan congelamientos repentinos de pantalla seguidos del cierre inesperado del juego (*crash to desktop*). Al inspeccionar los registros del kernel mediante `dmesg`, el fallo queda registrado con el mensaje **`[drm:amdgpu_job_timedout] ring gfx_0.0.0 timeout`** seguido de un intento fallido de reinicio de hardware (*GPU reset failed*).

Este error ocurre cuando un trabajo gráfico encolado en los anillos de ejecución de la GPU excede el tiempo límite de respuesta del programador DRM del kernel Linux. Las causas más comunes incluyen inestabilidad en los perfiles de energía dinámica DPM de AMDGPU, desajustes de sincronización entre el compositor Wayland y los controladores Mesa RADV, o micro-caídas de voltaje durante picos de carga en trazado de rayos o shaders pesados.

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
| **Gestión agresiva de frecuencias dinámicas (DPM) provocando cuelgues del anillo gfx** |

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

Para comprobar si el bloqueo de tu sistema corresponde a un fallo del programador de AMDGPU, abre una terminal inmediatamente después del crasheo y filtra los mensajes del kernel:

```bash
# Filtrar registros de dmesg relacionados con amdgpu
sudo dmesg -T | grep -E "amdgpu_job_timedout|GPU reset|ring gfx"
```

Si el registro muestra salidas como:
```text
[drm:amdgpu_job_timedout [amdgpu]] *ERROR* ring gfx_0.0.0 timeout, signaled seq=...
[drm:amdgpu_device_gpu_recover [amdgpu]] *ERROR* GPU reset failed
```
Has confirmado que el hardware gráfico sufrió un GPU Hang y el kernel no pudo reiniciar el chip sin interrumpir la sesión gráfica.

### Paso 2: Ajustar parámetros del Kernel para estabilizar AMDGPU

En distribuciones como Arch Linux, Fedora, Ubuntu o Bazzite, los estados de suspensión dinámica agresiva (*clock gating*) pueden desestabilizar la tarjeta gráfica durante cambios bruscos de carga:

1. Abre el archivo de configuración del gestor de arranque con privilegios de administrador:
   ```bash
   sudo nano /etc/default/grub
   ```

2. Localiza la directiva `GRUB_CMDLINE_LINUX_DEFAULT` y añade al final de las comillas los siguientes parámetros:
   ```text
   amdgpu.dpm=1 amdgpu.runpm=0
   ```
   - `amdgpu.dpm=1`: Fuerza una gestión de energía dinámica controlada.
   - `amdgpu.runpm=0`: Desactiva la administración de energía en tiempo de ejecución (Run-time Power Management) que causa desincronización de voltaje en tarjetas dedicadas de escritorio.

3. Actualiza el gestor de arranque según tu distribución:
   ```bash
   # En Debian, Ubuntu y derivados:
   sudo update-grub

   # En Arch Linux, EndeavourOS y CachyOS:
   sudo grub-mkconfig -o /boot/grub/grub.cfg

   # En Fedora (sistemas UEFI):
   sudo grub2-mkconfig -o /etc/grub2-efi.cfg
   ```

### Paso 3: Configurar variables de entorno para Steam y Vulkan (Mesa RADV)

El compilador de shaders por defecto de Mesa (ACO) es extremadamente rápido, pero en ciertos juegos exigentes bajo DirectX 12 (VKD3D-Proton) puede generar primitivas gráficas complejas que disparan el tiempo de espera del shader engine.

Añade los siguientes parámetros de lanzamiento en las propiedades del juego en **Steam** (`Propiedades` -> `Parámetros de lanzamiento`):

```bash
RADV_DEBUG=noaccel,llvm %command%
```
O si buscas máxima estabilidad de renderizado en títulos DirectX 12:

```bash
VKD3D_CONFIG=no_upload_hwwrite,dxr11 %command%
```

### Paso 4: Desactivar la suspensión de enlace PCIe ASPM

Active State Power Management (ASPM) es una función de ahorro de energía del bus PCIe que reduce el voltaje del puerto cuando la tarjeta gráfica disminuye su uso. En placas base con configuraciones PCIe agresivas, el tiempo que tarda la GPU en volver al estado de pleno rendimiento puede exceder el límite del scheduler de AMDGPU:

Añade también a los parámetros del kernel en `/etc/default/grub`:
```text
pcie_aspm=off
```
Regenera la configuración de GRUB y reinicia el ordenador. Esto mantendrá el canal de comunicación del bus PCI Express despierto y receptivo al 100%.

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

Prácticas de seguridad recomendadas:
- Actualiza periódicamente los paquetes de `mesa` y `vulkan-radeon` desde los repositorios oficiales o repositorios optimizados (como Kisak PPA en Ubuntu o Mesa-git).
- Comprueba que la fuente de alimentación (PSU) suministre cables PCIe independientes (12V) para cada conector de 8 pines de la GPU, evitando cables en puente (*pigtail*).
- Si realizaste overclock o undervolt con utilidades como CoreCtrl o TuxClocker, restablece las curvas de voltaje a valores de fábrica para descartar inestabilidad eléctrica.

## Preguntas Frecuentes

### ¿Este error significa que mi tarjeta gráfica está físicamente dañada?
En la inmensa mayoría de casos (más del 95%), este problema es estrictamente de software: desincronización de controladores, límites de tiempo de espera del scheduler de Linux o parámetros de ahorro energético del PCIe.

### ¿Ocurre este problema tanto en Wayland como en X11?
Sí, aunque en entornos Wayland recientes el uso de *Explicit Sync* (sincronización explícita introducida en Linux 6.8+ y Wayland Protocols 1.34) ha reducido drásticamente los cuelgues causados por sincronización implícita en controladores Mesa.

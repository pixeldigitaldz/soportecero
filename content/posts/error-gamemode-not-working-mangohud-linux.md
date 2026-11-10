---
title: Cómo activar y solucionar fallos en GameMode y MangoHud para juegos en Linux
description: >-
  Soluciona problemas de integración donde Feral GameMode o MangoHud no se
  activan ni muestran la superposición FPS en juegos de Linux o Steam.
category: Gaming Tech
tags:
  - Linux
  - Gaming
  - Performance
readTime: 7 min
date: '2026-07-27'
---
Feral GameMode (`gamemoded`) y MangoHud son herramientas fundamentales en el ecosistema de juegos en Linux: la primera ajusta dinámicamente el gobernador de la CPU, prioridades de E/S y perfiles de energía de la GPU, mientras que la segunda renderiza una superposición (*overlay*) para monitorizar fotogramas (FPS), temperaturas y frecuencias. Sin embargo, inconsistencias en librerías de 32 bits, servicios DBus o variables de entorno pueden provocar que no se carguen en Steam o Lutris.

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
| **MangoHud no aparece al ejecutar juegos en Steam**: Sintaxis incorrecta en parámetros de lanzamiento o falta paquete de librerías multilib de 32 bits (`lib32-mangohud`) |

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

Comprueba que el demonio `gamemoded` esté instalado y corriendo correctamente en tu sesión de usuario mediante systemd:

```bash
# Comprobar el estado del servicio en tu usuario
systemctl --user status gamemoded.service

# Si está inactivo, inicialízalo y habilítalo para el inicio automático
systemctl --user enable --now gamemoded.service

# Ejecutar el test integral de autodiagnóstico de GameMode
gamemoded -t
```
*(Si el test falla en la sección de CPU governor, asegúrate de tener instalado `dbus` y el paquete `cpupower` en tu distribución).*

### Paso 2: Instalar las dependencias de 32 y 64 bits para MangoHud
Juegos antiguos o ejecutables en Proton de 32 bits requieren que MangoHud esté disponible en ambas arquitecturas (`x86` y `x86_64`):

```bash
# En Arch Linux / CachyOS / Manjaro:
sudo pacman -S mangohud lib32-mangohud gamemode lib32-gamemode

# En Ubuntu / Debian / Pop!_OS:
sudo apt install mangohud gamemode mangohud:i386
```

### Paso 3: Configurar las Opciones de Lanzamiento en Steam y Lutris
En Steam, haz clic derecho sobre el juego > *Propiedades* > *General* > *Parámetros de lanzamiento*, e ingresa la combinación de ambos comandos:

```bash
# Opción estándar recomendada para combinar GameMode y MangoHud
gamemoderun mangohud %command%

# Si deseas forzar parámetros específicos de MangoHud mediante variables de entorno
MANGOHUD=1 MANGOHUD_CONFIG=cpu_temp,gpu_temp,fps,fps_limit=144 gamemoderun %command%
```

### Paso 4: Ajustar el archivo de configuración global de MangoHud
Crea o edita el archivo de configuración en tu directorio personal para personalizar los paneles y solucionar fallos visuales en Wayland:

```bash
# Crear directorio de configuración si no existe
mkdir -p ~/.config/MangoHud/

# Crear o editar el archivo MangoHud.conf
nano ~/.config/MangoHud/MangoHud.conf
```

Añade los siguientes parámetros optimizados:
```ini
legacy_layout=false
gpu_stats
gpu_temp
cpu_stats
cpu_temp
fps
frametime=1
toggle_hud=Shift_R+F12
no_display
```
*(Nota: La opción `no_display` permite arrancar MangoHud oculto por defecto y mostrarlo únicamente cuando presiones `Shift Derecho + F12`).*

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

Prácticas de seguridad recomendadas:
- **Verifica conflictos de superposiciones**: Evita ejecutar simultáneamente overlays de Discord (Vencord), RivaTuner o VKBasalt si experimentas micro-tirones (*stuttering*) o cierres inesperados.
- **Audita permisos en plataformas Flatpak**: Si ejecutas Steam o Heroic Games Launcher desde Flatpak, debes conceder permisos a la aplicación para comunicarse con el demonio DBus de GameMode mediante Flatseal o con el comando: `flatpak override --user --talk-name=org.freedesktop.gamemode com.valvesoftware.Steam`.

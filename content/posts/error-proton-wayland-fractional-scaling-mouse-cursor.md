---
title: >-
  Cómo solucionar problemas de cursor desalineado y escalado en juegos con
  Proton en Wayland
description: >-
  Guía para reparar la desalineación del cursor del ratón, clics fuera de
  objetivo y desenfoque por escalado fraccional en juegos ejecutados con Steam
  Proton en Wayland.
category: Gaming Tech
tags:
  - Proton
  - Wayland
  - Gaming
readTime: 8 min
date: '2026-08-04'
---
Al ejecutar juegos de Windows en Linux utilizando Steam Proton bajo un servidor de pantalla Wayland con **escalado fraccional** activado (por ejemplo, 125%, 150% o 175% en monitores 1440p o 4K), es habitual experimentar desincronía del cursor del ratón. Los síntomas incluyen un cursor de ratón desalineado que hace clic varios centímetros al lado de los botones de la interfaz del juego, una imagen borrosa por reescalado de Xwayland o la imposibilidad de atrapar (*mouse confinement*) el ratón dentro de la ventana del juego.

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
| **El ratón hace clic en una posición desplazada respecto a la ubicación del puntero visible en pantalla**: Xwayland aplica un escalado por software a la ventana del juego mientras Wine lee las coordenadas del ratón sin escalar |

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

En entornos como KDE Plasma o GNOME, asegúrate de que las aplicaciones X11/Xwayland sean escaladas por la propia aplicación y no por el compositor:

En **KDE Plasma**:
1. Ve a *Preferencias del Sistema > Pantalla y Monitor > Escalado*.
2. En la opción **"Escalado para aplicaciones legacy (X11)"**, selecciona **"Aplicadas por las propias aplicaciones"** (Apply scaling themselves) en lugar de "Escaladas por el sistema".

En **GNOME / Hyprland**:
Para Hyprland, añade la regla de ventana o deshabilita la escala forzada de Xwayland en tu archivo de configuración:
```ini
# En hyprland.conf
xwayland {
    force_zero_scaling = true
}
```

### Paso 2: Habilitar el Driver Nativo de Wayland en Proton Experimental / Proton GE
A partir de Wine 9.0 y versiones recientes de Proton (Proton Experimental o GE-Proton 9+), es posible prescindir totalmente de Xwayland y ejecutar la ventana del juego usando la ventana nativa de Wayland, eliminando por completo la desalineación del ratón:

Abre las **Propiedades del juego en Steam > Parámetros de lanzamiento** e introduce las siguientes variables de entorno:

```bash
# Para versiones recientes de Proton GE o Wine 9.0+ con soporte Wayland nativo:
PROTON_ENABLE_WAYLAND=1 %command%

# Opcional: Para evitar que el juego altere la resolución del escritorio en pantallas primarias:
DISPLAY= PROTON_ENABLE_WAYLAND=1 %command%
```

### Paso 3: Configurar captura de ratón en el registro de Wine (Wineprefix)
Si un juego específico continúa perdiendo el foco o desalineando el cursor al pasar entre menús y pantalla completa, fuerza el confinamiento del puntero modificando las claves de registro de Wine dentro de la carpeta `compatdata` de Steam:

```bash
# Asumiendo AppID del juego (ejemplo: 1086940 para Baldur's Gate 3)
WINEPREFIX=~/.steam/steam/steamapps/compatdata/1086940/pfx winecfg
```
En la pestaña **Gráficos** de `winecfg`:
1. Marca **"Capturar automáticamente el ratón en ventanas a pantalla completa"**.
2. Desmarca **"Permitir al gestor de ventanas controlar las ventanas"** si el cursor no puede atrapar los bordes.

Alternativamente, puedes inyectarlo vía script en el prefijo:
```bash
WINEPREFIX=~/.steam/steam/steamapps/compatdata/<APPID>/pfx reg add "HKCU\\Software\\Wine\\DirectInput" /v "MouseWarpOverride" /d "force" /f
```

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

- **Usa resoluciones nativas dentro del juego**: Cuando uses escalado fraccional en el escritorio (ej. 150%), selecciona la resolución física nativa del monitor (ej. 3840x2160) dentro de las opciones gráficas del juego y ajusta el tamaño de la UI con tecnologías de reescalado como FSR o DLSS.
- **Utiliza Proton-GE reciente**: Mantén tus versiones de Proton-GE actualizadas mediante herramientas como `ProtonUp-Qt` para obtener los últimos parches para los protocolos `relative-pointer-v1` y `pointer-constraints-v1` de Wayland.
- **Desactiva capas de Overlays incompatibles**: Desactiva overlays de terceros que usen ganchos X11 obsoletos, ya que pueden interferir con las coordenadas del cursor proyectadas en Xwayland.

---
title: 'Error Easy Anti-Cheat: Untrusted system file en Windows y Linux Proton'
description: >-
  Cómo reparar el bloqueo Untrusted system file de Easy Anti-Cheat al jugar a
  Apex Legends, Fortnite o Elden Ring.
category: Gaming Tech
tags:
  - Gaming
  - AntiCheat
  - Steam
  - Windows
readTime: 7 min
date: '2026-10-01'
---
Al intentar iniciar juegos multijugador protegidos por Easy Anti-Cheat (EAC), el proceso de carga se detiene y muestra una ventana emergente: `Easy Anti-Cheat - Untrusted system file (C:\...\archivo.dll)`. El sistema antitrampas rechaza la firma digital de esa biblioteca específica e impide la entrada al juego por motivos de seguridad.

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
| **Librerías DLL modificadas por programas de terceros (ReShade, MSI Afterburner, grabadores de pantalla)** |

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

Observa con atención la ruta completa que aparece dentro del cuadro de error de Easy Anti-Cheat:
- Si apunta a una carpeta dentro de `C:\Windows\System32\` o `SysWOW64`, se trata de una librería del sistema dañada.
- Si apunta a la carpeta de instalación del juego o a programas de captura (OBS, RivaTuner, Overwolf, Discord), se trata de un conflicto con el overlay de ese programa.

### Paso 2: Desactivar capas superpuestas (Overlays) y programas de inyección
Cierra completamente los siguientes programas antes de abrir el juego:
1. **RivaTuner Statistics Server (RTSS):** Cambia el nivel de detección de *High* a *None* o añade una excepción para el ejecutable del juego.
2. **ReShade:** Si instalaste mods gráficos o ReShade, elimina temporalmente `dxgi.dll` de la carpeta del juego.
3. Desactiva la superposición de Discord y GeForce Experience.

### Paso 3: Reparar el servicio de Easy Anti-Cheat o el Runtime en Steam
Si el fallo persiste en Windows, reinstala el servicio:
1. Navega hasta la carpeta del juego y busca la subcarpeta `EasyAntiCheat`.
2. Haz clic derecho sobre `EasyAntiCheat_Setup.exe` y selecciona *Ejecutar como Administrador*.
3. Selecciona tu juego en el menú desplegable y haz clic en **Servicio de Reparación**.

En Linux con Steam / Proton:
Asegúrate de tener instalada en tu biblioteca de Steam la herramienta oficial **Proton EasyAntiCheat Runtime**.

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

* Mantén actualizadas las bibliotecas de Microsoft Visual C++ Redistributable (2015-2022).
* Evita instalar DLLs de sitios no oficiales en las carpetas de sistema de Windows.

## Preguntas Frecuentes

### ¿Por qué ocurre este error con dlls oficiales de Windows como crypt32.dll o ntdll.dll?
Ocurre cuando una actualización de Windows quedó a medias o la firma digital del archivo caducó en la base de datos de EAC. Se resuelve ejecutando `DISM /Online /Cleanup-Image /RestoreHealth` seguido de `sfc /scannow`.

### ¿Easy Anti-Cheat funciona con juegos de Steam en Steam Deck?
Sí, siempre que los desarrolladores hayan habilitado la compatibilidad con Linux/Proton y tengas instalado el `Proton EasyAntiCheat Runtime` desde Steam.

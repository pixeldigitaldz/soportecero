---
title: >-
  Cómo configurar la velocidad del ventilador (Active Cooler) mediante consola
  de comandos
description: >-
  Aprende a controlar los umbrales de temperatura y ajustar la velocidad del
  ventilador en Mini PCs y placas de desarrollo mediante la terminal para evitar
  sobrecalentamientos.
category: Sistemas y Servidores
tags:
  - Hardware
  - Linux
  - Raspberry Pi
readTime: 7 min
date: '2026-06-26'
---
Las placas de desarrollo y Mini PCs modernos (como la Raspberry Pi 5) ofrecen un rendimiento increíble, pero disipan mucho calor cuando ejecutas servicios pesados de Docker o servidores multimedia. El uso de un **Active Cooler (disipador activo con ventilador)** es obligatorio para evitar el *thermal throttling* (reducción automática de potencia por exceso de temperatura).

Por defecto, el sistema operativo gestiona el ventilador de forma automática, pero muchas veces los umbrales de fábrica son muy altos, permitiendo que la placa alcance los 60°C antes de encender el aire, acortando la vida útil del hardware.

## Análisis de Arquitectura y Causa Raíz

En la arquitectura del sistema operativo **Linux**, las aplicaciones de usuario operan en espacio no privilegiado (*User Space*) y dependen de llamadas al sistema (*syscalls*) para interactuar con los recursos físicos de hardware a través del **Kernel de Linux**. El subsistema del kernel arbitra el acceso a la memoria virtual, los descriptores de archivos, la pila de protocolos de red TCP/IP y los dispositivos de almacenamiento en bloque a través de la capa de abstracción **VFS (Virtual File System)**.

La anomalía técnica identificada en esta incidencia proviene de una restricción o condición de fallo en los mecanismos de control del sistema:
1. **Límites de descriptores de archivos y cuotas de inodos:** Cada archivo, socket de red o tubería (*pipe*) abierto por un proceso consume un descriptor de archivo en la tabla del kernel. Si el proceso alcanza el límite de descriptores asignado por el subsistema `ulimit` o si el sistema de archivos agota su tabla de inodos libres (incluso cuando resta espacio en gigabytes en disco), el kernel rechaza cualquier operación de escritura con el código de error `ENOSPC (No space left on device)` o `EMFILE (Too many open files)`.
2. **Jerarquía de permisos POSIX y atributos inmutables del sistema:** Las llamadas al sistema como `open()`, `unlink()` o `chmod()` evalúan los bits de permiso estándar (Lectura `r`, Escritura `w`, Ejecución `x`) junto con el UID/GID del proceso ejecutor. Si el archivo posee atributos extendidos inmutables fijados a nivel del sistema de archivos mediante `chattr +i`, el kernel bloquea cualquier mutación incluso ante el usuario privilegiado `root`, retornando el error `EPERM (Operation not permitted)`.
3. **Administración de memoria virtual y Swapping:** Cuando el sistema experimenta presión de memoria y la memoria física disponible es insuficiente para satisfacer las solicitudes del gestor de páginas, el kernel recurre a la memoria swap. Si los umbrales de agresividad (`vm.swappiness`) están desajustados o el espacio de intercambio está fragmentado, el sistema entra en un estado de congestión (*thrashing*), degradando el rendimiento general hasta que el subsistema OOM Killer termina procesos para preservar la estabilidad del kernel.

## Entorno de Laboratorio y Diagnóstico

Antes de aplicar cualquier cambio destructivo o reiniciar servicios en un entorno de producción, es fundamental ejecutar una matriz de diagnóstico preliminar para identificar la capa exacta donde ocurre el fallo:

| Causa | Solución |
|---|---|
| **Overlay de control PWM del ventilador no activado en config.txt** | Definir umbrales térmicos inferiores en `/boot/firmware/config.txt` |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Comprobar el estado del servicio en el gestor de inicialización systemd
sudo systemctl status --no-pager -l raspberrypi-firmware

# 2. Inspeccionar los registros del diario del sistema filtrando por unidad
sudo journalctl -u raspberrypi-firmware -n 50 --no-pager

# 3. Auditar el espacio y tabla de inodos en todos los sistemas de archivos montados
df -Th && df -ih
```

- El flag `--no-pager` en `systemctl` y `journalctl` evita invocar el paginador interactivo (`less`), permitiendo redirigir la salida o analizar los registros sin interrumpir flujos de automatización.
- El comando `df` con los modificadores `-T` (tipo de sistema de archivos ext4/xfs/btrfs) y `-h` (formato legible en gigabytes/megabytes), combinado con `-i` (tabla de inodos disponibles), permite descartar si el disco está lleno por bytes reales o saturado por millones de archivos pequeños huérfanos.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

Abre la terminal de tu sistema operativo basado en Linux y ejecuta el siguiente comando para conocer la temperatura exacta del procesador en tiempo real:
```bash
vcgencmd measure_temp
```

### Paso 2: Editar el archivo de configuración de arranque
En sistemas basados en Raspberry Pi OS, podemos modificar los parámetros de activación editando el archivo config.txt. Abre el editor con privilegios de administrador:
```bash
sudo nano /boot/firmware/config.txt
```
(Nota: En versiones antiguas de sistemas operativos, la ruta puede ser simplemente `/boot/config.txt`).

### Paso 3: Definir los nuevos umbrales de temperatura (Cooling Trip Points)
Desplázate hasta el final del archivo y añade las siguientes líneas para personalizar los grados exactos a los que el ventilador cambiará de velocidad (los valores corresponden a miligrados Celsius, por ejemplo 50000 equivale a 50°C):
```plaintext
# Ajuste personalizado del Active Cooler
dtparam=fan_temp0=45000
dtparam=fan_temp0_hyst=5000
dtparam=fan_temp1=52000
dtparam=fan_temp1_hyst=5000
dtparam=fan_temp2=60000
dtparam=fan_temp2_hyst=5000
```
Guarda el archivo presionando `Ctrl + O`, confirma con `Enter` y sal con `Ctrl + X`.

### Paso 4: Reiniciar el sistema
Para aplicar los cambios de hardware en las tablas de configuración internas, aplica un reinicio limpio:
```bash
sudo reboot
```

## 🛡️ Consejos de Prevención

Prácticas de seguridad recomendadas:
- Evita conexiones directas de ventiladores genéricos a los pines GPIO de 5V/GND sin control PWM, ya que si el ventilador consume demasiada corriente o intentas cablearlo de forma incorrecta, puedes provocar un cortocircuito letal que dañe la placa permanentemente (dejándola con un LED rojo fijo de muerte). Usa siempre accesorios oficiales conectados al conector dedicado de ventilador JST.

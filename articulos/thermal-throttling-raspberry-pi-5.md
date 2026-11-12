---
title: Cómo evitar el estrangulamiento térmico (thermal throttling) en Raspberry Pi 5
description: >-
  Aprende a diagnosticar caídas de rendimiento por temperatura y configura los
  umbrales de enfriamiento en tu mini PC Raspberry Pi 5.
category: Sistemas y Servidores
tags:
  - Raspberry Pi
  - Hardware
  - Linux
readTime: 7 min
date: '2026-07-20'
---
El estrangulamiento térmico o *thermal throttling* en Raspberry Pi 5 ocurre cuando el procesador sobrepasa los 80 °C en tareas exigentes. Para evitar daños por calor, el controlador del microcódigo reduce automáticamente la frecuencia del procesador de 2.4 GHz a menos de 1.5 GHz, lo que degrada drásticamente el rendimiento de tus contenedores o emuladores.

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
| **Temperatura del SoC alcanzando el límite de 80°C bajo carga constante** | Install official Raspberry Pi Active Cooler fan assembly |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Comprobar el estado del servicio en el gestor de inicialización systemd
sudo systemctl status --no-pager -l fancontrol

# 2. Inspeccionar los registros del diario del sistema filtrando por unidad
sudo journalctl -u fancontrol -n 50 --no-pager

# 3. Auditar el espacio y tabla de inodos en todos los sistemas de archivos montados
df -Th && df -ih
```

- El flag `--no-pager` en `systemctl` y `journalctl` evita invocar el paginador interactivo (`less`), permitiendo redirigir la salida o analizar los registros sin interrumpir flujos de automatización.
- El comando `df` con los modificadores `-T` (tipo de sistema de archivos ext4/xfs/btrfs) y `-h` (formato legible en gigabytes/megabytes), combinado con `-i` (tabla de inodos disponibles), permite descartar si el disco está lleno por bytes reales o saturado por millones de archivos pequeños huérfanos.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

Puedes comprobar la temperatura del procesador y verificar si el núcleo de Linux ha registrado alertas de reducción de velocidad de reloj mediante consola:
```bash
# Consultar la temperatura del CPU en grados Celsius
vcgencmd measure_temp

# Verificar si existen códigos de error por voltaje o calor (un valor distinto de 0x0 indica problemas)
vcgencmd get_throttled
```

### Paso 2: Ajustar los umbrales del ventilador oficial (Active Cooler)
Asegura que el ventilador de tu disipador oficial comience a girar al 100% antes de alcanzar la temperatura crítica de 80 °C editando los parámetros del firmware:
```bash
# Abrir el archivo de configuración del arranque
sudo nano /boot/firmware/config.txt
```
Agrega estas líneas al final del archivo para programar que el ventilador se active al máximo a partir de los 65 °C:
```plaintext
# Forzar enfriamiento agresivo
dtparam=fan_temp0=50000
dtparam=fan_temp0_hyst=5000
dtparam=fan_temp1=58000
dtparam=fan_temp1_hyst=5000
dtparam=fan_temp2=65000
dtparam=fan_temp2_hyst=5000
```

### Paso 3: Aplicar y validar la nueva tabla térmica
Guarda los cambios presionando `Ctrl + O` y reinicia tu placa de desarrollo para que el microcontrolador de energía aplique las directivas:
```bash
# Reiniciar el dispositivo
sudo reboot
```

## 🛡️ Consejos de Prevención

Prácticas de seguridad recomendadas:
- No utilices cajas o gabinetes completamente cerrados y sin rejillas de ventilación activa para alojar tu Raspberry Pi 5 en producción. La Pi 5 disipa casi el doble de calor bajo carga máxima comparada con la generación anterior, por lo que depender exclusivamente de disipación pasiva de aluminio sin flujo de aire constante saturará térmicamente el gabinete en pocos minutos, forzando al procesador a trabajar permanentemente en modo degradado.

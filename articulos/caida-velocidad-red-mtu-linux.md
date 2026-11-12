---
title: >-
  Cómo diagnosticar y solucionar problemas de velocidad de red ajustando el
  tamaño de MTU
description: >-
  Aprende a diagnosticar la fragmentación de paquetes y optimiza el tamaño de la
  Unidad de Transmisión Máxima (MTU) de tu tarjeta de red.
category: Sistemas y Servidores
tags:
  - Network
  - Linux
  - Sysadmin
readTime: 7 min
date: '2026-06-27'
---
Los problemas de velocidad de red intermitente, las descargas interrumpidas o la imposibilidad de cargar ciertos portales web seguros ocurren a menudo por una mala configuración del tamaño de la **Unidad de Transmisión Máxima (MTU)** de tu tarjeta de red. Si tu proveedor exige paquetes más pequeños que el estándar de tu sistema, los enrutadores intermedios deben fragmentar los datos, degradando el rendimiento.

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
| **MTU mal configurado causando fragmentación de paquetes** | Configurar MTU en 1500 (o 1492 para PPPoE): `ip link set dev eth0 mtu 1500` |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Comprobar el estado del servicio en el gestor de inicialización systemd
sudo systemctl status --no-pager -l NetworkManager

# 2. Inspeccionar los registros del diario del sistema filtrando por unidad
sudo journalctl -u NetworkManager -n 50 --no-pager

# 3. Auditar el espacio y tabla de inodos en todos los sistemas de archivos montados
df -Th && df -ih
```

- El flag `--no-pager` en `systemctl` y `journalctl` evita invocar el paginador interactivo (`less`), permitiendo redirigir la salida o analizar los registros sin interrumpir flujos de automatización.
- El comando `df` con los modificadores `-T` (tipo de sistema de archivos ext4/xfs/btrfs) y `-h` (formato legible en gigabytes/megabytes), combinado con `-i` (tabla de inodos disponibles), permite descartar si el disco está lleno por bytes reales o saturado por millones de archivos pequeños huérfanos.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

Vamos a buscar el tamaño máximo de paquete que tu red puede transferir sin necesidad de dividir los datos. Corre la prueba restando la cabecera IP/ICMP de 28 bytes de tu objetivo:
```bash
# Probar el tamaño de paquete en Linux (ejemplo para 1472 bytes de datos)
ping -M do -s 1472 8.8.8.8
```
*(Si la terminal te responde `Packet needs to be fragmented but DF set`, significa que el paquete es demasiado grande. Reduce el número en incrementos de 10 hasta encontrar el valor exacto que responda sin fragmentar, por ejemplo 1420 bytes, y súmale los 28 bytes de cabecera: `1420 + 28 = 1448 MTU`).*

### Paso 2: Aplicar el tamaño de MTU óptimo en tu tarjeta de red
Una vez detectado el valor correcto, configura la interfaz de red de tu sistema operativo (reemplaza `eth0` por tu tarjeta activa):
```bash
# Cambiar el MTU temporalmente en Linux
sudo ip link set dev eth0 mtu 1448

# Verificar que los parámetros de red se hayan actualizado
ip link show eth0
```

## 🛡️ Consejos de Prevención

Prácticas de seguridad recomendadas:
- No incrementes de forma arbitraria el tamaño de MTU a valores superiores a 1500 (Jumbo Frames) si no tienes la certeza de que todos los conmutadores y enrutadores de tu red local soportan esta característica por hardware. Configurar un MTU sobredimensionado provocará que las solicitudes de red se descarten por completo debido a desajustes de búfer, dejando tu máquina incomunicada de forma inmediata.

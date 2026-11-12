---
title: Guía rápida para recuperar el cargador de arranque GRUB corrupto en Linux
description: >-
  Aprende a restablecer el cargador de arranque GRUB en sistemas UEFI y BIOS
  utilizando una distribución Live USB y la herramienta chroot.
category: Sistemas y Servidores
tags:
  - Linux
  - GRUB
  - Bootloader
readTime: 7 min
date: '2026-06-27'
---
El fallo en el cargador de arranque GRUB (dejando el sistema congelado en la consola de rescate `grub>`) suele ocurrir tras una actualización de kernel fallida, fallos en la tabla de particiones EFI o tras configurar arranques duales con Windows. Para repararlo, debemos montar e ingresar al sistema de archivos dañado desde un entorno temporal.

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
| **Cargador de arranque GRUB eliminado o corrupto tras actualización de Windows** | Restore UEFI boot order using `efibootmgr -o <boot_order>` |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Comprobar el estado del servicio en el gestor de inicialización systemd
sudo systemctl status --no-pager -l grub-boot

# 2. Inspeccionar los registros del diario del sistema filtrando por unidad
sudo journalctl -u grub-boot -n 50 --no-pager

# 3. Auditar el espacio y tabla de inodos en todos los sistemas de archivos montados
df -Th && df -ih
```

- El flag `--no-pager` en `systemctl` y `journalctl` evita invocar el paginador interactivo (`less`), permitiendo redirigir la salida o analizar los registros sin interrumpir flujos de automatización.
- El comando `df` con los modificadores `-T` (tipo de sistema de archivos ext4/xfs/btrfs) y `-h` (formato legible en gigabytes/megabytes), combinado con `-i` (tabla de inodos disponibles), permite descartar si el disco está lleno por bytes reales o saturado por millones de archivos pequeños huérfanos.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

Introduce un Live USB compatible con tu distribución actual, arráncalo en modo UEFI/BIOS y detecta el identificador de tu disco duro:
```bash
sudo fdisk -l
```
*(Identifica tu partición raíz de Linux, por ejemplo `/dev/sda2`, y la partición EFI en formato FAT32, por ejemplo `/dev/sda1`).*

### Paso 2: Montar el sistema dañado y preparar el chroot
Monta la estructura de directorios del sistema de archivos dañado en la sesión temporal:
```bash
# Montar partición raíz
sudo mount /dev/sda2 /mnt

# Montar directorios de comunicación del kernel
for i in /dev /dev/pts /proc /sys /run; do sudo mount -B $i /mnt$i; done

# Montar partición EFI si usas UEFI
sudo mount /dev/sda1 /mnt/boot/efi
```

### Paso 3: Entrar al sistema (chroot) y reinstalar GRUB
Ingresa como superusuario al entorno de tu sistema de archivos original y reinstala el cargador de arranque:
```bash
# Cambiar la raíz del shell
sudo chroot /mnt /bin/bash

# Reinstalar GRUB apuntando al disco (reemplazar /dev/sda por el disco físico general)
grub-install /dev/sda

# Regenerar el archivo de configuración del menú de arranque
update-grub

# Salir y desmontar
exit
sudo reboot
```

## 🛡️ Consejos de Prevención

Prácticas de seguridad recomendadas:
- Antes de modificar el orden de particiones o instalar actualizaciones mayores del kernel, genera respaldos de la configuración de GRUB (`/etc/default/grub`). Nunca manipules o fuerces la instalación de GRUB en la partición EFI (`grub-install /dev/sda1`) en lugar del dispositivo físico del disco (`/dev/sda`), ya que esto puede corromper las tablas de montaje EFI de tu placa base de forma permanente, impidiendo que reconozca cualquier medio de almacenamiento durante la autocomprobación de encendido (POST).

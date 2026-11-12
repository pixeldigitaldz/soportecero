---
title: Error No Space Left on Device con Espacio Libre (Inodos Agotados en Linux)
description: >-
  ¿Tu servidor Linux muestra No Space Left on Device pero df -h indica espacio
  disponible? Aprende a detectar y liberar inodos agotados paso a paso.
category: Sistemas y Servidores
tags:
  - Linux
  - Sysadmin
  - Almacenamiento
  - Bash
readTime: 7 min
date: '2026-09-11'
---
El error `No space left on device` en Linux no solo ocurre cuando los gigabytes del disco duro se llenan. Cada archivo, enlace simbólico y directorio requiere una estructura de metadatos llamada **inodo**. Si tu sistema crea millones de archivos diminutos (como sesiones de PHP, logs o ficheros de caché), la tabla de inodos se agota al 100% aunque `df -h` muestre gigabytes de espacio disponible.

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
| **Millones de archivos temporales pequeños o sesiones PHP/Docker sin limpiar** | Find directories with the highest inode count via find and delete them |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Comprobar el estado del servicio en el gestor de inicialización systemd
sudo systemctl status --no-pager -l systemd-journald

# 2. Inspeccionar los registros del diario del sistema filtrando por unidad
sudo journalctl -u systemd-journald -n 50 --no-pager

# 3. Auditar el espacio y tabla de inodos en todos los sistemas de archivos montados
df -Th && df -ih
```

- El flag `--no-pager` en `systemctl` y `journalctl` evita invocar el paginador interactivo (`less`), permitiendo redirigir la salida o analizar los registros sin interrumpir flujos de automatización.
- El comando `df` con los modificadores `-T` (tipo de sistema de archivos ext4/xfs/btrfs) y `-h` (formato legible en gigabytes/megabytes), combinado con `-i` (tabla de inodos disponibles), permite descartar si el disco está lleno por bytes reales o saturado por millones de archivos pequeños huérfanos.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

Ejecuta el comando `df -ih` para inspeccionar el porcentaje de uso de inodos (campo *IUse%*) en lugar del espacio de almacenamiento en bytes:
```bash
df -ih
```
Si la partición raíz (`/`) o `/var` muestra un 100% en *IUse%*, has confirmado que el problema es el agotamiento de inodos.

### Paso 2: Localizar el directorio que satura los inodos
Para encontrar qué subdirectorio dentro de `/var` contiene una cantidad astronómica de ficheros diminutos, ejecuta este análisis rápido:
```bash
sudo du --inodes -d 2 /var | sort -rn | head -n 15
```
Los sospechosos habituales suelen ser:
- `/var/lib/php/sessions/` (sesiones PHP caducadas no recolectadas por garbage collection).
- `/var/spool/postfix/maildrop/` (correos de cron rebotados).
- `/var/log/` (registros rotados no comprimidos ni eliminados).

### Paso 3: Eliminar los ficheros masivos sin bloquear la terminal
No utilices `rm -rf *` en una carpeta con millones de archivos porque la shell arrojará el error `Argument list too long`. Utiliza `find` con la directiva `-delete`:
```bash
# Limpiar sesiones huérfanas de PHP
sudo find /var/lib/php/sessions/ -type f -cmin +1440 -delete

# Limpiar archivos de log antiguos
sudo find /var/log/ -type f -name "*.gz" -mtime +30 -delete
```
Comprueba inmediatamente después con `df -ih` cómo el porcentaje de uso de inodos desciende.

## 🛡️ Consejos de Prevención

* Configura tareas periódicas de rotación de logs con `logrotate` estableciendo un límite estricto en la directiva `rotate` y activando `compress`.
* Automatiza la limpieza de sesiones huérfanas y ficheros temporales con un cronjob en `/etc/cron.daily/`.

## Preguntas Frecuentes

### ¿Se puede ampliar el número de inodos de una partición ext4 existente?
En sistemas de archivos ext4, el número total de inodos se define al formatear la partición (con mkfs.ext4 -N). Para aumentarlo es necesario reformatear o migrar a sistemas con inodos dinámicos como XFS o Btrfs.

### ¿Por qué lsof muestra archivos eliminados ocupando inodos?
Si un proceso mantiene abierto un archivo que fue borrado del disco, el sistema operativo no libera el inodo ni los bloques hasta que el proceso finaliza. Identifícalos con `lsof +L1` y reinicia el servicio con systemctl.

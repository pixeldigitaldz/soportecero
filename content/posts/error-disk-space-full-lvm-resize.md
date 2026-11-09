---
title: >-
  Cómo redimensionar un volumen LVM en Linux cuando el disco se queda sin
  espacio
description: >-
  Aprende a extender de forma segura un volumen lógico LVM y su sistema de
  archivos EXT4 o XFS sin perder datos y sin apagar el servidor.
category: Sistemas y Servidores
tags:
  - Linux
  - Sysadmin
  - LVM
readTime: 7 min
date: '2026-07-06'
---
El error de disco lleno (`No space left on device`) en un servidor Linux que utiliza LVM (Logical Volume Manager) puede paralizar bases de datos y servicios. La ventaja de LVM es que permite expandir el almacenamiento en caliente, sumando espacio físico al volumen lógico y extendiendo el sistema de archivos sin necesidad de reiniciar.

## Contexto de Arquitectura y Causa Raíz del Fallo

En la arquitectura del sistema operativo **Linux**, las aplicaciones de usuario operan en espacio no privilegiado (*User Space*) y dependen de llamadas al sistema (*syscalls*) para interactuar con los recursos físicos de hardware a través del **Kernel de Linux**. El subsistema del kernel arbitra el acceso a la memoria virtual, los descriptores de archivos, la pila de protocolos de red TCP/IP y los dispositivos de almacenamiento en bloque a través de la capa de abstracción **VFS (Virtual File System)**.

La anomalía técnica identificada en esta incidencia proviene de una restricción o condición de fallo en los mecanismos de control del sistema:
1. **Límites de descriptores de archivos y cuotas de inodos:** Cada archivo, socket de red o tubería (*pipe*) abierto por un proceso consume un descriptor de archivo en la tabla del kernel. Si el proceso alcanza el límite de descriptores asignado por el subsistema `ulimit` o si el sistema de archivos agota su tabla de inodos libres (incluso cuando resta espacio en gigabytes en disco), el kernel rechaza cualquier operación de escritura con el código de error `ENOSPC (No space left on device)` o `EMFILE (Too many open files)`.
2. **Jerarquía de permisos POSIX y atributos inmutables del sistema:** Las llamadas al sistema como `open()`, `unlink()` o `chmod()` evalúan los bits de permiso estándar (Lectura `r`, Escritura `w`, Ejecución `x`) junto con el UID/GID del proceso ejecutor. Si el archivo posee atributos extendidos inmutables fijados a nivel del sistema de archivos mediante `chattr +i`, el kernel bloquea cualquier mutación incluso ante el usuario privilegiado `root`, retornando el error `EPERM (Operation not permitted)`.
3. **Administración de memoria virtual y Swapping:** Cuando el sistema experimenta presión de memoria y la memoria física disponible es insuficiente para satisfacer las solicitudes del gestor de páginas, el kernel recurre a la memoria swap. Si los umbrales de agresividad (`vm.swappiness`) están desajustados o el espacio de intercambio está fragmentado, el sistema entra en un estado de congestión (*thrashing*), degradando el rendimiento general hasta que el subsistema OOM Killer termina procesos para preservar la estabilidad del kernel.

## Entorno de Laboratorio y Diagnóstico Previo

Antes de aplicar cualquier cambio destructivo o reiniciar servicios en un entorno de producción, es fundamental ejecutar una matriz de diagnóstico preliminar para identificar la capa exacta donde ocurre el fallo:

| Causa | Solución |
|---|---|
| **Volumen Lógico (LV) sin espacio libre pero con espacio disponible en Volume Group (VG)** |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Comprobar el estado del servicio en el gestor de inicialización systemd
sudo systemctl status --no-pager -l NOMBRE_SERVICIO

# 2. Inspeccionar los registros del diario del sistema filtrando por unidad
sudo journalctl -u NOMBRE_SERVICIO -n 50 --no-pager

# 3. Auditar el espacio y tabla de inodos en todos los sistemas de archivos montados
df -Th && df -ih
```

- El flag `--no-pager` en `systemctl` y `journalctl` evita invocar el paginador interactivo (`less`), permitiendo redirigir la salida o analizar los registros sin interrumpir flujos de automatización.
- El comando `df` con los modificadores `-T` (tipo de sistema de archivos ext4/xfs/btrfs) y `-h` (formato legible en gigabytes/megabytes), combinado con `-i` (tabla de inodos disponibles), permite descartar si el disco está lleno por bytes reales o saturado por millones de archivos pequeños huérfanos.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

Primero, verifica qué partición está saturada y localiza la ruta de tu volumen lógico:
```bash
# Ver el uso de disco de todas las particiones
df -h

# Listar los volúmenes lógicos activos
sudo lvdisplay
```
*(Anota la ruta del volumen que quieres extender, por ejemplo `/dev/mapper/vg_system-lv_root`).*

### Paso 2: Escanear el nuevo almacenamiento físico
Si has ampliado el disco virtual en tu hipervisor (Proxmox, VMware, KVM), debes indicarle al núcleo de Linux que detecte el cambio de tamaño del disco físico (por ejemplo, `/dev/sda`):
```bash
# Forzar un re-escaneo del bus SCSI para detectar la nueva capacidad
echo 1 | sudo tee /sys/class/block/sda/device/rescan

# Notificar a LVM que el volumen físico ha cambiado de tamaño
sudo pvresize /dev/sda
```

### Paso 3: Extender el volumen lógico y el sistema de archivos
Una vez que el volumen físico reconoce el nuevo espacio, procede a ampliar el volumen lógico y a redimensionar su estructura interna en un solo paso:
```bash
# Para sistemas con formato EXT4 (extiende volumen lógico y sistema de archivos simultáneamente)
sudo lvextend -r -l +100%FREE /dev/mapper/vg_system-lv_root

# Si el sistema de archivos usa XFS, ejecuta la extensión de forma explícita
sudo lvextend -l +100%FREE /dev/mapper/vg_system-lv_root
sudo xfs_growfs /
```

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
- Nunca reduzcas el tamaño de un volumen lógico LVM (`lvreduce`) en caliente o sin haber realizado un respaldo completo previo de tu base de datos. Mientras que la extensión de almacenamiento es una tarea segura que se ejecuta en milisegundos, la reducción de volumen es altamente destructiva y puede corromper los descriptores de archivos de forma permanente si el tamaño lógico asignado queda por debajo del volumen real de tus datos.

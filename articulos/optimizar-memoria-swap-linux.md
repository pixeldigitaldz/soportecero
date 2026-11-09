---
title: 'Memoria virtual en Linux: Cómo configurar y optimizar el uso de Swap'
description: >-
  Aprende a crear un archivo Swapfile, configurar persistencia en fstab y
  ajustar swappiness y vfs_cache_pressure en Linux.
category: Sistemas y Servidores
tags:
  - Linux
  - SysAdmin
  - Swap
  - Rendimiento
  - Ubuntu
  - Debian
readTime: 8 min
date: '2026-06-27'
---
En sistemas operativos Linux, la memoria Swap (espacio de intercambio) permite al kernel descargar páginas de memoria RAM inactivas hacia el disco de almacenamiento, liberando memoria física de alta velocidad para la caché del sistema de archivos y aplicaciones activas. Un sistema sin Swap o con un valor de `swappiness` inadecuado sufrirá congelamientos o cierres forzados por el OOM Killer.

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
| **Servidor o PC sin memoria Swap configurada sufriendo cierres por OOM Killer** |

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

Si tu servidor carece de partición Swap, crea un archivo de intercambio en la raíz del sistema:
```bash
# 1. Comprobar si ya existe swap activa
sudo swapon --show
free -h

# 2. Crear un archivo preasignado de 4GB (o 8GB según tu RAM)
sudo fallocate -l 4G /swapfile

# Si fallocate no es compatible con tu sistema de archivos (ej. Btrfs o XFS antiguo):
# sudo dd if=/dev/zero of=/swapfile bs=1M count=4096 status=progress

# 3. Asignar permisos estrictos de solo lectura/escritura para root
sudo chmod 600 /swapfile

# 4. Formatear el archivo como área de intercambio
sudo mkswap /swapfile

# 5. Activar el Swapfile en el sistema
sudo swapon /swapfile
```

### Paso 2: Configurar la persistencia del montaje en /etc/fstab
Asegura que el archivo Swap se monte automáticamente tras cada reinicio del sistema:
```bash
# Hacer una copia de seguridad de fstab
sudo cp /etc/fstab /etc/fstab.bak

# Añadir la entrada persistente
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Paso 3: Optimizar los parámetros del kernel (swappiness y vfs_cache_pressure)
Por defecto, muchas distribuciones tienen `vm.swappiness=60`, lo que hace que el kernel utilice el disco antes de lo necesario. Para servidores y equipos de escritorio con SSD:
```bash
# Comprobar el valor actual
cat /proc/sys/vm/swappiness

# Establecer temporalmente swappiness a 10 (solo usa swap bajo presión real)
sudo sysctl vm.swappiness=10
sudo sysctl vm.vfs_cache_pressure=50

# Hacer la configuración permanente en /etc/sysctl.d/99-swap.conf
echo -e "vm.swappiness=10\nvm.vfs_cache_pressure=50" | sudo tee /etc/sysctl.d/99-swap.conf
sudo sysctl --system
```

### Paso 4: Verificar el estado de la memoria
Comprueba con `free -h` que el nuevo espacio Swap aparece activo y disponible.

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

- **Cuidado en sistemas de archivos Btrfs:** En Btrfs, los archivos swap requieren atributos especiales (`chattr +C /swapfile`) para desactivar el Copy-on-Write (CoW) antes de asignar espacio.
- **Utiliza ZRAM en equipos con poca memoria:** Para dispositivos con 2GB a 4GB de RAM (como Raspberry Pi), considera `zram-tools` para comprimir memoria en RAM en lugar de escribir en discos lentos.

## ❓ Preguntas Frecuentes (FAQ)

### ¿Cuánta memoria Swap debo asignar?
Como regla general: para sistemas con menos de 4GB de RAM, asigna el doble de RAM en Swap. Para sistemas con 8GB a 16GB, asigna entre 4GB y 8GB de Swap. Para más de 32GB de RAM, 4GB a 8GB suelen ser suficientes para amortiguar picos.

### ¿El archivo Swap desgasta los discos SSD?
Con un `swappiness` bajo (10 a 20), la escritura en Swap es mínima y no afectará la vida útil de los SSD modernos con nivelación de desgaste (wear leveling).

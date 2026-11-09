---
title: >-
  Cómo resolver: Error 2002 (HY000): Can't connect to local MySQL server through
  socket
description: >-
  Aprende a solucionar el error 2002 Can't connect to MySQL server through
  socket '/var/run/mysqld/mysqld.sock' en Ubuntu, Debian y CentOS.
category: Web y Código
tags:
  - MySQL
  - MariaDB
  - Linux
  - SysAdmin
  - Bases de Datos
  - Ubuntu
readTime: 7 min
date: '2026-06-25'
---
El error `ERROR 2002 (HY000): Can't connect to local MySQL server through socket '/var/run/mysqld/mysqld.sock' (2)` ocurre cuando el cliente de línea de comandos de MySQL o una aplicación web local intenta comunicarse con el motor de base de datos a través del archivo de socket IPC de UNIX y este no existe en la ruta esperada o el daemon `mysqld` se ha detenido abruptamente.

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
| **El servidor MySQL / MariaDB está detenido o no pudo crear el socket UNIX por falta de espacio en disco** |

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

Verifica si el proceso de base de datos está detenido y si la partición raíz tiene espacio libre para escribir archivos temporales:
```bash
# 1. Comprobar espacio disponible en disco
df -h

# 2. Comprobar el estado de MySQL / MariaDB
sudo systemctl status mysql # o mariadb

# 3. Iniciar el servicio si está inactivo
sudo systemctl start mysql
```

### Paso 2: Crear el directorio del socket y asignar permisos correctos
Si el directorio `/var/run/mysqld` fue eliminado tras un reinicio del sistema (común en sistemas con `tmpfs`):
```bash
# Crear la carpeta del socket
sudo mkdir -p /var/run/mysqld

# Asignar la propiedad al usuario mysql
sudo chown -R mysql:mysql /var/run/mysqld
sudo chmod -R 755 /var/run/mysqld

# Reiniciar el servicio
sudo systemctl restart mysql
```

### Paso 3: Sincronizar la ruta del socket en my.cnf
Asegúrate de que la sección cliente y la sección servidor apunten exactamente a la misma ruta de socket:
```ini
# /etc/mysql/my.cnf o /etc/mysql/mysql.conf.d/mysqld.cnf
[mysqld]
socket = /var/run/mysqld/mysqld.sock

[client]
socket = /var/run/mysqld/mysqld.sock
```

### Paso 4: Crear un enlace simbólico de compatibilidad si es necesario
Si tu aplicación busca el socket en `/tmp/mysql.sock` mientras MySQL lo crea en `/var/run/mysqld/mysqld.sock`:
```bash
sudo ln -s /var/run/mysqld/mysqld.sock /tmp/mysql.sock
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

- **Monitorea los logs de error de MySQL:** Revisa periódicamente `/var/log/mysql/error.log` para detectar tablas InnoDB corruptas antes de que provoquen cierres del servidor.
- **Configura límites de memoria en servidores pequeños:** En VPS con 1GB de RAM, ajusta `innodb_buffer_pool_size` a 256M para evitar que el proceso sea terminado por el OOM Killer.

## ❓ Preguntas Frecuentes (FAQ)

### ¿Por qué puedo conectar con 127.0.0.1 pero fallo con localhost?
Porque en sistemas UNIX, conectar a `localhost` fuerza la comunicación por socket de archivos (`mysqld.sock`), mientras que conectar a `127.0.0.1` utiliza la pila de red TCP/IP (puerto 3306).

### ¿Qué significa el código de error (2) al final del mensaje?
El número (2) es el código de error estándar del kernel Linux `ENOENT` (No such file or directory), indicando que el archivo de socket físico no existe en disco.

---
title: Cómo reparar una base de datos SQLite corrupta en Sonarr o Radarr
description: >-
  Aprende a recuperar tus series y configuraciones reparando el error 'database
  disk image is malformed' de SQLite mediante herramientas de consola en Linux.
category: Sistemas y Servidores
tags:
  - Sonarr
  - Radarr
  - Database
  - SQLite
readTime: 7 min
date: '2026-06-27'
---
El error de base de datos corrupta en Sonarr o Radarr (identificado en los logs con el mensaje `database disk image is malformed`) ocurre cuando el archivo interno SQLite (`sonarr.db` o `radarr.db`) se corrompe por escrituras interrumpidas, cortes repentinos de energía en tu servidor o problemas de sincronización de bloqueos de archivos en sistemas de almacenamiento en red.

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
| **Base de datos SQLite de Sonarr/Radarr corrupta por apagado repentino del contenedor** | Rebuild database using `sqlite3 .recover` pipeline into a clean database |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Comprobar el estado del servicio en el gestor de inicialización systemd
sudo systemctl status --no-pager -l sonarr

# 2. Inspeccionar los registros del diario del sistema filtrando por unidad
sudo journalctl -u sonarr -n 50 --no-pager

# 3. Auditar el espacio y tabla de inodos en todos los sistemas de archivos montados
df -Th && df -ih
```

- El flag `--no-pager` en `systemctl` y `journalctl` evita invocar el paginador interactivo (`less`), permitiendo redirigir la salida o analizar los registros sin interrumpir flujos de automatización.
- El comando `df` con los modificadores `-T` (tipo de sistema de archivos ext4/xfs/btrfs) y `-h` (formato legible en gigabytes/megabytes), combinado con `-i` (tabla de inodos disponibles), permite descartar si el disco está lleno por bytes reales o saturado por millones de archivos pequeños huérfanos.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

Antes de manipular la base de datos, debes asegurarte de que no haya ningún proceso escribiendo en ella. Detén el contenedor de Docker correspondiente:
```bash
docker stop sonarr
```

### Paso 2: Ejecutar los comandos de recuperación de SQLite
Accede al directorio donde se guardan las configuraciones del contenedor (típicamente `/docker/sonarr/` o `/home/usuario/appdata/sonarr/`) y ejecuta las herramientas de rescate de SQLite en tu terminal:
```bash
# Exportar los datos sanos del archivo corrupto a una plantilla de recuperación
sqlite3 sonarr.db ".recover" | sqlite3 clean.db

# Respaldar la base de datos corrupta original
mv sonarr.db sonarr.db.bak

# Reemplazar la base de datos por la versión limpia recuperada
mv clean.db sonarr.db

# Verificar que los permisos del archivo sean correctos (ejemplo para Docker)
chmod 664 sonarr.db
```

### Paso 3: Reiniciar el servicio
Vuelve a iniciar el contenedor o servicio. Sonarr leerá el archivo restaurado sin problemas:
```bash
docker start sonarr
```

## 🛡️ Consejos de Prevención

Prácticas de seguridad recomendadas:
- Jamás montes las bases de datos de tus contenedores multimedia (`sonarr.db`, `radarr.db` o `plex.db`) sobre rutas de red compartidas mediante protocolos como NFS o SMB/CIFS. SQLite no está diseñado para coordinar accesos simultáneos con latencia de red. La falta de consistencia en el bloqueo de archivos a través de la red corromperá el índice de indexación de inmediato ante la mínima fluctuación de conexión, destruyendo tus configuraciones de forma irreversible.

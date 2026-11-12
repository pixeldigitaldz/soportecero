---
title: >-
  Cómo solucionar el error FATAL: password authentication failed for user en
  PostgreSQL
description: >-
  Aprende a resolver la falla de autenticación por contraseña en PostgreSQL
  actualizando las contraseñas de usuario y ajustando el archivo pg_hba.conf.
category: Sistemas y Servidores
tags:
  - PostgreSQL
  - Databases
  - Sysadmin
readTime: 8 min
date: '2026-08-01'
---
El error **FATAL: password authentication failed for user** ocurre en PostgreSQL cuando el servidor de base de datos rechaza la conexión de un cliente debido a una contraseña incorrecta, la falta de un método de autenticación válido en `pg_hba.conf` o una discrepancia entre el usuario del sistema operativo y el rol de PostgreSQL.

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
| **`psql: error: FATAL: password authentication failed for user "postgres"`**: Contraseña incorrecta, usuario no existente o método de autenticación (scram-sha-256 / md5 / peer) desconfigurado en `pg_hba.conf` | Connect via local UNIX socket as system user `postgres`, reset password with `ALTER USER`, and update `pg_hba.conf` |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Comprobar el estado del servicio en el gestor de inicialización systemd
sudo systemctl status --no-pager -l postgresql

# 2. Inspeccionar los registros del diario del sistema filtrando por unidad
sudo journalctl -u postgresql -n 50 --no-pager

# 3. Auditar el espacio y tabla de inodos en todos los sistemas de archivos montados
df -Th && df -ih
```

- El flag `--no-pager` en `systemctl` y `journalctl` evita invocar el paginador interactivo (`less`), permitiendo redirigir la salida o analizar los registros sin interrumpir flujos de automatización.
- El comando `df` con los modificadores `-T` (tipo de sistema de archivos ext4/xfs/btrfs) y `-h` (formato legible en gigabytes/megabytes), combinado con `-i` (tabla de inodos disponibles), permite descartar si el disco está lleno por bytes reales o saturado por millones de archivos pequeños huérfanos.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

En entornos Linux, el usuario superadministrador predeterminado de PostgreSQL (`postgres`) utiliza autenticación `peer` por defecto a través de sockets de UNIX locales. Accede directamente cambiando al usuario del sistema:

```bash
# Cambiar al usuario de sistema postgres e ingresar a psql
sudo -u postgres psql
```

Si el comando anterior funciona y te otorga acceso al prompt `postgres=#`, no hay ningún problema grave en el motor; el fallo se limita a la autenticación por contraseña vía TCP/IP.

### Paso 2: Restablecer la contraseña del rol de PostgreSQL

Desde la consola interactiva `psql`, asigna una nueva contraseña segura para el rol afectado (por ejemplo, `postgres` o tu usuario de aplicación):

```sql
-- Cambiar la contraseña del usuario postgres
ALTER USER postgres WITH PASSWORD 'TuNuevaContraseniaSegura123!';
```

Sal de la consola con `\q`.

### Paso 3: Configurar el archivo de autenticación pg_hba.conf

Abre el archivo de configuración de autenticación de clientes de PostgreSQL (`pg_hba.conf`). Puedes encontrar su ubicación exacta ejecutando `SHOW hba_file;` dentro de `psql` o buscando en `/etc/postgresql/`:

```bash
# Ejemplo para PostgreSQL 15/16 en Ubuntu/Debian
sudo nano /etc/postgresql/16/main/pg_hba.conf
```

Inspecciona las líneas de control de acceso para conexiones locales y TCP/IP (`127.0.0.1/32` o `::1/128`). Asegúrate de que utilicen `scram-sha-256` o `md5` en lugar de métodos restrictivos:

```config
# TYPE  DATABASE        USER            ADDRESS                 METHOD
# Conexiones locales por socket de UNIX
local   all             postgres                                peer
local   all             all                                     md5

# Conexiones IPv4 en localhost (TCP/IP)
host    all             all             127.0.0.1/32            scram-sha-256

# Conexiones IPv6 en localhost
host    all             all             ::1/128                 scram-sha-256
```

### Paso 4: Recargar la configuración de PostgreSQL

Aplica los cambios en `pg_hba.conf` recargando el servicio sin interrumpir las conexiones activas:

```bash
# Recargar la configuración en el servidor Linux
sudo systemctl reload postgresql
```

Prueba la conexión TCP pasando el parámetro `-h localhost` y `-U postgres`:

```bash
psql -h localhost -U postgres -W
```

## 🛡️ Consejos de Prevención

- **Utilizar `scram-sha-256`**: Evita usar el método `md5` en versiones modernas de PostgreSQL (13+), ya que `scram-sha-256` ofrece mayor protección frente a ataques de fuerza bruta y sniffing de contraseñas.
- **Usar variables de entorno o `.pgpass`**: Para scripts automatizados, almacena las credenciales en un archivo local `~/.pgpass` con permisos `0600` en lugar de exponer contraseñas en texto plano dentro de la línea de comandos.
- **Verificar el archivo `postgresql.conf`**: Si intentas conectarte de forma remota, asegúrate de que la directiva `listen_addresses = '*'` esté configurada además de permitir la subred en `pg_hba.conf`.

---
title: >-
  Cómo solucionar el error OOM command not allowed cuando Redis alcanza la
  memoria máxima
description: >-
  Guía técnica para solucionar el error OOM (Out Of Memory) en Redis
  configurando políticas de desalojo (maxmemory-policy) y optimizando el uso de
  RAM.
category: Sistemas y Servidores
tags:
  - Redis
  - Databases
  - Sysadmin
readTime: 8 min
date: '2026-07-27'
---
El error `OOM command not allowed when used memory > 'maxmemory'` ocurre en instancias de Redis cuando el uso de memoria RAM alcanza el límite estipulado en el parámetro `maxmemory` y la política de desalojo (*eviction policy*) por defecto está configurada como `noeviction`. Bajo estas condiciones, Redis rechaza cualquier comando que intente agregar o modificar datos (`SET`, `HSET`, `LPUSH`), respondiendo con una excepción de falta de memoria (*Out of Memory*).

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
| **Comandos de escritura fallan con `OOM command not allowed`**: La memoria alcanzó el límite `maxmemory` bajo la política por defecto `noeviction` | Configure an automatic eviction policy (`allkeys-lru` / `volatile-lru`) or increase `maxmemory` |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Comprobar el estado del servicio en el gestor de inicialización systemd
sudo systemctl status --no-pager -l redis-server

# 2. Inspeccionar los registros del diario del sistema filtrando por unidad
sudo journalctl -u redis-server -n 50 --no-pager

# 3. Auditar el espacio y tabla de inodos en todos los sistemas de archivos montados
df -Th && df -ih
```

- El flag `--no-pager` en `systemctl` y `journalctl` evita invocar el paginador interactivo (`less`), permitiendo redirigir la salida o analizar los registros sin interrumpir flujos de automatización.
- El comando `df` con los modificadores `-T` (tipo de sistema de archivos ext4/xfs/btrfs) y `-h` (formato legible en gigabytes/megabytes), combinado con `-i` (tabla de inodos disponibles), permite descartar si el disco está lleno por bytes reales o saturado por millones de archivos pequeños huérfanos.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

Conéctate a tu instancia de Redis y ejecuta el comando de información de memoria para auditar la memoria consumida y la política actual:

```bash
# Conectar mediante redis-cli
redis-cli -h 127.0.0.1 -p 6379

# Consultar métricas de memoria
127.0.0.1:6379> INFO memory

# Salida relevante a verificar:
# used_memory_human:1.95G
# maxmemory_human:2.00G
# maxmemory_policy:noeviction
```

### Paso 2: Cambiar la política de desalojo (`maxmemory-policy`) en caliente
Para restaurar el servicio inmediatamente sin reiniciar el servidor Redis, aplica una política de desalojo (*eviction policy*) en tiempo de ejecución:

```bash
# Configurar la política para desahuciar las claves menos utilizadas (LRU)
127.0.0.1:6379> CONFIG SET maxmemory-policy allkeys-lru

# Opcional: Aumentar el límite de memoria asignada a la instancia si dispones de RAM libre
127.0.0.1:6379> CONFIG SET maxmemory 3gb
```

Las políticas principales de desalojo disponibles son:
- **`allkeys-lru`**: Elimina las claves menos recientemente usadas (*Least Recently Used*) entre todos los registros. Ideal para caché web.
- **`volatile-lru`**: Elimina solo las claves que tienen un tiempo de expiración (TTL) configurado.
- **`allkeys-lfu`**: Elimina las claves usadas con menor frecuencia (*Least Frequently Used*).
- **`noeviction`**: Retorna error en comandos de escritura (comportamiento predeterminado).

### Paso 3: Persistir los cambios en la configuración (`redis.conf`)
Para evitar que los ajustes se pierdan al reiniciar la instancia o el contenedor Docker, actualiza el archivo de configuración principal de Redis:

```ini
# En /etc/redis/redis.conf o redis.conf del contenedor:

# Límite máximo de memoria (ejemplo: 2 Gigabytes)
maxmemory 2048mb

# Política de desalojo recomendada para cachés de producción
maxmemory-policy allkeys-lru

# Activar la desfragmentación automática en segundo plano
activedefrag yes
```

Guarda los cambios y aplica una relectura limpia o reinicio del servicio:
```bash
sudo systemctl restart redis-server
```

## 🛡️ Consejos de Prevención

Prácticas de seguridad recomendadas:
- **Asigna siempre un TTL a las claves de caché**: Asegúrate de que las operaciones de guardado en el código de tu aplicación especifiquen expiración (`SET key value EX 3600`) para permitir la limpieza natural de registros vetustos.
- **Escanea claves pesadas periódicamente**: Utiliza la herramienta de línea de comandos para identificar claves de datos sobredimensionadas: `redis-cli --bigkeys` o `redis-cli --memkeys`.
- **Establece alertas de monitoreo**: Configura métricas en Prometheus/Grafana o Datadog para recibir notificaciones cuando `used_memory` supere el 85% de `maxmemory`.

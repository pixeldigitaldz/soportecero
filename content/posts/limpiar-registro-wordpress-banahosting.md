---
title: Cómo limpiar y optimizar la base de datos de WordPress saturada en BanaHosting
description: >-
  Guía práctica para eliminar transitorios, revisiones huérfanas y reducir el
  consumo de disco MySQL en cPanel BanaHosting.
category: Sistemas y Servidores
tags:
  - WordPress
  - BanaHosting
  - MySQL
  - cPanel
  - Optimización
readTime: 7 min
date: '2026-06-27'
---
El crecimiento descontrolado de la base de datos MySQL en alojamientos como BanaHosting o servidores cPanel provoca que tu sitio web supere los límites de inodes, alcance el tope de CPU/IOPS y experimente lentitud general o errores 500/503. Esto suele deberse a millones de transitorios no eliminados en `wp_options` y miles de revisiones antiguas en `wp_posts`.

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
| **Tabla wp_options sobrecargada por transitorios expirados y logs huérfanos** | Run SQL cleanup queries for transients in phpMyAdmin |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Comprobar el estado del servicio en el gestor de inicialización systemd
sudo systemctl status --no-pager -l php-fpm

# 2. Inspeccionar los registros del diario del sistema filtrando por unidad
sudo journalctl -u php-fpm -n 50 --no-pager

# 3. Auditar el espacio y tabla de inodos en todos los sistemas de archivos montados
df -Th && df -ih
```

- El flag `--no-pager` en `systemctl` y `journalctl` evita invocar el paginador interactivo (`less`), permitiendo redirigir la salida o analizar los registros sin interrumpir flujos de automatización.
- El comando `df` con los modificadores `-T` (tipo de sistema de archivos ext4/xfs/btrfs) y `-h` (formato legible en gigabytes/megabytes), combinado con `-i` (tabla de inodos disponibles), permite descartar si el disco está lleno por bytes reales o saturado por millones de archivos pequeños huérfanos.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

Evita que WordPress guarde copias ilimitadas de cada borrador añadiendo estas directivas en tu archivo `wp-config.php` (antes de la línea */* That's all, stop editing! */*):
```php
// Limitar revisiones a un máximo de 3 por entrada
define('WP_POST_REVISIONS', 3);

// Aumentar el intervalo de autoguardado a 120 segundos
define('AUTOSAVE_INTERVAL', 120);

// Forzar el vaciado de la papelera cada 7 días
define('EMPTY_TRASH_DAYS', 7);
```

### Paso 2: Limpiar transitorios huérfanos en wp_options (Vía phpMyAdmin)
Accede a **cPanel > phpMyAdmin**, selecciona tu base de datos de WordPress y ejecuta la siguiente consulta en la pestaña SQL:
```sql
-- Eliminar transitorios y transients expirados
DELETE FROM wp_options WHERE option_name LIKE ('_transient_%');
DELETE FROM wp_options WHERE option_name LIKE ('_site_transient_%');
```

### Paso 3: Eliminar revisiones antiguas y metadatos huérfanos
Limpia todas las revisiones anteriores acumuladas en la tabla de posts y sus metadatos asociados:
```sql
-- 1. Eliminar todas las revisiones de artículos
DELETE a,b,c
FROM wp_posts a
LEFT JOIN wp_term_relationships b ON (a.ID = b.object_id)
LEFT JOIN wp_postmeta c ON (a.ID = c.post_id)
WHERE a.post_type = 'revision';

-- 2. Eliminar metadatos huérfanos
DELETE pm FROM wp_postmeta pm LEFT JOIN wp_posts wp ON wp.ID = pm.post_id WHERE wp.ID IS NULL;
```

### Paso 4: Desfragmentar y optimizar las tablas MySQL
Tras eliminar miles de registros, desfragmenta el espacio en disco con el comando de optimización:
```sql
OPTIMIZE TABLE wp_options, wp_posts, wp_postmeta, wp_comments;
```

## 🛡️ Consejos de Prevención

- **Cuidado con plugins de analítica interna:** Evita plugins que guarden estadísticas de visitas o logs de seguridad dentro de las tablas de WordPress (como WP-Statistics o plugins de redirección pesados). Utiliza Cloudflare o Google Analytics para métricas.
- **Programa mantenimientos semanales:** Puedes utilizar herramientas como WP-Optimize o comandos WP-CLI en tareas cron para automatizar la desfragmentación.

## ❓ Preguntas Frecuentes (FAQ)

### ¿Es seguro borrar las filas _transient_ de wp_options?
Sí, totalmente seguro. Los transitorios son datos en caché temporal. Si un plugin necesita un transitorio activo, WordPress lo regenerará automáticamente en la próxima visita.

### ¿Afecta borrar revisiones a los artículos publicados?
No. Solo se eliminan los borradores históricos intermedios. El contenido público y activo de tus entradas permanece 100% intacto.

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
| **Tabla wp_options sobrecargada por transitorios expirados y logs huérfanos** |

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

- **Cuidado con plugins de analítica interna:** Evita plugins que guarden estadísticas de visitas o logs de seguridad dentro de las tablas de WordPress (como WP-Statistics o plugins de redirección pesados). Utiliza Cloudflare o Google Analytics para métricas.
- **Programa mantenimientos semanales:** Puedes utilizar herramientas como WP-Optimize o comandos WP-CLI en tareas cron para automatizar la desfragmentación.

## ❓ Preguntas Frecuentes (FAQ)

### ¿Es seguro borrar las filas _transient_ de wp_options?
Sí, totalmente seguro. Los transitorios son datos en caché temporal. Si un plugin necesita un transitorio activo, WordPress lo regenerará automáticamente en la próxima visita.

### ¿Afecta borrar revisiones a los artículos publicados?
No. Solo se eliminan los borradores históricos intermedios. El contenido público y activo de tus entradas permanece 100% intacto.

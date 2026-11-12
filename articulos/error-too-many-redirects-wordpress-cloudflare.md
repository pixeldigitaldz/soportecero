---
title: >-
  Cómo solucionar el bucle de redirecciones ERR_TOO_MANY_REDIRECTS en WordPress
  con Cloudflare
description: >-
  Resuelve el bucle infinito de redirecciones HTTPS entre WordPress y Cloudflare
  cambiando el modo SSL/TLS a Full (Strict) y corrigiendo wp-config.php.
category: Web y Código
tags:
  - WordPress
  - Cloudflare
  - SSL
readTime: 7 min
date: '2026-07-27'
---
El mensaje de error `ERR_TOO_MANY_REDIRECTS` (o bucle infinito de redirecciones) ocurre en sitios WordPress alojados detrás de Cloudflare cuando el proxy de CDN y el servidor web de origen entran en una espiral de redirecciones HTTP/HTTPS contradictorias.

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
| **El navegador muestra `ERR_TOO_MANY_REDIRECTS` al acceder al sitio web**: Cloudflare está configurado en modo SSL "Flexible", enviando peticiones HTTP al origen mientras WordPress redirige de HTTP a HTTPS | Change Cloudflare SSL/TLS mode to "Full" or "Full (Strict)" and update HTTPS proxy detection in `wp-config.php` |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Comprobar el estado del servicio en el gestor de inicialización systemd
sudo systemctl status --no-pager -l nginx

# 2. Inspeccionar los registros del diario del sistema filtrando por unidad
sudo journalctl -u nginx -n 50 --no-pager

# 3. Auditar el espacio y tabla de inodos en todos los sistemas de archivos montados
df -Th && df -ih
```

- El flag `--no-pager` en `systemctl` y `journalctl` evita invocar el paginador interactivo (`less`), permitiendo redirigir la salida o analizar los registros sin interrumpir flujos de automatización.
- El comando `df` con los modificadores `-T` (tipo de sistema de archivos ext4/xfs/btrfs) y `-h` (formato legible en gigabytes/megabytes), combinado con `-i` (tabla de inodos disponibles), permite descartar si el disco está lleno por bytes reales o saturado por millones de archivos pequeños huérfanos.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

1. Inicia sesión en el panel de control de **Cloudflare**.
2. Selecciona tu dominio y dirígete a **SSL/TLS** > **Overview**.
3. Cambia la opción de cifrado de **Flexible** a **Full** o **Full (Strict)**.

*(El modo Flexible envía tráfico desempaquetado por HTTP hacia tu servidor de origen. Si WordPress tiene activada la redirección forzada a HTTPS, responderá con una redirección 301, creando un bucle infinito).*

### Paso 2: Configurar los encabezados HTTPS en wp-config.php

Abre el archivo `wp-config.php` de tu instalación de WordPress e inserta el siguiente bloque de código antes de la línea `/* That's all, stop editing! Happy publishing. */`:

```php
// Detectar encabezado de proxy inverso de Cloudflare
if (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') {
    $_SERVER['HTTPS'] = 'on';
}

define('WP_HOME', 'https://tudominio.com');
define('WP_SITEURL', 'https://tudominio.com');
```

### Paso 3: Limpiar cachés y validar el sitio

1. En el panel de Cloudflare, ve a **Caching** > **Configuration** y haz clic en **Purge Everything**.
2. Limpia la caché de tu navegador web o realiza la prueba en una ventana de incógnito.
3. Si utilizas plugins de caché en WordPress (como WP Rocket o LiteSpeed Cache), purga la caché del plugin.

## 🛡️ Consejos de Prevención

- **Evitar el modo SSL Flexible**: Mantén siempre activo el modo **Full** o **Full (Strict)** en Cloudflare instalando un certificado SSL gratuito (como Let's Encrypt o Cloudflare Origin CA) en tu servidor de origen.
- **Utilizar las Reglas de Página (Page Rules) adecuadamente**: Si fuerzas HTTPS en Cloudflare mediante "Always Use HTTPS", no agregues reglas adicionales de redirección HTTP a HTTPS en `.htaccess` o Nginx que puedan entrar en conflicto.
- **Instalar el plugin oficial de Cloudflare para WordPress**: Facilita la sincronización de direcciones IP de clientes y el manejo automático de purga de caché.

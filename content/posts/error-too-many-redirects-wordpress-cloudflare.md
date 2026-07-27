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
readTime: 4 min
date: '2026-07-27'
---

El mensaje de error `ERR_TOO_MANY_REDIRECTS` (o bucle infinito de redirecciones) ocurre en sitios WordPress alojados detrás de Cloudflare cuando el proxy de CDN y el servidor web de origen entran en una espiral de redirecciones HTTP/HTTPS contradictorias.

## 🔍 El Diagnóstico Rápido

| Síntoma | Causa Raíz | Solución |
|---|---|---|
| El navegador muestra `ERR_TOO_MANY_REDIRECTS` al acceder al sitio web | Cloudflare está configurado en modo SSL "Flexible", enviando peticiones HTTP al origen mientras WordPress redirige de HTTP a HTTPS | Ajustar el modo de cifrado SSL/TLS en Cloudflare a "Full" o "Full (Strict)" y configurar las constantes HTTPS en `wp-config.php` |

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Cambiar el modo de cifrado SSL/TLS en Cloudflare

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

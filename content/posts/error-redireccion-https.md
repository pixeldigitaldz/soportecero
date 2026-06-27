---
title: "Cómo solucionar el error de redirección infinita HTTP a HTTPS en tu dominio propio"
description: "Guía técnica para resolver el bucle infinito ERR_TOO_MANY_REDIRECTS al configurar certificados SSL en tu servidor web, WordPress o Cloudflare."
category: "Web y Código"
tags: ["SSL", "Cloudflare", "Servidores"]
readTime: "3 min"
date: "2026-06-26"
---

El error `ERR_TOO_MANY_REDIRECTS` (Demasiadas redirecciones) ocurre cuando tu servidor web y un servicio externo (como Cloudflare) entran en un conflicto de instrucciones: el servidor le dice al navegador que use HTTPS, pero Cloudflare intercepta la petición y la devuelve en HTTP, creando un bucle infinito que impide cargar la página.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Ajustar el cifrado en Cloudflare
Si usas Cloudflare para proteger tu dominio propio, la causa principal es tener el modo de SSL configurado en "Flexible".
1. Inicia sesión en tu panel de Cloudflare y ve a la sección **SSL/TLS**.
2. Cambia el modo de cifrado de "Flexible" a **Completo (Full)** o **Completo (Estricto) / Full (Strict)**.
3. Esto obliga a que la comunicación entre Cloudflare y tu servidor sea 100% cifrada bajo HTTPS, rompiendo el bucle.

### Paso 2: Revisar el archivo `.htaccess` (En servidores Apache)
Si no usas Cloudflare, el fallo está en las reglas de tu servidor. Abre tu archivo `.htaccess` y asegúrate de usar una regla de redirección limpia que no choque consigo misma:
```apache
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
```

## 🛡️ Consejo de Prevención
Prácticas de seguridad recomendadas:
- Borra siempre la caché de tu navegador (Ctrl + F5) tras hacer cambios en los certificados SSL, ya que los navegadores recuerdan las rutas viejas de redirección y pueden mostrarte el error guardado en su memoria local.

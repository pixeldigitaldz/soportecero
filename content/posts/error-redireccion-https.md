---
title: "Cómo solucionar el error de redirección infinita HTTP a HTTPS en tu dominio propio"
description: "Aprende a solucionar el bucle ERR_TOO_MANY_REDIRECTS entre Cloudflare, Nginx, Apache y WordPress al forzar HTTPS."
category: "Web y Código"
tags: ["HTTPS", "SSL", "Cloudflare", "Nginx", "WordPress", "SysAdmin"]
readTime: "5 min"
date: "2026-06-25"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Modo de cifrado SSL en Cloudflare configurado en 'Flexible' mientras el servidor redirige a HTTPS** | Cambiar el modo de cifrado en Cloudflare a 'Full (Strict)' |
| **Bucle de redirección en .htaccess o Nginx por no evaluar la cabecera X-Forwarded-Proto** | Configurar `fastcgi_param HTTPS on;` y verificar `$_SERVER['HTTP_X_FORWARDED_PROTO']` |

El error `ERR_TOO_MANY_REDIRECTS` (Redirección infinita) ocurre cuando el navegador del usuario entra en un bucle cerrado de peticiones HTTP/HTTPS que nunca llega a completarse. La causa principal es una desincronización entre un proxy inverso perimetral (como Cloudflare o un CDN) y el servidor de origen (Nginx/Apache/WordPress).

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Configurar el modo SSL/TLS en Cloudflare a Completo (Estricto)
Si utilizas Cloudflare con el modo **Flexible**, Cloudflare conecta con tu servidor por HTTP plano (puerto 80). Si tu servidor web tiene una regla para redirigir todo el tráfico a HTTPS, se generará un bucle infinito:
1. Inicia sesión en tu panel de **Cloudflare**.
2. Ve a **SSL/TLS > Overview** (Información general).
3. Cambia la opción de *Flexible* a **Full** (Completo) o **Full (Strict)** (Completo estricto).

### Paso 2: Configurar la detección de HTTPS detrás de proxy en WordPress (wp-config.php)
Indica a WordPress que confíe en la cabecera de protocolo seguro enviada por el proxy inverso:
```php
// Añadir al inicio de wp-config.php (antes de require_once wp-settings.php):
if (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') {
    $_SERVER['HTTPS'] = 'on';
}
```

### Paso 3: Configurar la redirección correcta en Nginx
Asegúrate de que tu bloque de servidor en Nginx redirija limpiamente solo en el puerto 80 sin crear bucles en el puerto 443:
```nginx
# Bloque HTTP (Puerto 80) -> Redirigir a HTTPS
server {
    listen 80;
    server_name misitio.com www.misitio.com;
    return 301 https://$host$request_uri;
}

# Bloque HTTPS (Puerto 443) -> Servir contenido
server {
    listen 443 ssl http2;
    server_name misitio.com www.misitio.com;

    ssl_certificate /etc/letsencrypt/live/misitio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/misitio.com/privkey.pem;

    location / {
        proxy_set_header X-Forwarded-Proto https;
        proxy_pass http://localhost:3000;
    }
}
```

### Paso 4: Limpiar la caché de redirecciones 301 en el navegador
Las redirecciones HTTP 301 se guardan de forma persistente en la caché del navegador:
1. Abre una ventana de incógnito para comprobar si el bucle persiste.
2. Limpia la caché de navegación y cookies del dominio.

## 🛡️ Consejos de Prevención
- **Activa HSTS (HTTP Strict Transport Security):** Una vez que tu HTTPS sea 100% estable, habilita HSTS para que los navegadores recuerden conectar siempre por HTTPS directamente sin realizar redirecciones previas.
- **Sincroniza las URLs en Ajustes de WordPress:** Comprueba que en *Ajustes > Generales*, tanto *Dirección de WordPress (URL)* como *Dirección del sitio (URL)* comiencen exactamente con `https://`.

## ❓ Preguntas Frecuentes (FAQ)

### ¿Por qué ocurre el bucle con SSL Flexible de Cloudflare?
Porque el visitante pide HTTPS a Cloudflare, Cloudflare solicita HTTP a tu servidor, tu servidor responde con un 301 diciendo "ve a HTTPS", y Cloudflare vuelve a repetir el ciclo indefinidamente.

### ¿Cómo verifico la cadena de redirección desde la terminal?
Ejecuta: `curl -IL https://misitio.com` para observar cada código de respuesta HTTP (301, 302, 200) en cada salto.

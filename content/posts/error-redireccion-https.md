---
title: >-
  Cómo solucionar el error de redirección infinita HTTP a HTTPS en tu dominio
  propio
description: >-
  Aprende a solucionar el bucle ERR_TOO_MANY_REDIRECTS entre Cloudflare, Nginx,
  Apache y WordPress al forzar HTTPS.
category: Web y Código
tags:
  - HTTPS
  - SSL
  - Cloudflare
  - Nginx
  - WordPress
  - SysAdmin
readTime: 7 min
date: '2026-06-25'
---
El error `ERR_TOO_MANY_REDIRECTS` (Redirección infinita) ocurre cuando el navegador del usuario entra en un bucle cerrado de peticiones HTTP/HTTPS que nunca llega a completarse. La causa principal es una desincronización entre un proxy inverso perimetral (como Cloudflare o un CDN) y el servidor de origen (Nginx/Apache/WordPress).

## Análisis de Arquitectura y Causa Raíz

En servidores web de alto rendimiento como **Nginx** y **Apache HTTP Server**, la arquitectura de despacho de solicitudes se basa en modelos de concurrencia optimizados: bucles de eventos asíncronos no bloqueantes gobernados por multiplexación de E/S (`epoll` en Linux) en el caso de Nginx, y modelos híbridos prefork/worker basados en hilos y procesos en Apache.

El fallo técnico reportado se origina por una discrepancia en la negociación de capas entre el servidor web y los procesos upstream o el sistema de archivos subyacente:
1. **Resolución de sockets y ciclo de vida HTTP:** Cuando Nginx actúa como reverse proxy hacia un servidor de aplicaciones (PHP-FPM, Node.js, Python WSGI o contenedores), delega el tráfico a través de sockets TCP (`127.0.0.1:puerto`) o sockets de dominio UNIX (`AF_UNIX`). Si el backend colapsa por una excepción no controlada, agota su cola de backlog de conexiones entrantes (`somaxconn`), o excede el umbral de tiempo establecido por `proxy_read_timeout`, el kernel emite una señal de cierre de canal que Nginx traduce en un error HTTP 502 Bad Gateway o 504 Gateway Timeout hacia el cliente web.
2. **Evaluación de directivas `.htaccess` y memoria en Apache:** En Apache, cada solicitud hacia un directorio provoca que el servidor escanee y parsee el archivo `.htaccess` en tiempo de ejecución. Si se declara una directiva correspondiente a un módulo no cargado en el kernel de Apache (como reglas de reescritura `RewriteRule` sin el módulo `mod_rewrite`, o manipulación de encabezados sin `mod_headers`), el compilador de configuración interno aborta inmediatamente la petición con un error HTTP 500 Internal Server Error, registrando la alerta en el log del servidor.
3. **Permisos POSIX y herencia de grupos de ejecución:** El servidor web corre bajo una identidad de privilegios mínimos en el sistema operativo (comúnmente `www-data`, `nginx` o `apache`). Si los archivos web carecen de permisos de lectura (`r`, máscara 644) o los directorios carecen de permisos de ejecución y paso (`x`, máscara 755), el kernel deniega la llamada `open()` con el error `EACCES`, transformándose en un error HTTP 403 Forbidden.

## Entorno de Laboratorio y Diagnóstico

Antes de aplicar cualquier cambio destructivo o reiniciar servicios en un entorno de producción, es fundamental ejecutar una matriz de diagnóstico preliminar para identificar la capa exacta donde ocurre el fallo:

| Causa | Solución |
|---|---|
| **Modo de cifrado SSL en Cloudflare configurado en 'Flexible' mientras el servidor redirige a HTTPS** | Switch Cloudflare SSL/TLS encryption mode to 'Full' or 'Full (Strict)' |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Verificar la sintaxis de los archivos de configuración
sudo nginx -t

# 2. Consultar las últimas 50 líneas del registro de errores en tiempo real
sudo tail -n 50 /var/log/nginx/error.log

# 3. Comprobar qué procesos están escuchando en los puertos HTTP/HTTPS
sudo ss -tulpn | grep -E ':(80|443|3000|8080|9000)'
```

- El comando `nginx -t` valida la sintaxis de todos los bloques `server` y `location` incluidos, confirmando si los certificados SSL y las rutas de sockets existen en el disco sin interrumpir el servicio activo.
- El comando `ss` con los flags `-t` (TCP), `-u` (UDP), `-l` (listening), `-p` (procesos y PIDs asociados) y `-n` (numérico sin resolución DNS inversa) identifica con precisión milimétrica si otro servicio está ocupando el puerto o si el backend está inactivo.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

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

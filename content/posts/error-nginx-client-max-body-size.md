---
title: Cómo solucionar el error 413 Request Entity Too Large y 403 Forbidden en Nginx
description: >-
  Aprende a solucionar el error 413 request entity too large y 403 forbidden nginx. Configura client_max_body_size y corrige permisos de archivos www-data en minutos.
category: Sistemas y Servidores
tags:
  - Nginx
  - Sysadmin
  - Web
readTime: 7 min
date: '2026-07-03'
---
El error **413 request entity too large** en Nginx ocurre cuando el tamaño del archivo subido excede el límite permitido por defecto (1 MB). Para solucionarlo de inmediato, añade o modifica la directiva `client_max_body_size 64M;` dentro del bloque `http`, `server` o `location` en `/etc/nginx/nginx.conf` y recarga el servicio con `sudo nginx -s reload`.

Por su parte, el error **403 forbidden nginx** surge cuando el usuario ejecutor del servidor web (comúnmente `www-data` o `nginx`) carece de permisos POSIX de lectura en los archivos estáticos o permisos de ejecución en los directorios. Para resolver el bloqueo 403 al instante, restablece la propiedad y permisos seguros ejecutando `sudo chown -R www-data:www-data /var/www/html && sudo find /var/www/html -type d -exec chmod 755 {} + && sudo find /var/www/html -type f -exec chmod 644 {} +`.

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
| **Directiva client_max_body_size en Nginx con límite inferior al tamaño del archivo subido** | Increase limit in `nginx.conf`: `client_max_body_size 64M;` |

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

Abre el archivo de configuración global de Nginx o el bloque de servidor (`server block`) asignado a tu sitio web:
```bash
# Abrir la configuración principal de Nginx
sudo nano /etc/nginx/nginx.conf
```
Dentro de la sección `http`, `server` o `location`, añade o modifica la siguiente directiva para ampliar el límite de subida a, por ejemplo, 64 Megabytes:
```nginx
# Permitir subidas de hasta 64MB
client_max_body_size 64M;
```

### Paso 2: Ajustar los límites de carga en PHP-FPM (si corresponde)
Si tu sitio web corre bajo PHP (como WordPress, Drupal o Laravel), debes coordinar el tamaño límite de Nginx con las directivas internas de tu intérprete de PHP:
```bash
# Abrir el archivo de configuración de PHP (ajusta según tu versión activa)
sudo nano /etc/php/8.2/fpm/php.ini
```
Busca y modifica las siguientes variables para que coincidan con el límite de Nginx:
```ini
upload_max_filesize = 64M
post_max_size = 64M
memory_limit = 256M
```

### Paso 3: Validar y reiniciar los servicios
Verifica que la sintaxis de Nginx sea correcta antes de aplicar los cambios en producción:
```bash
# Comprobar sintaxis del servidor web
sudo nginx -t

# Reiniciar los daemon para aplicar la configuración
sudo systemctl restart nginx
sudo systemctl restart php8.2-fpm
```

## 🛡️ Consejos de Prevención

Prácticas de seguridad recomendadas:
- No establezcas la directiva `client_max_body_size` a `0` (lo cual deshabilita cualquier límite de comprobación en el servidor). Configurar un tamaño infinito expone a tu servidor web Nginx a ataques de denegación de servicio (DoS), permitiendo que usuarios maliciosos inunden tu disco de almacenamiento subiendo de forma paralela archivos masivos repetidamente hasta agotar por completo los recursos de tu máquina de producción.

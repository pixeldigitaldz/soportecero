---
title: "Cómo solucionar el error 504 Gateway Timeout en Nginx con PHP-FPM (Rápido)"
description: "Guía paso a paso para corregir el error 504 Gateway Timeout en Nginx y PHP-FPM aumentando timeouts y optimizando procesos."
category: "Sistemas y Servidores"
tags: ["Nginx", "PHP-FPM", "Linux", "SysAdmin", "Servidores", "WordPress"]
readTime: "5 min"
date: "2026-07-26"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Script PHP tarda más tiempo en responder que el límite fastcgi_read_timeout en Nginx** | Aumentar `fastcgi_read_timeout 300s;` en la configuración del bloque server de Nginx |
| **Límites max_execution_time y request_terminate_timeout bajos en php.ini y pool PHP-FPM** | Aumentar `max_execution_time = 300` en `php.ini` y `request_terminate_timeout = 300s` en `www.conf` |

El error `504 Gateway Timeout` en un servidor web Nginx con PHP-FPM indica que Nginx actuó como proxy inverso o pasarela y no recibió una respuesta oportuna del servicio PHP-FPM antes de que expirara el tiempo de espera (timeout) configurado. Esto es frecuente durante importaciones pesadas, consultas lentas a bases de datos o subida de archivos grandes.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Aumentar los tiempos de espera en la configuración de Nginx
Abre el archivo de configuración de tu sitio web (por ejemplo, `/etc/nginx/sites-available/mi-sitio.conf` o `/etc/nginx/nginx.conf`):
```nginx
server {
    listen 80;
    server_name misitio.com;
    root /var/www/misitio;

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php8.3-fpm.sock;

        # Aumentar tiempos de espera a 300 segundos (5 minutos)
        fastcgi_connect_timeout 300s;
        fastcgi_send_timeout 300s;
        fastcgi_read_timeout 300s;
        
        # Optimizar buffers de FastCGI para respuestas grandes
        fastcgi_buffer_size 128k;
        fastcgi_buffers 4 256k;
        fastcgi_busy_buffers_size 256k;
    }
}
```

### Paso 2: Ajustar los límites de ejecución en php.ini
Modifica el archivo `php.ini` correspondiente a tu versión de PHP-FPM (ej. `/etc/php/8.3/fpm/php.ini`):
```ini
; Tiempo máximo de ejecución en segundos
max_execution_time = 300

; Tiempo máximo de análisis de datos de entrada
max_input_time = 300

; Límite de memoria para scripts pesados
memory_limit = 512M
```

### Paso 3: Configurar el pool de PHP-FPM (www.conf)
Edita el archivo de configuración del pool (`/etc/php/8.3/fpm/pool.d/www.conf`):
```ini
; Tiempo de espera antes de terminar un proceso PHP colgado
request_terminate_timeout = 300s

; Asegurar suficientes procesos hijos para atender peticiones concurrentes
pm = dynamic
pm.max_children = 50
pm.start_servers = 10
pm.min_spare_servers = 5
pm.max_spare_servers = 20
```

### Paso 4: Validar la sintaxis y reiniciar los servicios
Comprueba que no existen errores de sintaxis antes de reiniciar:
```bash
# 1. Comprobar configuración de Nginx
sudo nginx -t

# 2. Reiniciar PHP-FPM y Nginx
sudo systemctl restart php8.3-fpm
sudo systemctl restart nginx
```

## 🛡️ Consejos de Prevención
- **Monitorea consultas lentas en MySQL:** Muchos timeouts 504 no son fallos de PHP, sino consultas SQL bloqueadas en bases de datos sin índices. Habilita el *Slow Query Log* en MySQL/MariaDB.
- **Utiliza colas asíncronas para tareas largas:** Si tu aplicación envía correos masivos o procesa imágenes, utiliza colas con Redis/RabbitMQ o Celery en segundo plano en lugar de ejecutar la tarea dentro de la petición HTTP del usuario.

## ❓ Preguntas Frecuentes (FAQ)

### ¿Qué diferencia hay entre el error 502 Bad Gateway y el 504 Gateway Timeout?
El error **502** ocurre cuando PHP-FPM está completamente caído o el socket no responde de inmediato. El error **504** ocurre cuando PHP-FPM sí está activo, pero la tarea tarda demasiado tiempo en completarse y supera el límite de tiempo.

### ¿Cloudflare puede generar un error 504?
Sí. Si utilizas Cloudflare con proxy activo (nube naranja), Cloudflare tiene un timeout estricto de 100 segundos para planes gratuitos. Si tu backend tarda más de 100 segundos, Cloudflare mostrará su propia pantalla 504.

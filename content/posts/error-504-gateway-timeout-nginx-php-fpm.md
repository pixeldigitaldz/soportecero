---
title: "Cómo solucionar el error 504 Gateway Timeout en Nginx con PHP-FPM (Rápido)"
description: "Guía paso a paso para identificar y resolver el error 504 Gateway Timeout en Nginx y PHP-FPM ajustando los tiempos de espera (timeouts) en la configuración."
category: "Sistemas y Servidores"
tags: ["Nginx", "PHP-FPM", "Sysadmin"]
readTime: "4 min"
date: "2026-07-26"
---

El error **504 Gateway Timeout** ocurre cuando Nginx actúa como proxy inverso frente a un servidor backend (como PHP-FPM) y este último no responde a tiempo antes de que expire el límite de espera configurado en el servidor web.

## Diagnóstico Rápido

| Causa | Solución |
|---|---|
| **HTTP 504 Gateway Timeout al procesar scripts PHP pesados**: Nginx o PHP-FPM interrumpe la conexión porque el script tarda más que `fastcgi_read_timeout` o `max_execution_time` | Aumentar los valores de timeout en `nginx.conf` y en los archivos de configuración de PHP-FPM |

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Aumentar los timeouts en la configuración de Nginx

Abre el archivo de configuración del sitio en Nginx (por ejemplo `/etc/nginx/sites-available/default` o `/etc/nginx/conf.d/default.conf`):

```nginx
server {
    listen 80;
    server_name example.com;

    location ~ \.php$ {
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;

        # Aumentar el tiempo límite de lectura e interconexión con FastCGI
        fastcgi_connect_timeout 300s;
        fastcgi_send_timeout 300s;
        fastcgi_read_timeout 300s;
    }
}
```

### Paso 2: Configurar los límites de ejecución en PHP-FPM

Ajusta la directiva de tiempo de ejecución en tu archivo `php.ini` (`/etc/php/8.2/fpm/php.ini`):

```ini
max_execution_time = 300
max_input_time = 300
memory_limit = 256M
```

Además, asegúrate de actualizar el archivo del pool de PHP-FPM (`/etc/php/8.2/fpm/pool.d/www.conf`):

```ini
request_terminate_timeout = 300s
```

### Paso 3: Validar y reiniciar los servicios

Verifica que la sintaxis de Nginx sea correcta antes de aplicar los cambios:

```bash
sudo nginx -t
```

Si el resultado es exitoso, reinicia Nginx y PHP-FPM:

```bash
sudo systemctl restart php8.2-fpm
sudo systemctl restart nginx
```

## 🛡️ Consejos de Prevención

- **Delegar procesos pesados a colas en segundo plano**: Utiliza herramientas como Redis y Celery/Supervisor o Laravel Queues para tareas como generación de reportes o procesamiento de imágenes.
- **Monitorear el registro de consultas lentas**: Activa el `request_slowlog_timeout` en PHP-FPM para detectar consultas SQL o funciones que ralentizan las peticiones web.
- **Optimizar consultas a la base de datos**: Agrega índices en MySQL/PostgreSQL para evitar bloqueos prolongados durante peticiones HTTP.

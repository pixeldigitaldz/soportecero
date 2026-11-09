---
title: Cómo solucionar el error 504 Gateway Timeout en Nginx con PHP-FPM (Rápido)
description: >-
  Guía paso a paso para corregir el error 504 Gateway Timeout en Nginx y PHP-FPM
  aumentando timeouts y optimizando procesos.
category: Sistemas y Servidores
tags:
  - Nginx
  - PHP-FPM
  - Linux
  - SysAdmin
  - Servidores
  - WordPress
readTime: 7 min
date: '2026-07-26'
---
El error `504 Gateway Timeout` en un servidor web Nginx con PHP-FPM indica que Nginx actuó como proxy inverso o pasarela y no recibió una respuesta oportuna del servicio PHP-FPM antes de que expirara el tiempo de espera (timeout) configurado. Esto es frecuente durante importaciones pesadas, consultas lentas a bases de datos o subida de archivos grandes.

## Contexto de Arquitectura y Causa Raíz del Fallo

En servidores web de alto rendimiento como **Nginx** y **Apache HTTP Server**, la arquitectura de despacho de solicitudes se basa en modelos de concurrencia optimizados: bucles de eventos asíncronos no bloqueantes gobernados por multiplexación de E/S (`epoll` en Linux) en el caso de Nginx, y modelos híbridos prefork/worker basados en hilos y procesos en Apache.

El fallo técnico reportado se origina por una discrepancia en la negociación de capas entre el servidor web y los procesos upstream o el sistema de archivos subyacente:
1. **Resolución de sockets y ciclo de vida HTTP:** Cuando Nginx actúa como reverse proxy hacia un servidor de aplicaciones (PHP-FPM, Node.js, Python WSGI o contenedores), delega el tráfico a través de sockets TCP (`127.0.0.1:puerto`) o sockets de dominio UNIX (`AF_UNIX`). Si el backend colapsa por una excepción no controlada, agota su cola de backlog de conexiones entrantes (`somaxconn`), o excede el umbral de tiempo establecido por `proxy_read_timeout`, el kernel emite una señal de cierre de canal que Nginx traduce en un error HTTP 502 Bad Gateway o 504 Gateway Timeout hacia el cliente web.
2. **Evaluación de directivas `.htaccess` y memoria en Apache:** En Apache, cada solicitud hacia un directorio provoca que el servidor escanee y parsee el archivo `.htaccess` en tiempo de ejecución. Si se declara una directiva correspondiente a un módulo no cargado en el kernel de Apache (como reglas de reescritura `RewriteRule` sin el módulo `mod_rewrite`, o manipulación de encabezados sin `mod_headers`), el compilador de configuración interno aborta inmediatamente la petición con un error HTTP 500 Internal Server Error, registrando la alerta en el log del servidor.
3. **Permisos POSIX y herencia de grupos de ejecución:** El servidor web corre bajo una identidad de privilegios mínimos en el sistema operativo (comúnmente `www-data`, `nginx` o `apache`). Si los archivos web carecen de permisos de lectura (`r`, máscara 644) o los directorios carecen de permisos de ejecución y paso (`x`, máscara 755), el kernel deniega la llamada `open()` con el error `EACCES`, transformándose en un error HTTP 403 Forbidden.

## Entorno de Laboratorio y Diagnóstico Previo

Antes de aplicar cualquier cambio destructivo o reiniciar servicios en un entorno de producción, es fundamental ejecutar una matriz de diagnóstico preliminar para identificar la capa exacta donde ocurre el fallo:

| Causa | Solución |
|---|---|
| **Script PHP tarda más tiempo en responder que el límite fastcgi_read_timeout en Nginx** |

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

- **Monitorea consultas lentas en MySQL:** Muchos timeouts 504 no son fallos de PHP, sino consultas SQL bloqueadas en bases de datos sin índices. Habilita el *Slow Query Log* en MySQL/MariaDB.
- **Utiliza colas asíncronas para tareas largas:** Si tu aplicación envía correos masivos o procesa imágenes, utiliza colas con Redis/RabbitMQ o Celery en segundo plano en lugar de ejecutar la tarea dentro de la petición HTTP del usuario.

## ❓ Preguntas Frecuentes (FAQ)

### ¿Qué diferencia hay entre el error 502 Bad Gateway y el 504 Gateway Timeout?
El error **502** ocurre cuando PHP-FPM está completamente caído o el socket no responde de inmediato. El error **504** ocurre cuando PHP-FPM sí está activo, pero la tarea tarda demasiado tiempo en completarse y supera el límite de tiempo.

### ¿Cloudflare puede generar un error 504?
Sí. Si utilizas Cloudflare con proxy activo (nube naranja), Cloudflare tiene un timeout estricto de 100 segundos para planes gratuitos. Si tu backend tarda más de 100 segundos, Cloudflare mostrará su propia pantalla 504.

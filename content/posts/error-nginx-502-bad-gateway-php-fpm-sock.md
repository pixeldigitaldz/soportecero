---
title: Error 502 Bad Gateway en Nginx con PHP-FPM
description: >-
  ¿Nginx devuelve error 502 Bad Gateway al procesar scripts PHP? Aprende a
  corregir el socket de comunicación de PHP-FPM en 3 pasos.
category: Sistemas y Servidores
tags:
  - Nginx
  - PHP-FPM
  - Sysadmin
  - Linux
readTime: 7 min
date: '2026-08-12'
---
El error **`502 Bad Gateway`** en un servidor web Nginx con PHP-FPM ocurre cuando Nginx actúa como proxy inverso pero no logra comunicarse con el proceso de escucha de PHP. El mensaje de error típico en `/var/log/nginx/error.log` es:
`connect() to unix:/run/php/php8.2-fpm.sock failed (2: No such file or directory)` o `Connection refused`.

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
| **Servicio php-fpm detenido o no iniciado** |

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

Asegúrate de que el servicio de PHP-FPM esté activo en tu servidor:

```bash
# Comprobar el servicio (ajusta según tu versión: 8.1, 8.2, 8.3)
sudo systemctl status php8.2-fpm
```
Si el estado indica `inactive (dead)` o `failed`, inicialízalo:
```bash
sudo systemctl enable --now php8.2-fpm
```

### Paso 2: Verificar la ubicación exacta del archivo Socket (`.sock`)
Comprueba la ruta real donde PHP-FPM está escuchando las conexiones:

```bash
ls -la /run/php/
```
Salida esperada: `php8.2-fpm.sock` o `php8.3-fpm.sock`.

Abre el archivo de configuración del bloque de servidor de tu sitio en `/etc/nginx/sites-available/tudominio.conf`:
```nginx
location ~ \.php$ {
    include snippets/fastcgi-php.conf;
    # La ruta DEBE coincidir exactamente con el archivo .sock de tu sistema:
    fastcgi_pass unix:/run/php/php8.2-fpm.sock;
}
```

### Paso 3: Corregir permisos en el socket de PHP-FPM
Si el archivo `.sock` existe pero Nginx muestra `Permission denied` en sus registros:

Abre la configuración del pool de usuarios de PHP-FPM:
```bash
sudo nano /etc/php/8.2/fpm/pool.d/www.conf
```
Asegúrate de que el propietario del socket sea el mismo usuario que ejecuta Nginx (`www-data`):
```ini
listen.owner = www-data
listen.group = www-data
listen.mode = 0660
```
Reinicia PHP-FPM y Nginx:
```bash
sudo systemctl restart php8.2-fpm
sudo systemctl restart nginx
```

## Resolución de Casos Borde (Troubleshooting)

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

* Al actualizar la versión de PHP en el servidor (ej. de PHP 8.1 a 8.3), recuerda actualizar la ruta `fastcgi_pass` en Nginx, de lo contrario volverá el error 502.

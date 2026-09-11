---
title: "[SOLUCIONADO] Nginx connect() failed (111: Connection refused) while connecting to upstream"
description: "Soluciona el error de Nginx 111: Connection refused en proxy_pass hacia Node.js, PHP-FPM, Docker o Python Gunicorn."
category: "Sistemas y Servidores"
tags: ["Nginx","DevOps","Nodejs","Sysadmin"]
readTime: "4 min"
date: "2026-09-19"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **El servicio backend (Node.js, Gunicorn, Docker) no está ejecutándose o se cayó por un error fatal** | Comprobar el estado del proceso backend con systemctl status o docker ps |
| **Discordancia de puerto o socket UNIX en la directiva proxy_pass de Nginx** | Corregir el puerto de escucha (ej. 3000, 8000) o los permisos del socket .sock |

Al configurar Nginx como proxy inverso hacia aplicaciones web (Next.js, Express, Django, Laravel), es muy común ver el error HTTP 502 Bad Gateway en el navegador y la siguiente línea en el archivo de registro `/var/log/nginx/error.log`: `connect() failed (111: Connection refused) while connecting to upstream, client: ..., server: ..., request: ..., upstream: "http://127.0.1:3000/..."`. Esto significa que Nginx intentó transferir la petición al backend, pero no encontró ningún proceso escuchando en ese puerto o socket.

> **Solución Rápida (1 Minuto):**
> 1. Revisa qué servicios están escuchando en puertos locales:
>    `sudo ss -tulpn | grep -E '3000|8000|8080|9000'`
> 2. Comprueba si tu backend (Node/Python/Docker) está activo:
>    `sudo systemctl status mi-app`

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Comprobar si el backend está escuchando en el puerto correcto
Utiliza `ss` o `netstat` para verificar si tu servidor backend realmente tiene el puerto abierto:
```bash
sudo ss -tulpn | grep LISTEN
```
Si tu directiva en Nginx es `proxy_pass http://127.0.0.1:3000;` pero en la lista de puertos no aparece ningún proceso en el puerto 3000, tu aplicación backend no está corriendo o falló durante el arranque.

### Paso 2: Comprobar conflicto entre 127.0.0.1 y localhost (IPv4 vs IPv6)
En sistemas modernos, `localhost` puede resolverse a la dirección IPv6 `[::1]`. Si tu servidor Node.js o Python solo escucha en IPv4 (`127.0.0.1`), Nginx intentará conectar a IPv6 y arrojará el error 111:
```nginx
# En tu archivo de configuración de Nginx (/etc/nginx/sites-available/default)
location / {
    # Cambia 'localhost' por la IP explícita 127.0.0.1
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

### Paso 3: Verificar permisos en sockets UNIX (PHP-FPM o Gunicorn)
Si utilizas sockets UNIX en lugar de puertos TCP (`unix:/run/php/php-fpm.sock`), verifica los permisos del archivo socket:
```bash
ls -la /run/php/php-fpm.sock
```
El socket debe pertenecer al usuario de Nginx (`www-data` en Ubuntu/Debian o `nginx` en RHEL):
```bash
sudo chown www-data:www-data /run/php/php-fpm.sock
sudo chmod 660 /run/php/php-fpm.sock
sudo systemctl reload nginx
```

## 🛡️ Consejo de Prevención
* Utiliza gestores de procesos como PM2 o unidades de systemd con `Restart=always` para que tu backend se recupere automáticamente tras un bloqueo.
* Configura health checks periódicos que monitoreen el estado del upstream antes de enviar tráfico.

## Preguntas Frecuentes

### ¿Por qué el error 111 solo ocurre tras reiniciar el servidor?
Ocurre cuando Nginx arranca antes de que el servicio upstream (Node.js o Docker) esté listo. Añade `After=docker.service` en la unidad de systemd de tu aplicación para controlar el orden de inicio.

### ¿Cómo distingo entre el error 111 (Connection refused) y el error 110 (Connection timed out)?
El error 111 indica que el puerto rechazó activamente el paquete porque no hay ningún proceso escuchando. El error 110 significa que los paquetes se descartaron silenciosamente (típico de reglas de firewall bloqueando el tráfico).

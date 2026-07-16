---
title: "How to Diagnose and Fix 502 Bad Gateway Error in Nginx Reverse Proxy"
description: "Learn how to diagnose why Nginx returns a 502 Bad Gateway error by checking sockets and backend services."
category: "Systems & Servers"
tags: ["Nginx", "Docker", "Sysadmin"]
readTime: "4 min"
date: "2026-07-23"
---

The `502 Bad Gateway` error on an Nginx web server configured as a reverse proxy means that Nginx has received an invalid response (or no response at all) from the origin server or backend (such as PHP-FPM, a Node.js process, Gunicorn, or a Docker container) when trying to forward the client's request.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Comprobar el estado del servicio del backend
Nginx cannot dispatch the query if the service processing the internal logic of your web application has stopped. Check its status in the console:
```bash
# Ejemplo si tu aplicación usa PHP-FPM
sudo systemctl status php8.2-fpm

# Ejemplo si usas NodeJS en segundo plano con PM2
pm2 status

# Ejemplo si corres el backend en contenedores
docker ps
```
*(Si el servicio trasero está inactivo, inicialo de inmediato: `sudo systemctl start php8.2-fpm`).*

### Paso 2: Verificar la ruta del Socket o Puerto en la configuración
If the backend is active but you still receive the 502 error, it is likely that Nginx is trying to communicate through an incorrect port or unix socket. Open the configuration file for your site's block `/etc/nginx/sites-available/default`:
```nginx
# Ejemplo de enrutamiento por Socket Unix. Verifica que la ruta física del archivo .sock sea idéntica
fastcgi_pass unix:/run/php/php8.2-fpm.sock;

# Ejemplo de enrutamiento por puerto local. Asegura que el servicio escuche en el puerto correcto
proxy_pass http://127.0.0.1:3000;
```

### Paso 3: Revisar el registro detallado de logs de Nginx
The Nginx error log will provide the exact connection refused description. Inspect it in real time:
```bash
sudo tail -n 50 -f /var/log/nginx/error.log
```
*(Busca descriptores como `Connection refused` o `Permission denied` en la comunicación con el socket).*

## 🛡️ Consejo de Prevención

Recommended safety practices:
- Configure monitoring systems or automatic watchdogs for your backends. If a memory leak causes your Node.js or PHP-FPM application to suddenly collapse and leaves Nginx disconnected, tools like Systemd (with the `Restart=on-failure` directive) or process managers like PM2 will automatically bring the service back up within milliseconds, mitigating the occurrence of the 502 error for your visitors.

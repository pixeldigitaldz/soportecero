---
title: "Cómo diagnosticar y reparar el error 502 Bad Gateway en Nginx reverse proxy"
description: "Aprende a diagnosticar por qué Nginx devuelve un error 502 Bad Gateway comprobando sockets y servicios del backend."
category: "Sistemas y Servidores"
tags: ["Nginx", "Docker", "Sysadmin"]
readTime: "4 min"
date: "2026-06-27"
---

El error `502 Bad Gateway` en un servidor web Nginx configurado como proxy inverso significa que Nginx ha recibido una respuesta inválida (o ninguna respuesta) del servidor de origen o backend (como PHP-FPM, un proceso de Node.js, Gunicorn o un contenedor de Docker) al intentar transferir la petición del cliente.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Comprobar el estado del servicio del backend
Nginx no puede despachar la consulta si el servicio que procesa la lógica interna de tu aplicación web se ha detenido. Comprueba su estado en consola:
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
Si el backend está activo pero sigues recibiendo el error 502, es probable que Nginx esté intentando comunicarse a través de un puerto o socket unix incorrecto. Abre el archivo de configuración del bloque de tu sitio `/etc/nginx/sites-available/default`:
```nginx
# Ejemplo de enrutamiento por Socket Unix. Verifica que la ruta física del archivo .sock sea idéntica
fastcgi_pass unix:/run/php/php8.2-fpm.sock;

# Ejemplo de enrutamiento por puerto local. Asegura que el servicio escuche en el puerto correcto
proxy_pass http://127.0.0.1:3000;
```

### Paso 3: Revisar el registro detallado de logs de Nginx
El log de errores de Nginx te dará la causa de conexión rechazada exacta. Inspecciónalo en tiempo real:
```bash
sudo tail -n 50 -f /var/log/nginx/error.log
```
*(Busca descriptores como `Connection refused` o `Permission denied` en la comunicación con el socket).*

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
- Configura sistemas de monitorización o guardianes (*watchdogs*) automáticos para tus backends. Si una fuga de memoria provoca que tu aplicación de NodeJS o PHP-FPM colapse repentinamente y deje a Nginx incomunicado, herramientas como Systemd (con la directiva `Restart=on-failure`) o gestores de procesos como PM2 levantarán el servicio de forma automática en milisegundos, mitigando la aparición del error 502 a tus visitantes.

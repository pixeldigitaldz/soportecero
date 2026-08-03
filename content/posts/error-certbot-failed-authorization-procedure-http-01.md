---
title: "[SOLUCIONADO] Error Certbot 'Failed authorization procedure (http-01)'"
description: "¿Let's Encrypt / Certbot no puede generar tu certificado SSL por fallo en la prueba HTTP-01? Aprende a solucionar los bloqueos de puerto y Nginx."
category: "Sistemas y Servidores"
tags: ["Certbot", "SSL", "Nginx", "Apache", "Sysadmin"]
readTime: "4 min"
date: "2026-08-03"
---

El error **`Certbot: Failed authorization procedure. domain.com (http-01): fetching http://domain.com/.well-known/acme-challenge/...: Connection refused / Timeout`** ocurre al intentar emitir o renovar un certificado SSL gratuito de Let's Encrypt cuando los servidores de validación de Let's Encrypt no pueden acceder al archivo de prueba temporal generado en tu servidor web.

> **Solución Rápida (1 Minuto):**
> 1. Abre el puerto 80 en tu firewall: `sudo ufw allow 80/tcp`
> 2. Si usas Nginx, detén el servicio temporalmente para renovar en modo standalone:
>    `sudo systemctl stop nginx && sudo certbot certonly --standalone -d tudominio.com`

## 🚀 Cómo solucionar el error de autorización HTTP-01 paso a paso

### Paso 1: Comprobar el bloqueo del puerto 80 (HTTP)
Let's Encrypt exige obligatoriamente que el **puerto 80** esté abierto y accesible desde internet para completar la validación `http-01`, incluso aunque estés configurando una redirección hacia HTTPS (puerto 443).

1. **Verificar firewall interno UFW / Firewalld:**
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw reload
   ```
2. **Verificar Security Groups en la nube (AWS / Cloud / Proxmox):**
   Asegúrate de que las reglas de entrada (*Inbound Rules*) de tu VPS autoricen el tráfico del puerto `80` para cualquier IP (`0.0.0.0/0`).

### Paso 2: Configurar la ruta de validación en Nginx
Si tienes Nginx activo, la directiva del bloque de servidor debe permitir el acceso a la carpeta oculta `.well-known/acme-challenge/`:

Abre tu archivo de configuración en `/etc/nginx/sites-available/tudominio.conf`:
```nginx
server {
    listen 80;
    server_name tudominio.com www.tudominio.com;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
        allow all;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}
```
Verifica y reinicia Nginx:
```bash
sudo nginx -t && sudo systemctl restart nginx
```

### Paso 3: Renovar certificados en Modo Standalone
Si el servidor web tiene configuraciones complejas que interfieren con la ruta, utiliza el plugin `standalone` de Certbot apagando momentáneamente tu servidor web:

```bash
# 1. Detener el servidor web
sudo systemctl stop nginx || sudo systemctl stop apache2

# 2. Ejecutar Certbot Standalone
sudo certbot certonly --standalone -d tudominio.com -d www.tudominio.com

# 3. Volver a iniciar el servidor web
sudo systemctl start nginx || sudo systemctl start apache2
```

## 🛡️ Consejo de Prevención
* Utiliza la opción `--webroot` en renovaciones automáticas de Certbot para evitar interrumpir la ejecución de tu servidor web Nginx o Apache.

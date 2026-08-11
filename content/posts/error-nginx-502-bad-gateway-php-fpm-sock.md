---
title: "[SOLUCIONADO] Error 502 Bad Gateway en Nginx con PHP-FPM"
description: "¿Nginx devuelve error 502 Bad Gateway al procesar scripts PHP? Aprende a corregir el socket de comunicación de PHP-FPM en 3 pasos."
category: "Sistemas y Servidores"
tags: ["Nginx", "PHP-FPM", "Sysadmin", "Linux"]
readTime: "4 min"
date: "2026-08-12"
---

El error **`502 Bad Gateway`** en un servidor web Nginx con PHP-FPM ocurre cuando Nginx actúa como proxy inverso pero no logra comunicarse con el proceso de escucha de PHP. El mensaje de error típico en `/var/log/nginx/error.log` es:
`connect() to unix:/run/php/php8.2-fpm.sock failed (2: No such file or directory)` o `Connection refused`.

> **Solución Rápida (1 Minuto):**
> 1. Inicia el servicio PHP-FPM de tu versión instalada:
>    `sudo systemctl restart php8.2-fpm`
> 2. Revisa que la ruta del socket en el `fastcgi_pass` de Nginx coincida exactamente con la versión activa de PHP.

## 🚀 Cómo solucionar el error 502 Bad Gateway paso a paso

### Paso 1: Verificar el estado del demonio PHP-FPM
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

## 🛡️ Consejo de Prevención
* Al actualizar la versión de PHP en el servidor (ej. de PHP 8.1 a 8.3), recuerda actualizar la ruta `fastcgi_pass` en Nginx, de lo contrario volverá el error 502.

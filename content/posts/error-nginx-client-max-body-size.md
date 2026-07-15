---
title: "Cómo solucionar el error 413 Request Entity Too Large en Nginx"
description: "Corrige el fallo 413 al subir imágenes o archivos pesados a tu servidor web configurando los límites de transferencia en Nginx y PHP."
category: "Sistemas y Servidores"
tags: ["Nginx", "Sysadmin", "Web"]
readTime: "3 min"
date: "2026-07-03"
---

El error **413 request entity too large** en un servidor web Nginx ocurre cuando un cliente intenta subir un archivo (como una imagen, un plugin de WordPress o un backup pesado) cuyo tamaño supera el límite máximo de carga permitido en la directiva de configuración del proxy web.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Configurar el límite de subida en Nginx
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

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
- No establezcas la directiva `client_max_body_size` a `0` (lo cual deshabilita cualquier límite de comprobación en el servidor). Configurar un tamaño infinito expone a tu servidor web Nginx a ataques de denegación de servicio (DoS), permitiendo que usuarios maliciosos inunden tu disco de almacenamiento subiendo de forma paralela archivos masivos repetidamente hasta agotar por completo los recursos de tu máquina de producción.

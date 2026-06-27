---
title: "Cómo solucionar el error 403 Forbidden en Nginx dentro de Docker"
description: "Aprende a diagnosticar y corregir los problemas de acceso y permisos de archivos al montar directorios web en contenedores de Nginx."
category: "Sistemas y Servidores"
tags: ["Nginx", "Docker", "Linux"]
readTime: "4 min"
date: "2026-06-27"
---

El error `403 Forbidden` en un contenedor de Nginx suele ocurrir cuando el servidor web no tiene permisos de lectura para acceder a los archivos del volumen local montado, o cuando no encuentra un archivo de inicio indexado válido en el directorio raíz de la ruta de servicio.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Corregir los permisos del sistema de archivos local
El usuario dentro del contenedor de Nginx (habitualmente `nginx` o `www-data` con UID 101 o 82) requiere permisos de lectura en los archivos y ejecución en los directorios de tu carpeta compartida. En tu servidor Linux, ajusta los privilegios ejecutando:
```bash
# Cambiar la propiedad al usuario y grupo del servidor web si es necesario,
# o asegurar permisos de lectura globales (lectura para archivos, lectura+ejecución para carpetas):
sudo find /ruta/local/a/tus/archivos/web -type d -exec chmod 755 {} \;
sudo find /ruta/local/a/tus/archivos/web -type f -exec chmod 644 {} \;
```

### Paso 2: Verificar el archivo de inicio (Index)
Asegúrate de que el bloque `server` en tu configuración de Nginx (`nginx.conf` o el archivo en `conf.d`) busque un archivo existente. Comprueba que el archivo principal de tu directorio esté nombrado exactamente de la siguiente manera y en minúsculas:
- `index.html`
- `index.php`

Una falta de concordancia en las mayúsculas (como `Index.html` o `INDEX.HTML`) provocará el fallo 403 de inmediato en sistemas Linux debido a que el sistema de archivos distingue entre mayúsculas y minúsculas (*case-sensitive*).

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
- Al trabajar en distribuciones basadas en Red Hat (como CentOS, Rocky Linux o Fedora), evita que las políticas de seguridad de **SELinux** en el sistema anfitrión bloqueen el acceso a los descriptores de archivos del contenedor. Siempre que configures el montaje de un volumen local, añade la etiqueta de seguridad compartida `:Z` al final de la ruta del volumen en tu comando o archivo de Docker Compose:
  ```yaml
  volumes:
    - /ruta/local:/usr/share/nginx/html:Z
  ```

---
title: "Resuelto: Error de permisos (Permission Denied) en volúmenes de Docker Compose"
description: "Aprende a solucionar errores EACCES y Permission Denied en carpetas compartidas y volúmenes de Docker Compose y Dockge."
category: "Sistemas y Servidores"
tags: ["Docker", "Dockge", "Linux", "Permisos", "Docker Compose", "DevOps"]
readTime: "5 min"
date: "2026-06-26"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **El UID/GID del usuario dentro del contenedor no coincide con el propietario de la carpeta en el host** | Cambiar el propietario de la carpeta con `sudo chown -R 1000:1000 /ruta/volumen` o usar variable `user: "1000:1000"` |
| **Bloqueo de seguridad por contexto SELinux o AppArmor** | Añadir el flag de volumen `:z` o `:Z` al mapear volúmenes en `docker-compose.yml` |

El fallo recurrente `EACCES: permission denied`, `touch: cannot touch '/data/...': Permission denied` o `failed to open stream: Permission denied` en aplicaciones desplegadas con Dockge o Docker Compose ocurre cuando el usuario interno del contenedor (como `node` UID 1000, `www-data` UID 33 o `nobody` UID 65534) no posee permisos de escritura sobre el directorio montado en el sistema anfitrión.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Averiguar el UID y GID del usuario del contenedor
Revisa qué usuario ejecuta el proceso dentro de la imagen de Docker:
```bash
# Ejecutar un comando id temporal dentro de la imagen del contenedor
docker run --rm <nombre_imagen> id
```
Ejemplos comunes de UIDs según la imagen:
- **Node.js**: UID `1000`, GID `1000` (usuario `node`).
- **Nginx / PHP-FPM**: UID `33`, GID `33` (usuario `www-data`).
- **PostgreSQL**: UID `999` o `70` (usuario `postgres`).
- **Uptime Kuma / Dockge**: UID `1000` o `0` (root).

### Paso 2: Corregir el propietario y permisos de la carpeta en el host
Asigna la propiedad del directorio en el servidor anfitrión al usuario correspondiente del contenedor:
```bash
# Para contenedores que corren como usuario 1000 (estándar en Node/Dockge):
sudo chown -R 1000:1000 /opt/dockge/stacks/mi-stack/data

# Asegurar permisos de lectura, escritura y ejecución de directorios
sudo chmod -R 775 /opt/dockge/stacks/mi-stack/data
```

### Paso 3: Especificar el usuario explícitamente en docker-compose.yml
En tu archivo `compose.yaml`, puedes forzar a Docker a ejecutar el contenedor con el ID de tu usuario actual en Linux (`id -u` e `id -g`):
```yaml
services:
  mi-app:
    image: mi-app:latest
    user: "${UID:-1000}:${GID:-1000}"
    volumes:
      - ./data:/app/data:z
    restart: unless-stopped
```
*Nota:* El sufijo `:z` (o `:Z` para aislamiento exclusivo) reetiqueta el contexto de seguridad SELinux en distribuciones como Fedora, Red Hat, CentOS y Rocky Linux.

### Paso 4: Reiniciar el contenedor y verificar la persistencia
Reinicia el servicio para validar que la aplicación puede crear y modificar archivos:
```bash
# Reiniciar el contenedor en Dockge o mediante CLI
docker compose down && docker compose up -d

# Verificar los logs para confirmar que no hay errores EACCES
docker compose logs -f
```

## 🛡️ Consejos de Prevención
- **Evita chmod 777 como solución definitiva:** Aunque `chmod 777` resuelve el bloqueo de inmediato, concede permisos totales a cualquier proceso local en el servidor, creando una brecha de seguridad. Utiliza siempre `chown` con el UID específico.
- **Estandariza los entornos PUID/PGID:** Muchas imágenes comunitarias (como las de LinuxServer.io) admiten variables de entorno `PUID=1000` y `PGID=1000` para auto-ajustar permisos en el arranque.

## ❓ Preguntas Frecuentes (FAQ)

### ¿Qué diferencia hay entre :z y :Z en los volúmenes de Docker?
El modificador `:z` comparte el contexto SELinux entre múltiples contenedores, mientras que `:Z` asigna una etiqueta privada exclusiva solo para ese contenedor específico.

### ¿Cómo sé qué UID tiene mi usuario en Linux?
Ejecuta `id -u` para el identificador de usuario y `id -g` para el grupo.

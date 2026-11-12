---
title: Error de permisos (Permission Denied) en volúmenes de Docker Compose
description: >-
  Aprende a solucionar errores EACCES y Permission Denied en carpetas
  compartidas y volúmenes de Docker Compose y Dockge.
category: Sistemas y Servidores
tags:
  - Docker
  - Dockge
  - Linux
  - Permisos
  - Docker Compose
  - DevOps
readTime: 7 min
date: '2026-06-26'
---
El fallo recurrente `EACCES: permission denied`, `touch: cannot touch '/data/...': Permission denied` o `failed to open stream: Permission denied` en aplicaciones desplegadas con Dockge o Docker Compose ocurre cuando el usuario interno del contenedor (como `node` UID 1000, `www-data` UID 33 o `nobody` UID 65534) no posee permisos de escritura sobre el directorio montado en el sistema anfitrión.

## Análisis de Arquitectura y Causa Raíz

En entornos contenerizados, el motor de **Docker** se apoya en primitivas fundamentales del kernel de Linux: **Namespaces** (PID, NET, MNT, IPC, UTS) para el aislamiento lógico de procesos y **Control Groups (cgroups v1/v2)** para el límite estricto de recursos de hardware (memoria RAM, ciclos de CPU y cuotas de I/O de disco).

Cuando se produce este fallo, la anomalía suele situarse en la frontera entre el demonio `dockerd`, el runtime OCI (`containerd` / `runc`) y el subsistema de red del host:
1. **Comunicación con el socket IPC (`/var/run/docker.sock`):** El cliente de Docker interactúa con la API REST local mediante llamadas al sistema sobre un socket de dominio UNIX. Si los permisos de usuario en el socket no pertenecen al grupo `docker` o si el demonio ha quedado bloqueado por un hilo zombie, la llamada al sistema devuelve inmediatamente un descriptor de error `EACCES` o `ECONNREFUSED`.
2. **Ciclo de vida del contenedor y estados OCI:** Durante la creación del contenedor (`container create / start`), `runc` solicita al kernel la creación de los namespaces y el montaje del sistema de archivos en capas mediante el driver de almacenamiento **Overlay2** (`lowerdir`, `upperdir` y `merged`). Si existe corrupción en las capas de imagen, agotamiento de inodos en `/var/lib/docker`, o incompatibilidad con la arquitectura del binario, el runtime aborta con códigos de salida específicos (ej. Exit Code 137 por OOM Killer o Exit Code 126/127 por permisos o dependencias ausentes).
3. **Pila de red virtual y cadenas de iptables:** Para exponer puertos (`-p`), Docker manipula directamente las tablas `nat` y `filter` del subsistema Netfilter mediante cadenas personalizadas (`DOCKER`, `DOCKER-USER`). Reinicios no sincronizados del firewall (`ufw` o `firewalld`) eliminan estas cadenas en memoria del kernel, provocando que los paquetes TCP entrantes sean descartados silenciosamente con paquetes TCP RST.

## Entorno de Laboratorio y Diagnóstico

Antes de aplicar cualquier cambio destructivo o reiniciar servicios en un entorno de producción, es fundamental ejecutar una matriz de diagnóstico preliminar para identificar la capa exacta donde ocurre el fallo:

| Causa | Solución |
|---|---|
| **El UID/GID del usuario dentro del contenedor no coincide con el propietario de la carpeta en el host** | Adjust host folder ownership via `sudo chown -R 1000:1000 /path/data` or set `user: "1000:1000"` |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Comprobar el estado general del demonio Docker
sudo systemctl status docker --no-pager -l

# 2. Inspeccionar los últimos logs del contenedor afectado
docker logs --tail 50 --timestamps dockge

# 3. Verificar el uso de recursos y memoria en tiempo real
docker stats --no-stream
```

- El comando `docker logs` con el parámetro `--tail 50` extrae únicamente las últimas 50 líneas emitidas en `stdout` y `stderr`, mientras que `--timestamps` permite correlacionar el segundo exacto del fallo con los registros del sistema operativo.
- El flag `--no-stream` en `docker stats` realiza un muestreo único del consumo de CPU y memoria de todos los contenedores en ejecución, evitando bloquear la terminal interactiva.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

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

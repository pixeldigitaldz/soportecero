---
title: Error 'failed to compute cache key' en Docker Build
description: >-
  ¿Recibes el error 'failed to compute cache key' al construir una imagen con
  docker build? Solución paso a paso para corregir rutas y Dockerfile.
category: Sistemas y Servidores
tags:
  - Docker
  - DevOps
  - Sysadmin
readTime: 6 min
date: '2026-08-03'
---
El error **`failed to compute cache key: failed to walk: lstat ...: no such file or directory`** durante el comando `docker build` ocurre cuando la instrucción `COPY` o `ADD` dentro del `Dockerfile` hace referencia a un archivo o directorio local que no existe dentro del **contexto de construcción** de Docker.

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
| **Ruta de origen especificada en el comando COPY/ADD del Dockerfile no existe** | Verify exact local file path and check `.dockerignore` file |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Comprobar el estado general del demonio Docker
sudo systemctl status docker --no-pager -l

# 2. Inspeccionar los últimos logs del contenedor afectado
docker logs --tail 50 --timestamps docker-build

# 3. Verificar el uso de recursos y memoria en tiempo real
docker stats --no-stream
```

- El comando `docker logs` con el parámetro `--tail 50` extrae únicamente las últimas 50 líneas emitidas en `stdout` y `stderr`, mientras que `--timestamps` permite correlacionar el segundo exacto del fallo con los registros del sistema operativo.
- El flag `--no-stream` en `docker stats` realiza un muestreo único del consumo de CPU y memoria de todos los contenedores en ejecución, evitando bloquear la terminal interactiva.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

Cuando ejecutas `docker build -t mi-imagen .`, el punto final `.` define el **contexto**. Docker empaqueta y envía todos los archivos de esa carpeta al daemon de Docker.

Si tu `Dockerfile` contiene:
```dockerfile
COPY package.json ./
```
Pero ejecutas `docker build` desde un directorio padre donde `package.json` no está en la raíz, Docker arrojará el error `failed to compute cache key`.

**Solución:** Múdate a la carpeta raíz de tu proyecto o ajusta la ruta en el comando de compilación:
```bash
# Ejecutar desde la raíz del proyecto indicando la ubicación del Dockerfile
docker build -t mi-app:latest -f ./docker/Dockerfile .
```

### Paso 2: Verificar reglas en `.dockerignore`
Abre el archivo `.dockerignore` ubicado en la raíz del proyecto. Si por accidente añadiste una regla que ignora el archivo que intentas copiar con `COPY`:
```plaintext
# Si tienes esto en .dockerignore:
src/config.json
```
Docker no incluirá `src/config.json` en el contexto y fallará con `failed to compute cache key`.

**Solución:** Elimina la regla del `.dockerignore` o añade una excepción usando `!`:
```plaintext
!src/config.json
```

### Paso 3: Mayúsculas y minúsculas en sistemas Linux
En sistemas operativos Linux, los nombres de archivos distinguen entre mayúsculas y minúsculas (*case-sensitive*). Si en tu código el archivo se llama `App.js` pero en el `Dockerfile` escribiste:
```dockerfile
COPY app.js ./
```
El motor de Docker no encontrará `app.js` y cancelará la construcción. Corrige el nombre para que coincida exactamente.

## 🛡️ Consejos de Prevención

* Utiliza Builds multi-etapa (*Multi-stage builds*) limpias para evitar copiar archivos innecesarios.
* Mantén un archivo `.dockerignore` ordenado que solo excluya `.git`, `node_modules`, y archivos de entorno `.env`.

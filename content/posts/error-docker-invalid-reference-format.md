---
title: Error 'invalid reference format' en Docker
description: >-
  ¿Recibes el error 'docker: invalid reference format' al ejecutar docker run o
  docker build? Aprende a corregir sintaxis de comillas y rutas.
category: Sistemas y Servidores
tags:
  - Docker
  - DevOps
  - Sysadmin
  - Linux
readTime: 6 min
date: '2026-08-18'
---
El error **`docker: invalid reference format`** (o `invalid reference format: repository name must be lowercase`) ocurre al ejecutar comandos `docker run`, `docker pull` o `docker build` cuando la sintaxis de los nombres de imagen, banderas de volumen (`-v`) o variables de entorno contiene comillas mal formateadas, espacios o letras mayúsculas.

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
| **Error sintáctico en el nombre de la imagen o banderas del comando docker run** | Ensure image tag is lowercase and free of illegal characters |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Comprobar el estado general del demonio Docker
sudo systemctl status docker --no-pager -l

# 2. Inspeccionar los últimos logs del contenedor afectado
docker logs --tail 50 --timestamps my-app

# 3. Verificar el uso de recursos y memoria en tiempo real
docker stats --no-stream
```

- El comando `docker logs` con el parámetro `--tail 50` extrae únicamente las últimas 50 líneas emitidas en `stdout` y `stderr`, mientras que `--timestamps` permite correlacionar el segundo exacto del fallo con los registros del sistema operativo.
- El flag `--no-stream` en `docker stats` realiza un muestreo único del consumo de CPU y memoria de todos los contenedores en ejecución, evitando bloquear la terminal interactiva.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

Docker impone estrictamente que los nombres de los repositorios e imágenes estén escritos en letras minúsculas:

* ❌ **Incorrecto:** `docker run -d MiEmpresa/Backend:v1`
* ✅ **Correcto:** `docker run -d miempresa/backend:v1`

### Paso 2: Corregir el formateo de volúmenes según tu sistema operativo

El error suele generarse al intentar montar volúmenes del sistema operativo anfitrión usando comandos copiados de tutoriales diseñados para otra terminal:

* **En Linux / macOS (Bash o Zsh):**
  ```bash
  docker run -v $(pwd):/app mi-imagen:latest
  ```
* **En Windows PowerShell:**
  ```powershell
  docker run -v "${PWD}:/app" mi-imagen:latest
  ```
* **En Windows CMD (Símbolo del sistema):**
  ```cmd
  docker run -v "%cd%:/app" mi-imagen:latest
  ```

### Paso 3: Evitar saltos de línea mal formateados en scripts
Si ejecutas un comando multilínea con barras invertidas (`\`) en Linux/macOS, asegúrate de que no haya espacios en blanco ocultos después de la barra:

```bash
# Correcto (sin espacios despues de la barra invertida):
docker run -d \
  --name mi-contenedor \
  -p 8080:80 \
  nginx:alpine
```

## 🛡️ Consejos de Prevención

* Utiliza archivos `docker-compose.yml` en lugar de comandos `docker run` muy largos para evitar errores de sintaxis en terminales de diferentes sistemas operativos.

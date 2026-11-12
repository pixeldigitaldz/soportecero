---
title: 'Error bind: address already in use al iniciar contenedores en Docker'
description: >-
  Aprende a identificar y terminar procesos que ocupan puertos en conflicto (80,
  443, 3000, 8080) en Linux y Docker Compose.
category: Sistemas y Servidores
tags:
  - Docker
  - Linux
  - Puertos
  - SysAdmin
  - Networking
  - DevOps
readTime: 7 min
date: '2026-06-25'
---
Al iniciar un contenedor mediante `docker run` o `docker compose up`, el error `driver failed programming external connectivity on endpoint ...: Error starting userland proxy: listen tcp 0.0.0.0:80: bind: address already in use` indica que el puerto de red solicitado en el sistema anfitrión ya está reservado por otro proceso activo.

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
| **Otro servicio en el host (como Nginx, Apache o Node.js) ya está escuchando en el puerto requerido** | Identificar el PID del proceso mediante `sudo lsof -i :<port>` or `ss -tulpn` and terminate service |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Comprobar el estado general del demonio Docker
sudo systemctl status docker --no-pager -l

# 2. Inspeccionar los últimos logs del contenedor afectado
docker logs --tail 50 --timestamps app-container

# 3. Verificar el uso de recursos y memoria en tiempo real
docker stats --no-stream
```

- El comando `docker logs` con el parámetro `--tail 50` extrae únicamente las últimas 50 líneas emitidas en `stdout` y `stderr`, mientras que `--timestamps` permite correlacionar el segundo exacto del fallo con los registros del sistema operativo.
- El flag `--no-stream` en `docker stats` realiza un muestreo único del consumo de CPU y memoria de todos los contenedores en ejecución, evitando bloquear la terminal interactiva.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

Utiliza herramientas de red de Linux para descubrir el Process ID (PID) exacto del servicio bloqueante:
```bash
# Opción 1: Usando lsof (ejemplo para puerto 80 u 8080)
sudo lsof -i :80

# Opción 2: Usando ss (Socket Statistics)
sudo ss -tulpn | grep :80
```

### Paso 2: Detener el servicio o proceso del sistema operativo
Si el puerto está ocupado por un servidor web instalado en el sistema anfitrión:
```bash
# Si es Apache o Nginx en el host:
sudo systemctl stop nginx
sudo systemctl stop apache2

# Si es un proceso genérico, finalízalo mediante su PID:
sudo kill -15 <PID>
# Si no responde de inmediato:
sudo kill -9 <PID>
```

### Paso 3: Identificar contenedores Docker ocultos reteniendo el puerto
A menudo un contenedor anterior se quedó en estado detached o en bucle de reinicio:
```bash
# Listar todos los contenedores (incluyendo detenidos)
docker ps -a --filter "publish=80"

# Detener y eliminar el contenedor en conflicto
docker stop <container_id>
docker rm <container_id>
```

### Paso 4: Cambiar el puerto en el mapeo de docker-compose.yml
Si necesitas que ambos servicios coexistan, cambia el puerto del host en tu archivo de composición:
```yaml
services:
  mi-aplicacion:
    image: nginx:alpine
    ports:
      # Mapear el puerto 8080 del host al puerto 80 interno del contenedor
      - "8080:80"
    restart: unless-stopped
```

## 🛡️ Consejos de Prevención

- **Evita exponer puertos innecesarios al host:** Si utilizas redes Docker internas (`networks`), comunícate entre contenedores usando sus nombres de servicio sin mapear puertos a `0.0.0.0`.
- **Comprueba antes de desplegar:** En scripts de automatización CI/CD, añade una comprobación previa con `nc -zv localhost <puerto>`.

## ❓ Preguntas Frecuentes (FAQ)

### ¿Por qué lsof no muestra nada pero Docker sigue dando error de bind?
A veces el módulo `docker-proxy` en iptables queda desincronizado tras un cuelgue del sistema. Reiniciar el daemon de Docker (`sudo systemctl restart docker`) limpia las tablas NAT huérfanas.

### ¿Puedo enlazar dos contenedores al mismo puerto interno?
Sí. Cada contenedor tiene su propia pila de red aislada. Lo que no puedes hacer es mapear ambos al mismo puerto de la máquina host.

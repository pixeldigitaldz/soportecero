---
title: >-
  Solución al crasheo por falta de memoria virtual (SWAP) en Linux (CachyOS /
  Bazzite)
description: >-
  Evita que tus juegos pesados e instancias de Docker se cierren solos
  configurando o expandiendo el espacio de memoria SWAP en distribuciones
  modernas de Linux.
category: Gaming Tech
tags:
  - Linux
  - Optimización
  - Gaming
readTime: 7 min
date: '2026-06-26'
---
Al ejecutar títulos demandantes en hardware moderno bajo distribuciones Linux de alto rendimiento como **CachyOS** o **Bazzite**, el sistema puede cerrar repentinamente tus juegos o contenedores pesados sin previo aviso. Al revisar los logs, el culpable suele ser el proceso `Out Of Memory (OOM) Killer`.

Esto pasa porque el sistema se queda sin memoria RAM física y, al no encontrar suficiente memoria virtual (**espacio SWAP**) configurada en el almacenamiento local, congela o mata la aplicación para proteger el sistema operativo.

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
| **Memoria RAM y espacio Swap totalmente agotados (OOM Killer)** | Crear y activar un archivo swapfile de 8 a 16 GB con `mkswap` |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Comprobar el estado general del demonio Docker
sudo systemctl status docker --no-pager -l

# 2. Inspeccionar los últimos logs del contenedor afectado
docker logs --tail 50 --timestamps app-worker

# 3. Verificar el uso de recursos y memoria en tiempo real
docker stats --no-stream
```

- El comando `docker logs` con el parámetro `--tail 50` extrae únicamente las últimas 50 líneas emitidas en `stdout` y `stderr`, mientras que `--timestamps` permite correlacionar el segundo exacto del fallo con los registros del sistema operativo.
- El flag `--no-stream` en `docker stats` realiza un muestreo único del consumo de CPU y memoria de todos los contenedores en ejecución, evitando bloquear la terminal interactiva.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

Abre tu terminal y ejecuta el siguiente comando para ver si tienes memoria virtual activa:
```bash
swapon --show
```
Si no sale ninguna línea de respuesta, tu sistema carece por completo de memoria de intercambio.

### Paso 2: Crear un archivo SWAP seguro de 8 Gigabytes
Para juegos y edición, un archivo de 8GB asignado en tu SSD es ideal para dar soporte en picos de consumo de RAM. Ejecuta los siguientes comandos en orden:
```bash
# 1. Crear el archivo asignando el espacio
sudo fallocate -l 8G /swapfile

# 2. Darle permisos de seguridad correctos
sudo chmod 600 /swapfile

# 3. Formatear el archivo como espacio de intercambio
sudo mkswap /swapfile

# 4. Activar la nueva memoria SWAP
sudo swapon /swapfile
```

### Paso 3: Hacer el cambio permanente para cada reinicio
Para evitar que la configuración se borre al apagar la PC, añade el archivo a la tabla de particiones del sistema:
1. Abre el archivo de configuración:
```bash
sudo nano /etc/fstab
```
2. Añade la siguiente línea al final del todo:
```plaintext
/swapfile none swap sw 0 0
```
Guardar (Ctrl + O, Enter) y salir (Ctrl + X).

## 🛡️ Consejos de Prevención

Prácticas de seguridad recomendadas:
- Si usas sistemas modernos, investiga el uso de zRAM en lugar de un archivo SWAP tradicional. zRAM comprime los datos directamente en tu memoria RAM física, siendo hasta 10 veces más rápido que leer y escribir en un disco de estado sólido (SSD).

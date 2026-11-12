---
title: 'Error iptables failed: No chain/target/match by that name en Docker'
description: >-
  Cómo solucionar el error de red iptables failed No chain target match by that
  name al iniciar contenedores de Docker tras reiniciar el firewall o UFW.
category: Sistemas y Servidores
date: '2026-08-23'
readTime: 7 min
tags:
  - Docker
  - Linux
  - Redes
---
El error `iptables failed: iptables --wait -t nat -A DOCKER ... No chain/target/match by that name` se produce cuando el cortafuegos del sistema (UFW, Firewalld o iptables) se reinicia o recarga mientras el daemon de Docker está activo, eliminando las cadenas nativas `DOCKER` y `DOCKER-USER` de la tabla NAT.

Al intentar mapear puertos de red en un nuevo contenedor (`-p 8080:80`), Docker falla porque no encuentra la infraestructura de enrutamiento necesaria.

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
| **Reinicio de UFW o Firewalld después de Docker** | Restart the Docker service with `sudo systemctl restart docker` |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Comprobar el estado general del demonio Docker
sudo systemctl status docker --no-pager -l

# 2. Inspeccionar los últimos logs del contenedor afectado
docker logs --tail 50 --timestamps docker-daemon

# 3. Verificar el uso de recursos y memoria en tiempo real
docker stats --no-stream
```

- El comando `docker logs` con el parámetro `--tail 50` extrae únicamente las últimas 50 líneas emitidas en `stdout` y `stderr`, mientras que `--timestamps` permite correlacionar el segundo exacto del fallo con los registros del sistema operativo.
- El flag `--no-stream` en `docker stats` realiza un muestreo único del consumo de CPU y memoria de todos los contenedores en ejecución, evitando bloquear la terminal interactiva.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

**Reinicia el servicio de Docker para regenerar las cadenas**
La solución inmediata y más común es forzar a Docker a reconstruir sus reglas en la tabla de filtrado de paquetes:
```bash
sudo systemctl restart docker
```
Una vez reiniciado, prueba iniciar tu stack de contenedores:
```bash
docker compose up -d
```

**Configura el orden de inicio entre UFW y Docker**
Si usas Ubuntu/Debian con UFW, asegúrate de que UFW cargue antes que Docker. En caso de reiniciar UFW con `sudo ufw reload`, acostúmbrate a encadenar el reinicio de Docker:
```bash
sudo ufw reload && sudo systemctl restart docker
```

**Verifica la compatibilidad con nftables**
En distribuciones modernas (Debian 12+, Arch Linux, RHEL 9), el sistema operativo utiliza `nftables` por defecto. Si Docker intenta comunicarse con `iptables-legacy`, se producirán desajustes. Comprueba la alternativa activa:
```bash
sudo update-alternatives --config iptables
```
Selecciona la opción recomendada para tu distribución (usualmente `iptables-nft` en sistemas actuales).

**Carga los módulos de red de Linux**
Si estás en un VPS o contenedor Proxmox (LXC), es posible que los módulos NAT del kernel no se hayan cargado automáticamente:
```bash
sudo modprobe ip_tables
sudo modprobe iptable_nat
sudo modprobe iptable_filter
```

## 🛡️ Consejos de Prevención

- **Uso de la cadena DOCKER-USER:** Nunca agregues reglas de firewall personalizadas directamente a la cadena `DOCKER`. Añádelas a la cadena `DOCKER-USER` para que no se borren en cada reinicio.
- **Configuración de daemon.json:** Puedes deshabilitar la manipulación automática de iptables en Docker (`"iptables": false` en `/etc/docker/daemon.json`) si prefieres gestionar el enrutamiento manualmente con Nginx Proxy Manager o Traefik.

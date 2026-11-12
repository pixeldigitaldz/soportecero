---
title: Cómo solucionar Error Docker Exit Code 137 y Container Killed (OOMKilled)
description: >-
  Aprende a diagnosticar y solucionar el error 137 en Docker provocado por el
  OOM Killer de Linux y límites de memoria en Docker Compose.
category: Sistemas y Servidores
tags:
  - Docker
  - Linux
  - DevOps
  - Docker Compose
readTime: 7 min
date: '2026-09-02'
---
El código de salida `Exit Code 137` en Docker indica que el contenedor fue terminado forzosamente por la señal del sistema `SIGKILL` (señal estándar 9, donde 128 + 9 = 137). En el 95% de los entornos de producción, esto ocurre cuando el proceso dentro del contenedor consume más memoria RAM de la configurada o agota la memoria del host, obligando al mecanismo **Out Of Memory (OOM) Killer** del kernel de Linux a finalizarlo para proteger la estabilidad del servidor.

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
| **Contenedor superó el límite de memoria asignado en Docker** | Aumentar `mem_limit` en `docker-compose.yml` or add swap memory to host |

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

Antes de modificar configuraciones, comprueba los metadatos de estado del contenedor:
```bash
# Inspeccionar el estado de salida y la bandera OOMKilled
docker inspect <nombre_o_id_contenedor> --format="{{.State.ExitCode}} - OOMKilled: {{.State.OOMKilled}}"
```
Si la salida devuelve `137 - OOMKilled: true`, el fallo es definitivamente por falta de memoria RAM. También puedes consultar el registro del kernel:
```bash
# Buscar registros del OOM Killer en el sistema anfitrión
sudo dmesg -T | grep -i -E "oom[- ]killer|killed process"
```

### Paso 2: Ajustar los límites de memoria en Docker Compose
Si tu servicio está definido en un archivo `docker-compose.yml`, ajusta la asignación de recursos aumentando el límite o añadiendo una reserva:
```yaml
services:
  mi-servicio:
    image: mi-app:latest
    deploy:
      resources:
        limits:
          memory: 2048M
        reservations:
          memory: 512M
    # Para sintaxis Compose v2 estándar sin modo swarm:
    mem_limit: 2g
    mem_reservation: 512m
```

### Paso 3: Optimizar el límite de memoria del runtime (Node.js / Java / Python)
Si ejecutas aplicaciones sobre máquinas virtuales o runtimes gestionados, asegúrate de que el runtime conozca los límites de memoria del contenedor:
```bash
# Para Node.js: Fijar el tamaño máximo del heap (ejemplo 1536MB en contenedor de 2GB)
NODE_OPTIONS="--max-old-space-size=1536"

# Para Java/JVM: Utilizar detección automática de memoria en cgroups
JAVA_TOOL_OPTIONS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"
```

### Paso 4: Reiniciar y monitorear el consumo de recursos en tiempo real
Aplica los cambios y comprueba las estadísticas de consumo de memoria:
```bash
# Reiniciar el stack de contenedores
docker compose up -d --force-recreate

# Monitorear el uso de memoria en vivo
docker stats --no-stream
```

## 🛡️ Consejos de Prevención

- **Configura alertas preventivas:** Utiliza herramientas de monitoreo como Prometheus + Grafana o cAdvisor para detectar fugas de memoria (memory leaks) antes de que el contenedor alcance el 100% de su límite.
- **Habilita memoria Swap segura:** En entornos de desarrollo o VPS con recursos ajustados, asegúrate de que el host disponga de memoria swap configurada para amortiguar picos repentinos de carga sin matar contenedores de inmediato.

## ❓ Preguntas Frecuentes (FAQ)

### ¿El Exit Code 137 siempre significa falta de memoria?
No necesariamente el 100% de las veces, pero sí en la inmensa mayoría. El código 137 significa que el contenedor recibió una señal `SIGKILL` (9). Esto también ocurre si ejecutas manualmente `docker kill` o si un orquestador como Kubernetes termina un pod que no respondió al periodo de gracia de terminación.

### ¿Cómo puedo evitar que Docker mate un contenedor crítico?
Puedes asignar la directiva `oom_score_adj: -500` en la configuración avanzada del contenedor para indicarle al kernel de Linux que este contenedor tiene menor prioridad de ser terminado frente a otros procesos auxiliares.

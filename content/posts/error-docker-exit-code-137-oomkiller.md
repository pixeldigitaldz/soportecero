---
title: "Cómo solucionar Error Docker Exit Code 137 y Container Killed (OOMKilled)"
description: "Aprende a diagnosticar y solucionar el error 137 en Docker provocado por el OOM Killer de Linux y límites de memoria en Docker Compose."
category: "Sistemas y Servidores"
tags: ["Docker", "Linux", "DevOps", "Docker Compose"]
readTime: "5 min"
date: "2026-09-02"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Contenedor superó el límite de memoria asignado en Docker** | Aumentar `mem_limit` en `docker-compose.yml` o añadir swap al host |
| **Proceso terminado por el kernel Linux (OOM Killer SIGKILL 9)** | Optimizar el recolector de basura de la app y verificar logs con `dmesg -T` |

El código de salida `Exit Code 137` en Docker indica que el contenedor fue terminado forzosamente por la señal del sistema `SIGKILL` (señal estándar 9, donde 128 + 9 = 137). En el 95% de los entornos de producción, esto ocurre cuando el proceso dentro del contenedor consume más memoria RAM de la configurada o agota la memoria del host, obligando al mecanismo **Out Of Memory (OOM) Killer** del kernel de Linux a finalizarlo para proteger la estabilidad del servidor.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Verificar si el contenedor fue eliminado por OOMKilled
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

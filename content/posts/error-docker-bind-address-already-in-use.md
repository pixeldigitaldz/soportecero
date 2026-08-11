---
title: 'Solución: Error starting userland proxy: bind: address already in use en Docker'
description: 'Cómo solucionar el error de puerto ocupado en Docker (address already in use) paso a paso en Linux y Windows.'
category: 'Sistemas y Servidores'
date: '2026-08-12'
readTime: '3 min'
tags: ['Docker', 'Linux', 'Redes']
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Otro servicio usa el puerto (ej. Nginx/Apache)** | Detener el servicio o cambiar el puerto en Docker (`docker-compose.yml`) |
| **Contenedor zombi reteniendo el puerto** | Reiniciar el servicio de Docker o matar el proceso |
| **Conflicto con Docker Desktop (Windows/Mac)** | Reiniciar Docker Desktop o WSL2 |

## La Solución Paso a Paso

**Encuentra qué proceso está usando el puerto**
En Linux, ejecuta el siguiente comando para ver qué aplicación está ocupando el puerto (cambia `80` por tu puerto en conflicto):
```bash
sudo netstat -tulpn | grep :80
```
O usando `lsof`:
```bash
sudo lsof -i :80
```

**Detén el servicio conflictivo**
Si descubres que Apache o Nginx están corriendo nativamente y ocupando el puerto 80, detenlos:
```bash
sudo systemctl stop apache2
sudo systemctl disable apache2
```

**Mata el proceso si es necesario**
Si es un proceso zombi, puedes matarlo usando su PID (el número que te dio el comando anterior):
```bash
sudo kill -9 <PID>
```

**Cambia el puerto en tu Docker Compose**
Si no puedes detener el servicio nativo, simplemente cambia el puerto que expone Docker editando tu `docker-compose.yml`:
```yaml
ports:
  - "8080:80" # Cambia el puerto izquierdo (host)
```
Luego vuelve a levantar el contenedor:
```bash
docker-compose up -d
```

## Prevención
- **Asignación de puertos:** Usa un proxy inverso como Traefik o Nginx Proxy Manager en los puertos 80/443 y expón el resto de contenedores de forma interna.
- **Monitoreo:** Revisa qué puertos están en uso en tu servidor antes de desplegar un nuevo stack usando `netstat` o `ss`.
- **Limpieza regular:** Ejecuta `docker system prune` para limpiar redes y contenedores huérfanos que podrían estar bloqueando recursos.

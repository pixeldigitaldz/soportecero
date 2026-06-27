---
title: "Cómo resolver el fallo de timeout al conectar Prowlarr o Radarr con indexers privados"
description: "Solución definitiva al error de conexión y tiempo de espera agotado (Timeout) entre gestores multimedia automatizados e indexers privados de torrents o Usenet."
category: "Sistemas y Servidores"
tags: ["Prowlarr", "Radarr", "Docker"]
readTime: "4 min"
date: "2026-06-26"
---

El error de `Timeout` o tiempo de espera agotado en herramientas como Prowlarr, Radarr o Sonarr ocurre cuando los gestores intentan sincronizar o realizar una búsqueda en un indexer privado y la solicitud no recibe respuesta en el tiempo límite (usualmente 30 segundos). 

Esto se debe principalmente a bloqueos por el desafío de seguridad de Cloudflare en el tracker indexer, o a problemas de resolución de nombres (DNS) dentro de la red interna de tus contenedores Docker.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Implementar FlareSolverr (Para evadir bloqueos de Cloudflare)
Si el indexer privado usa protección de Cloudflare, tus apps de automatización serán rechazadas de inmediato.
1. Levanta un contenedor de **FlareSolverr** en tu archivo Docker Compose o servidor local:
```yaml
  flaresolverr:
    image: ghcr.io/flaresolverr/flaresolverr:latest
    container_name: flaresolverr
    environment:
      - LOG_LEVEL=info
    ports:
      - 8191:8191
    restart: unless-stopped
```
2. En tu panel de Prowlarr, ve a Settings > Tags. Añade una etiqueta para FlareSolverr apuntando a tu IP local en el puerto 8191 (ej. http://192.168.1.100:8191).
3. Asigna esa misma etiqueta a la configuración del indexer que te está dando fallos.

### Paso 2: Ajustar el tiempo de espera (Timeout) en la interfaz
Si el rastreador simplemente es lento respondiendo debido a saturación, aumenta el límite por defecto en la app:
1. En Prowlarr o Radarr, ve a Settings > General.
2. Activa las opciones avanzadas (Show Advanced Options).
3. Busca el parámetro System HTTP Timeout y súbelo de 30 a 60 o 90 segundos. Guarda los cambios.

## 🛡️ Consejo de Prevención
Prácticas de seguridad recomendadas:
- Si usas una VPN para tus descargas, asegúrate de que Prowlarr y Radarr tengan rutas estáticas configuradas para no perder comunicación con la red local (LAN) de tu casa o servidor doméstico.

---
title: "Solución al error de conexión rechazada entre Prowlarr y qBittorrent en Docker"
description: "Aprende a corregir el error 'Connection Refused' configurando correctamente las redes internas de Docker para tus aplicaciones de automatización."
category: "Web y Código"
tags: ["Prowlarr", "Docker", "qBittorrent"]
readTime: "4 min"
date: "2026-07-27"
---

El error de conexión rechazada (`Connection Refused` o `Test failed: Connection refused`) al intentar vincular Prowlarr con qBittorrent en Docker ocurre porque ambos servicios corren en contenedores aislados que no comparten la misma red lógica virtual de Docker, o porque qBittorrent rechaza conexiones externas debido a una mala configuración en su API de control.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Configurar una red compartida en tu archivo Docker Compose
Si tus contenedores no pueden hablar entre sí usando sus nombres de servicio, crea una red dedicada en tu archivo `docker-compose.yml`:
```yaml
# Definir una red puente común en tu compose
networks:
  arr-network:
    driver: bridge
```
Asegura que tanto el servicio de `prowlarr` como el de `qbittorrent` tengan asignada esta red:
```yaml
services:
  prowlarr:
    ...
    networks:
      - arr-network
  qbittorrent:
    ...
    networks:
      - arr-network
```

### Paso 2: Desactivar la protección CSRF y permitir acceso local en qBittorrent
El motor de seguridad de qBittorrent bloqueará las llamadas a la API hechas desde otros contenedores dentro de la red privada si no configuras los parámetros de acceso seguro en tu cliente web:
1. Accede a la interfaz web de qBittorrent.
2. Ve a **Alt+O** (Opciones) > **WebUI**.
3. Desmarca la casilla **Habilitar protección contra falsificación de petición en sitios cruzados (CSRF)**.
4. En el campo **Evitar la autenticación de clientes en subredes locales**, ingresa la subred interna de Docker:
```plaintext
172.16.0.0/12, 192.168.0.0/16
```

### Paso 3: Utilizar el nombre del contenedor como dirección de Host
Al configurar el cliente de Torrent dentro del panel de Prowlarr, nunca utilices `localhost` o `127.0.0.1`. En su lugar, ingresa el nombre exacto del contenedor asignado en Docker:
```plaintext
Host: qbittorrent
Port: 8080
```

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
- No expongas directamente los puertos de control de la interfaz WebUI de qBittorrent o de la API de Prowlarr a Internet sin establecer una contraseña de acceso fuerte y robusta. Si deseas acceder de forma remota a estas herramientas de automatización, utiliza túneles VPN seguros (como WireGuard o Tailscale) en lugar de realizar mapeos de puertos directos en tu router de red doméstico, protegiendo tus descargas de intrusiones no autorizadas.

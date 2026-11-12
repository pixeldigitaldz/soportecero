---
title: Solución al error de conexión rechazada entre Prowlarr y qBittorrent en Docker
description: >-
  Guía técnica para solucionar el error 'Connection Refused' entre Prowlarr y qBittorrent en Docker Compose, redes bridge y stacks con Gluetun VPN.
category: Web y Código
tags:
  - Prowlarr
  - Docker
  - qBittorrent
readTime: 8 min
date: '2026-07-27'
---

Al configurar qBittorrent como cliente de descargas (Download Client) en el panel de control de Prowlarr (o aplicaciones de la suite `*arr` como Sonarr y Radarr), el botón **Test** suele arrojar el fallo:

```text
Test failed: Unable to connect to qBittorrent, Connection refused (127.0.0.1:8080)
```
o bien:
```text
Test failed: Resource temporarily unavailable (qbittorrent:8080) / Connection refused
```

Este fallo no responde habitualmente a una caída del servicio de qBittorrent, sino a una desconexión en el modelo de redes virtuales de Docker, a mecanismos de seguridad de la WebUI de qBittorrent (CSRF y validación de cabecera Host), o a arquitecturas donde el cliente torrent enruta su tráfico mediante un contenedor VPN (como Gluetun).

---

## Análisis de Arquitectura y Causa Raíz

Para resolver la conectividad entre ambos contenedores es imprescindible entender cómo gestiona Docker el direccionamiento y la resolución DNS interna:

1. **El fallo de `localhost` o `127.0.0.1` dentro de un contenedor:** Cada contenedor en Docker cuenta con su propio Network Namespace aislado. Cuando introduces `localhost:8080` dentro de la interfaz web de Prowlarr, la aplicación intenta establecer un socket TCP contra su propio espacio de red local (`lo`), donde no existe ningún servicio escuchando en el puerto 8080. La pila TCP/IP del kernel emite de inmediato un paquete TCP RST (`ECONNREFUSED`).
2. **Redes por defecto frente a redes de usuario (Bridge):** Los contenedores creados con `docker run` sin banderas de red se unen a la red `bridge` por defecto de Docker. En esta red predeterminada, el servidor DNS interno de Docker (`127.0.0.11`) **está desactivado**. Solo las redes personalizadas creadas por el usuario (o por `docker compose`) permiten la resolución de nombres de servicio (Service Discovery) mediante DNS.
3. **Mecanismos de protección de qBittorrent WebUI:** Las versiones modernas de qBittorrent incorporan protección contra ataques CSRF (*Cross-Site Request Forgery*) y validación de la cabecera HTTP `Host`. Si una petición procedente de Prowlarr incluye la cabecera `Host: qbittorrent:8080` y la protección está activa sin excepciones de subred, qBittorrent rechaza la llamada API con un código HTTP 401 o corta la conexión.
4. **Pilas de red compartidas con VPN (Gluetun):** En despliegues donde qBittorrent utiliza `network_mode: "service:gluetun"`, qBittorrent pierde su interfaz de red virtual propia (`eth0`) y comparte el namespace de red del contenedor VPN. En este caso, el nombre DNS `qbittorrent` no existe para otros contenedores en la red bridge: el tráfico debe dirigirse al nombre del servicio VPN (`gluetun`) y el puerto debe exponerse en el contenedor VPN.

---

## Entorno de Laboratorio y Diagnóstico Previo

Identifica la topología de tu entorno mediante esta matriz de diagnóstico:

| Síntoma en Prowlarr | Causa Raíz Identificada | Solución de Ingeniería |
|---|---|---|
| `Connection refused (127.0.0.1:8080)` | Uso de dirección loopback local en lugar del nombre DNS del contenedor. | Cambiar el host a `qbittorrent` o `gluetun` en la configuración de Prowlarr. |
| `Name or service not known: qbittorrent` | Los contenedores pertenecen a redes Docker distintas o la red por defecto no tiene DNS interno. | Definir una red bridge compartida (`external` o común) en `docker-compose.yml`. |
| `Connection refused` (qBittorrent bajo VPN Gluetun) | Prowlarr apunta a `qbittorrent:8080` cuando la interfaz de red le pertenece a `gluetun`. | Apuntar el host a `gluetun` y mapear el puerto `8080:8080` en el servicio Gluetun. |
| `Unauthorized / Test failed: Unauthorized` | Contraseña incorrecta o bloqueo por subred no autorizada en qBittorrent. | Configurar excepción de subred Docker en qBittorrent o verificar usuario/password. |
| `403 Forbidden` tras conexión inicial | Protección CSRF o validación de cabecera Host activa en qBittorrent WebUI. | Desactivar validación de Host y CSRF para clientes locales en `qBittorrent.conf`. |

### Comandos de Inspección de Red Docker

Ejecuta estas instrucciones en la terminal del host para verificar el estado de los contenedores y sus redes:

```bash
# 1. Comprobar a qué redes virtuales están conectados los contenedores
docker inspect -f '{{json .NetworkSettings.Networks}}' prowlarr | jq .
docker inspect -f '{{json .NetworkSettings.Networks}}' qbittorrent | jq .

# 2. Probar la resolución DNS y conectividad TCP desde dentro del contenedor de Prowlarr
docker exec -it prowlarr nc -zv qbittorrent 8080
# O utilizando curl:
docker exec -it prowlarr curl -I -m 5 http://qbittorrent:8080/api/v2/app/webapiVersion

# 3. Comprobar los puertos que están escuchando dentro del contenedor de qBittorrent
docker exec -it qbittorrent ss -tulpn
```

---

## Implementación Técnica Paso a Paso

### Paso 1: Configurar una Red Bridge Compartida en Docker Compose

Si Prowlarr y qBittorrent están definidos en el mismo archivo `docker-compose.yml`, define una red personalizada:

```yaml
version: '3.8'

services:
  qbittorrent:
    image: lscr.io/linuxserver/qbittorrent:latest
    container_name: qbittorrent
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Europe/Madrid
      - WEBUI_PORT=8080
    ports:
      - "8080:8080"
      - "6881:6881"
      - "6881:6881/udp"
    volumes:
      - ./qbittorrent/config:/config
      - /datos/torrents:/downloads
    networks:
      - arr-net
    restart: unless-stopped

  prowlarr:
    image: lscr.io/linuxserver/prowlarr:latest
    container_name: prowlarr
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Europe/Madrid
    ports:
      - "9696:9696"
    volumes:
      - ./prowlarr/config:/config
    networks:
      - arr-net
    restart: unless-stopped

networks:
  arr-net:
    name: arr-net
    driver: bridge
```

Si ejecutas los servicios en archivos compose independientes, declara la red como externa:

```bash
# Crear la red manualmente una sola vez en el host
docker network create arr-net
```

Y en cada `docker-compose.yml`:

```yaml
networks:
  arr-net:
    external: true
```

### Paso 2: Desactivar CSRF y Host Header Validation en qBittorrent

1. Abre la interfaz web de qBittorrent (`http://IP_SERVIDOR:8080`).
2. Ve a **Opciones** (icono de engranaje o `Alt+O`) > pestaña **Web UI**.
3. Localiza la sección de **Seguridad** y desmarca:
   * **Habilitar la protección contra la falsificación de petición en sitios cruzados (CSRF)**.
   * **Habilitar la validación de la cabecera Host** (Host header validation).
4. En el campo **Evitar la autenticación de clientes en subredes locales**, añade el rango de subredes internas de Docker:
   ```text
   172.16.0.0/12, 192.168.0.0/16, 10.0.0.0/8
   ```
5. Guarda los cambios. Si la WebUI no es accesible, detén el contenedor y edita directamente el archivo `qBittorrent.conf` en la carpeta montada:

```ini
[Preferences]
WebUI\CSRFProtection=false
WebUI\HostHeaderValidation=false
WebUI\LocalHostAuth=false
WebUI\AuthSubnetWhitelist=172.16.0.0/12, 192.168.0.0/16
```

### Paso 3: Configurar el Download Client en Prowlarr

1. Accede al panel web de Prowlarr (`http://IP_SERVIDOR:9696`).
2. Dirígete a **Settings** > **Download Clients** > pulsa el botón **+** y selecciona **qBittorrent**.
3. Rellena los campos con los siguientes valores exactos:
   * **Name:** `qBittorrent`
   * **Enable:** Marcado
   * **Host:** `qbittorrent` (el nombre del servicio o contenedor en Docker)
   * **Port:** `8080` (el puerto interno de la WebUI)
   * **Use SSL:** Desmarcado (a menos que hayas configurado certificados TLS inversos)
   * **Username:** Tu usuario de qBittorrent (por defecto `admin`)
   * **Password:** Tu contraseña configurada
4. Pulsa **Test**. La comprobación debe devolver una confirmación verde instantánea. Pulsa **Save**.

---

## Resolución de Casos Borde (Troubleshooting)

### Caso Borde 1: qBittorrent Enrutado a través de Gluetun VPN

Cuando qBittorrent se ejecuta tras una VPN como Gluetun, utiliza `network_mode: "service:gluetun"`. En este escenario:

1. qBittorrent **no puede tener puertos mapeados** en su bloque de servicio; los puertos deben mapearse en `gluetun`.
2. qBittorrent y Prowlarr no pueden comunicarse mediante el nombre `qbittorrent`.

**Configuración correcta en `docker-compose.yml`:**

```yaml
services:
  gluetun:
    image: qmcgaw/gluetun
    container_name: gluetun
    cap_add:
      - NET_ADMIN
    devices:
      - /dev/net/tun:/dev/net/tun
    ports:
      - "8080:8080" # WebUI de qBittorrent expuesta a través de Gluetun
      - "6881:6881"
      - "6881:6881/udp"
    environment:
      - VPN_SERVICE_PROVIDER=airvpn # O tu proveedor habitual
      - VPN_TYPE=wireguard
    networks:
      - arr-net

  qbittorrent:
    image: lscr.io/linuxserver/qbittorrent:latest
    container_name: qbittorrent
    network_mode: "service:gluetun"
    depends_on:
      - gluetun
    volumes:
      - ./qbittorrent/config:/config
      - /datos/torrents:/downloads
```

**Ajuste en Prowlarr:** En el campo **Host** del cliente de descargas en Prowlarr, escribe `gluetun` (en lugar de `qbittorrent`) con el puerto `8080`.

---

## Preguntas Frecuentes

### ¿Por qué obtengo Connection Refused si puedo abrir la WebUI desde mi navegador?
Tu navegador accede a qBittorrent desde la red física de tu hogar utilizando la IP del host y el puerto publicado (`http://192.168.1.100:8080`). Sin embargo, Prowlarr corre dentro de una red virtual aislada en Docker; si intentas usar `localhost` o la IP de red física sin una regla de enrutamiento NAT adecuada, la conexión se rechaza.

### ¿Es seguro desactivar la protección CSRF en qBittorrent?
Sí, siempre que la interfaz WebUI no esté expuesta directamente a Internet mediante apertura de puertos WAN en el router. Dentro de una red Docker privada o tras un Reverse Proxy con autenticación (como Nginx Proxy Manager, Traefik o Authelia), es una práctica habitual requerida por las APIs de automatización.

---
title: Error 502 Bad Gateway en Cloudflare Tunnel (cloudflared)
description: >-
  Guía técnica para resolver el Error 502 Bad Gateway y Unable to reach the origin service en Cloudflare Tunnel (cloudflared) con Docker, HTTPS local y Nginx.
category: Sistemas y Servidores
tags:
  - Cloudflare
  - Cloudflared
  - Docker
  - Nginx
readTime: 7 min
date: '2026-11-23'
---

El **`Error 502 Bad Gateway`** detrás de un **Cloudflare Tunnel (`cloudflared`)** —acompañado en logs por `Unable to reach the origin service` o `connection refused`— indica que el borde de Cloudflare sí logra conectarse a tu demonio `cloudflared`, pero `cloudflared` **no puede comunicarse con tu servicio local de destino**. A diferencia de un error 522 de firewall externo, aquí el fallo ocurre 100% dentro de la red local o entre contenedores Docker.

## Diagnóstico Rápido

| Causa | Solución |
|---|---|
| **`cloudflared` en Docker apuntando a `localhost` o `127.0.0.1`** | Usar el nombre del servicio Docker (ej. `http://nginx:80`) en la misma red bridge |
| **Certificado HTTPS local autofirmado rechazado (`x509`)** | Apuntar a `http://` interno o habilitar `noTLSVerify: true` en el origen |
| **El origen espera un encabezado `Host` distinto (`httpHostHeader`)** | Definir `httpHostHeader` o usar `originServerName` en la regla de *ingress* |
| **Servicio escuchando solo en IPv6 (`[::1]`) o puerto incorrecto** | Verificar socket con `ss -tulpn` y alinear puerto interno (no el mapeado en host) |

---

## Cómo Funciona el Enrutamiento en `cloudflared` y Por Qué Falla

Cuando un usuario visita tu dominio, Cloudflare enruta la petición por el túnel cifrado hasta el proceso `cloudflared` de tu servidor. A partir de ese punto, `cloudflared` actúa como un proxy inverso local y realiza una petición directa hacia la URL configurada en tu *Public Hostname* (por ejemplo `http://localhost:8080` o `https://app:443`).

Las tres causas reales del **502 Bad Gateway** en producción son:

1. **Aislamiento de red en Docker:** Si ejecutas `cloudflared` dentro de un contenedor Docker en modo `bridge`, `localhost` significa *"el propio contenedor de `cloudflared`"*, nunca tu otro contenedor ni el host.
2. **Validación estricta de TLS hacia el origen:** Si configuras el destino del túnel como `https://...` apuntando a un Nginx local, Traefik, Proxmox o Portainer con certificado autofirmado o emitido para otro nombre, `cloudflared` aborta el handshake TLS con error `x509: certificate signed by unknown authority` y devuelve `502`.
3. **Confusión entre puerto externo e interno:** En Docker Compose, si una app expone `8080:3000`, dentro de la red Docker el servicio escucha en el puerto **`3000`**, no en el `8080`.

---

## Solución Paso a Paso en Cloudflared y Docker

### Paso 1: Inspeccionar el error exacto en los logs de `cloudflared`

Antes de cambiar la configuración, lee el motivo exacto que reporta el demonio del túnel:

```bash
# Si cloudflared corre como servicio systemd en Linux:
sudo journalctl -u cloudflared -n 50 --no-pager

# Si cloudflared corre en Docker:
docker logs --tail 50 cloudflared
```

Busca líneas con `ERR` como `dial tcp 127.0.0.1:8080: connect: connection refused` (problema de red/puerto) o `remote error: tls` / `x509` (problema de certificado HTTPS local).

### Paso 2: Corregir la red Docker y usar el nombre del servicio

Si `cloudflared` está en Docker, asegúrate de que comparta una **red bridge definida por el usuario** con el contenedor de destino y apunta al **nombre del servicio + puerto interno**:

```yaml
services:
  cloudflared:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel run
    environment:
      - TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN}
    networks:
      - tunnel_net

  app:
    image: nginx:alpine
    # El puerto interno es 80; en Cloudflare Zero Trust configura: http://app:80
    networks:
      - tunnel_net

networks:
  tunnel_net:
    driver: bridge
```

En el panel de **Cloudflare Zero Trust → Networks → Tunnels → Public Hostname**, cambia la URL de origen de `http://localhost:8080` a **`http://app:80`**.

### Paso 3: Resolver fallos TLS `x509` en orígenes HTTPS locales (Proxmox, Portainer, Nginx)

Si el servicio interno exige HTTPS obligatorio (por ejemplo Proxmox en `:8006`, Portainer en `:9443` o un Nginx con SSL interno):

1. En **Cloudflare Zero Trust** (túnel gestionado desde la nube): entra al *Public Hostname* → **Additional application settings → TLS** → activa **No TLS Verify** (*Deshabilitar verificación TLS*).
2. Si gestionas el túnel con archivo local `config.yml`, añade `originRequest` con `noTLSVerify`:

```yaml
tunnel: TU-TUNNEL-ID
credentials-file: /etc/cloudflared/TU-TUNNEL-ID.json

ingress:
  - hostname: panel.tudominio.com
    service: https://127.0.0.1:8006
    originRequest:
      noTLSVerify: true
      httpHostHeader: panel.tudominio.com
  - service: http_status:404
```

Reinicia el servicio tras editar el archivo:

```bash
sudo systemctl restart cloudflared
```

### Paso 4: Verificar conectividad directa desde el mismo contexto de `cloudflared`

Comprueba que el destino responde exactamente desde donde corre `cloudflared`:

```bash
# Desde el host Linux (si cloudflared es nativo):
curl -I http://127.0.0.1:3000

# Desde otro contenedor en la misma red Docker (si cloudflared está en Docker):
docker exec cloudflared wget -qO- --spider http://app:80 && echo "OK"
```

---

## Preguntas Frecuentes

### ¿Es inseguro usar `http://` entre `cloudflared` y mi contenedor local?
No, si ambos corren dentro del mismo servidor o red privada Docker. Todo el tráfico desde el usuario hasta `cloudflared` viaja cifrado con TLS a través de la red de Cloudflare; el tramo `http://app:80` ocurre únicamente en memoria/loopback dentro de tu propia máquina y evita errores de doble cifrado o `x509`.

### ¿Por qué me da 502 si el servicio funciona al abrir `http://IP_SERVIDOR:PUERTO` en mi navegador?
Porque al abrirlo desde tu navegador usas el puerto publicado en el host (ej. `8080`), mientras que `cloudflared` dentro de Docker necesita el nombre del contenedor y su puerto interno (ej. `3000`), o porque tu app escucha en `127.0.0.1` en lugar de `0.0.0.0`.

---

## Consejo de Prevención

* Utiliza nombres de servicio explícitos en redes Docker dedicadas (`tunnel_net`) en lugar de `network_mode: host` cuando quieras mantener tus servicios aislados sin abrir puertos al exterior.
* Configura el parámetro `httpHostHeader` cuando redirijas el túnel hacia un VirtualHost de Nginx o Apache que filtre peticiones por nombre de dominio.
* Monitoriza la versión de `cloudflared` periódicamente (`cloudflared version`), ya que versiones muy antiguas pierden compatibilidad con protocolos QUIC/HTTP2 del borde de Cloudflare.

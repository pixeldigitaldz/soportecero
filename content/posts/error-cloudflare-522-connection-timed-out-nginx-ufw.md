---
title: Error 522 Cloudflare Connection Timed Out en Nginx y UFW
description: >-
  Guía técnica para diagnosticar y resolver el Error 522 (Connection Timed Out) de Cloudflare en servidores Linux con Nginx, UFW, iptables y keepalive TCP.
category: Sistemas y Servidores
tags:
  - Cloudflare
  - Nginx
  - UFW
  - Linux
readTime: 7 min
date: '2026-11-21'
---

El **`Error 522: Connection timed out`** ocurre cuando el proxy inverso de Cloudflare intenta establecer o mantener una conexión TCP hacia tu servidor de origen (generalmente en el puerto `80` o `443`) y no recibe respuesta dentro de la ventana de espera establecida. A diferencia del error 521 —donde el origen rechaza activamente el paquete con un `TCP RST`—, en un error 522 los paquetes `SYN` o la petición HTTP quedan descartados en silencio o bloqueados en cola.

## Diagnóstico Rápido

| Causa | Solución |
|---|---|
| **IPs de Cloudflare bloqueadas por UFW, iptables o Fail2Ban** | Permitir explícitamente los rangos IPv4/IPv6 oficiales de Cloudflare en el puerto `443` |
| **Saturación de `worker_connections` o `keepalive` en Nginx** | Ajustar `worker_connections`, `backlog` del kernel (`net.core.somaxconn`) y `keepalive_timeout` |
| **IP de origen desactualizada en los registros DNS de Cloudflare** | Verificar la IP pública actual con `curl -4 ifconfig.me` y actualizar el registro `A` / `AAAA` |
| **Caída o congelamiento de interfaz de red / ruta en el VPS** | Comprobar el estado del socket TCP con `ss -tulpn` y probar acceso directo saltando el proxy |

---

## Arquitectura del Handshake y Causa Raíz del Error 522

Cloudflare aplica dos umbrales estrictos de tiempo de espera (*timeouts*) al comunicarse con tu servidor de origen:

1. **Timeout de conexión TCP inicial (15 segundos):** Cuando un nodo perimetral (*edge*) de Cloudflare envía un paquete `TCP SYN` hacia tu IP de origen, espera recibir el `SYN-ACK` en menos de 15 segundos. Si un firewall con política `DROP` (como `UFW` o reglas de `iptables` / `nftables`) descarta el paquete sin responder, o si la ruta de red está saturada, el cliente recibe un `Error 522`.
2. **Timeout de respuesta HTTP / Keepalive (90 segundos):** Si la conexión TCP se establece pero tu servidor web (Nginx, Apache o un upstream en Node.js/PHP-FPM) tarda más de 90 segundos en enviar los primeros bytes de la respuesta, o cierra abruptamente una conexión `keepalive` reutilizada sin enviar un cierre limpio, Cloudflare aborta la transacción y devuelve un `522`.

### Causas más frecuentes en producción

* **Limitación de tasa (*rate limiting*) o bloqueo automático en Fail2Ban:** Si Nginx no restaura la IP real del visitante mediante `set_real_ip_from` y `real_ip_header CF-Connecting-IP`, Fail2Ban o `ngx_http_limit_req_module` ven todo el tráfico proveniente de unas pocas IPs de Cloudflare y terminan bloqueando al propio proxy de Cloudflare.
* **Agotamiento de la cola `SYN backlog` en el kernel Linux:** En picos de tráfico, si `net.core.somaxconn` y `net.ipv4.tcp_max_syn_backlog` conservan valores bajos por defecto, el kernel comienza a descartar paquetes `SYN` entrantes de Cloudflare de forma silenciosa.

---

## Solución Paso a Paso en el Servidor de Origen

### Paso 1: Verificar si el servidor responde directamente sin Cloudflare

Desde tu máquina local (o desde otro servidor externo), prueba la conexión TCP directa hacia la IP real de tu VPS simulando el encabezado `Host` de tu dominio:

```bash
curl -I --resolve soportecero.com:443:TU_IP_ORIGEN https://soportecero.com/
```

Si este comando se queda colgado y expira (*timed out*), el problema está en el firewall de red, la IP pública del DNS o el servicio web en el origen. Si responde en milisegundos con `200 OK`, el origen está sano y el bloqueo afecta específicamente a las IPs de Cloudflare.

### Paso 2: Permitir los rangos IP oficiales de Cloudflare en UFW / iptables

Asegúrate de que ningún firewall perimetral (UFW, Security Groups de AWS/OCI, o `iptables`) esté filtrando o aplicando *rate limit* a los nodos de Cloudflare. Puedes autorizar los rangos IPv4 actuales de Cloudflare en UFW:

```bash
for ip in $(curl -s https://www.cloudflare.com/ips-v4); do
  sudo ufw allow proto tcp from "$ip" to any port 80,443 comment 'Cloudflare Edge'
done
sudo ufw reload
```

Si utilizas IPv6 en tu registro `AAAA`, repite el bucle con `https://www.cloudflare.com/ips-v6`.

### Paso 3: Restaurar la IP real del cliente en Nginx (evitar falsos positivos en Fail2Ban)

Crea un archivo dedicado en `/etc/nginx/conf.d/cloudflare-realip.conf` para que Nginx registre la IP verdadera del usuario y no bloquee las IPs del proxy de Cloudflare:

```nginx
# Fragmento esencial para Nginx detrás de Cloudflare
set_real_ip_from 173.245.48.0/20;
set_real_ip_from 103.21.244.0/22;
set_real_ip_from 103.22.200.0/22;
set_real_ip_from 103.31.4.0/22;
set_real_ip_from 141.101.64.0/18;
set_real_ip_from 108.162.192.0/18;
set_real_ip_from 190.93.240.0/20;
set_real_ip_from 188.114.96.0/20;
set_real_ip_from 197.234.240.0/22;
set_real_ip_from 198.41.128.0/17;
real_ip_header CF-Connecting-IP;
```

Valida la sintaxis y recarga Nginx:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Paso 4: Ajustar `keepalive_timeout` y colas TCP del kernel

Cloudflare mantiene conexiones persistentes hacia el origen. Si `keepalive_timeout` en Nginx es demasiado bajo (por ejemplo, `5s`), puede provocar condiciones de carrera cuando Cloudflare intenta reutilizar un socket justo cuando Nginx lo está cerrando. Configura un valor saludable en `/etc/nginx/nginx.conf`:

```nginx
keepalive_timeout 75s;
keepalive_requests 1000;
```

Y amplía la cola de conexiones entrantes en `/etc/sysctl.d/99-network-tuning.conf`:

```ini
net.core.somaxconn = 4096
net.ipv4.tcp_max_syn_backlog = 4096
```

Aplica los cambios del kernel sin reiniciar:

```bash
sudo sysctl --system
```

---

## Preguntas Frecuentes

### ¿Cuál es la diferencia entre Error 521 y Error 522 en Cloudflare?
En el Error 521, el servidor de origen rechaza activamente la conexión devolviendo un paquete `TCP RST` (por ejemplo, Nginx está detenido). En el Error 522, no hay respuesta en absoluto dentro del tiempo límite de 15 segundos para el handshake TCP o 90 segundos para la respuesta HTTP, normalmente por paquetes descartados (`DROP`) en el firewall o saturación de procesos.

### ¿Desactivar el proxy (nube naranja a gris) soluciona el Error 522?
Pasar a DNS-Only (nube gris) expone la IP real de tu servidor y evita el proxy de Cloudflare, por lo que desaparecerá el mensaje 522 de Cloudflare, pero si el origen está bloqueado por firewall o saturado, el usuario seguirá experimentando un `ERR_CONNECTION_TIMED_OUT` directo en su navegador.

---

## Consejo de Prevención

* Automatiza la actualización semanal de los rangos IP de Cloudflare en tu configuración `set_real_ip_from` y reglas de firewall mediante un script en `cron`.
* Configura Cloudflare Authenticated Origin Pulls (mTLS) para aceptar tráfico únicamente desde la red de Cloudflare en el puerto `443`, evitando exponer el origen a escaneos directos.
* Monitoriza la cola de conexiones activas y descartes TCP con `ss -s` y `netstat -s | grep -i listen` ante picos de tráfico.

---
title: "Cómo solucionar el error DNS_PROBE_FINISHED_NXDOMAIN en tu red local"
description: "Aprende a resolver el fallo de resolución DNS NXDOMAIN depurando la caché de tu sistema y configurando servidores de nombres estables."
category: "Sistemas y Servidores"
tags: ["DNS", "Network", "Sysadmin"]
readTime: "4 min"
date: "2026-06-27"
---

El error de resolución de nombre `DNS_PROBE_FINISHED_NXDOMAIN` ocurre cuando el servidor DNS asignado por tu red local o proveedor de internet no puede encontrar la dirección IP asociada al dominio que intentas abrir, respondiendo que el dominio solicitado no existe.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Vaciar la caché local del resolvedor DNS en tu terminal
Tu sistema operativo almacena temporalmente las consultas previas para ahorrar ancho de banda. Si una consulta falló en el pasado, el equipo seguirá reportando el error a menos que vacíes la caché local:
```bash
# En Linux (utilizando systemd-resolved)
sudo resolvectl flush-caches

# Verificar el estado de la caché DNS activa
resolvectl statistics
```

### Paso 2: Forzar servidores de nombres públicos estables (Google / Cloudflare)
Si el resolvedor de tu proveedor de red local es inestable, edita los resolvedores de tu máquina. En sistemas Linux con red estática, modifica `/etc/resolv.conf`:
```bash
sudo nano /etc/resolv.conf
```
Asegura que contenga únicamente resolvedores rápidos de confianza:
```plaintext
nameserver 1.1.1.1
nameserver 8.8.8.8
```

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
- No utilices resolvedores DNS inestables o sin cifrado para gestionar la comunicación interna de servidores productivos. En redes locales híbridas, mantén una política de tiempos de vida cortos (TTL bajos de 300 o 600 segundos) para tus registros NS. Esto asegura que si realizas cambios de IP o migraciones de dominio, los enrutadores de los clientes borren la información desactualizada de forma automática y no mantengan enrutamientos rotos que disparen el error NXDOMAIN a tus usuarios.

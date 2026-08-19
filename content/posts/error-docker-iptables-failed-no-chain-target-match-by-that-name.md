---
title: 'Error iptables failed: No chain/target/match by that name en Docker'
description: 'Cómo solucionar el error de red iptables failed No chain target match by that name al iniciar contenedores de Docker tras reiniciar el firewall o UFW.'
category: 'Sistemas y Servidores'
date: '2026-08-23'
readTime: '3 min'
tags: ['Docker', 'Linux', 'Redes']
---

El error `iptables failed: iptables --wait -t nat -A DOCKER ... No chain/target/match by that name` se produce cuando el cortafuegos del sistema (UFW, Firewalld o iptables) se reinicia o recarga mientras el daemon de Docker está activo, eliminando las cadenas nativas `DOCKER` y `DOCKER-USER` de la tabla NAT.

Al intentar mapear puertos de red en un nuevo contenedor (`-p 8080:80`), Docker falla porque no encuentra la infraestructura de enrutamiento necesaria.

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Reinicio de UFW o Firewalld después de Docker** | Reiniciar el servicio de Docker (`sudo systemctl restart docker`) |
| **Conflicto entre iptables heredado y nftables** | Configurar Docker o el sistema para usar `iptables-legacy` o un backend coherente |
| **Módulos de kernel iptables no cargados** | Cargar los módulos con `sudo modprobe ip_tables && sudo modprobe iptable_nat` |

## La Solución Paso a Paso

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

## Prevención
- **Uso de la cadena DOCKER-USER:** Nunca agregues reglas de firewall personalizadas directamente a la cadena `DOCKER`. Añádelas a la cadena `DOCKER-USER` para que no se borren en cada reinicio.
- **Configuración de daemon.json:** Puedes deshabilitar la manipulación automática de iptables en Docker (`"iptables": false` en `/etc/docker/daemon.json`) si prefieres gestionar el enrutamiento manualmente con Nginx Proxy Manager o Traefik.

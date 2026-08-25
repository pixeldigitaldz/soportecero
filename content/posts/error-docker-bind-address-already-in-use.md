---
title: "Error: Error starting userland proxy: bind: address already in use en Docker"
description: "Aprende a identificar y terminar procesos que ocupan puertos en conflicto (80, 443, 3000, 8080) en Linux y Docker Compose."
category: "Sistemas y Servidores"
tags: ["Docker", "Linux", "Puertos", "SysAdmin", "Networking", "DevOps"]
readTime: "5 min"
date: "2026-06-25"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Otro servicio en el host (como Nginx, Apache o Node.js) ya está escuchando en el puerto requerido** | Identificar el PID con `sudo lsof -i :<puerto>` o `ss -tulpn` y detener el proceso en conflicto |
| **Un contenedor Docker huérfano o en segundo plano sigue reteniendo el puerto en iptables** | Detener el contenedor antiguo con `docker stop <id>` o reiniciar el daemon `systemctl restart docker` |

Al iniciar un contenedor mediante `docker run` o `docker compose up`, el error `driver failed programming external connectivity on endpoint ...: Error starting userland proxy: listen tcp 0.0.0.0:80: bind: address already in use` indica que el puerto de red solicitado en el sistema anfitrión ya está reservado por otro proceso activo.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Localizar qué proceso está utilizando el puerto en conflicto
Utiliza herramientas de red de Linux para descubrir el Process ID (PID) exacto del servicio bloqueante:
```bash
# Opción 1: Usando lsof (ejemplo para puerto 80 u 8080)
sudo lsof -i :80

# Opción 2: Usando ss (Socket Statistics)
sudo ss -tulpn | grep :80
```

### Paso 2: Detener el servicio o proceso del sistema operativo
Si el puerto está ocupado por un servidor web instalado en el sistema anfitrión:
```bash
# Si es Apache o Nginx en el host:
sudo systemctl stop nginx
sudo systemctl stop apache2

# Si es un proceso genérico, finalízalo mediante su PID:
sudo kill -15 <PID>
# Si no responde de inmediato:
sudo kill -9 <PID>
```

### Paso 3: Identificar contenedores Docker ocultos reteniendo el puerto
A menudo un contenedor anterior se quedó en estado detached o en bucle de reinicio:
```bash
# Listar todos los contenedores (incluyendo detenidos)
docker ps -a --filter "publish=80"

# Detener y eliminar el contenedor en conflicto
docker stop <container_id>
docker rm <container_id>
```

### Paso 4: Cambiar el puerto en el mapeo de docker-compose.yml
Si necesitas que ambos servicios coexistan, cambia el puerto del host en tu archivo de composición:
```yaml
services:
  mi-aplicacion:
    image: nginx:alpine
    ports:
      # Mapear el puerto 8080 del host al puerto 80 interno del contenedor
      - "8080:80"
    restart: unless-stopped
```

## 🛡️ Consejos de Prevención
- **Evita exponer puertos innecesarios al host:** Si utilizas redes Docker internas (`networks`), comunícate entre contenedores usando sus nombres de servicio sin mapear puertos a `0.0.0.0`.
- **Comprueba antes de desplegar:** En scripts de automatización CI/CD, añade una comprobación previa con `nc -zv localhost <puerto>`.

## ❓ Preguntas Frecuentes (FAQ)

### ¿Por qué lsof no muestra nada pero Docker sigue dando error de bind?
A veces el módulo `docker-proxy` en iptables queda desincronizado tras un cuelgue del sistema. Reiniciar el daemon de Docker (`sudo systemctl restart docker`) limpia las tablas NAT huérfanas.

### ¿Puedo enlazar dos contenedores al mismo puerto interno?
Sí. Cada contenedor tiene su propia pila de red aislada. Lo que no puedes hacer es mapear ambos al mismo puerto de la máquina host.

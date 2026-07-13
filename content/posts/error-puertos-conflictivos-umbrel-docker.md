---
title: "Cómo solucionar conflictos de puertos ocupados en Docker dentro de Umbrel OS"
description: "Aprende a resolver el error de puerto ocupado al instalar contenedores o servicios personalizados que colisionan con el proxy web de Umbrel."
category: "Sistemas y Servidores"
tags: ["Docker", "Umbrel", "Sysadmin"]
readTime: "4 min"
date: "2026-08-01"
---

El error de puerto ya asignado (`bind: address already in use` o `port already allocated`) al intentar levantar un contenedor personalizado en Umbrel OS ocurre porque el proxy web interno de la plataforma (basado en Nginx o Traefik) ya tiene reservado el puerto 80 y 443 para gestionar la tienda de aplicaciones y el acceso seguro a su panel.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Localizar qué contenedor o proceso está ocupando el puerto
Antes de modificar cualquier compose, identifica de manera precisa qué servicio está acaparando el puerto del sistema mediante la consola SSH de tu Umbrel:
```bash
# Buscar el proceso y puerto en conflicto (por ejemplo, el puerto 80)
sudo lsof -i :80

# Listar todos los puertos mapeados por contenedores activos de Docker
docker ps --format "table {{.ID}}\t{{.Names}}\t{{.Ports}}"
```

### Paso 2: Modificar el mapeo en tu archivo docker-compose.yml
Nunca intentes desinstalar o matar los procesos del panel nativo de Umbrel. En su lugar, edita el archivo de configuración del contenedor que deseas instalar y reasigna su puerto externo a uno que esté libre (por ejemplo, cambia del puerto `80:80` a `8085:80`):
```yaml
services:
  app-custom:
    image: nginx:alpine
    ports:
      # Mapear el puerto libre 8085 del host al puerto 80 interno del contenedor
      - "8085:80"
```

### Paso 3: Reiniciar el contenedor modificado
Aplica los cambios recreando la estructura del contenedor en tu servidor:
```bash
# Apagar y volver a levantar el contenedor de forma aislada
docker compose down && docker compose up -d
```

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
- Evita alterar directamente la red principal de Docker del sistema de Umbrel (`docker0` o la red host nativa) al instalar aplicaciones personalizadas de terceros. Siempre declara redes de tipo puente (`bridge`) aisladas dentro de tus archivos Compose. Esto previene colisiones accidentales de puertos y de asignación de DNS internas, manteniendo los servicios críticos de tu nodo de Bitcoin o suite de almacenamiento web completamente seguros y operativos.

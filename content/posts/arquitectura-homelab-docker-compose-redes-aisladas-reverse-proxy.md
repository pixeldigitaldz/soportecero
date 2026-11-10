---
title: "Guía de Arquitectura en Producción: Cómo Aislar Contenedores en Docker Compose con Redes Internas, Límites de Recursos y Reverse Proxy Seguro"
description: "Aprende a diseñar una arquitectura de red multicapa segura en Docker Compose. Aísla bases de datos sin acceso a Internet con redes internas, configura reverse proxies Nginx y previene fugas de puertos por bypass de iptables."
category: "Sistemas y Servidores"
tags:
  - Docker
  - DevOps
  - Sysadmin
  - Seguridad
  - Linux
  - Nginx
readTime: "9 min"
date: "2026-11-08"
---

En infraestructuras modernas de servidores locales (*homelabs*) y entornos de producción basados en contenedores, **Docker Compose** se ha consolidado como el estándar *de facto* para la orquestación declarativa de servicios. Sin embargo, la gran mayoría de despliegues cometen un error crítico de seguridad arquitectónica: confiar en la configuración por defecto de redes bridge (`bridge network`) y publicar puertos arbitrarios en `0.0.0.0` mediante la directiva `ports: - "3306:3306"` o `ports: - "5432:5432"`.

Este enfoque expone directamente sockets de bases de datos, paneles de administración interna y colas de mensajes a toda la red de área local o, peor aún, a la Internet pública, ignorando las reglas de cortafuegos convencionales del host. Para blindar un entorno profesional, es imprescindible diseñar una **topología de red multicapa segregada** donde cada contenedor tenga acceso estrictamente al principio de mínimo privilegio de red.

## Análisis de Arquitectura y Causa Raíz

Para comprender por qué los contenedores quedan vulnerables por omisión en Docker, debemos analizar cómo interactúa el demonio `dockerd` con el subsistema de red del kernel de Linux:

1. **El peligroso Bypass de Netfilter e Iptables:** Cuando instalas Docker en una distribución Linux (como Debian, Ubuntu o Rocky Linux) y habilitas un firewall local como `UFW` (Uncomplicated Firewall) o `firewalld`, asumes que ejecutar `ufw default deny incoming` bloquea cualquier conexión entrante que no haya sido autorizada explícitamente. **Esto es una falsa sensación de seguridad**. Por diseño, el demonio de Docker inyecta sus propias cadenas de enrutamiento (`DOCKER`, `DOCKER-USER` y `DOCKER-ISOLATION-STAGE-1`) en la tabla `nat` de iptables antes de que las reglas de UFW sean evaluadas. En consecuencia, si expones un puerto con `- "8080:8080"`, Docker crea una regla `DNAT` (Destination Network Address Translation) en el kernel que redirige los paquetes TCP directamente al contenedor, sorteando completamente las restricciones de UFW.
2. **Topología de red plana vs. Redes de Cero Confianza (*Zero Trust*):** En una red bridge predeterminada (`default bridge`), todos los contenedores adjuntos comparten la misma interfaz virtual (ej. `docker0`) y pueden comunicarse entre sí sin restricciones a través de sus direcciones IP internas. Si un atacante compromete un contenedor frontend (como un CMS vulnerable o una API web expuesta), obtiene de inmediato conectividad directa por sockets TCP hacia la base de datos o el almacenamiento en caché de Redis, permitiendo el movimiento lateral sin resistencia.
3. **Mapeo Macvlan frente a Subredes Internas Aisladas:** Mientras que los controladores **Macvlan** asignan una dirección MAC física independiente a cada contenedor para que aparezca como un dispositivo físico en la LAN corporativa (ideal para servicios como Pi-hole, AdGuard Home o servidores DHCP que requieren interactuar a nivel de Capa 2), las aplicaciones web multicapa requieren lo opuesto: subredes virtuales aisladas mediante el parámetro `internal: true`. Una red definida con `internal: true` no asigna una puerta de enlace (*default gateway*) hacia la interfaz física del host, impidiendo que los contenedores allí confinados puedan iniciar o recibir tráfico fuera del daemon de Docker, neutralizando de raíz ataques de exfiltración de datos.

## Entorno de Laboratorio y Diagnóstico

Antes de implementar una arquitectura multicapa, debemos auditar las tablas de enrutamiento y comprobar qué contenedores y puertos están expuestos en interfaces externas:

| Síntoma de Exposición | Capa de Red Afectada | Causa Raíz Identificada | Acción Correctiva Inmediata |
|---|---|---|---|
| Puerto de base de datos visible desde hosts remotos de la LAN | Netfilter / Iptables NAT | Directiva `ports:` publicando en `0.0.0.0` sin restricción de interfaz | Sustituir `ports:` por `expose:` y confinar el contenedor en una red `internal: true` |
| Bypass silencioso de reglas en UFW | Cadenas de Docker en Kernel | Docker antepone su cadena `PREROUTING` a la tabla `INPUT` de UFW | Enrutar el tráfico exclusivamente a través de un Reverse Proxy Nginx o Traefik |
| Fallo de resolución DNS interno entre contenedores | Docker Embedded DNS (127.0.0.11) | Contenedores vinculados a la red `default bridge` en lugar de una red definida por el usuario | Crear redes personalizadas en Compose con asignación de alias de servicio |
| Exfiltración de datos por contenedores backend comprometidos | Enrutamiento IP saliente | La red del backend cuenta con gateway hacia Internet | Activar `internal: true` en la subred de almacenamiento y persistencia |

Ejecuta los siguientes comandos en la terminal del host para diagnosticar la exposición actual:

```bash
# 1. Comprobar qué sockets de contenedores están escuchando en todas las interfaces de red (0.0.0.0)
sudo ss -tulpn | grep -E ':(docker-proxy|3306|5432|6379|8080)'

# 2. Auditar las cadenas activas inyectadas por Docker en iptables
sudo iptables -t nat -L DOCKER -n -v --line-numbers

# 3. Inspeccionar el aislamiento de una red de Docker existente
docker network inspect bridge --format '{{json .IPAM.Config}}'
```

- El comando `ss` con los modificadores `-t` (TCP), `-u` (UDP), `-l` (listening), `-p` (mostrar programas y PIDs) y `-n` (numérico) revela de inmediato si el proceso `docker-proxy` está publicando puertos confidenciales en interfaces públicas.
- El comando `iptables -t nat -L DOCKER` desglosa las reglas de reenvío `DNAT` en memoria, permitiéndote comprobar si peticiones dirigidas a tu IP pública son transferidas a contenedores sin control previo.

## Implementación Técnica Paso a Paso

Diseñaremos una arquitectura industrial de 3 capas segregadas:
1. **`frontend_net`**: Subred puente para el Reverse Proxy Nginx y la interfaz web pública.
2. **`backend_internal`**: Subred con `internal: true`. Contiene la base de datos PostgreSQL y el servicio Redis. No tiene salida a Internet ni visibilidad externa.
3. **`monitoring_net`**: Subred dedicada para métricas de Prometheus y Node Exporter.

### Paso 1: Crear la estructura del proyecto y configurar el archivo docker-compose.yml

Crea el directorio de trabajo seguro y define el archivo de orquestación:

```bash
# Crear directorio de trabajo con permisos restringidos
sudo mkdir -p /opt/homelab-secure && cd /opt/homelab-secure
sudo chmod 750 /opt/homelab-secure
```

Abre o crea el archivo `docker-compose.yml`:

```yaml
version: '3.8'

# Definición de Servicios Multicapa
services:

  # Capa 1: Reverse Proxy Seguro de Entrada (Nginx)
  reverse-proxy:
    image: nginx:1.25-alpine
    container_name: production_proxy
    restart: unless-stopped
    ports:
      # Único servicio con puertos publicados al exterior (HTTP/HTTPS)
      - "80:80"
      - "443:443"
    volumes:
      - ./proxy/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./proxy/certs:/etc/ssl/certs:ro
    networks:
      - frontend_net
    deploy:
      resources:
        limits:
          cpus: '0.50'
          memory: 256M
    healthcheck:
      test: ["CMD-SHELL", "wget -q --spider http://127.0.0.1/health || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 10s

  # Capa 2: Backend de Aplicación (API interna)
  api-service:
    image: node:20-alpine
    container_name: production_api
    restart: unless-stopped
    working_dir: /app
    environment:
      - NODE_ENV=production
      - DB_HOST=db-postgres
      - DB_PORT=5432
      - DB_NAME=app_production
      - DB_USER=app_user
      - DB_PASSWORD_FILE=/run/secrets/db_password
    expose:
      # Expuesto solo a nivel de red interna de Docker, sin binding en host
      - "3000"
    networks:
      - frontend_net      # Comunicación con el Reverse Proxy
      - backend_internal  # Comunicación segura con PostgreSQL y Redis
    deploy:
      resources:
        limits:
          cpus: '1.00'
          memory: 512M
    healthcheck:
      test: ["CMD", "nc", "-z", "127.0.0.1", "3000"]
      interval: 20s
      timeout: 5s
      retries: 3
      start_period: 15s

  # Capa 3: Persistencia y Base de Datos (Completamente Aislada)
  db-postgres:
    image: postgres:16-alpine
    container_name: production_postgres
    restart: unless-stopped
    environment:
      - POSTGRES_DB=app_production
      - POSTGRES_USER=app_user
      - POSTGRES_PASSWORD=SuperSecretPasswordSecure_2026!
      - PGDATA=/var/lib/postgresql/data/pgdata
    expose:
      - "5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      # Conectado ÚNICAMENTE a la red interna sin gateway ni acceso a Internet
      - backend_internal
    deploy:
      resources:
        limits:
          cpus: '1.50'
          memory: 1024M
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app_user -d app_production"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 20s

# Segmentación de Redes Declarativas
networks:
  frontend_net:
    driver: bridge
    ipam:
      driver: default
      config:
        - subnet: 172.28.10.0/24
          gateway: 172.28.10.1

  backend_internal:
    driver: bridge
    internal: true # BLOQUEO TOTAL DE ACCESO A INTERNET Y RED EXTERNA
    ipam:
      driver: default
      config:
        - subnet: 172.28.20.0/24

volumes:
  postgres_data:
    driver: local
```

### Paso 2: Análisis técnico de parámetros y directivas clave

- `internal: true`: Esta directiva en `backend_internal` instruye al motor de Docker a omitir la creación de una regla de enrutamiento hacia la interfaz por defecto del host. Los contenedores en esta red pueden comunicarse entre sí a través de sus direcciones IP privadas o nombres de servicio, pero cualquier intento de conexión TCP/UDP saliente hacia Internet fallará de inmediato a nivel de socket (`Network is unreachable`).
- `expose:` vs `ports:`: Al usar `expose: - "5432"` en lugar de `ports: - "5432:5432"`, PostgreSQL no es vinculado al demonio `docker-proxy` en la máquina anfitriona. Solo los contenedores que compartan explícitamente la red `backend_internal` (en este caso `api-service`) podrán iniciar conexiones hacia el puerto 5432.
- `deploy.resources.limits`: Protege al servidor host contra ataques de denegación de servicio internos o fugas de memoria (*memory leaks*), evitando que un servicio descontrolado active el OOM-Killer general del sistema.
- `healthcheck`: Garantiza que Docker monitorice activamente el estado operativo del proceso antes de enrutar tráfico.

### Paso 3: Configurar el bloque de Reverse Proxy en Nginx

Crea el archivo de configuración de Nginx `/opt/homelab-secure/proxy/nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    # Ocultar firmas de versión para mitigar escaneos de vulnerabilidades
    server_tokens off;

    # Dimensionamiento de buffers para peticiones seguras
    client_max_body_size 16M;
    proxy_buffer_size 128k;
    proxy_buffers 4 256k;
    proxy_busy_buffers_size 256k;

    # Enrutamiento hacia la API interna
    upstream backend_nodes {
        # Resolución DNS automática por el embedded DNS de Docker (127.0.0.11)
        server api-service:3000 max_fails=3 fail_timeout=10s;
        keepalive 32;
    }

    server {
        listen 80;
        server_name homelab.local;

        # Endpoint de salud para healthchecks de Docker
        location /health {
            access_log off;
            return 200 "healthy\n";
        }

        location / {
            proxy_pass http://backend_nodes;
            proxy_http_version 1.1;
            
            # Encabezados de seguridad y transporte
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # Timeouts defensivos
            proxy_connect_timeout 10s;
            proxy_read_timeout 60s;
            proxy_send_timeout 60s;
        }
    }
}
```

### Paso 4: Despliegue y validación de conectividad estricta

Inicia el stack completo en segundo plano:

```bash
docker compose up -d
```

Verifica que todos los contenedores alcancen el estado `healthy`:

```bash
docker compose ps
```

## Resolución de Casos Borde (Troubleshooting)

### Caso Borde 1: Fallo de resolución DNS interno en redes con `internal: true`

En ocasiones, tras arrancar un contenedor en una red `internal: true`, la aplicación lanza errores del tipo `getaddrinfo ENOTFOUND db-postgres`. Esto ocurre cuando la aplicación intenta consultar un servidor DNS externo (como `8.8.8.8` o el DNS corporativo de la máquina anfitriona) en lugar de consultar el servidor DNS embebido de Docker (`127.0.0.11`).

Para resolver y verificar la resolución de nombres entre contenedores:

```bash
# Ejecutar un ping por nombre de servicio desde la API hacia la base de datos
docker compose exec api-service ping -c 3 db-postgres

# Inspeccionar el archivo /etc/resolv.conf inyectado en el contenedor
docker compose exec api-service cat /etc/resolv.conf
```

Asegúrate de que la primera línea de `/etc/resolv.conf` dentro del contenedor sea `nameserver 127.0.0.11`. En Docker Compose, los nombres de los servicios definidos en el archivo YAML se registran automáticamente como registros A en este servidor DNS local.

### Caso Borde 2: Necesidad de ejecutar actualizaciones o migraciones en contenedores aislados

Dado que la red `backend_internal` tiene `internal: true`, si ejecutas comandos dentro de `production_postgres` como `apk update` o intentas descargar extensiones desde Internet, la conexión fallará. 

La práctica correcta en entornos de producción consiste en:
1. Construir imágenes personalizadas (*custom Dockerfiles*) con todas las extensiones empaquetadas previamente.
2. Si un contenedor necesita realizar migraciones que descargan librerías remotas temporalmente, vincúlalo a una red con salida a Internet durante el inicio del build y retíralo antes de pasar a producción.

### Verificación de Logs en Tiempo Real y Blindaje

Para confirmar que no existan puertos filtrados ni fugas de red:

```bash
# 1. Verificar que la base de datos no tenga salida a Internet
docker compose exec db-postgres wget -q --spider --timeout=3 https://google.com || echo "Aislamiento Exitoso: Sin acceso exterior"

# 2. Auditar los registros de Nginx ante intentos de acceso no autorizados
docker compose logs -f reverse-proxy | grep -E "(error|warn|403|404)"

# 3. Comprobar el aislamiento de red detallado en formato JSON
docker network inspect homelab-secure_backend_internal --format '{{json .Containers}}'
```

Si gestionas infraestructuras para clientes o presupuestas servicios de securización y hardening de servidores, recuerda estimar con precisión el tiempo de diseño de arquitectura y mitigación de riesgos calculando tus honorarios profesionales en nuestra [Calculadora de Tarifa Hora Freelance](/tools/tarifa-hora-freelance.html).

## 🛡️ Consejos de Prevención

- **Nunca uses `0.0.0.0` para bases de datos:** Si requieres administrar una base de datos remotamente desde tu ordenador local, no abras el puerto al exterior; conéctate mediante un túnel SSH seguro (`ssh -L 5432:localhost:5432 usuario@servidor`).
- **Implementa secretos de Docker (*Docker Secrets*):** Evita declarar contraseñas en texto plano dentro de la directiva `environment:`. Utiliza archivos protegidos con permisos `600` referenciados mediante `secrets:`.
- **Audita periódicamente las cadenas de iptables:** Tras cualquier actualización de UFW o reinicio del servicio de Docker, ejecuta `sudo iptables -L DOCKER-USER -n -v` para confirmar que tus políticas de filtrado perimetral continúen vigentes.

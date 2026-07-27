---
title: >-
  Cómo solucionar el error OOM command not allowed cuando Redis alcanza la
  memoria máxima
description: >-
  Guía técnica para solucionar el error OOM (Out Of Memory) en Redis
  configurando políticas de desalojo (maxmemory-policy) y optimizando el uso de
  RAM.
category: Sistemas y Servidores
tags:
  - Redis
  - Databases
  - Sysadmin
readTime: 4 min
date: '2026-07-27'
---

El error `OOM command not allowed when used memory > 'maxmemory'` ocurre en instancias de Redis cuando el uso de memoria RAM alcanza el límite estipulado en el parámetro `maxmemory` y la política de desalojo (*eviction policy*) por defecto está configurada como `noeviction`. Bajo estas condiciones, Redis rechaza cualquier comando que intente agregar o modificar datos (`SET`, `HSET`, `LPUSH`), respondiendo con una excepción de falta de memoria (*Out of Memory*).

## 🔍 El Diagnóstico Rápido

| Síntoma | Causa Raíz | Solución |
| :--- | :--- | :--- |
| Comandos de escritura fallan con `OOM command not allowed` | La memoria alcanzó el límite `maxmemory` bajo la política por defecto `noeviction` | Configurar una política de desalojo automática (`allkeys-lru` o `volatile-lru`) o aumentar `maxmemory` |
| El proceso de Redis es eliminado por el Kernel (*Linux OOM Killer*) | El archivo `redis.conf` no define un límite `maxmemory`, consumiendo toda la RAM del host | Establecer un tope en `maxmemory` equivalente al 70-80% de la RAM del servidor |
| Alto ratio de fragmentación de memoria (`mem_fragmentation_ratio > 1.5`) | El asignador de memoria Jemalloc conserva páginas liberadas tras borrar claves masivas | Habilitar la desfragmentación activa en Redis (`activedefrag yes`) |

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Diagnosticar el estado de memoria en Redis CLI
Conéctate a tu instancia de Redis y ejecuta el comando de información de memoria para auditar la memoria consumida y la política actual:

```bash
# Conectar mediante redis-cli
redis-cli -h 127.0.0.1 -p 6379

# Consultar métricas de memoria
127.0.0.1:6379> INFO memory

# Salida relevante a verificar:
# used_memory_human:1.95G
# maxmemory_human:2.00G
# maxmemory_policy:noeviction
```

### Paso 2: Cambiar la política de desalojo (`maxmemory-policy`) en caliente
Para restaurar el servicio inmediatamente sin reiniciar el servidor Redis, aplica una política de desalojo (*eviction policy*) en tiempo de ejecución:

```bash
# Configurar la política para desahuciar las claves menos utilizadas (LRU)
127.0.0.1:6379> CONFIG SET maxmemory-policy allkeys-lru

# Opcional: Aumentar el límite de memoria asignada a la instancia si dispones de RAM libre
127.0.0.1:6379> CONFIG SET maxmemory 3gb
```

Las políticas principales de desalojo disponibles son:
- **`allkeys-lru`**: Elimina las claves menos recientemente usadas (*Least Recently Used*) entre todos los registros. Ideal para caché web.
- **`volatile-lru`**: Elimina solo las claves que tienen un tiempo de expiración (TTL) configurado.
- **`allkeys-lfu`**: Elimina las claves usadas con menor frecuencia (*Least Frequently Used*).
- **`noeviction`**: Retorna error en comandos de escritura (comportamiento predeterminado).

### Paso 3: Persistir los cambios en la configuración (`redis.conf`)
Para evitar que los ajustes se pierdan al reiniciar la instancia o el contenedor Docker, actualiza el archivo de configuración principal de Redis:

```ini
# En /etc/redis/redis.conf o redis.conf del contenedor:

# Límite máximo de memoria (ejemplo: 2 Gigabytes)
maxmemory 2048mb

# Política de desalojo recomendada para cachés de producción
maxmemory-policy allkeys-lru

# Activar la desfragmentación automática en segundo plano
activedefrag yes
```

Guarda los cambios y aplica una relectura limpia o reinicio del servicio:
```bash
sudo systemctl restart redis-server
```

## 🛡️ Consejos de Prevención

Prácticas de seguridad recomendadas:
- **Asigna siempre un TTL a las claves de caché**: Asegúrate de que las operaciones de guardado en el código de tu aplicación especifiquen expiración (`SET key value EX 3600`) para permitir la limpieza natural de registros vetustos.
- **Escanea claves pesadas periódicamente**: Utiliza la herramienta de línea de comandos para identificar claves de datos sobredimensionadas: `redis-cli --bigkeys` o `redis-cli --memkeys`.
- **Establece alertas de monitoreo**: Configura métricas en Prometheus/Grafana o Datadog para recibir notificaciones cuando `used_memory` supere el 85% de `maxmemory`.

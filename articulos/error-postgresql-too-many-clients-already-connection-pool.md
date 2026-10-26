---
title: 'Cómo resolver FATAL: sorry, too many clients already en PostgreSQL y Node.js'
description: 'Aprende a diagnosticar y solucionar el agotamiento de conexiones en PostgreSQL max_connections utilizando Connection Pooling con PgBouncer o Prisma.'
category: 'Web y Código'
date: '2026-08-24'
readTime: '3 min'
tags: ['PostgreSQL', 'Node.js', 'Databases']
---

El error `FATAL: sorry, too many clients already` en PostgreSQL ocurre cuando el número de conexiones simultáneas abiertas hacia el servidor de base de datos supera el límite configurado en la directiva `max_connections` (que por defecto suele ser 100 en instancias estándar).

En entornos web modernos con Node.js, Next.js, microservicios o arquitecturas Serverless (AWS Lambda, Vercel), abrir conexiones directas en cada solicitud sin un gestor de pool satura rápidamente la memoria del motor PostgreSQL.

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Conexiones abiertas sin cerrar (`connection leaks`)** | Asegurar que cada cliente de base de datos ejecute `client.release()` o termine en bloques `finally` |
| **Arquitectura Serverless abriendo conexiones por cada invocación** | Implementar un Connection Pooler intermedio como **PgBouncer** o **Prisma Accelerate / Supabase Pooler** |
| **Límite `max_connections` insuficiente para el servidor** | Incrementar `max_connections` en `postgresql.conf` si el servidor dispone de memoria RAM suficiente |

## La Solución Paso a Paso

**Inspecciona las conexiones activas e inactivas en tiempo real**
Conéctate a PostgreSQL con `psql` y consulta el estado de las sesiones para identificar qué aplicación está reteniendo las conexiones:
```sql
SELECT state, count(*) 
FROM pg_stat_activity 
GROUP BY state;
```
Para ver qué consultas o usuarios están consumiendo más conexiones:
```sql
SELECT pid, usename, client_addr, state, query_start, query 
FROM pg_stat_activity 
WHERE state != 'idle' 
ORDER BY query_start DESC;
```

**Termina conexiones colgadas de emergencia**
Si necesitas recuperar el acceso al servidor inmediatamente para labores de mantenimiento:
```sql
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'idle' AND pid <> pg_backend_pid();
```

**Configura correctamente un Connection Pool en Node.js (pg / pg-pool)**
Nunca instancies un nuevo `new Client()` en cada ruta o solicitud de tu API. Usa un `Pool` global compartido:
```javascript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Máximo 20 conexiones simultáneas por instancia
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function query(text, params) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release(); // Vital: liberar la conexión de vuelta al pool
  }
}
```

**Aumenta el límite de `max_connections` en el servidor**
Si tu servidor cuenta con hardware potente (más de 8 GB de RAM), edita `/etc/postgresql/16/main/postgresql.conf`:
```ini
max_connections = 250
shared_buffers = 2GB
```
Aplica los cambios reiniciando el servicio:
```bash
sudo systemctl restart postgresql
```

## Prevención
- **Uso obligatorio de PgBouncer:** En producción con alto tráfico, coloca PgBouncer en modo `transaction pooling` delante de PostgreSQL. Esto permite gestionar más de 10,000 conexiones concurrentes consumiendo únicamente 50 conexiones reales en la base de datos.
- **Monitoreo de métricas:** Configura alertas en Prometheus o Datadog cuando las conexiones superen el 80% del valor de `max_connections`.

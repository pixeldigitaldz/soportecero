---
title: 'How to solve FATAL: sorry, too many clients already in PostgreSQL and Node.js'
description: 'Learn how to diagnose and fix connection pool exhaustion in PostgreSQL max_connections using PgBouncer and connection pooling in Node.js.'
category: 'Web & Code'
date: '2026-08-24'
readTime: '3 min'
tags: ['PostgreSQL', 'Node.js', 'Databases']
---

The error `FATAL: sorry, too many clients already` in PostgreSQL occurs when the number of active and idle client connections exceeds the limit configured in the `max_connections` parameter (which defaults to 100 on standard PostgreSQL server installations).

In modern web stacks using Node.js, Next.js, or Serverless functions (AWS Lambda, Vercel), instantiating direct database clients on every HTTP request rapidly exhausts the database process pool and memory.

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Unclosed connection leaks** | Always invoke `client.release()` inside `finally` blocks when using client checkouts |
| **Serverless functions spawning unpooled connections** | Implement a centralized Connection Pooler such as **PgBouncer** or **Supabase / Prisma Pooler** |
| **`max_connections` limit set too low for hardware** | Increase `max_connections` in `postgresql.conf` if the server has sufficient RAM |

## Step-by-Step Solution

**Inspect active and idle connection distribution**
Connect to PostgreSQL using `psql` and execute the following diagnostic query:
```sql
SELECT state, count(*) 
FROM pg_stat_activity 
GROUP BY state;
```
To inspect which queries are consuming connection slots:
```sql
SELECT pid, usename, client_addr, state, query_start, query 
FROM pg_stat_activity 
WHERE state != 'idle' 
ORDER BY query_start DESC;
```

**Terminate stuck or zombie connections**
If you need immediate database recovery access:
```sql
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'idle' AND pid <> pg_backend_pid();
```

**Configure global Connection Pooling in Node.js**
Never create `new Client()` per API endpoint. Always reuse a single shared `Pool`:
```javascript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Max concurrent connections per worker
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function query(text, params) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release(); // Crucial: return connection back to pool
  }
}
```

**Increase `max_connections` in postgresql.conf**
For dedicated production servers with 8GB+ RAM, adjust `/etc/postgresql/16/main/postgresql.conf`:
```ini
max_connections = 250
shared_buffers = 2GB
```
Restart the service to apply changes:
```bash
sudo systemctl restart postgresql
```

## Prevention Tips
- **Deploy PgBouncer in transaction mode:** Place PgBouncer in front of PostgreSQL in production. This allows serving over 10,000 concurrent client requests using only 50 physical backend database connections.
- **Connection monitoring:** Configure automated alerts when active connections exceed 80% of `max_connections`.

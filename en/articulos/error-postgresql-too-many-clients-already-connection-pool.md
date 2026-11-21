---
title: 'How to solve FATAL: sorry, too many clients already in PostgreSQL and Node.js'
description: 'Learn how to diagnose and fix connection pool exhaustion in PostgreSQL max_connections using PgBouncer and connection pooling in Node.js.'
category: 'Web & Code'
date: '2026-08-24'
readTime: '6 min'
tags: ['PostgreSQL', 'Node.js', 'Databases']
---

The error `FATAL: sorry, too many clients already` in PostgreSQL occurs when the total number of active, idle, and `idle in transaction` client backend processes reaches the ceiling defined by `max_connections` (which defaults to `100` on most standard installations). Once that threshold is hit, the postmaster process refuses all new TCP or UNIX socket handshakes, causing immediate 500 errors across Node.js, Next.js, and serverless APIs.

## Quick Diagnostics

| Symptom / Cause | Immediate Action |
|---|---|
| **Unclosed client checkouts (`pg` or ORM leaks)** | Ensure `client.release()` runs inside a `finally` block |
| **Serverless functions opening per-invocation sockets** | Route traffic through **PgBouncer** in `transaction` pooling mode |
| **Long-running `idle in transaction` sessions** | Set `idle_in_transaction_session_timeout` and terminate stuck PIDs |
| **Insufficient `max_connections` for dedicated RAM** | Tune `max_connections` and `shared_buffers` in `postgresql.conf` |

## Root Cause & Technical Mechanics

PostgreSQL uses a process-per-connection model: every incoming socket causes the `postgres` postmaster to `fork()` a backend worker with its own private memory (`work_mem`, `temp_buffers`) and shared-memory `PGPROC` slot. When all slots up to `max_connections` (minus `superuser_reserved_connections`, default `3`) fill up, normal roles receive `FATAL: sorry, too many clients already`.

Two Node.js patterns exhaust this pool rapidly:
1. **Per-request instantiation:** Calling `new Client()` inside a route handler without closing it leaves sockets sitting `idle` until TCP keepalive expires.
2. **Serverless concurrency spikes:** Platforms like AWS Lambda or Vercel spin up dozens of isolated containers simultaneously; 15 containers opening a `Pool` of 10 connections instantly saturate a default PostgreSQL server.

## Step-by-Step Solution

### 1. Audit Active and Idle Connections via `psql`

Log in using a superuser role (which uses the reserved slots) and group current sessions by state:

```sql
SELECT state, usename, application_name, count(*)
FROM pg_stat_activity
GROUP BY state, usename, application_name
ORDER BY count(*) DESC;
```

Identify long-lived `idle in transaction` or stalled queries holding locks and sockets:

```sql
SELECT pid, usename, client_addr, state, now() - state_change AS duration, left(query, 80) AS query_snippet
FROM pg_stat_activity
WHERE state IS NOT NULL
ORDER BY duration DESC
LIMIT 20;
```

### 2. Terminate Zombie or Stalled Backends

If your application is locked out and you need immediate recovery, terminate idle backends older than 5 minutes without killing your own `psql` session:

```sql
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state IN ('idle', 'idle in transaction')
  AND now() - state_change > interval '5 minutes'
  AND pid <> pg_backend_pid();
```

Verify that connection slots are freed by re-running the count query or checking `SELECT count(*) FROM pg_stat_activity;`.

### 3. Enforce a Singleton `pg.Pool` in Node.js

Never instantiate `new Client()` per HTTP request. Export a single module-level `Pool` (and attach it to `globalThis` in Next.js dev mode so Hot Module Replacement does not leak pools):

```javascript
import { Pool } from 'pg';

export const pool =
  globalThis.pgPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 15,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

if (process.env.NODE_ENV !== 'production') globalThis.pgPool = pool;

export async function runQuery(text, params) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}
```

### 4. Deploy PgBouncer for Serverless or High-Concurrency Workloads

For microservices or serverless functions, place **PgBouncer** in front of PostgreSQL using `pool_mode = transaction` in `/etc/pgbouncer/pgbouncer.ini`:

```ini
[pgbouncer]
listen_addr = 127.0.0.1
listen_port = 6432
auth_type = scram-sha-256
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
```

Reload PgBouncer and inspect active pools:

```bash
sudo systemctl reload pgbouncer
psql -p 6432 -U postgres pgbouncer -c "SHOW POOLS;"
```

### 5. Tune `postgresql.conf` Timeouts and Limits

On servers with 8 GB+ RAM, raise `max_connections` cautiously and enforce cleanup for abandoned transactions in `/etc/postgresql/16/main/postgresql.conf`:

```ini
max_connections = 200
shared_buffers = 2GB
idle_in_transaction_session_timeout = '60s'
```

Restart and verify:

```bash
sudo systemctl restart postgresql
psql -U postgres -c "SHOW max_connections;"
```

## Frequently Asked Questions

### Why does Next.js exhaust connections in `next dev` even with one user?
During development, Next.js re-evaluates module scopes on file saves, creating a new `pg.Pool` or `PrismaClient` on every reload unless you cache it on `globalThis`.

### Should I just set `max_connections = 1000` in PostgreSQL?
No. Raising `max_connections` too high without a pooler increases context-switching overhead, lock contention on `ProcArray`, and memory usage (~5–10 MB per backend), risking Linux OOM kills.

### What is the difference between `pg_cancel_backend` and `pg_terminate_backend`?
`pg_cancel_backend(pid)` aborts only the active query while keeping the socket open. `pg_terminate_backend(pid)` sends `SIGTERM`, closing the connection and freeing the `max_connections` slot immediately.

## Prevention Advice

- **Use transaction-mode pooling:** Route all stateless and serverless workloads through PgBouncer or a managed pooler rather than connecting directly to port `5432`.
- **Set `idle_in_transaction_session_timeout`:** Always configure a 30s–60s timeout in `postgresql.conf` so crashed clients cannot hold locks and slots indefinitely.
- **Monitor `pg_stat_activity` utilization:** Trigger alerts when active connections cross 75% of `max_connections`.
- **Verify ORM pool limits:** Explicitly set `connection_limit` in Prisma (`?connection_limit=5` in `DATABASE_URL`) or `max` in Drizzle/Knex when deploying multiple app replicas.

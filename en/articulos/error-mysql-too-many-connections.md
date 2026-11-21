---
title: 'Resolving: ''Too many connections'' Error in MySQL / MariaDB Databases'
description: >-
  Learn how to diagnose and fix the error of exceeding open connections in MySQL
  by optimizing your server's connection directives.
category: Web & Code
tags:
  - MySQL
  - MariaDB
  - Database
readTime: 5 min
date: '2026-07-27'
---

The `ERROR 1040 (HY000): Too many connections` failure immediately halts incoming database queries and locks out application workers. It triggers when the number of concurrent client threads exceeds the `max_connections` ceiling configured in your MySQL or MariaDB daemon.

## Quick Diagnostics

| Symptom / Cause | Immediate Action |
|---|---|
| **Active thread count equals `max_connections`** | Raise ceiling live via `SET GLOBAL max_connections = 300;` |
| **Hundreds of connections stuck in `Sleep` state** | Lower `wait_timeout` and `interactive_timeout` in `my.cnf` |
| **Application opening unpooled connections per request** | Introduce connection pooling (ProxySQL, HikariCP, or PgBouncer-style app pool) |
| **Admin locked out when slots are exhausted** | Connect via `extra_port` (MariaDB) or the reserved `SUPER` / `CONNECTION_ADMIN` slot |

## Root Cause & Technical Mechanics

MySQL and MariaDB allocate a dedicated OS thread (or thread-pool worker) and per-session memory buffers—such as `sort_buffer_size`, `read_buffer_size`, `join_buffer_size`, and `tmp_table_size`—for every client connection. By default, `max_connections` is set to `151`. MySQL reserves one extra slot (`max_connections + 1`) exclusively for accounts holding the `CONNECTION_ADMIN` (or legacy `SUPER`) privilege so an administrator can still log in to diagnose a saturated server.

When a PHP-FPM worker, Node.js microservice, or Python script opens a persistent connection without closing it—or hangs on an unindexed table lock—the thread remains in the `Sleep` or `Locked` state until `wait_timeout` (default `28800` seconds, or 8 hours) expires. Under traffic spikes, these idle threads rapidly consume all 151 slots, causing `mysqld` to reject new TCP and Unix socket handshakes with error `1040`.

## Step-by-Step Solution

### Step 1: Log in via the reserved admin slot and inspect threads

Use the root or admin account to claim the reserved administrative connection and inspect active states:

```bash
mysql -u root -p -e "SHOW GLOBAL VARIABLES LIKE 'max_connections';"
mysql -u root -p -e "SHOW GLOBAL STATUS LIKE 'Threads_connected';"
mysql -u root -p -e "SHOW FULL PROCESSLIST;"
```

Look closely at the `Command` and `Time` columns in `SHOW FULL PROCESSLIST;`. If you see dozens or hundreds of rows with `Command = Sleep` and `Time > 60`, your application is leaking connections or holding idle persistent sockets open too long.

### Step 2: Apply an immediate runtime limit increase (no restart)

To restore service availability without dropping active transactions, raise `max_connections` and tighten `wait_timeout` dynamically:

```sql
SET GLOBAL max_connections = 300;
SET GLOBAL wait_timeout = 120;
SET GLOBAL interactive_timeout = 120;
```

Verify the new runtime values took effect:

```bash
mysql -u root -p -e "SHOW VARIABLES WHERE Variable_name IN ('max_connections', 'wait_timeout');"
```

### Step 3: Persist tuned directives in the configuration file

Runtime `SET GLOBAL` changes vanish on service reboot. Edit `/etc/mysql/mysql.conf.d/mysqld.cnf` (Ubuntu/Debian MySQL) or `/etc/my.cnf.d/server.cnf` (MariaDB on RHEL/AlmaLinux) under the `[mysqld]` block:

```ini
[mysqld]
max_connections = 300
wait_timeout = 120
interactive_timeout = 120
max_connect_errors = 10000
thread_cache_size = 32
```

If you run MariaDB and want a dedicated emergency admin port, you can also add `extra_port = 3307` and `extra_max_connections = 5`. Also verify that systemd allows enough file descriptors (`LimitNOFILE=65535`) so the OS does not cap `max_connections` below your setting.

### Step 4: Restart and verify peak connection metrics

Validate configuration syntax before restarting:

```bash
mysqld --validate-config
sudo systemctl restart mysql   # or: sudo systemctl restart mariadb
```

Confirm the daemon is healthy and monitor `Max_used_connections` over the next few minutes:

```bash
mysql -u root -p -e "SHOW GLOBAL STATUS WHERE Variable_name IN ('Max_used_connections', 'Threads_connected', 'Aborted_connects');"
```

## Frequently Asked Questions

**Why did MySQL ignore the higher `max_connections` value I put in `my.cnf`?**
If `open_files_limit` at the OS/systemd level is too low (for example, `1024`), MySQL silently caps `max_connections` to fit within available file descriptors. Check `SHOW VARIABLES LIKE 'open_files_limit';` and raise `LimitNOFILE` in a systemd override (`systemctl edit mysql`).

**How much RAM does each MySQL connection actually consume?**
Each idle connection consumes roughly 256 KB to several megabytes for thread stack and session buffers, but active queries can allocate `sort_buffer_size + read_buffer_size + join_buffer_size` per thread. Setting `max_connections = 2000` on a 4 GB VPS risks triggering the Linux OOM killer under load.

**Should I use `mysql_pconnect` or persistent connections in PHP?**
Generally no, unless paired with a carefully sized PHP-FPM `pm.max_children` ceiling. Each PHP-FPM worker holds its own persistent MySQL socket, which often creates more idle connections than short-lived pooled queries.

## Prevention Advice

- **Size `max_connections` to physical RAM:** Calculate worst-case per-thread memory before raising limits; keep `Max_used_connections` below 75% of `max_connections` during peak traffic.
- **Enable slow query logging:** Set `slow_query_log = 1` and `long_query_time = 1` so locking queries do not pile up threads.
- **Use application-level pooling:** Configure bounded pools in Node.js (`mysql2`), Python (`SQLAlchemy`), or Java (`HikariCP`), or place **ProxySQL** in front of the database.
- **Alert on connection saturation:** Track `Threads_connected / max_connections` in Prometheus (`mysqld_exporter`) and trigger warnings at 80%.

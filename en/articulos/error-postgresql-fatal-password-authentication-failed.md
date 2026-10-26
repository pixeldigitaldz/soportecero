---
title: "How to Fix PostgreSQL 'FATAL: password authentication failed for user' Error"
description: "Learn how to resolve PostgreSQL password authentication failures by resetting user passwords and configuring the pg_hba.conf access control file."
category: "Systems & Servers"
tags: ["PostgreSQL", "Databases", "Sysadmin"]
readTime: "4 min"
date: "2026-08-01"
---

The **FATAL: password authentication failed for user** error occurs in PostgreSQL when the database engine rejects a client connection due to an incorrect password, a missing authentication method in `pg_hba.conf`, or a mismatch between system users and PostgreSQL database roles.

## Quick Diagnostics

| Cause | Solution |
|---|---|
| **`psql: error: FATAL: password authentication failed for user "postgres"`**: Incorrect user password, missing role, or misconfigured auth method (`scram-sha-256`, `md5`, `peer`) in `pg_hba.conf` | Connect via local UNIX socket as system user `postgres`, reset password with `ALTER USER`, and update `pg_hba.conf` |

## 🚀 How to Fix the Error Step-by-Step

### Step 1: Connect via local UNIX socket as the system postgres user

On Linux environments, the default PostgreSQL superuser (`postgres`) uses `peer` authentication over local UNIX sockets. Access the interactive prompt directly by switching system users:

```bash
# Switch to the postgres system user and launch psql
sudo -u postgres psql
```

If the command succeeds and drops you into the `postgres=#` prompt, the PostgreSQL daemon is functioning properly; the failure is isolated to TCP/IP password authentication.

### Step 2: Reset the PostgreSQL user role password

From the interactive `psql` shell, set a new password for the target database role (such as `postgres` or your application user):

```sql
-- Change password for the postgres database user
ALTER USER postgres WITH PASSWORD 'YourNewSecurePassword123!';
```

Exit the interactive terminal using `\q`.

### Step 3: Configure client authentication in pg_hba.conf

Open PostgreSQL's client authentication configuration file (`pg_hba.conf`). You can locate its path by running `SHOW hba_file;` inside `psql` or looking in `/etc/postgresql/`:

```bash
# Example for PostgreSQL 15/16 on Debian/Ubuntu
sudo nano /etc/postgresql/16/main/pg_hba.conf
```

Inspect access control entries for local and TCP/IP loopback connections (`127.0.0.1/32` or `::1/128`). Ensure they use `scram-sha-256` or `md5`:

```config
# TYPE  DATABASE        USER            ADDRESS                 METHOD
# Local UNIX socket connections
local   all             postgres                                peer
local   all             all                                     md5

# IPv4 local connections (TCP/IP)
host    all             all             127.0.0.1/32            scram-sha-256

# IPv6 local connections
host    all             all             ::1/128                 scram-sha-256
```

### Step 4: Reload the PostgreSQL service

Reload the PostgreSQL service to apply changes made to `pg_hba.conf` without terminating existing active client connections:

```bash
# Reload configuration on your Linux server
sudo systemctl reload postgresql
```

Test password authentication via TCP/IP using the `-h localhost` parameter:

```bash
psql -h localhost -U postgres -W
```

## 🛡️ Prevention Advice

- **Enforce `scram-sha-256`**: Avoid deprecated `md5` authentication on modern PostgreSQL instances (version 13+), as `scram-sha-256` offers robust protection against replay and dictionary attacks.
- **Use `.pgpass` files for automated scripts**: Store password credentials securely in a user `~/.pgpass` file with `0600` permissions rather than hardcoding passwords in command lines or bash scripts.
- **Verify `listen_addresses` in `postgresql.conf`**: If connecting from a remote server, ensure `listen_addresses = '*'` is enabled in addition to adding subnets to `pg_hba.conf`.

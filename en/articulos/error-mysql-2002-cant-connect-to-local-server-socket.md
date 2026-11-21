---
title: >-
  How to Fix: Error 2002 (HY000): Can't connect to local MySQL server through
  socket
description: >-
  Learn how to solve MySQL error 2002 Can't connect through socket
  '/var/run/mysqld/mysqld.sock' in Ubuntu, Debian, and CentOS.
category: Web & Code
tags:
  - MySQL
  - MariaDB
  - Linux
  - SysAdmin
  - Databases
  - Ubuntu
readTime: '6 min'
date: '2026-06-25'
---

The error `ERROR 2002 (HY000): Can't connect to local MySQL server through socket '/var/run/mysqld/mysqld.sock' (2)` means the `mysql` CLI client (or PHP/Python/Node driver) tried to open a local UNIX domain socket for inter-process communication (IPC), and the kernel returned `ENOENT` (`(2)` — No such file or directory) because either `mysqld` is not running or its socket file lives at a different path.

## Quick Diagnostics

| Symptom / Cause | Immediate Action |
|---|---|
| **`mysql` or `mariadb` systemd service stopped** | Run `sudo systemctl start mysql` (or `mariadb`) |
| **Root disk 100% full preventing InnoDB & socket creation** | Free space (`df -h`) before restarting `mysqld` |
| **Missing `/var/run/mysqld` directory on `tmpfs`** | Recreate directory owned by `mysql:mysql` |
| **Client expects `/tmp/mysql.sock` instead of `/var/run/mysqld/mysqld.sock`** | Align `socket` in `/etc/mysql/my.cnf` under `[mysqld]` and `[client]` |

## Root Cause & Technical Mechanics

On Linux and macOS, passing `-h localhost` (or omitting `-h` entirely) instructs the MySQL/MariaDB client library (`libmysqlclient`) to bypass TCP/IP port `3306` and instead connect via a **UNIX domain socket**—a special filesystem endpoint created by `mysqld` at startup.

Error `2002` with trailing code `(2)` (`ENOENT`) or `(111)` (`ECONNREFUSED`) occurs under three common conditions:
1. **Daemon Failure or OOM Kill:** If InnoDB crashes due to exhausted disk space, a full `/tmp`, or the Linux OOM killer terminating `mysqld` on a low-RAM VPS, the daemon never creates (or leaves behind a dead) `.sock` file.
2. **Volatile `/run` (`tmpfs`) Permissions:** `/var/run` is a symlink to `/run`, which is mounted on volatile RAM (`tmpfs`) and wiped on every reboot. If packaging scripts or manual edits fail to recreate `/var/run/mysqld` with `mysql:mysql` ownership, `mysqld` cannot write `mysqld.sock`.
3. **Config Path Drift:** Compiling or mixing packages (e.g., MariaDB vs. Oracle MySQL, or Docker/Homebrew vs. APT) often places the server socket at `/run/mysqld/mysqld.sock` while the client reads `/tmp/mysql.sock`.

## Step-by-Step Solution

### 1. Check Disk Space and Service Status

Before restarting the database, verify that your root and `/var` partitions are not at 100% capacity, then inspect the service:

```bash
df -h / /var/lib/mysql
sudo systemctl status mysql --no-pager || sudo systemctl status mariadb --no-pager
```

If the service is stopped, inspect the error log for the exact crash reason:

```bash
sudo tail -n 30 /var/log/mysql/error.log
```

### 2. Recreate `/var/run/mysqld` with Correct Ownership

If logs report `Can't start server : Bind on unix socket: No such file or directory` or `Permission denied`, create the runtime directory and assign it to the `mysql` user:

```bash
sudo mkdir -p /var/run/mysqld
sudo chown -R mysql:mysql /var/run/mysqld
sudo chmod 755 /var/run/mysqld
sudo systemctl restart mysql
```

Verify the socket file now exists and is actively listening:

```bash
ls -la /var/run/mysqld/mysqld.sock
ss -xlp | grep mysqld
```

### 3. Synchronize Socket Paths in `my.cnf`

If `mysqld` is running (`systemctl is-active mysql` returns `active`) yet `mysql` still throws Error 2002, check where the server actually placed the socket:

```bash
sudo find /run /var/run /tmp -name "*.sock" 2>/dev/null
```

Align both `[mysqld]` and `[client]` in `/etc/mysql/my.cnf` (or `/etc/my.cnf` on RHEL/CentOS):

```ini
[mysqld]
socket = /var/run/mysqld/mysqld.sock

[client]
socket = /var/run/mysqld/mysqld.sock
```

Restart the service and test local CLI access:

```bash
sudo systemctl restart mysql
mysql -u root -p -e "SELECT VERSION();"
```

## Frequently Asked Questions

### Why does `mysql -h 127.0.0.1` work when `mysql -h localhost` fails?
In MySQL clients, `localhost` is a special keyword that forces UNIX domain socket IPC. Specifying `127.0.0.1` forces a standard TCP/IP connection to port `3306`, bypassing the `.sock` file completely.

### What is the difference between `(2)` and `(111)` at the end of Error 2002?
`(2)` maps to POSIX `ENOENT` (the `.sock` file does not exist at that path). `(111)` maps to `ECONNREFUSED` (a stale `.sock` file still sits on disk from a crashed `mysqld` process, or `mysqld` crashed before binding).

### How do I keep `mysqld` from crashing on a 1 GB RAM VPS?
Add a 1–2 GB swap file and lower `innodb_buffer_pool_size = 256M` in `/etc/mysql/mysql.conf.d/mysqld.cnf` so the Linux OOM killer does not terminate `mysqld` during traffic spikes.

## Prevention Advice

- **Use `systemd-tmpfiles` for `/run/mysqld`:** Ensure `/usr/lib/tmpfiles.d/mysql.conf` exists (`d /run/mysqld 0755 mysql mysql -`) so reboots never lose the socket directory.
- **Monitor `/var/log/mysql/error.log`:** Set up log rotation and alerts for InnoDB page errors or OOM kills.
- **Standardize app DSNs on `127.0.0.1`:** Configure PHP (`PDO`), Python, and Node.js drivers to use `127.0.0.1:3306` when you want predictable TCP behavior across host and container environments.
- **Keep 10%+ free disk headroom:** InnoDB binary logs (`binlog`) can silently fill `/var/lib/mysql` unless `binlog_expire_logs_seconds` is configured.

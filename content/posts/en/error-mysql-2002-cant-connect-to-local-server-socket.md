---
title: "How to Fix: Error 2002 (HY000): Can't connect to local MySQL server through socket"
description: "Learn how to solve MySQL error 2002 Can't connect through socket '/var/run/mysqld/mysqld.sock' in Ubuntu, Debian, and CentOS."
category: "Web & Code"
tags: ["MySQL", "MariaDB", "Linux", "SysAdmin", "Databases", "Ubuntu"]
readTime: "5 min"
date: "2026-06-25"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **MySQL / MariaDB daemon stopped or unable to create UNIX socket due to exhausted storage** | Inspect disk with `df -h` and start service with `sudo systemctl start mysql` |
| **Socket path mismatch between my.cnf (/var/run/mysqld/mysqld.sock vs /tmp/mysql.sock)** | Create compatibility symlink or synchronize socket paths across `[client]` and `[mysqld]` |

The exception `ERROR 2002 (HY000): Can't connect to local MySQL server through socket '/var/run/mysqld/mysqld.sock' (2)` occurs when local CLI clients or web applications attempt communication via the UNIX domain socket IPC endpoint and find the socket file missing or the `mysqld` daemon in a failed state.

## 🚀 Step-by-Step Solution

### Step 1: Verify Service Health and Storage Headroom
Confirm whether the daemon is actively running and storage is unconstrained:
```bash
# 1. Check disk capacity
df -h

# 2. Inspect MySQL / MariaDB daemon state
sudo systemctl status mysql # or mariadb

# 3. Start daemon if inactive
sudo systemctl start mysql
```

### Step 2: Recreate Socket Directory and Fix Permissions
If volatile `tmpfs` mounting cleared the parent runtime directory on reboot:
```bash
# Create target socket directory
sudo mkdir -p /var/run/mysqld

# Grant ownership to system 'mysql' account
sudo chown -R mysql:mysql /var/run/mysqld
sudo chmod -R 755 /var/run/mysqld

# Restart database service
sudo systemctl restart mysql
```

### Step 3: Align Socket Directives in my.cnf
Ensure client and server configuration blocks share identical socket paths:
```ini
# /etc/mysql/my.cnf
[mysqld]
socket = /var/run/mysqld/mysqld.sock

[client]
socket = /var/run/mysqld/mysqld.sock
```

### Step 4: Create a Compatibility Symlink
If legacy applications expect the socket at `/tmp/mysql.sock`:
```bash
sudo ln -s /var/run/mysqld/mysqld.sock /tmp/mysql.sock
```

## 🛡️ Prevention Advice
- **Audit MySQL Error Logs:** Periodically inspect `/var/log/mysql/error.log` to identify InnoDB table corruption before unexpected crashes.
- **Tune memory allocation on lean instances:** On 1GB VPS instances, set `innodb_buffer_pool_size = 256M` to avoid OOM Killer invocations.

## ❓ Frequently Asked Questions (FAQ)

### Why does 127.0.0.1 connect while localhost fails?
In UNIX environments, connecting to `localhost` forces UNIX domain socket communication, while `127.0.0.1` utilizes network TCP/IP sockets on port 3306.

### What does error code (2) represent?
The (2) suffix corresponds to the standard Linux POSIX error `ENOENT` (No such file or directory), confirming the physical socket file is absent from disk.

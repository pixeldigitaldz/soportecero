---
title: 'Fix: Error 2002 (HY000): Can''t connect to local MySQL server through socket'
description: 'How to diagnose and fix MySQL/MariaDB error 2002 when it cannot connect through the mysql.sock socket.'
category: 'Systems & Servers'
date: '2026-08-16'
readTime: '3 min'
tags: ['MySQL', 'Databases', 'Linux']
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **MySQL/MariaDB service is down** | Start the service: `systemctl start mysql` |
| **Missing or corrupted mysql.sock file** | Restart the service or recreate the path manually |
| **Incorrect permissions on /var/run/mysqld** | Change owner to mysql: `chown mysql:mysql /var/run/mysqld/` |

## Step-by-Step Solution

**Check the service status**
The most common error is that MySQL or MariaDB are simply not running. Check it:
```bash
sudo systemctl status mysql
# or if you use mariadb: sudo systemctl status mariadb
```
If it says *inactive* or *failed*, start it:
```bash
sudo systemctl start mysql
```

**Find the socket file manually**
Sometimes, the MySQL client looks for the `.sock` file in `/tmp/mysql.sock` but the server created it in `/var/run/mysqld/mysqld.sock`. To find where the socket really is, check your configuration file (`/etc/mysql/my.cnf` or `/etc/my.cnf`):
```bash
grep -i "socket" /etc/mysql/my.cnf
```
If you know the server is running but the socket is in another location, you can connect by specifying it:
```bash
mysql -u root -p -S /var/run/mysqld/mysqld.sock
```

**Permission and directory issues**
If the server fails to start complaining about the socket, the `/var/run/mysqld` folder might not exist or might not have the correct permissions (often happens after hard reboots or updates).
Recreate the folder and give permissions:
```bash
sudo mkdir -p /var/run/mysqld
sudo chown mysql:mysql /var/run/mysqld
sudo systemctl restart mysql
```

**Check for lack of disk space**
Sometimes, MySQL shuts down unexpectedly because the root partition (`/`) or `/var` has run out of space, preventing the creation of the temporary socket file.
```bash
df -h
```
If the disk is at 100%, free up space and restart the service.

## Prevention Tips
- **Disk monitoring:** Make sure to set up disk space alerts on your server.
- **Standardized configuration:** Define the `socket` path explicitly under the `[client]` and `[mysqld]` section in your `my.cnf` file so that both the server and the client always match the location.

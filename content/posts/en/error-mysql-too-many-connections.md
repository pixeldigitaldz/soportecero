---
title: "Fix: 'Too many connections' Error in MySQL / MariaDB Databases"
description: "Learn how to diagnose and fix the error of exceeding open connections in MySQL by optimizing your server's connection directives."
category: "Web & Code"
tags: ["MySQL", "MariaDB", "Database"]
readTime: "3 min"
date: "2026-07-31"
---

The `Error 1040: Too many connections` error immediately stops queries to your database and occurs when the number of open connection threads from your application exceeds the maximum directive defined in the internal settings of the MySQL or MariaDB server.

## 🚀 Step-by-Step Solution

### Step 1: Access the engine and diagnose inactive threads
If the web server still allows you to interact via console using the admin account, inspect which query processes are holding up the data traffic:
```bash
# Log in to the database engine
mysql -u root -p

# Execute the command to list processes
SHOW PROCESSLIST;
```
*(Look for queries with a prolonged "Sleep" state. If there are hundreds of them, the application is not closing connection channels after responding).*

### Step 2: Adjust global limits in the configuration file
Open the database server configuration file (`/etc/mysql/my.cnf` or `/etc/my.cnf.d/server.cnf` in MariaDB) and increase the maximum limit of concurrent connections allowed by your hardware:
```plaintext
[mysqld]
max_connections = 250
interactive_timeout = 180
wait_timeout = 60
```
*(Note: Reducing `wait_timeout` forces the engine to kill inactive, unused connections after 60 seconds, automatically freeing up slots).*

### Step 3: Restart the service to free memory
```bash
sudo systemctl restart mysql   # For MySQL
sudo systemctl restart mariadb # For MariaDB
```

## 🛡️ Prevention Advice

Recommended security practices:
- Do not arbitrarily increase the `max_connections` directive to astronomical values (such as 1000 or 2000) if your hardware has limited physical RAM. Each connection channel consumes processor resources and cache memory; exceeding the server's capacities will cause the system to freeze due to a lack of pagefile space or trigger critical crashes. Implement connection pooling in your web application to reuse channels instead of opening a new one for every query.

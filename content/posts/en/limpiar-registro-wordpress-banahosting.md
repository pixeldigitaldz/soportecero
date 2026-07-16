---
title: "How to clean and optimize a bloated WordPress database in BanaHosting"
description: "Learn how to clean WordPress and optimize your website's database to speed up load times and reduce CPU usage in BanaHosting."
category: "Web & Code"
tags: ["WordPress", "Database", "Maintenance"]
readTime: "3 min"
date: "2026-08-06"
---

Knowing how to **clean WordPress** and optimize your website's database on shared servers (like BanaHosting) is essential when the web gets slow or the control panel throws memory limit errors. This happens because WordPress defaults to accumulating thousands of rows of "post revisions" (old saved versions of your posts) and cache junk (*transients*) in the `wp_options` table, bloating SQL queries.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Limitar las revisiones de entradas en wp-config.php
By default, WordPress saves infinite copies of every change you make. We are going to cap it to a maximum of 3 versions so it stops bloating the database.
1. Enter the File Manager of your cPanel in BanaHosting.
2. Open the `wp-config.php` file and add the following line just before the text that says *That's all, stop editing!*:
  ```php
  define('WP_POST_REVISIONS', 3);
  ```

### Paso 2: Ejecutar una limpieza SQL directa (Vía phpMyAdmin)

Enter phpMyAdmin from your cPanel, select your WordPress database, go to the SQL tab and run this command to delete all stored old revisions in one go:
```sql
DELETE FROM wp_posts WHERE post_type = 'revision';
```

You will see how the size of your database drops drastically, speeding up searches and server response times.

## 🛡️ Consejo de Prevención

Recommended security practices:
- Make a full backup of your database in `.sql` format before running any direct deletion command. If you make a syntax error in the SQL query without having a prior backup, you could delete the actual articles of your blog or corrupt permanent link relationships irreversibly.

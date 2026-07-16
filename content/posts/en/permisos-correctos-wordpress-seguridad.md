---
title: "The ultimate file and folder permission guide to secure WordPress"
description: "Protect your WordPress website from code injections and unauthorized access by applying the optimal security permission schema."
category: "Web & Code"
tags: ["WordPress", "Security", "Linux"]
readTime: "4 min"
date: "2026-08-07"
---

WordPress security flaws that allow attackers to upload malicious scripts or modify configuration files usually occur due to overly permissive permissions on your hosting directories. Keeping the default configuration of some automatic installers is the most exploited attack vector.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Establecer los permisos globales de forma segura por consola
WordPress directories must belong to your web server user (such as `www-data`, `apache`, or `nginx`) and have a permission mask that prevents other users from writing to them:
```bash
# Cambiar la propiedad de los archivos al usuario del servidor web
sudo chown -R www-data:www-data /var/www/html/wordpress

# Forzar a todas las carpetas a tener permisos 755
find /var/www/html/wordpress -type d -exec chmod 755 {} \;

# Forzar a todos los archivos a tener permisos 644
find /var/www/html/wordpress -type f -exec chmod 644 {} \;
```

### Paso 2: Proteger al máximo el archivo crítico wp-config.php
The `wp-config.php` file contains your database credentials and session security keys. Nobody except the web server and you should be able to read it:
```bash
# Cambiar permisos de lectura exclusiva al dueño del archivo
chmod 600 /var/www/html/wordpress/wp-config.php
```

### Paso 3: Proteger el archivo de reescritura .htaccess
If you use the Apache web server, secure the route control file against plugin manipulations or malicious code injections:
```bash
chmod 644 /var/www/html/wordpress/.htaccess
```

## 🛡️ Consejo de Prevención

Recommended security practices:
- **Never apply 777 permissions (read, write, and execute for everyone) to any folder or file on your website under any circumstances**, not even temporarily to troubleshoot image upload issues in the `wp-content/uploads` folder. If a plugin has issues saving files, this is due to a file system user ownership conflict (`chown`) and not a lack of global write permissions; opening the doors completely will allow any script injected into the server to take full control of your host.

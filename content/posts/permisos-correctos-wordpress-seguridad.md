---
title: "La guía definitiva de permisos de archivos y carpetas para asegurar WordPress"
description: "Protege tu sitio web WordPress de inyecciones de código y accesos no autorizados aplicando el esquema de permisos de seguridad óptimo."
category: "Web y Código"
tags: ["WordPress", "Seguridad", "Linux"]
readTime: "4 min"
date: "2026-06-27"
---

Los fallos de seguridad en WordPress que permiten a atacantes subir scripts maliciosos o modificar archivos de configuración suelen ocurrir por tener permisos demasiado permisivos en los directorios de tu hosting. Mantener la configuración por defecto de algunos instaladores automáticos es el vector de ataque más explotado.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Establecer los permisos globales de forma segura por consola
Los directorios de WordPress deben pertenecer al usuario de tu servidor web (como `www-data`, `apache` o `nginx`) y tener una máscara de permisos que impida la escritura a otros usuarios:
```bash
# Cambiar la propiedad de los archivos al usuario del servidor web
sudo chown -R www-data:www-data /var/www/html/wordpress

# Forzar a todas las carpetas a tener permisos 755
find /var/www/html/wordpress -type d -exec chmod 755 {} \;

# Forzar a todos los archivos a tener permisos 644
find /var/www/html/wordpress -type f -exec chmod 644 {} \;
```

### Paso 2: Proteger al máximo el archivo crítico wp-config.php
El archivo `wp-config.php` contiene las credenciales de tu base de datos y llaves de seguridad de la sesión. Nadie excepto el servidor web y tú deben poder leerlo:
```bash
# Cambiar permisos de lectura exclusiva al dueño del archivo
chmod 600 /var/www/html/wordpress/wp-config.php
```

### Paso 3: Proteger el archivo de reescritura .htaccess
Si utilizas el servidor web Apache, asegura el archivo de control de rutas frente a manipulaciones de plugins o inyecciones de código maliciosas:
```bash
chmod 644 /var/www/html/wordpress/.htaccess
```

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
- **Nunca apliques permisos 777 (lectura, escritura y ejecución para todo el mundo) a ninguna carpeta o archivo de tu sitio web bajo ninguna circunstancia**, ni siquiera de manera temporal para solucionar problemas de subida de imágenes en la carpeta `wp-content/uploads`. Si un plugin tiene problemas para guardar archivos, esto se debe a un conflicto de propiedad del usuario del sistema de archivos (`chown`) y no a la falta de permisos de escritura globales; abrir las puertas por completo permitirá que cualquier script inyectado en el servidor tome el control total de tu host.

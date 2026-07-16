---
title: "How to Create a Compressed Automated Backup Script in Linux with Tar and Cron"
description: "Learn how to automatically pack configuration directories using compressed Bash scripts and schedule their execution with Cron."
category: "Systems & Servers"
tags: ["Linux", "Sysadmin", "Cron"]
readTime: "3 min"
date: "2026-07-17"
---

The most serious mistake in managing local or home servers is not having automated and intact backups against hardware failures or file corruption. Creating a scheduled task that packages your essential configuration files will guarantee peace of mind.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Escribir el script de empaquetado en Bash
Create a script in your user directory that automates the data compression by adding the current date to the name of the resulting file:
```bash
# Crear el script de respaldo
nano ~/auto_backup.sh
```
Paste the following code into the editor:
```bash
#!/bin/bash
# Definir variables de rutas absolutas
BACKUP_DIR="/var/backups/my_app"
SOURCE_DIR="/var/www/html/my_app_data"
FECHA=$(date +%Y-%m-%d_%H%M%S)
FILE_NAME="backup_$FECHA.tar.gz"

# Crear directorio de respaldo si no existe
mkdir -p "$BACKUP_DIR"

# Comprimir la carpeta de origen usando exclusión de temporales si es necesario
/usr/bin/tar -czf "$BACKUP_DIR/$FILE_NAME" "$SOURCE_DIR"

# Opcional: Eliminar archivos de respaldo más antiguos de 30 días para evitar saturar el disco
/usr/bin/find "$BACKUP_DIR" -name "backup_*.tar.gz" -mtime +30 -delete
```

### Paso 2: Otorgar permisos de ejecución al script
Ensure that the system can invoke the script you just scheduled:
```bash
chmod +x ~/auto_backup.sh
```

### Paso 3: Programar la ejecución en el programador de tareas Cron
Open your user's task table:
```bash
crontab -e
```
Add the following rule to run the automatic security packaging daily (for example, at 02:00 AM):
```plaintext
0 2 * * * /usr/bin/bash /home/usuario/auto_backup.sh >> /home/usuario/auto_backup.log 2>&1
```

## 🛡️ Consejo de Prevención

Recommended safety practices:
- Do not store your compressed backup files exclusively within the same physical drive of the production server. If the hard drive suffers a general mechanical collapse, you will lose both production data and backups. Always configure a secondary task in your script that replicates the packaged file to cloud storage, a local secondary server, or an external NAS using secure transmission utilities such as `rsync` or `rclone`.

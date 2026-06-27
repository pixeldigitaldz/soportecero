---
title: "Cómo crear un script de respaldos automatizados comprimidos en Linux con Tar y Cron"
description: "Aprende a empaquetar directorios de configuración de forma automática utilizando scripts en Bash comprimidos y programando su ejecución con Cron."
category: "Sistemas y Servidores"
tags: ["Linux", "Sysadmin", "Cron"]
readTime: "3 min"
date: "2026-06-27"
---

El error más grave en la gestión de servidores locales o domésticos es no disponer de respaldos automatizados e íntegros frente a fallos de hardware o corrupción de archivos. Crear una tarea programada que empaquete tus archivos esenciales de configuración te garantizará tranquilidad.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Escribir el script de empaquetado en Bash
Crea un script en tu directorio de usuario que automatice la compresión de los datos agregando la fecha del día al nombre del archivo resultante:
```bash
# Crear el script de respaldo
nano ~/auto_backup.sh
```
Pega el siguiente código en el editor:
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
Asegura que el sistema pueda invocar el script que acabas de programar:
```bash
chmod +x ~/auto_backup.sh
```

### Paso 3: Programar la ejecución en el programador de tareas Cron
Abre la tabla de tareas de tu usuario:
```bash
crontab -e
```
Agrega la siguiente regla para ejecutar el empaquetado automático de seguridad de forma diaria (por ejemplo, a las 02:00 de la madrugada):
```plaintext
0 2 * * * /usr/bin/bash /home/usuario/auto_backup.sh >> /home/usuario/auto_backup.log 2>&1
```

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
- No almacenes de forma exclusiva los archivos de respaldo comprimidos dentro de la misma unidad física del servidor de producción. Si el disco duro sufre un colapso mecánico general, perderás tanto los datos en producción como los respaldos. Configura siempre una tarea secundaria en tu script que replique el archivo empaquetado hacia un almacenamiento en la nube, un servidor secundario local o un NAS externo mediante utilidades de transmisión seguras como `rsync` o `rclone`.

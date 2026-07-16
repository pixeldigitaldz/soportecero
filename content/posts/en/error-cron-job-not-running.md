---
title: "Why Is My Cron Job Not Running? Step-by-Step Diagnosis"
description: "Learn how to diagnose why your scheduled Cron jobs are not running and how to debug failures in background automation scripts."
category: "Systems & Servers"
tags: ["Linux", "Sysadmin", "Cron"]
readTime: "3 min"
date: "2026-07-24"
---

The most common failure with automated Cron tasks is that the script or command runs perfectly when you execute it manually in your terminal, but fails silently when invoked by the system daemon (`cron`). This occurs due to critical differences between your user session and the isolated environment of Cron.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Forzar el uso de rutas absolutas en comandos y scripts
Cron does not load the environment variables from your `.bashrc` file or inherit the `PATH` variable from your interactive session. Therefore, it will not know where binaries like `python3`, `node`, or `git` are unless you use full paths:
```bash
# INCORRECTO:
* * * * * python3 /home/usuario/script.py

# CORRECTO (Usa "which python3" para verificar la ruta en tu sistema):
* * * * * /usr/bin/python3 /home/usuario/script.py
```

### Paso 2: Redirigir errores y logs de ejecución a un archivo físico
Since background tasks do not have a physical terminal to display error messages, you must force the system to write them to a log file in order to audit the exact reason for the failure:
```bash
# Redirigir la salida estándar (1) y el canal de errores (2) a un log
0 5 * * * /usr/bin/bash /home/usuario/backup.sh >> /home/usuario/backup.log 2>&1
```

### Paso 3: Verificar que el demonio de Cron esté activo
Make sure that the service responsible for coordinating the scheduled task queue is running on your server:
```bash
sudo systemctl status cron   # En Debian/Ubuntu
sudo systemctl status crond  # En Arch/RHEL/CentOS
```

## 🛡️ Consejo de Prevención

Recommended safety practices:
- Always declare the `PATH` variable and the preferred shell explicitly at the top of your crontab configuration file (`crontab -e`) to ensure that execution does not rely on inherited external variables:
  ```plaintext
  SHELL=/bin/bash
  PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
  ```

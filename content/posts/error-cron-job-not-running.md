---
title: "¿Por qué no se ejecuta mi tarea de Cron? Diagnóstico paso a paso"
description: "Aprende a diagnosticar por qué tus tareas programadas en Cron no se ejecutan y cómo depurar fallos en scripts de automatización en segundo plano."
category: "Sistemas y Servidores"
tags: ["Linux", "Sysadmin", "Cron"]
readTime: "3 min"
date: "2026-06-27"
---

El fallo más recurrente con las tareas automatizadas de Cron es que el script o comando funciona perfectamente cuando lo ejecutas de forma manual en tu terminal, pero falla silenciosamente cuando es invocado por el demonio del sistema (`cron`). Esto ocurre por diferencias críticas entre la sesión de tu usuario y el entorno aislado de Cron.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Forzar el uso de rutas absolutas en comandos y scripts
Cron no carga las variables de entorno de tu archivo `.bashrc` ni hereda la variable `PATH` de tu sesión interactiva. Por lo tanto, no sabrá dónde están binarios como `python3`, `node` o `git` a menos que utilices rutas completas:
```bash
# INCORRECTO:
* * * * * python3 /home/usuario/script.py

# CORRECTO (Usa "which python3" para verificar la ruta en tu sistema):
* * * * * /usr/bin/python3 /home/usuario/script.py
```

### Paso 2: Redirigir errores y logs de ejecución a un archivo físico
Dado que las tareas en segundo plano no tienen una terminal física para mostrar mensajes de error, debes forzar al sistema a escribirlos en un archivo log para poder auditar el motivo exacto del fallo:
```bash
# Redirigir la salida estándar (1) y el canal de errores (2) a un log
0 5 * * * /usr/bin/bash /home/usuario/backup.sh >> /home/usuario/backup.log 2>&1
```

### Paso 3: Verificar que el demonio de Cron esté activo
Asegúrate de que el servicio encargado de coordinar la cola de tareas programadas esté corriendo en tu servidor:
```bash
sudo systemctl status cron   # En Debian/Ubuntu
sudo systemctl status crond  # En Arch/RHEL/CentOS
```

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
- Siempre declara la variable `PATH` y el shell preferido explícitamente en la parte superior de tu archivo de programación crontab (`crontab -e`) para garantizar que la ejecución no dependa de variables externas heredadas:
  ```plaintext
  SHELL=/bin/bash
  PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
  ```

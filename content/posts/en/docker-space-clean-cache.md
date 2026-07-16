---
title: "How to Free Disk Space by Removing Cache and Orphaned Containers in Docker"
description: "Optimize your server storage by removing unused images, orphaned volumes, and container log files in Docker."
category: "Systems & Servers"
tags: ["Docker", "Linux", "Sysadmin"]
readTime: "4 min"
date: "2026-07-21"
---

The silent accumulation of disk space on servers running Docker occurs because the container engine never deletes old images by default when you download updates, nor does it clean up temporary build files or log files that grow indefinitely on the host path.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Ejecutar una limpieza de datos inactivos y volúmenes huérfanos
The `prune` command removes unused images, networks, and stopped containers. To force the removal of orphaned volumes that are no longer associated with any active container, run:
```bash
# Limpieza profunda de bajo impacto de recursos inactivos
docker system prune -a --volumes -f
```

### Paso 2: Localizar y vaciar archivos de registro (Logs) saturados
Containers that constantly print info to console generate logs in JSON format that can take up hundreds of gigabytes. Use this quick terminal script to identify the size of the logs and truncate them immediately without stopping your services:
```bash
# Listar y vaciar logs JSON acumulados en la ruta raíz de Docker
find /var/lib/docker/containers/ -name "*-json.log" -exec du -sh {} +

# Truncar logs a tamaño cero
sudo find /var/lib/docker/containers/ -name "*-json.log" -exec sh -c 'cat /dev/null > "{}"' \;
```

## 🛡️ Consejo de Prevención

Recommended safety practices:
- Prevent containers from accumulating log files uncontrollably on your local storage. Always configure automatic log rotation globally by adding limit parameters in the Docker daemon file (`/etc/docker/daemon.json`) before deploying your services:
  ```json
  {
    "log-driver": "json-file",
    "log-opts": {
      "max-size": "10m",
      "max-file": "3"
    }
  }
  ```

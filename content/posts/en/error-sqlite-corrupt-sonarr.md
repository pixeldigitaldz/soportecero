---
title: "How to Repair a Corrupted SQLite Database in Sonarr or Radarr"
description: "Learn how to recover your series and configurations by repairing the SQLite error 'database disk image is malformed' using command-line tools in Linux."
category: "Systems & Servers"
tags: ["Sonarr", "Radarr", "Database", "SQLite"]
readTime: "4 min"
date: "2026-08-03"
---

The corrupted database error in Sonarr or Radarr (identified in logs with the message `database disk image is malformed`) occurs when the internal SQLite file (`sonarr.db` or `radarr.db`) becomes corrupted due to interrupted writes, sudden server power outages, or file lock synchronization issues on network-attached storage systems.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Detener el contenedor o servicio afectado
Before manipulating the database, you must make sure that there are no processes writing to it. Stop the corresponding Docker container:
```bash
docker stop sonarr
```

### Paso 2: Ejecutar los comandos de recuperación de SQLite
Access the directory where container settings are saved (typically `/docker/sonarr/` or `/home/user/appdata/sonarr/`) and execute the SQLite rescue tools in your terminal:
```bash
# Exportar los datos sanos del archivo corrupto a una plantilla de recuperación
sqlite3 sonarr.db ".recover" | sqlite3 clean.db

# Respaldar la base de datos corrupta original
mv sonarr.db sonarr.db.bak

# Reemplazar la base de datos por la versión limpia recuperada
mv clean.db sonarr.db

# Verificar que los permisos del archivo sean correctos (ejemplo para Docker)
chmod 664 sonarr.db
```

### Paso 3: Reiniciar el servicio
Start the container or service again. Sonarr will read the restored file without issues:
```bash
docker start sonarr
```

## 🛡️ Consejo de Prevención

Recommended security practices:
- Never mount your media container databases (`sonarr.db`, `radarr.db`, or `plex.db`) on shared network paths via protocols such as NFS or SMB/CIFS. SQLite is not designed to coordinate simultaneous access with network latency. The lack of consistency in file locking across the network will corrupt the indexing index immediately upon the slightest connection fluctuation, destroying your configurations irreversibly.

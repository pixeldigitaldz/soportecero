---
title: "Cómo reparar una base de datos SQLite corrupta en Sonarr o Radarr"
description: "Aprende a recuperar tus series y configuraciones reparando el error 'database disk image is malformed' de SQLite mediante herramientas de consola en Linux."
category: "Sistemas y Servidores"
tags: ["Sonarr", "Radarr", "Database", "SQLite"]
readTime: "4 min"
date: "2026-06-27"
---

El error de base de datos corrupta en Sonarr o Radarr (identificado en los logs con el mensaje `database disk image is malformed`) ocurre cuando el archivo interno SQLite (`sonarr.db` o `radarr.db`) se corrompe por escrituras interrumpidas, cortes repentinos de energía en tu servidor o problemas de sincronización de bloqueos de archivos en sistemas de almacenamiento en red.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Detener el contenedor o servicio afectado
Antes de manipular la base de datos, debes asegurarte de que no haya ningún proceso escribiendo en ella. Detén el contenedor de Docker correspondiente:
```bash
docker stop sonarr
```

### Paso 2: Ejecutar los comandos de recuperación de SQLite
Accede al directorio donde se guardan las configuraciones del contenedor (típicamente `/docker/sonarr/` o `/home/usuario/appdata/sonarr/`) y ejecuta las herramientas de rescate de SQLite en tu terminal:
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
Vuelve a iniciar el contenedor o servicio. Sonarr leerá el archivo restaurado sin problemas:
```bash
docker start sonarr
```

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
- Jamás montes las bases de datos de tus contenedores multimedia (`sonarr.db`, `radarr.db` o `plex.db`) sobre rutas de red compartidas mediante protocolos como NFS o SMB/CIFS. SQLite no está diseñado para coordinar accesos simultáneos con latencia de red. La falta de consistencia en el bloqueo de archivos a través de la red corromperá el índice de indexación de inmediato ante la mínima fluctuación de conexión, destruyendo tus configuraciones de forma irreversible.

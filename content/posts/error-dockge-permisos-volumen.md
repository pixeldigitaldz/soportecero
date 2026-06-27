---
title: "Solución: Error de permisos (Permission Denied) en volúmenes de Docker Compose"
description: "Aprende a solucionar los fallos de lectura y escritura en carpetas locales montadas como volúmenes en contenedores Docker de Linux."
category: "Sistemas y Servidores"
tags: ["Docker", "Linux", "Servidores"]
readTime: "4 min"
date: "2026-06-26"
---

El error `io.containerd.runc.v2: OCI runtime create failed: permission denied` o los fallos internos donde un contenedor (como Nginx, Plex o un indexer) no puede guardar su configuración, ocurren porque el usuario interno del contenedor no tiene permisos del sistema de archivos de Linux para escribir en la carpeta del host que montaste en la sección `volumes:`.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Averiguar el UID y GID del contenedor
Muchos contenedores te permiten especificar con qué usuario del sistema deben ejecutarse mediante variables de entorno en el archivo `docker-compose.yml`. Revisa la documentación del contenedor buscando las variables `PUID` y `PGID`.

### Paso 2: Identificar tu usuario local
En la terminal de tu servidor, ejecuta el comando para ver el identificador de tu usuario actual:
```bash
id
```

Verás algo como `uid=1000(rodolfo) gid=1000(rodolfo)`. Toma nota de esos números.

### Paso 3: Corregir los permisos de la carpeta en el Host
Si montaste una carpeta local en `./config`, debes asignarle la propiedad al usuario correcto de tu Linux para que Docker pueda manipularla:
```bash
# Cambiar el propietario al usuario 1000
sudo chown -R 1000:1000 ./config

# Asegurar permisos de lectura y escritura estándar
sudo chmod -R 755 ./config
```

### Paso 4: Reiniciar el contenedor
Aplica un reinicio forzado para que el demonio de Docker tome la nueva configuración del disco:
```bash
docker compose down && docker compose up -d
```

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
* Jamás uses chmod 777 de forma masiva para solucionar problemas de Docker. Darle permisos de ejecución y escritura global a cualquiera expone tu servidor a que cualquier proceso comprometido modifique archivos raíz de tu sistema operativo.

---
title: "Cómo solucionar el error 'Permission Denied' en /var/run/docker.sock sin Sudo"
description: "Aprende a resolver el fallo de permisos al ejecutar comandos de Docker sin anteponer sudo agregando tu usuario al grupo docker de Linux."
category: "Sistemas y Servidores"
tags: ["Docker", "Linux", "Permissions"]
readTime: "3 min"
date: "2026-07-26"
---

El mensaje `permission denied while trying to connect to the Docker daemon socket at unix:///var/run/docker.sock` aparece cuando intentas ejecutar comandos de Docker sin privilegios de superusuario (`sudo`) y tu cuenta de Linux no pertenece al grupo con acceso al socket UNIX del demonio de Docker.

## 🔍 El Diagnóstico Rápido

| Síntoma | Causa Raíz | Solución |
|---|---|---|
| `permission denied while trying to connect to the Docker daemon socket` | El usuario actual no pertenece al grupo de sistema `docker` que administra `/var/run/docker.sock` | Agregar el usuario Linux al grupo `docker` y actualizar los permisos del socket o refrescar la sesión |

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Crear el grupo docker y agregar tu usuario

Comprueba si el grupo `docker` existe en tu sistema y agrega tu usuario actual a dicho grupo mediante `usermod`:

```bash
# Crear el grupo docker si no existe
sudo groupadd docker

# Agregar el usuario actual ($USER) al grupo docker
sudo usermod -aG docker $USER
```

### Paso 2: Actualizar la membresía de grupos en la sesión activa

Para que el cambio de grupo surta efecto sin necesidad de reiniciar el servidor o cerrar sesión por completo, ejecuta:

```bash
newgrp docker
```

Alternativamente, si estás en una sesión SSH o terminal de escritorio, puedes cerrar la sesión y volver a iniciarla.

### Paso 3: Verificar los permisos de /var/run/docker.sock y probar

Asegúrate de que el archivo de socket `/var/run/docker.sock` pertenezca al grupo `docker`:

```bash
ls -l /var/run/docker.sock
```

*(Debería mostrar un propietario como `root:docker` con permisos `srw-rw----`).*

Prueba la ejecución de Docker sin anteponer `sudo`:

```bash
docker run hello-world
```

## 🛡️ Consejos de Prevención

- **Evitar el uso de `chmod 777` en el socket**: Nunca otorgues permisos de lectura/escritura globales a `/var/run/docker.sock`, ya que expondrías todo el servidor anfitrión a riesgos de seguridad graves.
- **Evaluar Docker en modo sin raíz (Rootless Mode)**: En entornos de producción críticos, considera utilizar *Rootless Docker* para ejecutar el demonio y los contenedores dentro de un espacio de nombres de usuario sin privilegios de root.
- **Revisar scripts de CI/CD**: Asegúrate de que los agentes de integración continua (Jenkins, GitLab Runner, GitHub Actions runner) pertenezcan al grupo `docker` en la máquina anfitriona.

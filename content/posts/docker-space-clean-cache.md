---
title: "Cómo liberar espacio en disco eliminando caché y contenedores huérfanos en Docker"
description: "Guía completa para recuperar gigabytes en /var/lib/docker limpiando capas BuildKit, imágenes no utilizadas y volúmenes huérfanos."
category: "Sistemas y Servidores"
tags: ["Docker", "Linux", "DevOps", "SysAdmin", "Almacenamiento"]
readTime: "5 min"
date: "2026-06-25"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Directorio /var/lib/docker saturado por capas antiguas de compilación BuildKit e imágenes dangling** | Ejecutar `docker system prune -a --volumes` para recuperar espacio no utilizado |
| **Registros de logs masivos generados por contenedores en /var/lib/docker/containers/** | Configurar rotación de logs (log-driver max-size) en `/etc/docker/daemon.json` |

El crecimiento desmedido del directorio `/var/lib/docker` en servidores Linux es una de las causas más frecuentes de agotamiento de espacio en disco (error `no space left on device`). Esto ocurre porque Docker almacena de forma indefinida imágenes intermedias, capas de compilación en caché de BuildKit, contenedores detenidos y volúmenes anónimos huérfanos.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Analizar el uso de almacenamiento en Docker
Antes de borrar nada, identifica qué componentes están consumiendo más espacio:
```bash
# Ver el resumen de consumo de imágenes, contenedores y volúmenes
docker system df

# Ver información detallada de cada elemento
docker system df -v
```

### Paso 2: Limpiar imágenes, contenedores y redes en desuso
Ejecuta una purga integral de todos los recursos no asociados a contenedores actualmente en ejecución:
```bash
# Eliminar contenedores detenidos, redes no utilizadas e imágenes sin contenedor activo
docker system prune -a --force

# Limpiar específicamente la caché de compilación de BuildKit
docker builder prune -a --force
```

### Paso 3: Eliminar volúmenes huérfanos (Dangling Volumes)
Los volúmenes anónimos creados por bases de datos o servicios temporales no se borran automáticamente con `docker rm`:
```bash
# Listar volúmenes que no están vinculados a ningún contenedor
docker volume ls -qf dangling=true

# Eliminar todos los volúmenes huérfanos de forma segura
docker volume prune --force
```

### Paso 4: Limpiar y limitar los archivos de logs de contenedores
Si los logs de contenedores en formato JSON han crecido hasta ocupar varios gigabytes:
```bash
# Truncar logs de todos los contenedores en vivo sin detenerlos
sudo sh -c 'truncate -s 0 /var/lib/docker/containers/*/*-json.log'
```
Para evitar que vuelvan a crecer descontroladamente, crea o edita `/etc/docker/daemon.json`:
```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "3"
  }
}
```
Reinicia el servicio Docker para aplicar la rotación de logs:
```bash
sudo systemctl restart docker
```

## 🛡️ Consejos de Prevención
- **Automatiza tareas de mantenimiento semanales:** Añade un cron job con `docker system prune -f` para evitar acumulaciones masivas en servidores CI/CD.
- **Usa el flag --rm al compilar:** Al ejecutar contenedores temporales de depuración, utiliza siempre `docker run --rm` para que se eliminen automáticamente al salir.

## ❓ Preguntas Frecuentes (FAQ)

### ¿docker system prune -a borra las bases de datos de mis contenedores activos?
No. Los volúmenes y contenedores que estén en ejecución no son afectados. Sin embargo, si tienes contenedores detenidos que piensas volver a iniciar, asegúrate de utilizar volúmenes nombrados para proteger sus datos.

### ¿Cómo muevo /var/lib/docker a un disco secundario más grande?
Configura la directiva `"data-root": "/nuevo/disco/docker"` en `/etc/docker/daemon.json` y reinicia el servicio tras migrar los archivos.

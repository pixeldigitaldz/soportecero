---
title: "Cómo liberar espacio en disco eliminando caché y contenedores huérfanos en Docker"
description: "Optimiza el almacenamiento de tu servidor eliminando imágenes sin uso, volúmenes huérfanos y archivos de registros de contenedores en Docker."
category: "Sistemas y Servidores"
tags: ["Docker", "Linux", "Sysadmin"]
readTime: "4 min"
date: "2026-06-27"
---

La acumulación silenciosa de espacio en disco en servidores que corren Docker ocurre porque el motor de contenedores nunca elimina por defecto las imágenes antiguas cuando descargas actualizaciones, ni limpia los archivos temporales de compilación o los archivos de log que crecen indefinidamente en la ruta del host.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Ejecutar una limpieza de datos inactivos y volúmenes huérfanos
El comando `prune` elimina imágenes no utilizadas, redes y contenedores parados. Para forzar la eliminación de volúmenes huérfanos que ya no están asociados a ningún contenedor activo, corre:
```bash
# Limpieza profunda de bajo impacto de recursos inactivos
docker system prune -a --volumes -f
```

### Paso 2: Localizar y vaciar archivos de registro (Logs) saturados
Los contenedores que imprimen información en consola constantemente generan logs en formato JSON que pueden llegar a ocupar cientos de gigabytes. Utiliza este script rápido en consola para identificar el tamaño de los logs y truncarlos de inmediato sin detener tus servicios:
```bash
# Listar y vaciar logs JSON acumulados en la ruta raíz de Docker
find /var/lib/docker/containers/ -name "*-json.log" -exec du -sh {} +

# Truncar logs a tamaño cero
sudo find /var/lib/docker/containers/ -name "*-json.log" -exec sh -c 'cat /dev/null > "{}"' \;
```

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
- Evita que los contenedores acumulen archivos de registros de manera descontrolada en tu almacenamiento local. Configura siempre la rotación automática de logs a nivel global agregando parámetros de límites en el archivo daemon de Docker (`/etc/docker/daemon.json`) antes de desplegar tus servicios:
  ```json
  {
    "log-driver": "json-file",
    "log-opts": {
      "max-size": "10m",
      "max-file": "3"
    }
  }
  ```

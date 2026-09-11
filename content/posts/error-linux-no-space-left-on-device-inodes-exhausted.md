---
title: "[SOLUCIONADO] Error No Space Left on Device con Espacio Libre (Inodos Agotados en Linux)"
description: "¿Tu servidor Linux muestra No Space Left on Device pero df -h indica espacio disponible? Aprende a detectar y liberar inodos agotados paso a paso."
category: "Sistemas y Servidores"
tags: ["Linux","Sysadmin","Almacenamiento","Bash"]
readTime: "4 min"
date: "2026-09-11"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Millones de archivos temporales pequeños o sesiones PHP/Docker sin limpiar** | Buscar directorios con más inodos mediante find y eliminarlos |
| **Archivos eliminados que siguen retenidos por procesos en ejecución** | Identificar descriptores con lsof +L1 y reiniciar los servicios responsables |

El error `No space left on device` en Linux no solo ocurre cuando los gigabytes del disco duro se llenan. Cada archivo, enlace simbólico y directorio requiere una estructura de metadatos llamada **inodo**. Si tu sistema crea millones de archivos diminutos (como sesiones de PHP, logs o ficheros de caché), la tabla de inodos se agota al 100% aunque `df -h` muestre gigabytes de espacio disponible.

> **Solución Rápida (1 Minuto):**
> 1. Comprueba si los inodos están al 100%:
>    `df -ih`
> 2. Localiza la carpeta con más archivos acumulados:
>    `for d in /var/*; do echo -n "$d: "; find "$d" -xdev | wc -l; done | sort -k2 -n`

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Comprobar el consumo real de inodos en las particiones
Ejecuta el comando `df -ih` para inspeccionar el porcentaje de uso de inodos (campo *IUse%*) en lugar del espacio de almacenamiento en bytes:
```bash
df -ih
```
Si la partición raíz (`/`) o `/var` muestra un 100% en *IUse%*, has confirmado que el problema es el agotamiento de inodos.

### Paso 2: Localizar el directorio que satura los inodos
Para encontrar qué subdirectorio dentro de `/var` contiene una cantidad astronómica de ficheros diminutos, ejecuta este análisis rápido:
```bash
sudo du --inodes -d 2 /var | sort -rn | head -n 15
```
Los sospechosos habituales suelen ser:
- `/var/lib/php/sessions/` (sesiones PHP caducadas no recolectadas por garbage collection).
- `/var/spool/postfix/maildrop/` (correos de cron rebotados).
- `/var/log/` (registros rotados no comprimidos ni eliminados).

### Paso 3: Eliminar los ficheros masivos sin bloquear la terminal
No utilices `rm -rf *` en una carpeta con millones de archivos porque la shell arrojará el error `Argument list too long`. Utiliza `find` con la directiva `-delete`:
```bash
# Limpiar sesiones huérfanas de PHP
sudo find /var/lib/php/sessions/ -type f -cmin +1440 -delete

# Limpiar archivos de log antiguos
sudo find /var/log/ -type f -name "*.gz" -mtime +30 -delete
```
Comprueba inmediatamente después con `df -ih` cómo el porcentaje de uso de inodos desciende.

## 🛡️ Consejo de Prevención
* Configura tareas periódicas de rotación de logs con `logrotate` estableciendo un límite estricto en la directiva `rotate` y activando `compress`.
* Automatiza la limpieza de sesiones huérfanas y ficheros temporales con un cronjob en `/etc/cron.daily/`.

## Preguntas Frecuentes

### ¿Se puede ampliar el número de inodos de una partición ext4 existente?
En sistemas de archivos ext4, el número total de inodos se define al formatear la partición (con mkfs.ext4 -N). Para aumentarlo es necesario reformatear o migrar a sistemas con inodos dinámicos como XFS o Btrfs.

### ¿Por qué lsof muestra archivos eliminados ocupando inodos?
Si un proceso mantiene abierto un archivo que fue borrado del disco, el sistema operativo no libera el inodo ni los bloques hasta que el proceso finaliza. Identifícalos con `lsof +L1` y reinicia el servicio con systemctl.

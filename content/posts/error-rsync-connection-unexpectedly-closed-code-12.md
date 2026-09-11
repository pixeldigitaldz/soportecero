---
title: "[SOLUCIONADO] rsync error: error in rsync protocol data stream (code 12) connection unexpectedly closed"
description: "Soluciona el fallo rsync error code 12 connection unexpectedly closed al transferir archivos grandes o copias de seguridad por SSH."
category: "Sistemas y Servidores"
tags: ["rsync","SSH","Linux","Backup"]
readTime: "4 min"
date: "2026-09-21"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **El demonio rsync no está instalado en el servidor remoto de destino** | Instalar rsync en el host remoto ejecutando sudo apt install rsync |
| **Cierre de sesión SSH por inactividad o firewall cortando conexiones de archivos pesados** | Configurar ServerAliveInterval en SSH y usar las opciones -P --partial en rsync |

Durante la sincronización de archivos o respaldos remotos a través de SSH, la transferencia se interrumpe abruptamente arrojando: `rsync: connection unexpectedly closed (0 bytes received so far) [sender]` seguido de `rsync error: error in rsync protocol data stream (code 12) at io.c`. Este código de salida 12 significa que la comunicación entre los procesos de rsync emisor y receptor se rompió antes de completar el apretón de manos o la transferencia.

> **Solución Rápida (1 Minuto):**
> 1. Comprueba que rsync esté instalado en el servidor remoto:
>    `ssh usuario@servidor "which rsync"`
> 2. Transfiere con reanudación y mantenedor de conexión SSH activo:
>    `rsync -avzP -e "ssh -o ServerAliveInterval=30 -o TCPKeepAlive=yes" origen/ usuario@servidor:/destino/`

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Instalar el binario rsync en el servidor remoto
La causa más habitual de que la conexión se cierre inmediatamente con 0 bytes recibidos es que el servidor remoto no tiene instalado el paquete `rsync`:
```bash
# En el servidor remoto (Debian/Ubuntu)
sudo apt update && sudo apt install -y rsync

# En el servidor remoto (RHEL/AlmaLinux/Rocky)
sudo dnf install -y rsync
```

### Paso 2: Prevenir cortes de conexión SSH por inactividad (KeepAlive)
Si la desconexión ocurre a mitad de transferir un archivo de varios gigabytes, el firewall o el enrutador intermedio está cerrando las conexiones TCP inactivas. Añade parámetros KeepAlive en el flag `-e`:
```bash
rsync -avzP -e "ssh -o ServerAliveInterval=15 -o ServerAliveCountMax=4" /ruta/local/ usuario@servidor:/ruta/remota/
```

### Paso 3: Habilitar reanudación de archivos parciales (--partial)
Evita tener que reiniciar desde cero las transferencias interrumpidas utilizando el flag `--partial` o el combo `-P` (que equivale a `--partial --progress`):
```bash
rsync -avhP /var/backups/ usuario@servidor:/respaldos/
```
Si la red se corta, al volver a ejecutar el comando continuará exactamente en el megabyte donde se detuvo.

## 🛡️ Consejo de Prevención
* Configura `ClientAliveInterval 30` en `/etc/ssh/sshd_config` del servidor para evitar que sesiones de larga duración caigan en timeout.
* Para copias críticas de cientos de gigabytes, ejecuta rsync dentro de una sesión persistente de `tmux` o `screen`.

## Preguntas Frecuentes

### ¿Por qué rsync muestra "out of memory" antes del código de error 12?
Ocurre cuando rsync intenta construir la lista de millones de archivos en la memoria RAM de servidores con pocos recursos. Utiliza la bandera `--no-inc-recursive` o divide la sincronización por subcarpetas.

### ¿Cómo puedo ver el motivo exacto del fallo en la conexión?
Ejecuta rsync con doble nivel de detalle y depuración SSH: `rsync -vvv -e "ssh -vvv" ...` para ver qué extremo cerró la conexión TCP.

---
title: "[SOLUCIONADO] Error 'Host key verification failed' en SSH"
description: "¿Te sale el error 'Host key verification failed' o 'WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED' al conectar por SSH? Solución en 1 minuto."
category: "Sistemas y Servidores"
tags: ["SSH", "Linux", "Sysadmin", "Seguridad"]
readTime: "3 min"
date: "2026-08-03"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **La clave pública de la máquina remota cambió en el archivo known_hosts** | Eliminar la entrada antigua del host: `ssh-keygen -R IP_O_HOST` |
| **Ataque Man-in-the-Middle o reinstalación del sistema operativo del servidor** | Confirmar el nuevo huella digital de la clave e ingresar nuevamente mediante SSH |


El error **`Host key verification failed`** (acompañado de la advertencia en rojo `WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!`) ocurre cuando tu cliente SSH detecta que la huella digital criptográfica del servidor al que te intentas conectar no coincide con la llave guardada en tu archivo local `~/.ssh/known_hosts`.

Ocurre comúnmente cuando reinstalas el sistema operativo de tu VPS, cambias de servidor manteniendo la misma dirección IP o reconfiguras las llaves del servicio OpenSSH.

> **Solución Rápida (1 Minuto):**
> Elimina la clave antigua del servidor ejecutando:
> `ssh-keygen -R tu-direccion-ip-o-dominio`

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Eliminar la huella digital obsoleta del servidor
Ejecuta la herramienta nativa de `ssh-keygen` indicando la IP o nombre de host del servidor remoto:

```bash
ssh-keygen -R 192.168.1.100
```
*(Reemplaza `192.168.1.100` por la IP o dominio de tu servidor).*

Este comando busca y elimina automáticamente la línea en conflicto dentro de tu archivo `~/.ssh/known_hosts` y genera un respaldo de seguridad (`known_hosts.old`).

### Paso 2: Volver a conectar y aceptar la nueva huella digital
Intenta conectar nuevamente por SSH:

```bash
ssh usuario@192.168.1.100
```
La terminal mostrará la nueva huella criptográfica SHA256 e interactuará preguntando:
```plaintext
Are you sure you want to continue connecting (yes/no/[fingerprint])?
```
Escribe `yes` y presiona **Enter**. SSH registrará la nueva firma en `known_hosts` y establecerá la conexión normalmente.

### Paso 3: Limpieza manual en `known_hosts` (Alternativa)
Si la advertencia indica el número de línea exacto (por ejemplo: `Offending RSA key in /home/usuario/.ssh/known_hosts:42`):

Puedes abrir el archivo en tu editor de texto y eliminar la línea 42:
```bash
nano +42 ~/.ssh/known_hosts
```
Guarda los cambios (`Ctrl + O` -> `Enter`) y sal (`Ctrl + X`).

## 🛡️ Advertencia de Seguridad Importante
* Si **NO** has reinstalado el servidor ni cambiado su configuración y este error aparece de la nada en un servidor remoto de producción, **no elimines la clave a ciegas**. Podrías estar sufriendo un ataque de interceptación en la red conocido como **Man-in-the-Middle (MITM)**. Contacta primero al administrador de red o soporte de tu proveedor de hosting.

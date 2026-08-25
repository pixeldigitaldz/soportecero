---
title: "Cómo solucionar errores de firmas PGP corruptas y llaves inválidas en CachyOS"
description: "Aprende a restablecer y actualizar las claves del llavero de Pacman para corregir fallos de firma inválida en CachyOS y Arch Linux."
category: "Sistemas y Servidores"
tags: ["CachyOS", "Arch Linux", "Pacman", "Linux"]
readTime: "5 min"
date: "2026-07-18"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Claves PGP del llavero de pacman expiradas o desactualizadas en Arch/CachyOS** | Actualizar el keyring de pacman: `sudo pacman -Sy cachyos-keyring archlinux-keyring` |
| **Base de datos de firmas de repositorios corrupta en /etc/pacman.d/gnupg** | Reiniciar el llavero de llaves gpg: `sudo rm -rf /etc/pacman.d/gnupg && sudo pacman-key --init` |

El error crítico de Pacman `error: key "..." could not be looked up remotely` o `error: signature from "..." is invalid (corrupted package)` en CachyOS y distribuciones basadas en Arch Linux ocurre cuando el llavero local de firmas criptográficas de los desarrolladores queda desactualizado, el reloj del sistema está desfasado o la base de datos local de GnuPG se corrompe durante una descarga interrumpida. Esto bloquea la instalación y actualización de cualquier paquete por motivos de seguridad.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Sincronizar el reloj del sistema mediante NTP
Una causa muy frecuente de firmas criptográficas inválidas es un desfase en el reloj del sistema. Si la fecha de tu máquina no coincide con la fecha de emisión del certificado PGP, la validación fallará automáticamente:
```bash
# Forzar la sincronización horaria con los servidores NTP
sudo timedatectl set-ntp true

# Comprobar el estado del reloj del sistema
timedatectl status
```

### Paso 2: Limpiar paquetes corruptos de la caché local de Pacman
Elimina cualquier archivo `.pkg.tar.zst` descargado parcialmente que contenga firmas defectuosas en el disco:
```bash
# Limpiar por completo la caché de paquetes de Pacman
sudo pacman -Scc --noconfirm
```

### Paso 3: Inicializar y repoblar el llavero criptográfico desde cero
Si la base de datos de claves locales sufrió corrupción de datos, renuévala por completo:
```bash
# 1. Eliminar el directorio de firmas local corrupto
sudo rm -rf /etc/pacman.d/gnupg

# 2. Inicializar un nuevo llavero de seguridad en limpio
sudo pacman-key --init

# 3. Poblar el llavero con las firmas oficiales de Arch y CachyOS
sudo pacman-key --populate archlinux cachyos
```

### Paso 4: Actualizar los paquetes de llaveros oficiales y sincronizar el sistema
Instala las versiones más recientes de los llaveros de firmas sin verificar dependencias cruzadas y luego ejecuta la actualización completa:
```bash
# Actualizar los paquetes keyring de Arch y CachyOS
sudo pacman -Sy archlinux-keyring cachyos-keyring --noconfirm

# Refrescar las claves con los servidores de claves PGP oficiales
sudo pacman-key --refresh-keys

# Ejecutar una actualización completa del sistema
sudo pacman -Syu
```

## 🛡️ Consejos de Prevención
- **No deshabilites la verificación de firmas:** Evita cambiar la directiva `SigLevel = Required Database Optional` por `TrustAll` o `Never` en `/etc/pacman.conf`. Desactivar la seguridad PGP deja tu sistema vulnerable a ataques de intermediario (MitM) e inyección de binarios maliciosos.
- **Mantén el llavero actualizado periódicamente:** Si dejas un sistema Arch o CachyOS sin actualizar durante varios meses, actualiza siempre primero el paquete `archlinux-keyring` antes de realizar `pacman -Syu`.

## ❓ Preguntas Frecuentes (FAQ)

### ¿Por qué pacman-key --refresh-keys tarda tanto o da timeout?
Los servidores de claves de Ubuntu o MIT a menudo sufren congestión o bloqueos de firewall en el puerto 11371. Si falla, utiliza el servidor de claves de Arch añadiendo el parámetro: `sudo pacman-key --refresh-keys --keyserver hkps://keyserver.ubuntu.com`.

### ¿Qué hago si un paquete específico sigue dando error de firma tras repoblar?
Puedes forzar la descarga de la base de datos con `sudo pacman -Syy` y verificar si ese paquete en particular fue marcado como huérfano en los repositorios de CachyOS.

---
title: Cómo actualizar el llavero archlinux-keyring cuando Pacman falla al instalar paquetes
description: >-
  Guía de solución rápida para corregir errores de firmas PGP inválidas o desconocidas y actualizar archlinux-keyring en Arch Linux, Manjaro y CachyOS.
category: Sistemas y Servidores
tags:
  - Arch Linux
  - Pacman
  - Sysadmin
readTime: 4 min
date: '2026-08-04'
---

Al intentar actualizar el sistema o instalar nuevos paquetes en Arch Linux o distribuciones derivadas (como CachyOS, EndeavourOS o Manjaro) mediante `pacman -Syu`, es muy común enfrentarse a errores como `error: signature from "Developer Name <email>" is unknown trust` o `error: el paquete es inválido o está dañado (firma PGP inválida)`. Esto ocurre porque las claves GPG del proyecto Arch Linux expiran o cambian con el tiempo, y el llavero local (`archlinux-keyring`) no puede validar los paquetes firmados por los mantenedores oficiales.

## Diagnóstico Rápido

| Causa | Solución |
|---|---|
| **`error: signature from "..." is unknown trust` o `invalid or corrupted package` al usar pacman**: Las claves PGP de los desarrolladores cambiaron o el llavero local lleva meses sin actualizarse | Actualizar primero `archlinux-keyring` de forma aislada y reiniciar la base de datos de GPG |
| **Pacman falla al descargar las firmas `.sig` de los repositorios espejo**: Espejos (mirrors) desactualizados o hora del sistema fuera de sincronía | Sincronizar el reloj del sistema mediante `systemd-timesyncd` y actualizar la lista de mirrors |
| **El comando `pacman -Sy archlinux-keyring` también falla por firmas corruptas**: La base de datos de claves PGP local (`/etc/pacman.d/gnupg`) se encuentra corrupta | Eliminar la carpeta de claves GPG, re-inicializar el keyring y poblar las claves master |

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Sincronizar el reloj del sistema (NTP)
Las claves PGP dependen de marcas de tiempo precisas para verificar su validez. Si el reloj del sistema está desfasado, pacman rechazará todas las firmas:

```bash
# Activar la sincronización de hora en Linux
sudo systemctl enable --now systemd-timesyncd

# Verificar que la hora local y el reloj de red coincidan
timedatectl status
```

### Paso 2: Actualizar `archlinux-keyring` de forma aislada
Antes de intentar una actualización completa del sistema (`pacman -Syu`), fuerza la actualización única del llavero oficial:

```bash
# Sincronizar repositorios e instalar únicamente archlinux-keyring
sudo pacman -Sy archlinux-keyring

# Si utilizas CachyOS o Manjaro, actualiza también sus llaveros específicos:
# sudo pacman -Sy cachyos-keyring
# sudo pacman -Sy manjaro-keyring

# Tras actualizar el keyring exitosamente, procede con la actualización general:
sudo pacman -Syu
```

### Paso 3: Regenerar y limpiar el llavero de GPG (En caso de corrupción grave)
Si la actualización aislada falla con errores de clave de confianza desconocida, debes eliminar y reconstruir la base de datos de claves `/etc/pacman.d/gnupg`:

```bash
# 1. Eliminar la carpeta de claves corrupta
sudo rm -rf /etc/pacman.d/gnupg

# 2. Re-inicializar el llavero de Pacman
sudo pacman-key --init

# 3. Poblar el llavero con las claves de los desarrolladores oficiales de Arch Linux
sudo pacman-key --populate archlinux

# En CachyOS / Manjaro añadir también:
# sudo pacman-key --populate cachyos

# 4. Refrescar las claves con los servidores de claves PGP
sudo pacman-key --refresh-keys

# 5. Limpiar la caché de paquetes y ejecutar la actualización
sudo pacman -Sc --noconfirm
sudo pacman -Syu
```

## 🛡️ Consejos de Prevención

- **Actualiza el sistema periódicamente**: En distribuciones *rolling release* como Arch Linux, dejar el sistema sin actualizar durante varios meses incrementa exponencialmente las probabilidades de desfase en el llavero PGP.
- **Habilita el temporizador de actualización de keyring**: Mantén `archlinux-keyring-wkd-sync.timer` activo si existe en tu distribución para refrescar claves en segundo plano:
  ```bash
  sudo systemctl enable --now archlinux-keyring-wkd-sync.timer
  ```
- **Nunca deshabilites `SigLevel = Never` en `/etc/pacman.conf`**: Desactivar la comprobación de firmas digitales para resolver el error expone el sistema a la instalación de paquetes manipulados o maliciosos.

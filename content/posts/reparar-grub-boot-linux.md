---
title: "Guía rápida para recuperar el cargador de arranque GRUB corrupto en Linux"
description: "Aprende a restablecer el cargador de arranque GRUB en sistemas UEFI y BIOS utilizando una distribución Live USB y la herramienta chroot."
category: "Sistemas y Servidores"
tags: ["Linux", "GRUB", "Bootloader"]
readTime: "4 min"
date: "2026-06-27"
---

El fallo en el cargador de arranque GRUB (dejando el sistema congelado en la consola de rescate `grub>`) suele ocurrir tras una actualización de kernel fallida, fallos en la tabla de particiones EFI o tras configurar arranques duales con Windows. Para repararlo, debemos montar e ingresar al sistema de archivos dañado desde un entorno temporal.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Iniciar desde una distribución Live USB y localizar particiones
Introduce un Live USB compatible con tu distribución actual, arráncalo en modo UEFI/BIOS y detecta el identificador de tu disco duro:
```bash
sudo fdisk -l
```
*(Identifica tu partición raíz de Linux, por ejemplo `/dev/sda2`, y la partición EFI en formato FAT32, por ejemplo `/dev/sda1`).*

### Paso 2: Montar el sistema dañado y preparar el chroot
Monta la estructura de directorios del sistema de archivos dañado en la sesión temporal:
```bash
# Montar partición raíz
sudo mount /dev/sda2 /mnt

# Montar directorios de comunicación del kernel
for i in /dev /dev/pts /proc /sys /run; do sudo mount -B $i /mnt$i; done

# Montar partición EFI si usas UEFI
sudo mount /dev/sda1 /mnt/boot/efi
```

### Paso 3: Entrar al sistema (chroot) y reinstalar GRUB
Ingresa como superusuario al entorno de tu sistema de archivos original y reinstala el cargador de arranque:
```bash
# Cambiar la raíz del shell
sudo chroot /mnt /bin/bash

# Reinstalar GRUB apuntando al disco (reemplazar /dev/sda por el disco físico general)
grub-install /dev/sda

# Regenerar el archivo de configuración del menú de arranque
update-grub

# Salir y desmontar
exit
sudo reboot
```

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
- Antes de modificar el orden de particiones o instalar actualizaciones mayores del kernel, genera respaldos de la configuración de GRUB (`/etc/default/grub`). Nunca manipules o fuerces la instalación de GRUB en la partición EFI (`grub-install /dev/sda1`) en lugar del dispositivo físico del disco (`/dev/sda`), ya que esto puede corromper las tablas de montaje EFI de tu placa base de forma permanente, impidiendo que reconozca cualquier medio de almacenamiento durante la autocomprobación de encendido (POST).

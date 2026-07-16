---
title: "Quick guide to recover a corrupt GRUB bootloader in Linux"
description: "Learn how to restore the GRUB bootloader on UEFI and BIOS systems using a Live USB distribution and the chroot tool."
category: "Systems & Servers"
tags: ["Linux", "GRUB", "Bootloader"]
readTime: "4 min"
date: "2026-08-07"
---

GRUB bootloader failure (leaving the system frozen at the `grub>` rescue console) usually occurs after a failed kernel update, EFI partition table failures, or after configuring dual boots with Windows. To repair it, we must mount and enter the damaged file system from a temporary environment.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Iniciar desde una distribución Live USB y localizar particiones
Insert a Live USB compatible with your current distribution, boot it in UEFI/BIOS mode, and detect your hard drive identifier:
```bash
sudo fdisk -l
```
*(Identify your Linux root partition, for example `/dev/sda2`, and the EFI partition in FAT32 format, for example `/dev/sda1`).*

### Paso 2: Montar el sistema dañado y preparar el chroot
Mount the directory structure of the damaged file system in the temporary session:
```bash
# Montar partición raíz
sudo mount /dev/sda2 /mnt

# Montar directorios de comunicación del kernel
for i in /dev /dev/pts /proc /sys /run; do sudo mount -B $i /mnt$i; done

# Montar partición EFI si usas UEFI
sudo mount /dev/sda1 /mnt/boot/efi
```

### Paso 3: Entrar al sistema (chroot) y reinstalar GRUB
Log in as a superuser into your original file system environment and reinstall the bootloader:
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

Recommended security practices:
- Before modifying the partition order or installing major kernel updates, generate backups of the GRUB configuration (`/etc/default/grub`). Never manipulate or force GRUB installation on the EFI partition (`grub-install /dev/sda1`) instead of the physical disk device (`/dev/sda`), as this can permanently corrupt your motherboard's EFI mount tables, preventing it from recognizing any storage media during the power-on self-test (POST).

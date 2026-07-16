---
title: "How to reset a forgotten root user password in Linux systems"
description: "Step-by-step guide to recover root administrative access to your physical or virtual server by modifying the GRUB bootloader."
category: "Systems & Servers"
tags: ["Linux", "Sysadmin", "Security"]
readTime: "4 min"
date: "2026-08-08"
---

Losing the root administrator password on a physical Linux server or virtual machine blocks all access to system configurations. Fortunately, if you have physical access or access to the virtualization emulator console (KVM/IPMI), you can bypass authentication by editing kernel parameters in GRUB.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Acceder e interceptar el cargador de arranque GRUB
1. Restart the server.
2. When the **GRUB** operating system selection menu screen appears, immediately press the `e` key on your keyboard to edit the boot variables of the selected kernel.

### Paso 2: Modificar los parámetros del kernel
1. Scroll down using the arrow keys to locate the line starting with the word `linux` or `linux16`.
2. Go to the end of that line, delete the silent boot words (such as `rhgb quiet`) and add the following command to force the kernel to open a secure command prompt instead of the login interface:
```plaintext
init=/bin/bash
```
3. Press the `Ctrl + X` or `F10` key combination to boot the server with this new temporary configuration.

### Paso 3: Montar el disco en modo escritura y cambiar la clave
The system will boot directly as superuser without asking for a password, but with the disk configured in read-only mode. Enable write access to save changes:
```bash
# Remontar la partición raíz con privilegios de escritura
mount -o remount,rw /

# Modificar la clave del usuario administrador root
passwd root

# Forzar el reetiquetado de seguridad si usas SELinux (esencial en RHEL/Fedora/Rocky)
touch /.autorelabel

# Reiniciar el equipo
exec /sbin/init
```

## 🛡️ Consejo de Prevención

Recommended security practices:
- The ability to reset passwords in this way is a kernel feature, but it represents a major security risk if an attacker has physical access to your local servers. Protect your production system's bootloader by setting an access password for the GRUB console (`grub-mkpasswd-pbkdf2`), which will prevent unauthorized users from editing kernel parameters without prior authentication.

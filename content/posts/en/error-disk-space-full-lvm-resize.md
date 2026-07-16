---
title: "How to Resize an LVM Volume in Linux When the Disk Runs Out of Space"
description: "Learn how to safely extend an LVM logical volume and its EXT4 or XFS filesystem without losing data and without shutting down the server."
category: "Systems & Servers"
tags: ["Linux", "Sysadmin", "LVM"]
readTime: "4 min"
date: "2026-07-26"
---

The disk full error (`No space left on device`) on a Linux server using LVM (Logical Volume Manager) can paralyze databases and services. The advantage of LVM is that it allows hot storage expansion, adding physical space to the logical volume and extending the file system without needing a reboot.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Identificar el volumen lógico y el espacio disponible
First, verify which partition is saturated and locate the path of your logical volume:
```bash
# Ver el uso de disco de todas las particiones
df -h

# Listar los volúmenes lógicos activos
sudo lvdisplay
```
*(Anota la ruta del volumen que quieres extender, por ejemplo `/dev/mapper/vg_system-lv_root`).*

### Paso 2: Escanear el nuevo almacenamiento físico
If you have expanded the virtual disk in your hypervisor (Proxmox, VMware, KVM), you must tell the Linux kernel to detect the physical disk size change (for example, `/dev/sda`):
```bash
# Forzar un re-escaneo del bus SCSI para detectar la nueva capacidad
echo 1 | sudo tee /sys/class/block/sda/device/rescan

# Notificar a LVM que el volumen físico ha cambiado de tamaño
sudo pvresize /dev/sda
```

### Paso 3: Extender el volumen lógico y el sistema de archivos
Once the physical volume recognizes the new space, proceed to expand the logical volume and resize its internal structure in a single step:
```bash
# Para sistemas con formato EXT4 (extiende volumen lógico y sistema de archivos simultáneamente)
sudo lvextend -r -l +100%FREE /dev/mapper/vg_system-lv_root

# Si el sistema de archivos usa XFS, ejecuta la extensión de forma explícita
sudo lvextend -l +100%FREE /dev/mapper/vg_system-lv_root
sudo xfs_growfs /
```

## 🛡️ Consejo de Prevención

Recommended safety practices:
- Never reduce the size of an LVM logical volume (`lvreduce`) hot or without having made a full backup of your database beforehand. While expanding storage is a safe task that executes in milliseconds, volume reduction is highly destructive and can permanently corrupt file descriptors if the assigned logical size falls below the actual volume of your data.

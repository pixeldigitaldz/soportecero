---
title: "Cómo redimensionar un volumen LVM en Linux cuando el disco se queda sin espacio"
description: "Aprende a extender de forma segura un volumen lógico LVM y su sistema de archivos EXT4 o XFS sin perder datos y sin apagar el servidor."
category: "Sistemas y Servidores"
tags: ["Linux", "Sysadmin", "LVM"]
readTime: "4 min"
date: "2026-07-06"
---

El error de disco lleno (`No space left on device`) en un servidor Linux que utiliza LVM (Logical Volume Manager) puede paralizar bases de datos y servicios. La ventaja de LVM es que permite expandir el almacenamiento en caliente, sumando espacio físico al volumen lógico y extendiendo el sistema de archivos sin necesidad de reiniciar.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Identificar el volumen lógico y el espacio disponible
Primero, verifica qué partición está saturada y localiza la ruta de tu volumen lógico:
```bash
# Ver el uso de disco de todas las particiones
df -h

# Listar los volúmenes lógicos activos
sudo lvdisplay
```
*(Anota la ruta del volumen que quieres extender, por ejemplo `/dev/mapper/vg_system-lv_root`).*

### Paso 2: Escanear el nuevo almacenamiento físico
Si has ampliado el disco virtual en tu hipervisor (Proxmox, VMware, KVM), debes indicarle al núcleo de Linux que detecte el cambio de tamaño del disco físico (por ejemplo, `/dev/sda`):
```bash
# Forzar un re-escaneo del bus SCSI para detectar la nueva capacidad
echo 1 | sudo tee /sys/class/block/sda/device/rescan

# Notificar a LVM que el volumen físico ha cambiado de tamaño
sudo pvresize /dev/sda
```

### Paso 3: Extender el volumen lógico y el sistema de archivos
Una vez que el volumen físico reconoce el nuevo espacio, procede a ampliar el volumen lógico y a redimensionar su estructura interna en un solo paso:
```bash
# Para sistemas con formato EXT4 (extiende volumen lógico y sistema de archivos simultáneamente)
sudo lvextend -r -l +100%FREE /dev/mapper/vg_system-lv_root

# Si el sistema de archivos usa XFS, ejecuta la extensión de forma explícita
sudo lvextend -l +100%FREE /dev/mapper/vg_system-lv_root
sudo xfs_growfs /
```

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
- Nunca reduzcas el tamaño de un volumen lógico LVM (`lvreduce`) en caliente o sin haber realizado un respaldo completo previo de tu base de datos. Mientras que la extensión de almacenamiento es una tarea segura que se ejecuta en milisegundos, la reducción de volumen es altamente destructiva y puede corromper los descriptores de archivos de forma permanente si el tamaño lógico asignado queda por debajo del volumen real de tus datos.

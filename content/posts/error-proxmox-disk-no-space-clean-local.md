---
title: "Cómo liberar espacio en disco en Proxmox VE limpiando cachés y plantillas LXC"
description: "Aprende a solucionar el error de espacio de disco agotado en Proxmox VE eliminando ISOs duplicadas y copias de seguridad huérfanas de forma segura."
category: "Sistemas y Servidores"
tags: ["Proxmox", "Sysadmin", "Linux"]
readTime: "4 min"
date: "2026-08-10"
---

El error de espacio agotado en el almacenamiento local de Proxmox VE (`No space left on device` o fallos al arrancar máquinas virtuales) ocurre debido a la acumulación de imágenes ISO obsoletas, plantillas LXC no utilizadas, copias de seguridad de Dump antiguas y archivos de registro persistentes de contenedores corruptos en el directorio `/var/log`.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Analizar qué almacenamiento de Proxmox está saturado
Conéctate por SSH a tu nodo de Proxmox VE y ejecuta una comprobación detallada del espacio libre en tus bloques de disco locales:
```bash
# Comprobar el espacio libre de disco en las particiones del sistema
df -h

# Localizar directorios que consumen más espacio bajo el almacenamiento local
du -sh /var/lib/pve/local-bgs/* /var/lib/vz/*
```

### Paso 2: Eliminar imágenes ISO y plantillas LXC descargadas y sin usar
Puedes purgar las imágenes de instalación de sistemas operativos (ISOs) y las plantillas de contenedores de Linux de forma segura desde la consola para liberar espacio inmediato:
```bash
# Eliminar ISOs obsoletas en el almacenamiento vz
rm -f /var/lib/vz/template/iso/*.iso

# Eliminar plantillas de contenedores LXC descargadas
rm -f /var/lib/vz/template/cache/*.tar.xz
```

### Paso 3: Limpiar los registros persistentes acumulados de systemd
Los logs del sistema de Proxmox VE pueden acumular gigabytes de información inútil si tus máquinas virtuales envían alertas repetitivas por fallos internos de hardware o red:
```bash
# Forzar la rotación y reducir el espacio de logs a un máximo de 100 Megabytes
sudo journalctl --vacuum-size=100M
```

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
- No elimines ni modifiques manualmente los archivos de disco virtual (`.raw` o `.qcow2`) ubicados directamente en los directorios de datos `/var/lib/vz/images/` sin antes dar de baja la máquina virtual desde la interfaz web de administración de Proxmox. El borrado directo de descriptores de disco corrompe la configuración de la base de datos de clúster de Proxmox (`pve-cluster`), provocando inconsistencias lógicas que impiden migrar o restaurar máquinas de forma segura.

---
title: "Memoria virtual en Linux: Cómo configurar y optimizar el uso de Swap"
description: "Aprende a crear un archivo Swapfile, configurar persistencia en fstab y ajustar swappiness y vfs_cache_pressure en Linux."
category: "Sistemas y Servidores"
tags: ["Linux", "SysAdmin", "Swap", "Rendimiento", "Ubuntu", "Debian"]
readTime: "5 min"
date: "2026-06-27"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Servidor o PC sin memoria Swap configurada sufriendo cierres por OOM Killer** | Crear un swapfile de 4GB a 8GB con `fallocate` o `dd` y activarlo con `swapon` |
| **Uso excesivo y lento de Swap con RAM libre disponible (swappiness alto)** | Reducir el parámetro `vm.swappiness` a 10 o 20 en `/etc/sysctl.conf` |

En sistemas operativos Linux, la memoria Swap (espacio de intercambio) permite al kernel descargar páginas de memoria RAM inactivas hacia el disco de almacenamiento, liberando memoria física de alta velocidad para la caché del sistema de archivos y aplicaciones activas. Un sistema sin Swap o con un valor de `swappiness` inadecuado sufrirá congelamientos o cierres forzados por el OOM Killer.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Crear e inicializar un archivo Swap seguro (Swapfile)
Si tu servidor carece de partición Swap, crea un archivo de intercambio en la raíz del sistema:
```bash
# 1. Comprobar si ya existe swap activa
sudo swapon --show
free -h

# 2. Crear un archivo preasignado de 4GB (o 8GB según tu RAM)
sudo fallocate -l 4G /swapfile

# Si fallocate no es compatible con tu sistema de archivos (ej. Btrfs o XFS antiguo):
# sudo dd if=/dev/zero of=/swapfile bs=1M count=4096 status=progress

# 3. Asignar permisos estrictos de solo lectura/escritura para root
sudo chmod 600 /swapfile

# 4. Formatear el archivo como área de intercambio
sudo mkswap /swapfile

# 5. Activar el Swapfile en el sistema
sudo swapon /swapfile
```

### Paso 2: Configurar la persistencia del montaje en /etc/fstab
Asegura que el archivo Swap se monte automáticamente tras cada reinicio del sistema:
```bash
# Hacer una copia de seguridad de fstab
sudo cp /etc/fstab /etc/fstab.bak

# Añadir la entrada persistente
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Paso 3: Optimizar los parámetros del kernel (swappiness y vfs_cache_pressure)
Por defecto, muchas distribuciones tienen `vm.swappiness=60`, lo que hace que el kernel utilice el disco antes de lo necesario. Para servidores y equipos de escritorio con SSD:
```bash
# Comprobar el valor actual
cat /proc/sys/vm/swappiness

# Establecer temporalmente swappiness a 10 (solo usa swap bajo presión real)
sudo sysctl vm.swappiness=10
sudo sysctl vm.vfs_cache_pressure=50

# Hacer la configuración permanente en /etc/sysctl.d/99-swap.conf
echo -e "vm.swappiness=10\nvm.vfs_cache_pressure=50" | sudo tee /etc/sysctl.d/99-swap.conf
sudo sysctl --system
```

### Paso 4: Verificar el estado de la memoria
Comprueba con `free -h` que el nuevo espacio Swap aparece activo y disponible.

## 🛡️ Consejos de Prevención
- **Cuidado en sistemas de archivos Btrfs:** En Btrfs, los archivos swap requieren atributos especiales (`chattr +C /swapfile`) para desactivar el Copy-on-Write (CoW) antes de asignar espacio.
- **Utiliza ZRAM en equipos con poca memoria:** Para dispositivos con 2GB a 4GB de RAM (como Raspberry Pi), considera `zram-tools` para comprimir memoria en RAM en lugar de escribir en discos lentos.

## ❓ Preguntas Frecuentes (FAQ)

### ¿Cuánta memoria Swap debo asignar?
Como regla general: para sistemas con menos de 4GB de RAM, asigna el doble de RAM en Swap. Para sistemas con 8GB a 16GB, asigna entre 4GB y 8GB de Swap. Para más de 32GB de RAM, 4GB a 8GB suelen ser suficientes para amortiguar picos.

### ¿El archivo Swap desgasta los discos SSD?
Con un `swappiness` bajo (10 a 20), la escritura en Swap es mínima y no afectará la vida útil de los SSD modernos con nivelación de desgaste (wear leveling).

---
title: "Cómo configurar y optimizar el uso de memoria Swap en servidores Linux"
description: "Aprende a crear un archivo swapfile para evitar la caída de tus aplicaciones por falta de memoria RAM y optimiza el valor de swappiness."
category: "Sistemas y Servidores"
tags: ["Linux", "Sysadmin", "Swap"]
readTime: "4 min"
date: "2026-06-27"
---

El desbordamiento de memoria RAM en servidores en la nube sin particiones de intercambio (Swap) provoca que el kernel de Linux active el proceso asesino `OOM Killer` (Out of Memory Killer), deteniendo de inmediato aplicaciones críticas como bases de datos MySQL, servidores web Nginx o procesos de Node.js.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Crear e inicializar un archivo Swap seguro (Swapfile)
Si tu servidor VPS no cuenta con memoria de intercambio asignada, puedes generar un archivo dinámico de 4GB para mitigar picos de consumo:
```bash
# Crear un archivo vacío preasignado
sudo dd if=/dev/zero of=/swapfile bs=1M count=4096

# Asignar permisos estrictos de superusuario
sudo chmod 600 /swapfile

# Dar formato de intercambio al archivo
sudo mkswap /swapfile

# Activar el archivo como memoria Swap en el sistema
sudo swapon /swapfile
```

### Paso 2: Configurar la persistencia del montaje
Edita la tabla de sistemas de archivos del kernel (`/etc/fstab`) para asegurar que el sistema cargue la memoria de intercambio automáticamente al encenderse:
```bash
echo "/swapfile none swap sw 0 0" | sudo tee -a /etc/fstab
```

### Paso 3: Optimizar el umbral de activación (Swappiness)
El valor predeterminado de `swappiness` (normalmente 60) obliga al kernel a escribir en el disco demasiado pronto, lo que puede ralentizar servidores. Para optimizar el uso de memoria física RAM al máximo, baja el valor a `10` o `20`:
```bash
# Cambiar el valor temporalmente en memoria
sudo sysctl vm.swappiness=10

# Fijar la configuración en los parámetros del sistema
echo "vm.swappiness=10" | sudo tee -a /etc/sysctl.conf
```

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
- Evita ubicar archivos de memoria Swap en almacenamiento SSD secundario de baja calidad o discos externos compartidos. El ciclo constante de lecturas y escrituras intensivas puede desgastar físicamente las celdas de almacenamiento SSD de grado de consumo antes de tiempo, degradando de forma irreversible las tasas de transferencia de datos de tu disco duro principal.

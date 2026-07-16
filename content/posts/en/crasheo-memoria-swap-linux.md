---
title: "How to Fix Out of Memory (SWAP) Crashes in Linux (CachyOS / Bazzite)"
description: "Prevent your heavy games and Docker instances from closing unexpectedly by configuring or expanding SWAP memory space on modern Linux distributions."
category: "Gaming Tech"
tags: ["Linux", "Optimization", "Gaming"]
readTime: "4 min"
date: "2026-07-20"
---

When running demanding titles on modern hardware under high-performance Linux distributions like **CachyOS** or **Bazzite**, the system may suddenly close your games or heavy containers without warning. When checking the logs, the culprit is usually the `Out Of Memory (OOM) Killer` process.

This happens because the system runs out of physical RAM and, failing to find enough virtual memory (**SWAP space**) configured on local storage, freezes or kills the application to protect the operating system.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Comprobar tu estado actual de SWAP
Open your terminal and run the following command to see if you have virtual memory active:
```bash
swapon --show
```
If no response line appears, your system completely lacks swap memory.

### Paso 2: Crear un archivo SWAP seguro de 8 Gigabytes
For gaming and editing, an 8GB file allocated on your SSD is ideal for supporting spikes in RAM consumption. Run the following commands in order:
```bash
# 1. Crear el archivo asignando el espacio
sudo fallocate -l 8G /swapfile

# 2. Darle permisos de seguridad correctos
sudo chmod 600 /swapfile

# 3. Formatear el archivo como espacio de intercambio
sudo mkswap /swapfile

# 4. Activar la nueva memoria SWAP
sudo swapon /swapfile
```

### Paso 3: Hacer el cambio permanente para cada reinicio
To prevent the configuration from being erased when shutting down the PC, add the file to the system partition table:
1. Open the configuration file:
```bash
sudo nano /etc/fstab
```
2. Add the following line at the very end:
```plaintext
/swapfile none swap sw 0 0
```
Save (Ctrl + O, Enter) and exit (Ctrl + X).

## 🛡️ Consejo de Prevención
Recommended safety practices:
- If you use modern systems, look into using zRAM instead of a traditional SWAP file. zRAM compresses data directly in your physical RAM, being up to 10 times faster than reading and writing to a solid-state drive (SSD).

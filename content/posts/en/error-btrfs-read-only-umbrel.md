---
title: "How to Repair a BTRFS Filesystem Locked in Read-Only Mode on Your Server"
description: "Step-by-step guide to recover write access on home server hard drives that lock to protect your data from corruption."
category: "Systems & Servers"
tags: ["BTRFS", "Linux", "Storage"]
readTime: "4 min"
date: "2026-07-23"
---

When a secondary hard drive configured with the modern BTRFS file system (very common in storage arrays and home servers like Umbrel or ZimaOS) detects a write error, a power outage, or corrupt sectors, the Linux kernel automatically changes its state to `Read-Only` to prevent existing information from being destroyed. This immediately freezes all your automation and download applications.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Desmontar la unidad afectada
Do not attempt to force writing data onto a locked disk. First, stop the Docker services that are using it and unmount the path:
```bash
sudo systemctl stop docker
sudo umount /dev/sdb1
```
*(Reemplaza `/dev/sdb1` por la nomenclatura exacta de tu disco detectado).*

### Paso 2: Ejecutar una verificación de errores limpia (Check Scratch)

We will use BTRFS internal tools to scan the storage metadata tree without modifying blocks:
```bash
sudo btrfs check --readonly /dev/sdb1
```

Read the last lines in the terminal. If the system reports minor errors in the free space map (*free space cache*), we can order a safe repair of the file descriptors by running:
```bash
sudo btrfs check --repair /dev/sdb1
```
*(Nota: Ejecuta la reparación únicamente si el check previo te lo sugiere explícitamente).*

### Paso 3: Remontar el disco en modo de rescate limpio

If the volume continues to cause issues, force it to boot by cleaning the records of old corrupt transitions:
```bash
sudo mount -o remount,clear_cache,rw /dev/sdb1 /mnt/storage
```

## 🛡️ Consejo de Prevención

Recommended safety practices:
- Electrical power drops are the number one enemy of Linux-based servers. If you have your server connected directly to the wall outlet without an uninterruptible power supply (UPS), you run the latent risk of losing entire partitions due to a blackout. Configuring your hard drives with safe mount parameters like `noatime` reduces constant write cycles and protects the hardware life.

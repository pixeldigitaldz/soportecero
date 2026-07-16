---
title: "How to Free Disk Space by Properly Cleaning Pacman Cache in CachyOS"
description: "Avoid running out of space on your SSD by recovering gigabytes of data accumulated by the Pacman package manager in Arch Linux distributions."
category: "Systems & Servers"
tags: ["CachyOS", "Linux", "Maintenance"]
readTime: "3 min"
date: "2026-08-05"
---

Unlike other operating systems, Arch Linux-based distributions (such as CachyOS) do not automatically delete old packages that you download during updates. The `pacman` manager accumulates them indefinitely in the `/var/cache/pacman/pkg/` path in case you need to do a *downgrade*. Over time, this folder can consume 20GB or 30GB of your SSD storage.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Medir el tamaño actual de la basura
Run this command in your terminal to see exactly how much space the accumulated download cache is consuming:
```bash
du -sh /var/cache/pacman/pkg/
```

### Paso 2: Limpieza selectiva usando paccache (Recomendado)
Do not delete the entire folder by hand, as it is dangerous. We will use the official paccache tool to remove all old program versions, keeping only the currently installed version and the immediately preceding one for safety:
```bash
sudo paccache -r
```

### Paso 3: Eliminar paquetes huérfanos del sistema
Orphan packages are libraries that were installed as dependencies of a program you already deleted, so they remain floating on the disk without any purpose. Delete them with this command:
```bash
sudo pacman -Rns $(pacman -Qdtq)
```
If the system responds that there are no targets to remove, it means your dependency tree is completely clean.

## 🛡️ Consejo de Prevención

Recommended security practices:
* You can automate this maintenance so you do not have to remember it. Ask your system to run an automatic cleanup every week by scheduling a "Systemd Timer" executing the command: `sudo systemctl enable --now paccache.timer`.

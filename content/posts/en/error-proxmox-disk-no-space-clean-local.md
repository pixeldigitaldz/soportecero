---
title: "How to Free Disk Space in Proxmox VE by Cleaning Caches and LXC Templates"
description: "Learn how to resolve out-of-disk-space errors in Proxmox VE by safely removing duplicated ISOs and orphaned backups."
category: "Systems & Servers"
tags: ["Proxmox", "Sysadmin", "Linux"]
readTime: "4 min"
date: "2026-08-10"
---

The disk space exhausted error on Proxmox VE local storage (`No space left on device` or VM startup failures) occurs due to the accumulation of obsolete OS installation ISOs, unused LXC templates, old backup dumps, and bloated persistent system logs under the `/var/log` directory.

## 🚀 Step-by-Step Solution

### Step 1: Analyze disk space distribution
Connect to your Proxmox VE node via SSH and execute a disk space usage check on your local partitions:
```bash
# Check disk space on system partitions
df -h

# Identify directory sizes in default storage locations
du -sh /var/lib/pve/local-bgs/* /var/lib/vz/*
```

### Step 2: Remove unused installation ISOs and LXC templates
You can safely clean up operating system installation ISO files and downloaded container templates to recover space instantly:
```bash
# Delete obsolete ISOs from the vz storage pool
rm -f /var/lib/vz/template/iso/*.iso

# Delete unused LXC container template tarballs
rm -f /var/lib/vz/template/cache/*.tar.xz
```

### Step 3: Vacuum bloated systemd journal logs
System logs on Proxmox VE can grow to several gigabytes if your virtual machines generate continuous alerts due to hardware or internal network service warnings:
```bash
# Force rotation and limit persistent logs to 100 Megabytes
sudo journalctl --vacuum-size=100M
```

## 🛡️ Prevention Advice
Recommended security practices:
- Do not manually delete virtual disk images (`.raw` or `.qcow2`) located directly in the data paths `/var/lib/vz/images/` without first removing or detaching them from the Proxmox VE web GUI. Deleting raw disk descriptors manually corrupts the cluster database (`pve-cluster`), creating logical inconsistencies that block server migration and restore processes.

---
title: How to Increase and Optimize Virtual Memory (Swap) on Linux
description: >-
  Learn how to increase and optimize virtual memory (Swap) on Linux without rebooting. Step-by-step guide to create a swapfile, tune swappiness, and prevent OOM Killer crashes.
category: Systems & Servers
tags:
  - Linux
  - SysAdmin
  - Swap
  - Performance
  - Ubuntu
  - Debian
readTime: 5 min
date: '2026-06-27'
---

Configuring and increasing virtual memory in Linux through an optimized Swap file ensures system stability and prevents sudden crashes caused by the kernel Out-Of-Memory (OOM) Killer. In this engineering guide, you will learn how to expand swap space in real time without rebooting, set up persistence in fstab, and fine-tune swappiness for maximum server performance.

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Linux host running without Swap memory triggering unexpected OOM Killer crashes** | Create a 4GB-8GB swapfile via `fallocate` / `mkswap` and activate via `swapon` |
| **Aggressive disk swapping with plenty of available free RAM (high swappiness)** | Lower `vm.swappiness` parameter to 10 or 20 in `/etc/sysctl.conf` |

## 🚀 Step-by-Step Solution

### Step 1: Create and Initialize a Dedicated Swapfile
If your server lacks a dedicated swap partition, construct a root swapfile:
```bash
# 1. Inspect existing active swap
sudo swapon --show
free -h

# 2. Allocate a 4GB swapfile
sudo fallocate -l 4G /swapfile

# Alternative allocation method for legacy filesystems:
# sudo dd if=/dev/zero of=/swapfile bs=1M count=4096 status=progress

# 3. Restrict file permissions strictly to root
sudo chmod 600 /swapfile

# 4. Format file as Linux swap area
sudo mkswap /swapfile

# 5. Enable the swapfile
sudo swapon /swapfile
```

### Step 2: Establish Mount Persistence in /etc/fstab
Ensure the swapfile automatically mounts across system reboots:
```bash
# Backup existing fstab configuration
sudo cp /etc/fstab /etc/fstab.bak

# Append swapfile mount directive
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Step 3: Tune Kernel Swappiness and Cache Pressure
Default `vm.swappiness=60` causes premature swapping. On SSD/NVMe drives, configure optimized parameters:
```bash
# Check current swappiness
cat /proc/sys/vm/swappiness

# Apply optimized runtime settings
sudo sysctl vm.swappiness=10
sudo sysctl vm.vfs_cache_pressure=50

# Persist settings to system configuration
echo -e "vm.swappiness=10\nvm.vfs_cache_pressure=50" | sudo tee /etc/sysctl.d/99-swap.conf
sudo sysctl --system
```

### Step 4: Verify Memory Allocation
Run `free -h` to verify the newly provisioned swap capacity.

## 🛡️ Prevention Advice
- **Btrfs filesystem requirements:** On Btrfs volumes, disable Copy-on-Write before allocating the swap file (`chattr +C /swapfile`).
- **Consider ZRAM on constrained hardware:** On devices with limited memory (like Raspberry Pi), consider compressed RAM swap via `zram-tools`.

## ❓ Frequently Asked Questions (FAQ)

### How much swap space is recommended?
For systems with ≤4GB RAM, allocate 2x RAM. For 8GB–16GB RAM, 4GB–8GB swap is standard. For ≥32GB RAM systems, 4GB–8GB provides sufficient buffer safety.

### Does swap usage degrade SSD lifespan?
With low swappiness (10–20), swap write volume is negligible on modern SSDs with active wear leveling.

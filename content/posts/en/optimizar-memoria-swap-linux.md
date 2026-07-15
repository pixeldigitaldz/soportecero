---
title: "How to Configure Virtual Memory in Linux and Optimize Swap"
description: "Learn how to configure virtual memory in Linux and create a swapfile to prevent Out of Memory database and application crashes."
category: "Systems & Servers"
tags: ["Linux", "Sysadmin", "Swap"]
readTime: "4 min"
date: "2026-06-27"
---

Running out of physical RAM on cloud servers without swap space triggers the Linux kernel's `OOM Killer` (Out of Memory Killer), instantly terminating critical applications like MySQL databases, Nginx web servers, or Node.js processes.

## 🚀 Step-by-Step Solution

### Step 1: Create and initialize a secure Swap file (Swapfile)
If your VPS server does not have swap memory allocated, you can generate a dynamic 4GB file to mitigate consumption spikes:
```bash
# Create a pre-allocated empty file
sudo dd if=/dev/zero of=/swapfile bs=1M count=4096

# Assign strict superuser permissions
sudo chmod 600 /swapfile

# Format the file as swap space
sudo mkswap /swapfile

# Activate the swap file on the system
sudo swapon /swapfile
```

### Step 2: Configure mount persistence
Edit the kernel file system table (`/etc/fstab`) to ensure the system loads the swap memory automatically at boot:
```bash
echo "/swapfile none swap sw 0 0" | sudo tee -a /etc/fstab
```

### Step 3: Optimize the activation threshold (Swappiness)
The default `swappiness` value (usually 60) forces the kernel to write to disk too early, which can slow down servers. To maximize physical RAM utilization, lower the value to `10` or `20`:
```bash
# Temporarily change the value in memory
sudo sysctl vm.swappiness=10

# Make the configuration persistent across reboots
echo "vm.swappiness=10" | sudo tee -a /etc/sysctl.conf
```

## 🛡️ Prevention Advice
Recommended security practices:
- Avoid placing Swap files on low-quality secondary SSD storage or shared external drives. Continuous intensive reads and writes can wear down consumer-grade SSD cells prematurely, degrading your main drive's transfer rates.

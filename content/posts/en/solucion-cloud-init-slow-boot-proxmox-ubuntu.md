---
title: "[FIXED] cloud-init Slow Booting in Proxmox / Ubuntu Server"
description: "Proxmox VM or Ubuntu Server taking minutes to boot due to 'cloud-init waiting for network config'? Step-by-step optimization guide."
category: "Systems & Servers"
tags: ["Proxmox", "Cloud-Init", "Ubuntu", "Sysadmin"]
readTime: "4 min"
date: "2026-08-03"
---

The message **`cloud-init: waiting for network config`** or a 2 to 5-minute boot delay on Ubuntu Server virtual machines running on **Proxmox VE, KVM, or Cloud VPS** occurs when `cloud-init` stalls waiting for DHCP responses on unconfigured secondary network interfaces.

> **Quick Solution (1 Minute):**
> Disable post-provisioning cloud-init network waiting services:
> ```bash
> sudo touch /etc/cloud/cloud-init.disabled
> sudo systemctl disable cloud-init.service
> ```

## 🚀 Step-by-Step Fixes

### Step 1: Diagnose Boot Bottlenecks
Inspect boot time duration per service using `systemd-analyze`:

```bash
systemd-analyze blame | grep cloud-init
```
If `cloud-init-local.service` or `cloud-config.service` reports times over 30 seconds, cloud-init is stuck on network queries.

### Step 2: Disable cloud-init Post-Provisioning
Once your virtual machine has been fully created and configured with its static IP/hostname:

```bash
# Prevent cloud-init execution on subsequent boots
sudo touch /etc/cloud/cloud-init.disabled

# Disable systemd services
sudo systemctl disable cloud-init.service
sudo systemctl disable cloud-init-local.service
sudo systemctl disable cloud-config.service
sudo systemctl disable cloud-final.service
```

### Step 3: Configure Non-Blocking Netplan Interfaces
On Ubuntu Server, edit `/etc/netplan/50-cloud-init.yaml`:

```yaml
network:
  version: 2
  ethernets:
    eth0:
      dhcp4: true
      optional: true
```
Adding `optional: true` allows Ubuntu to complete booting immediately even if DHCP network resolution is slow. Apply changes:
```bash
sudo netplan apply
```

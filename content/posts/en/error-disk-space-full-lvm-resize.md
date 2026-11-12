---
title: How to Resize an LVM Logical Volume in Linux When Disk Space Runs Out
description: >-
  Learn how to safely extend an LVM logical volume and its ext4 or xfs filesystem hot in Linux
  without data loss and without rebooting the server.
category: Systems & Servers
tags:
  - Linux
  - Sysadmin
  - LVM
  - Storage
  - DevOps
readTime: 5 min
date: '2026-07-26'
---

Running into an emergency `No space left on device` error on a production Linux server can instantly halt relational database engines (PostgreSQL, MySQL), stop container runtimes (Docker, containerd), and prevent SSH sessions from generating temporary authentication tokens. When the underlying storage architecture is built upon the **Linux Logical Volume Manager (LVM)**, however, system administrators possess the capability to perform **online, non-disruptive storage expansion**.

Because LVM decouples physical storage disks from the operating system's logical file hierarchy, you can re-scan virtual disk buses in hypervisors (such as Proxmox VE, VMware ESXi, AWS EBS, or KVM), resize physical and logical volumes, and grow ext4 or XFS filesystems hot—with zero downtime and without rebooting the host.

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Volume Group (VG) has unallocated space while Logical Volume (LV) is full** | Run `sudo lvextend -r -l +100%FREE /dev/mapper/vg-lv` to grow LV and filesystem |
| **Virtual hypervisor disk expanded but Linux kernel has not re-scanned the SCSI bus** | Trigger a bus rescan: `echo 1 \| sudo tee /sys/class/block/sdX/device/rescan` |
| **Physical partition needs expansion before LVM can ingest new sectors** | Expand the partition table using `growpart /dev/sda 3` followed by `pvresize /dev/sda3` |
| **Filesystem remains at old capacity after volume expansion** | Expand filesystem using `resize2fs` (for ext4) or `xfs_growfs` (for XFS) |

## 🚀 Step-by-Step Implementation Guide

### Step 1: Identify Saturated Partitions and Locate Logical Volume Paths
Run storage inspection commands to identify the exact device mapper path of the exhausted partition:
```bash
# Check filesystem utilization across all mount points
df -hT

# Display physical volumes (PV), volume groups (VG), and logical volumes (LV)
sudo pvs
sudo vgs
sudo lvs
```
Make note of the logical volume path displayed under `df` (e.g., `/dev/mapper/ubuntu--vg-ubuntu--lv` or `/dev/ubuntu-vg/root`) and determine whether the filesystem type is **ext4** or **xfs**.

### Step 2: Trigger Kernel SCSI Rescan and Resize the Physical Partition
If you increased the virtual disk size in your hypervisor (e.g., expanding from 50 GB to 100 GB in Proxmox or AWS):
1. Instruct the Linux kernel to re-scan the block device without rebooting:
```bash
# Replace 'sda' with your physical drive descriptor
echo 1 | sudo tee /sys/class/block/sda/device/rescan
```
2. Verify that the kernel recognizes the new geometry with `lsblk`:
```bash
lsblk
```
3. If LVM sits on a physical partition (such as `/dev/sda3`):
```bash
# Install cloud-guest-utils if growpart is missing
sudo apt-get install -y cloud-guest-utils 2>/dev/null || sudo yum install -y cloud-utils-growpart

# Expand partition 3 to utilize all newly available sectors
sudo growpart /dev/sda 3

# Notify LVM that the physical volume has grown
sudo pvresize /dev/sda3
```

### Step 3: Extend the Logical Volume and Filesystem in One Step
Once the Physical Volume (PV) and Volume Group (VG) reflect unallocated free space, extend the Logical Volume. Using the `-r` (`--resizefs`) flag is the recommended best practice, as it automatically invokes the correct filesystem resizer (`resize2fs` for ext4 or `xfs_growfs` for XFS) in a single atomic transaction:
```bash
# Extend the logical volume to consume 100% of remaining free space in the Volume Group
# and immediately expand the underlying filesystem online
sudo lvextend -r -l +100%FREE /dev/mapper/ubuntu--vg-ubuntu--lv
```

### Step 4: Manual Filesystem Expansion (Alternative Fallback)
If you already ran `lvextend` without the `-r` flag, the logical volume will be larger than the filesystem it hosts. Resize the filesystem manually according to its format:
- **For ext4 filesystems:**
```bash
# Pass the device mapper path
sudo resize2fs /dev/mapper/ubuntu--vg-ubuntu--lv
```
- **For XFS filesystems:**
```bash
# XFS requires the mountpoint path (e.g., '/'), not the device path
sudo xfs_growfs /
```

### Step 5: Validate the New Storage Allocation
Confirm that the expanded capacity is actively recognized by the operating system:
```bash
df -h /
```
You should now see the expanded storage volume available immediately with zero pending system reboots.

## 🛡️ Best Practices & Disaster Recovery Advisory
- **Never Attempt Hot Volume Reduction (`lvreduce`):** While storage expansion is safe and routine, shrinking a logical volume is dangerous. XFS does not support shrinking under any circumstances. Ext4 supports shrinking only while unmounted, and any calculation error in block sizes will permanently destroy filesystem superblocks and truncate data.
- **Maintain Automated Volume Monitoring:** Configure Prometheus Node Exporter or Datadog alerts to trigger notifications when disk utilization reaches 80% to avoid emergency out-of-space incidents.

## Frequently Asked Questions (FAQ)

### Can I resize an LVM partition while MySQL or Docker is actively writing to it?
Yes. Both ext4 and XFS support online filesystem expansion. The Linux kernel pauses write locks for a fraction of a millisecond to update superblock block counts, allowing production database workloads to continue uninterrupted.

### What should I do if 'pvs' shows 0 free space after expanding the virtual disk?
If `pvs` shows no free space, you either forgot to trigger the kernel SCSI rescan (`rescan`), forgot to resize the partition with `growpart`, or forgot to run `pvresize`. Follow Step 2 in sequence to ensure each layer recognizes the newly added capacity.

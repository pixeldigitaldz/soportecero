---
title: How to Free Disk Space in Proxmox VE by Cleaning Caches and LXC Templates
description: >-
  Learn how to resolve out-of-disk-space errors in Proxmox VE by safely removing
  duplicated ISOs and orphaned backups.
category: Systems & Servers
tags:
  - Proxmox
  - Sysadmin
  - Linux
readTime: 6 min
date: '2026-07-27'
---

Seeing `No space left on device` in the Proxmox VE web UI, failing to start VMs or LXC containers, or watching the `pveproxy` and `pvedaemon` services crash usually means the root filesystem (`/`) or the `local` storage pool (`/var/lib/vz`) has hit 100% capacity. Because Proxmox stores cluster state (`/etc/pve`), ISO images, container templates, and systemd journals on the root volume by default, filling it halts both management and guest operations.

## Quick Diagnostics

| Symptom / Cause | Immediate Action |
|---|---|
| **Root `/` filesystem at 100% (`df -h`)** | Identify largest directories with `du -xh --max-depth=2 /` |
| **Accumulated ISOs and LXC template tarballs** | Clean `/var/lib/vz/template/iso/` and `/var/lib/vz/template/cache/` |
| **Bloated `systemd` journal or task logs** | Vacuum logs: `journalctl --vacuum-size=100M` |
| **Old `vzdump` backups stored on `local`** | Remove obsolete dumps in `/var/lib/vz/dump/` via GUI or CLI |

## Root Cause & Technical Mechanics

In a default Proxmox VE installation, the installer partitions the boot drive into an LVM volume group (`pve`) with `pve-root` mounted at `/` (often capped at 25–100 GB) and `pve-data` (`local-lvm` thin pool) reserved for VM disks. Everything outside `local-lvm`—including `/var/lib/vz` (`local` storage), `/var/log`, and `/var/cache/apt`—competes for space on `pve-root`.

Four common factors exhaust `pve-root`:
1. **Unpruned ISOs, Templates, and `vzdump` Backups:** Uploading multiple OS installers to `/var/lib/vz/template/iso/`, downloading LXC templates to `/var/lib/vz/template/cache/`, or accidentally targeting `local` instead of a dedicated NAS/PBS for scheduled `vzdump` backups rapidly consumes tens of gigabytes.
2. **Unbounded `systemd-journald` and PVE Task Logs:** Continuous hardware/PCIe AER warnings or failing cluster sync jobs can inflate `/var/log/journal/` and `/var/log/pve/tasks/` to several gigabytes.
3. **Deleted-but-Open File Descriptors:** Removing a massive log file while a daemon still holds an open file descriptor (`lsof +L1`) prevents the kernel from reclaiming blocks until the process restarts.
4. **Old Proxmox Kernel Headers/Images:** `apt` retains superseded `proxmox-kernel-*` packages until `apt autoremove` runs.

## Step-by-Step Solution

### 1. Audit Disk Usage Without Crossing Filesystem Boundaries
Connect to your Proxmox node via SSH (or the node **Shell** in the web GUI) and inspect mounted filesystems and inode usage:
```bash
df -hT
df -i /
```

Find which top-level directories on `/` are consuming space (`-x` avoids scanning `/mnt`, `/proc`, or ZFS mounts):
```bash
du -xh --max-depth=2 / | sort -rh | head -n 20
```

### 2. Clean Unused ISOs, LXC Templates, and Old Backups
Inspect `/var/lib/vz` before deleting so you only remove obsolete files:
```bash
ls -lh /var/lib/vz/template/iso/
ls -lh /var/lib/vz/template/cache/
ls -lh /var/lib/vz/dump/
```

Remove specific outdated ISOs, LXC tarballs, or old `vzdump` backups (or delete them cleanly from **Datacenter -> Node -> local -> ISO Images / CT Templates / Backups**):
```bash
# Example: remove old Ubuntu ISO and stale container template
rm -f /var/lib/vz/template/iso/ubuntu-22.04*.iso
rm -f /var/lib/vz/template/cache/debian-11*.tar.zst
```

### 3. Vacuum Systemd Journals, PVE Logs, and APT Cache
Shrink the `systemd` journal to 100 MB and purge orphaned `apt` packages and cached `.deb` archives:
```bash
journalctl --vacuum-size=100M
apt autoremove --purge -y
apt clean
```

Check for deleted files still held open by running daemons:
```bash
lsof +L1 | grep -i deleted
```
If a large deleted log file appears, restart its owning service (for example, `systemctl restart rsyslog` or `systemctl restart pveproxy`) to release the blocks.

### 4. Verify Recovered Space and Cluster Health
Confirm `/` has sufficient free space and that Proxmox services are healthy:
```bash
df -h /
systemctl status pve-cluster pvedaemon pveproxy
```

## Frequently Asked Questions

**Can I delete `.qcow2` or `.raw` files directly from `/var/lib/vz/images/`?**
No. Never delete virtual disk files manually with `rm` while a VM or CT still references them in `/etc/pve/qemu-server/` or `/etc/pve/lxc/`. Always detach and remove unused disks through the Proxmox web UI (`Hardware -> Hard Disk -> Detach -> Remove`) or `qm set <VMID> --delete <disk>`.

**Why does `df -h` say `/` is full even after I deleted a 20 GB backup file?**
Either an active process (like `vzdump` or `rsync`) still holds an open file descriptor to that deleted file (`lsof +L1`), or the file was on a ZFS dataset with snapshots still referencing the old blocks (`zfs list -t snapshot`).

**How do I cap `systemd-journald` permanently on Proxmox?**
Edit `/etc/systemd/journald.conf`, set `SystemMaxUse=200M`, and run `systemctl restart systemd-journald`.

## Prevention Advice

* Store VM backups on a dedicated **Proxmox Backup Server (PBS)**, NFS/SMB share, or secondary disk—never on the `local` root filesystem.
* Set `SystemMaxUse=200M` in `/etc/systemd/journald.conf` on every Proxmox node to prevent log runaway.
* Configure backup retention policies (`prune-backups`) on every scheduled `vzdump` job so old archives expire automatically.
* Monitor root partition usage with Zabbix, Prometheus Node Exporter, or Proxmox's built-in email notifications before `/` exceeds 85%.

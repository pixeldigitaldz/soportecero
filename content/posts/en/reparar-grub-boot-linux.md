---
title: How to Recover and Reinstall a Corrupted GRUB Bootloader in Linux (UEFI & BIOS)
description: >-
  Step-by-step guide to restore a broken GRUB bootloader or 'grub rescue>' console using a Live USB
  and chroot. Fix UEFI boot entries, dual-boot Windows overwrites, and corrupt grub.cfg files.
category: Systems & Servers
tags:
  - Linux
  - GRUB
  - Bootloader
  - Sysadmin
  - Troubleshooting
readTime: 5 min
date: '2026-07-27'
---

Finding your Linux system stuck at a `grub>` prompt, dropped into a `grub rescue> error: no such partition` shell, or booting straight into Windows after a Windows Update is one of the most alarming incidents for dual-boot and Linux desktop users.

This failure occurs when the Master Boot Record (MBR) or UEFI NVRAM boot entries point to a nonexistent disk UUID, when an unexpected power loss corrupts `/boot/grub/grub.cfg`, or when a Windows feature update overwrites the primary EFI system partition (ESP) boot order.

Using a temporary **Live USB Linux session** and the standard **chroot (change root)** environment allows you to bind system kernel pseudo-filesystems (`/dev`, `/proc`, `/sys`), access your real installation securely, and reinstall GRUB cleanly.

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **System boots directly into Windows after a Windows Update** | Restore UEFI boot order using `efibootmgr -o <boot_order>` |
| **Dropped into `grub rescue>` due to modified partition UUID** | Boot via Live USB, chroot into the install, and run `update-grub` |
| **EFI System Partition (ESP) missing GRUB EFI binaries** | Reinstall GRUB for UEFI: `grub-install --target=x86_64-efi --efi-directory=/boot/efi` |
| **Legacy MBR boot sector corrupted on BIOS systems** | Reinstall GRUB to disk MBR: `grub-install /dev/sdX` |

## 🚀 Step-by-Step Implementation Guide

### Step 1: Boot into a Live Linux USB Environment
Create and boot a standard 64-bit Live USB (such as Ubuntu, Debian, or Arch Linux) matching your architecture. Ensure you boot the Live USB in **UEFI mode** if your primary operating system uses UEFI.

Open a terminal and identify your physical drive partitions:
```bash
sudo lsblk -f
# Or view detailed partition labels:
sudo fdisk -l
```
Identify two critical partitions:
- **Your Linux Root partition (`/`):** Typically formatted as `ext4`, `btrfs`, or `xfs` (e.g., `/dev/nvme0n1p2` or `/dev/sda2`).
- **Your EFI System Partition (ESP):** A FAT32 partition typically between 100 MB and 1 GB in size (e.g., `/dev/nvme0n1p1` or `/dev/sda1`).

### Step 2: Mount Root and Kernel Virtual Filesystems
Mount your actual installed Linux root partition into the Live environment's `/mnt` directory:
```bash
# Mount the root Linux partition
sudo mount /dev/nvme0n1p2 /mnt
```
Bind-mount the host kernel virtual filesystems into `/mnt` so that tools executed inside the chroot can interact with the physical hardware:
```bash
for dir in /dev /dev/pts /proc /sys /run; do
    sudo mount --bind "$dir" "/mnt$dir"
done
```
If your system boots via modern UEFI (the vast majority of machines manufactured after 2012), mount your EFI partition inside the target boot tree:
```bash
sudo mkdir -p /mnt/boot/efi
sudo mount /dev/nvme0n1p1 /mnt/boot/efi
```

### Step 3: Enter the Chroot Environment
Switch your active terminal shell into the root environment of your installed system:
```bash
sudo chroot /mnt /bin/bash
```
Your command prompt now reflects your actual system installation. Any command executed here acts directly upon your installed packages and configuration files.

### Step 4: Reinstall the GRUB Bootloader
Execute the appropriate installation command according to your system firmware:
- **For Modern UEFI Systems (Standard):**
```bash
# Reinstall EFI binaries into the ESP and update NVRAM boot entries
grub-install --target=x86_64-efi --efi-directory=/boot/efi --bootloader-id=GRUB --recheck
```
- **For Legacy BIOS / MBR Systems:**
```bash
# Point to the physical disk (e.g., /dev/sda), NOT a partition number like /dev/sda1
grub-install --target=i386-pc /dev/sda --recheck
```

### Step 5: Regenerate the GRUB Configuration File
Scan all connected storage drives for operating systems (including Windows via `os-prober`) and rebuild the main menu file (`/boot/grub/grub.cfg`):
```bash
# On Debian, Ubuntu, and Linux Mint:
update-grub

# On Arch Linux, CachyOS, Fedora, and openSUSE:
grub-mkconfig -o /boot/grub/grub.cfg
```
Confirm that the output logs detecting your Linux kernel images (`vmlinuz`) and initramfs files.

### Step 6: Verify NVRAM Entries and Cleanly Reboot
If using UEFI, verify that GRUB is prioritized in the motherboard NVRAM boot queue:
```bash
efibootmgr
```
Exit the chroot and unmount all filesystems before rebooting:
```bash
# Exit chroot
exit

# Unmount filesystems cleanly
sudo umount -R /mnt

# Reboot into your restored system
sudo reboot
```
Remove the Live USB drive when prompted. Your system will now boot into the GRUB selection menu cleanly.

## 🛡️ Best Practices & Bootloader Maintenance
- **Keep os-prober Enabled for Dual Booting:** In `/etc/default/grub`, ensure `GRUB_DISABLE_OS_PROBER=false` is declared if you dual-boot with Windows. Modern GRUB releases disable `os-prober` by default for security, which hides Windows from the boot menu.
- **Backup the EFI Partition:** Occasionally archive your `/boot/efi/EFI/` folder. If a Windows major update replaces the bootloader, copying the folder back restores instant access.

## Frequently Asked Questions (FAQ)

### What does 'grub-install: error: cannot find EFI directory' mean?
This error occurs when you forgot to mount the FAT32 EFI partition to `/mnt/boot/efi` before entering the chroot. Verify that `mount | grep efi` displays the mounted ESP partition.

### How do I fix 'error: symbol grub_calloc not found' in grub rescue?
This symbol mismatch error indicates that the GRUB stage 1 loader in NVRAM/MBR does not match the version of GRUB modules located in `/boot/grub/`. Running `grub-install` and `update-grub` from a chroot synchronizes both components and fixes the error immediately.

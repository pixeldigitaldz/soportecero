---
title: How to Reset a Forgotten Root Password in Linux (Ubuntu, Debian, RHEL)
description: >-
  Step-by-step guide to recover administrative root access on Linux servers using GRUB kernel parameters,
  init=/bin/bash, emergency targets, and SELinux relabeling.
category: Systems & Servers
tags:
  - Linux
  - Sysadmin
  - Security
  - Ubuntu
  - RHEL
readTime: 5 min
date: '2026-07-27'
---

Losing or misplacing the administrative `root` password or finding your local `sudo` user account locked out on a physical Linux server or virtual machine can bring maintenance operations to a complete standstill.

Fortunately, as long as you have console access (via a physical monitor and keyboard, an out-of-band management interface like IPMI/iDRAC/iLO, or a cloud provider's web VNC/serial console), Linux allows administrators to intercept the boot sequence. By instructing the **GRUB bootloader** to launch a root shell directly—bypassing the standard initialization daemon and authentication layer—you can remount the root filesystem in read-write mode and assign a new password within minutes.

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Forgotten or locked root password on Debian/Ubuntu systems** | Append `init=/bin/bash` to kernel line in GRUB and remount root with `rw` |
| **Forgotten root password on RHEL / CentOS / Rocky Linux / Fedora** | Append `rd.break` in GRUB, remount `/sysroot`, and touch `/.autorelabel` |
| **Root password reset ignored or login fails on reboot due to SELinux** | Execute `touch /.autorelabel` to ensure security context recalculation |

## 🚀 Step-by-Step Implementation Guide

### Method 1: The `init=/bin/bash` Technique (Debian, Ubuntu, Arch Linux)
This universal technique instructs the Linux kernel to bypass the standard `systemd` init process and execute a raw Bourne Again Shell with immediate root authority:

1. Reboot your physical server or virtual machine.
2. When the **GRUB boot menu** appears, immediately press the `e` key to edit the configuration of the default highlighted kernel entry.
3. Use the arrow keys to scroll down and locate the kernel command line starting with `linux` or `linux64`:
```plaintext
linux /boot/vmlinuz-6.8.0-generic root=UUID=... ro quiet splash
```
4. Move your cursor to the end of that line. Remove words like `quiet` and `splash`, and append:
```plaintext
init=/bin/bash
```
5. Press `Ctrl + X` (or `F10`) to boot the kernel with this temporary parameter.
6. The system will boot instantly into a root prompt:
```bash
root@(none):/#
```
7. By default, the root filesystem is mounted as read-only (`ro`). Remount it with read-write permissions:
```bash
mount -o remount,rw /
```
8. Reset the root user password (or unlock your sudo user):
```bash
passwd root
# Or reset a standard user:
passwd username
```
9. Sync the disk buffers to ensure password changes are flushed to hardware:
```bash
sync
```
10. If your system runs SELinux (or to ensure proper state restoration), trigger a reboot:
```bash
exec /sbin/init
# Or force an immediate hardware reboot:
reboot -f
```

### Method 2: The `rd.break` Emergency Mode (RHEL, Rocky, AlmaLinux, Fedora)
Red Hat Enterprise Linux and its enterprise derivatives enforce strict systemd and SELinux policies that can reject direct `init=/bin/bash` resets. Use the native `rd.break` dracut emergency target:

1. At the GRUB menu, press `e` to edit the kernel line.
2. Locate the line starting with `linux` or `linux16` and append `rd.break` to the end of the line:
```plaintext
linux16 /vmlinuz-... root=... quiet rd.break
```
3. Press `Ctrl + X` to boot into the emergency initramfs shell:
```bash
switch_root:/#
```
4. In emergency mode, the real root filesystem is mounted read-only at `/sysroot`. Remount it as writable:
```bash
mount -o remount,rw /sysroot
```
5. Enter the root chroot environment:
```bash
chroot /sysroot
```
6. Change the password:
```bash
passwd root
```
7. **Crucial SELinux Step:** Inform SELinux to relabel the shadow password file on the next boot:
```bash
touch /.autorelabel
```
*(Without `/.autorelabel`, SELinux will block the modified `/etc/shadow` file from loading, preventing login on reboot).*
8. Exit the chroot and reboot:
```bash
exit
exit
```
The system will reboot, perform an automated SELinux relabeling pass (which may take 1 to 2 minutes), and bring you to the standard login prompt with your new password.

## 🛡️ Security Best Practices & Hardening
- **Password-Protect the GRUB Bootloader:** The ability to bypass authentication via kernel flags demonstrates why physical security is paramount. In enterprise environments, protect GRUB by generating an encrypted PBKDF2 password using `grub-mkpasswd-pbkdf2` and declaring superusers in `/etc/grub.d/40_custom`. This requires users to enter a password before accessing GRUB's `e` edit screen.
- **Enable Full-Disk Encryption (LUKS):** If a server is physically stolen or an unencrypted hard drive is mounted on another machine, anyone can read plaintext files. Deploying LUKS full-disk encryption prevents unauthorized filesystem manipulation even if an attacker boots external recovery media.

## Frequently Asked Questions (FAQ)

### Why does 'passwd' return 'Authentication token manipulation error'?
This error occurs when the filesystem is still mounted read-only (`ro`), or when the disk is 100% full with zero available storage blocks. Remount the filesystem as writable (`mount -o remount,rw /`) before invoking `passwd`.

### Can I reset the password if the GRUB menu is hidden or boots too fast?
If the GRUB menu is configured with `TIMEOUT=0`, repeatedly press or hold the `Shift` key (for legacy BIOS) or tap the `Escape` key (for UEFI) immediately upon machine power-on to force the GRUB menu to display.

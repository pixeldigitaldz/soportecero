---
title: >-
  Troubleshooting: Linux Boot Failure due to Incorrect Configuration in
  /etc/fstab
description: >-
  Learn how to repair your Linux system if it fails to boot and gets stuck in
  Emergency Mode due to an error in the fstab file.
category: Systems & Servers
tags:
  - Linux
  - Sysadmin
  - Terminal
readTime: 5 min
date: '2026-07-27'
---

Modifying `/etc/fstab` to auto-mount secondary drives, NVMe partitions, or swap files is routine sysadmin work, but a single typo, wrong UUID, or missing mount option can halt the Linux boot sequence and drop the system into `Welcome to emergency mode!`. Because `systemd` treats `/etc/fstab` entries as mandatory dependencies by default, any unresolvable device blocks `local-fs.target`.

## Quick Diagnostics

| Symptom / Cause | Verification | Immediate Fix |
|---|---|---|
| Typo, wrong UUID, or invalid filesystem type in `/etc/fstab` | `journalctl -xb -p err` or `findmnt --verify` | Remount `/` as `rw` and fix or comment out the broken line |
| External USB/secondary disk disconnected at boot | `lsblk -f` shows device missing | Add `nofail,x-systemd.device-timeout=5` to mount options |
| Root filesystem locked read-only in emergency shell | `mount \| grep " / "` shows `(ro,` | Run `mount -o remount,rw /` before editing |

## Root Cause & Technical Mechanics

During early userspace initialization, `systemd-fstab-generator` parses `/etc/fstab` and dynamically generates `.mount` and `.swap` unit files inside `/run/systemd/generator/`. By default, each generated unit is linked as a `Requires=` and `Before=` dependency of `local-fs.target`.

When `systemd` attempts to activate those units:

1. **Missing block device or mismatched UUID:** `udev` waits up to `90s` (the default `JobTimeoutSec`) for the device node (such as `/dev/disk/by-uuid/...`) to appear. Once the timer expires, the `.device` unit times out, failing `local-fs.target` and triggering `emergency.target`.
2. **Malformed columns or unsupported mount options:** `mount(8)` exits with a non-zero status code (commonly `32` for mount failure or `1` for incorrect invocation), which immediately aborts boot without waiting 90 seconds.
3. **Filesystem corruption on a checked partition:** If the sixth field (`fs_passno`) is `1` or `2`, `systemd-fsck` runs before mounting. Unrecoverable metadata errors pause boot for manual `fsck` intervention.

In emergency mode, the kernel mounts `/` read-only (`ro`) to protect against further corruption, which is why editors like `nano` or `vi` fail to save until you remount read-write.

## Step-by-Step Solution

### Step 1: Enter the Emergency Shell and Remount Root as Read-Write

At the `Give root password for maintenance` prompt, enter the root password (or press `Ctrl+D` if prompted on systems with a locked root account, or boot with `init=/bin/bash` from GRUB). Unlock the root filesystem for editing:

```bash
mount -o remount,rw /
```

Verify the root mount is now writable:

```bash
findmnt / -o TARGET,SOURCE,FSTYPE,OPTIONS
```

Confirm `rw` appears in the `OPTIONS` column.

### Step 2: Identify the Failing Entry and Actual Device UUIDs

Check the boot journal to see which exact mount unit failed:

```bash
journalctl -xb -p err --no-pager | grep -E "mount|fstab|Timed out"
```

List all attached block devices along with their exact UUIDs and filesystem types:

```bash
lsblk -f
```

Compare the `UUID` and `FSTYPE` columns from `lsblk -f` against `/etc/fstab`.

### Step 3: Repair or Comment Out the Broken Line

Open `/etc/fstab` with a terminal editor:

```bash
nano /etc/fstab
```

Either correct the six space/tab-separated fields (`<file system> <mount point> <type> <options> <dump> <pass>`), or temporarily comment out the offending entry with `#` so the system can boot:

```plaintext
# UUID=bad-uuid-value /mnt/backup ext4 defaults 0 2
UUID=9a1b2c3d-4e5f-6789-abcd-0123456789ef /mnt/backup ext4 defaults,nofail,x-systemd.device-timeout=5 0 2
```

Ensure the target mount directory actually exists (for example, `mkdir -p /mnt/backup`).

### Step 4: Validate Syntax and Test Mounts Before Rebooting

Always validate `/etc/fstab` before rebooting so `findmnt` catches syntax, UUID, or option errors:

```bash
findmnt --verify --verbose
systemctl daemon-reload && mount -a
```

If `findmnt --verify` reports zero errors and `mount -a` exits with status `0`, reboot safely with `systemctl reboot`.

## Frequently Asked Questions

### What if I cannot log into Emergency Mode because the root account is locked?
On Ubuntu and some cloud images where the root password is disabled, reboot and press `Esc` or `Shift` to open the GRUB menu, press `e` to edit the kernel line, append `systemd.unit=rescue.target` or `rw init=/bin/bash`, and press `Ctrl+X` to boot directly into a writable shell.

### Do I need to run `systemctl daemon-reload` after editing `/etc/fstab`?
Yes, if you are testing mounts on a running system. Because `systemd-fstab-generator` only converts `/etc/fstab` into `.mount` units at boot or during a reload, running `systemctl daemon-reload` ensures `systemd` picks up your edits immediately.

### What should the 5th (`dump`) and 6th (`pass`) fields be for secondary disks?
Set `dump` to `0` (the legacy `dump` backup utility is rarely used). Set `pass` to `1` only for the root `/` filesystem, `2` for other local Linux filesystems you want `fsck` to check at boot, and `0` for swap, network shares (NFS/SMB), or removable drives.

## Prevention Advice

- **Always test with `mount -a`:** Immediately after editing `/etc/fstab`, run `sudo findmnt --verify && sudo mount -a` before closing your terminal or rebooting.
- **Use `nofail` on non-root disks:** Add `nofail,x-systemd.device-timeout=5` to secondary, external, or data partitions so a missing drive never blocks boot.
- **Back up before editing:** Run `sudo cp /etc/fstab /etc/fstab.bak` prior to any modification.
- **Prefer UUIDs over `/dev/sdX`:** Kernel device letters (`/dev/sdb1`) can shift between boots when hardware is added or removed, whereas `UUID=` stays constant.

---
title: 'Guide: chmod Operation not permitted (Even as Root) in Linux'
description: >-
  Learn how to solve chmod / chown: Operation not permitted using lsattr and
  chattr to unlock immutable files in Linux step by step.
category: Systems & Servers
tags:
  - Linux
  - Permissions
  - SysAdmin
  - Security
  - Ubuntu
  - Debian
readTime: 5 min
date: '2026-06-25'
---

Encountering `chmod: changing permissions of 'file': Operation not permitted` or `chown: changing ownership of 'file': Operation not permitted` while running commands as `root` (UID 0) is a classic Linux sysadmin puzzle. Because standard POSIX permission checks do not block UID 0, this `EPERM` error points to kernel-level extended inode attributes, a read-only filesystem mount, container capability restrictions, or non-POSIX mount semantics.

## Quick Diagnostics

| Cause | Symptom | Solution |
|---|---|---|
| **Immutable (`+i`) or append-only (`+a`) flag** | `chmod`/`chown`/`rm` fails even as root | Inspect with `lsattr` and clear via `chattr -i` |
| **Read-only (`ro`) filesystem mount** | Kernel remounted volume after I/O errors | Check `findmnt` and remount `rw` after `fsck` |
| **NFS `root_squash` export** | Root on client mapped to `nobody` on server | Run `chmod` on the NFS server or adjust export |
| **Container missing `CAP_FOWNER`** | Unprivileged container or dropped capabilities | Run on host or grant required capability |

## Root Cause & Technical Mechanics

In the Linux kernel's Virtual File System (VFS) layer, `chmod` and `chown` invoke `notify_change()` to update an inode's metadata. Before standard UID 0 privileges take effect, the kernel checks two lower-level guards:

1. **Extended Inode Flags (`FS_IMMUTABLE_FL` / `FS_APPEND_FL`):** Native Linux filesystems—including `ext4`, `XFS`, and `Btrfs`—store extra attribute bits directly in the inode structure. When the immutable bit (`i`) is set, the kernel explicitly returns `-EPERM` (`Operation not permitted`) for any attempt to modify data, rename, unlink, or alter permissions/ownership—even for `root`. Only a process holding `CAP_LINUX_IMMUTABLE` calling `chattr -i` (via the `FS_IOC_SETFLAGS` ioctl) can clear it.
2. **Filesystem State and Mount Options:** If a storage device encounters hardware I/O errors or journal corruption, `errors=remount-ro` flips the superblock to read-only (`EROFS`). Likewise, Windows filesystems (`NTFS`, `vfat`/`FAT32`) lack POSIX inode ownership tables, and NFS shares with `root_squash` (the default) translate client UID 0 to `nfsnobody`, causing `EPERM` on metadata changes.

## Step-by-Step Solution

### Step 1: Inspect Extended Inode Attributes with `lsattr`

Standard `ls -l` output does not show kernel extended attributes. Query the file (or directory) with `lsattr`:

```bash
lsattr /path/to/file
```

Look for `i` (immutable) or `a` (append-only) in the attribute string:

```text
----i---------e------- /path/to/file
```

### Step 2: Clear Immutable or Append-Only Flags with `chattr`

Strip the locking flags as `root` or via `sudo`:

```bash
# Clear immutable and append-only attributes on a single file
sudo chattr -i -a /path/to/file

# Or clear recursively across a directory tree
sudo chattr -R -i /path/to/directory
```

### Step 3: Apply Permissions and Verify Inode Metadata

Once `lsattr` shows no `i` or `a` flags, run `chmod` or `chown` and verify with `stat`:

```bash
sudo chmod 644 /path/to/file
sudo chown www-data:www-data /path/to/file
stat -c "%a %U:%G %n" /path/to/file
```

### Step 4: Check Mount Options, NFS Exports, and Container Capabilities

If `lsattr` reports `Operation not supported` or shows no flags yet `chmod` still fails, inspect the mount point and kernel logs:

```bash
# Verify mount options (look for 'ro', 'vfat', 'ntfs', or 'nfs')
findmnt -T /path/to/file

# Check for kernel disk errors triggering read-only remounts
dmesg -T | grep -iE "remount|I/O error|EXT4-fs error"
```

If the partition is mounted `ro` without underlying hardware failure, remount it read-write:

```bash
sudo mount -o remount,rw /mount/point
```

On FAT32/exFAT/NTFS mounts, permissions must be set globally at mount time using `uid=`, `gid=`, `fmask=`, and `dmask=` options in `/etc/fstab`.

## Frequently Asked Questions

### Does `chattr +i` protect a file from `root` permanently?
It blocks accidental edits, deletions, and `chmod` by `root` scripts or daemons, but any process running as `root` with `CAP_LINUX_IMMUTABLE` can still unlock it with `chattr -i`.

### Why does `lsattr` print `Inappropriate ioctl for device` on my external drive?
Extended attributes (`lsattr`/`chattr`) are supported only on native Linux filesystems (`ext4`, `XFS`, `Btrfs`, `F2FS`). Non-Linux filesystems like `FAT32`, `exFAT`, and `NTFS` do not implement the `FS_IOC_GETFLAGS` ioctl.

### Could malware have set `chattr +i` on my server?
Yes. Persistence scripts and cryptominers frequently apply `chattr +i` to malicious cron jobs, `authorized_keys`, or modified binaries so administrators cannot remove them with `rm -rf` alone. Always audit unexpected `+i` flags.

## Prevention Advice

- Use `sudo chattr +i /etc/resolv.conf` intentionally only when preventing rogue DHCP/network daemons from overwriting static DNS configurations, and document it in your runbook.
- Avoid running `chmod`/`chown` on Windows-formatted USB drives or SMB/CIFS shares; configure `uid`/`gid` mount options instead.
- Schedule periodic `lsattr` integrity checks on `/etc`, `/usr/local/bin`, and `~/.ssh/authorized_keys` as part of host intrusion detection.
- Monitor SMART health and `dmesg` for storage I/O errors so read-only remounts are caught before deployments fail.

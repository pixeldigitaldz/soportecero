---
title: "Guide: chmod Operation not permitted (Even as Root) in Linux"
description: "Learn how to solve chmod / chown: Operation not permitted using lsattr and chattr to unlock immutable files in Linux step by step."
category: "Systems & Servers"
tags: ["Linux", "Permissions", "SysAdmin", "Security", "Ubuntu", "Debian"]
readTime: "5 min"
date: "2026-06-25"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **File protected by kernel immutable (+i) or append-only (+a) filesystem attribute** | Check with `lsattr <file>` and clear attributes using `sudo chattr -i <file>` |
| **Underlying filesystem mounted in Read-Only (ro) mode following disk I/O errors** | Remount read-write via `sudo mount -o remount,rw /` or verify SELinux context |

Encountering `chmod: changing permissions of 'file': Operation not permitted` or `chown: changing ownership of 'file': Operation not permitted` while executing commands as superuser `root` indicates the file is locked by Linux kernel extended filesystem attributes or the storage partition has degraded to Read-Only mode.

## 🚀 Step-by-Step Solution

### Step 1: Inspect Extended Attributes with lsattr
Standard `ls -l` commands only expose conventional POSIX permission bits. Extended kernel flags require `lsattr`:
```bash
# Inspect extended filesystem attributes
lsattr /path/to/file

# Typical output showing immutable bit:
# ----i---------e---- /path/to/file  (Letter 'i' denotes immutable)
```

### Step 2: Clear Immutable Flags with chattr
As superuser, strip the immutable and append-only flags:
```bash
# Remove immutable (-i) and append-only (-a) flags
sudo chattr -i /path/to/file
sudo chattr -a /path/to/file

# Recursively clear across an entire directory tree:
sudo chattr -R -i /path/to/directory
```

### Step 3: Apply Desired Permissions via chmod / chown
With the kernel lock removed, mutate permissions normally:
```bash
# Grant standard file read/write permissions
sudo chmod 644 /path/to/file

# Update ownership
sudo chown user:group /path/to/file
```

### Step 4: Check Filesystem Mount Status
If `lsattr` reports no flags yet modification is denied, verify partition write availability:
```bash
# Inspect root partition mount options
mount | grep -i " / "

# Remount filesystem read-write
sudo mount -o remount,rw /
```

## 🛡️ Prevention Advice
- **Leverage immutability for critical security files:** Protect critical infrastructure files (such as `/etc/resolv.conf`) against rogue daemon overrides with `sudo chattr +i /etc/resolv.conf`.
- **Audit unauthorized attribute modifications:** Malware scripts frequently apply `+i` flags to prevent administrative deletion.

## ❓ Frequently Asked Questions (FAQ)

### Does the immutable flag (+i) block root?
Yes. The immutable flag is enforced directly by the Linux kernel VFS layer. No process—even UID 0—can delete or mutate the file until `chattr -i` is issued.

### Does chattr work on FAT32 or NTFS mounts?
No. Extended attributes are exclusive to native Linux filesystems such as ext4, XFS, and Btrfs.

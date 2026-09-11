---
title: "[SOLVED] Error No Space Left on Device with Free Disk Space (Inodes Exhausted in Linux)"
description: "Does your Linux server show No Space Left on Device while df -h shows free storage? Learn how to detect and clear exhausted inodes step by step."
category: "Systems & Servers"
tags: ["Linux","Sysadmin","Storage","Bash"]
readTime: "4 min"
date: "2026-09-11"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Millions of small temporary files or uncollected PHP/Docker sessions** | Find directories with the highest inode count via find and delete them |
| **Deleted files still held open by active system processes** | Inspect unlinked open file descriptors with lsof +L1 and restart services |

The `No space left on device` error in Linux does not only trigger when storage gigabytes fill up. Every file, symlink, and directory requires a metadata structure known as an **inode**. If your system generates millions of tiny files (such as PHP session files, mail queue items, or application cache), the filesystem inode table reaches 100% capacity even when `df -h` reports plenty of free disk space.

> **Quick Solution (1 Minute):**
> 1. Check if inodes are at 100%:
>    `df -ih`
> 2. Locate the folder with the highest file density:
>    `sudo du --inodes -d 2 /var | sort -rn | head -n 15`

## 🚀 Step-by-Step Solution

### Step 1: Verify Filesystem Inode Utilization
Run `df -ih` to inspect the percentage of consumed inodes (*IUse%* column) instead of byte storage:
```bash
df -ih
```
If the root partition (`/`) or `/var` displays 100% under *IUse%*, your server is out of inodes.

### Step 2: Pinpoint the Directory Consuming Millions of Files
To locate which subfolder inside `/var` or `/tmp` is responsible for inode starvation, run:
```bash
sudo du --inodes -d 2 /var | sort -rn | head -n 15
```
Common culprits include:
- `/var/lib/php/sessions/` (expired PHP session dumps).
- `/var/spool/postfix/maildrop/` (bounced automated cron notification emails).
- Application micro-cache directories.

### Step 3: Purge Massive File Accumulations Safely
Avoid running `rm -rf *` in directories containing hundreds of thousands of files, as bash will abort with `Argument list too long`. Use `find` with the `-delete` flag:
```bash
# Purge stale PHP sessions older than 24 hours
sudo find /var/lib/php/sessions/ -type f -cmin +1440 -delete

# Purge compressed historical log archives
sudo find /var/log/ -type f -name "*.gz" -mtime +30 -delete
```
Verify the recovery by re-running `df -ih`.

## 🛡️ Prevention Tips
* Enforce strict log retention policies in `/etc/logrotate.conf` with automated compression.
* Schedule cron cleanup routines for high-frequency temporary file directories in `/etc/cron.daily/`.

## Frequently Asked Questions

### Can you increase the inode count on an existing ext4 partition?
On ext4, the inode density is permanently written during partition formatting via mkfs.ext4. To expand inodes dynamically, consider migrating workloads to XFS or Btrfs which allocate inodes on demand.

### Why does lsof report deleted files holding inodes?
If an active process keeps a file descriptor open after deletion, the kernel refuses to deallocate the inode. Pinpoint them with `lsof +L1` and restart the holding daemon.

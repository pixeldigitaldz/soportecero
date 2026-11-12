---
title: How to Repair a BTRFS Filesystem Locked in Read-Only Mode on Linux Servers
description: >-
  Step-by-step guide to diagnose and recover write access on BTRFS drives that have locked into
  read-only mode due to metadata corruption, sudden power loss, or I/O errors.
category: Systems & Servers
tags:
  - BTRFS
  - Linux
  - Storage
  - Sysadmin
  - Docker
readTime: 5 min
date: '2026-07-23'
---

When a secondary storage drive or array formatted with the **BTRFS (B-tree Filesystem)** encounters an unrecoverable write transaction, an unexpected power loss during tree balancing, or underlying NAND/magnetic bad blocks, the Linux kernel immediately invokes its built-in safety mechanism: it drops the filesystem into an emergency **read-only (`ro`) state**. This fail-safe mechanism protects existing metadata trees and file extents from cascading corruption.

On self-hosted homelabs, media servers, and appliances like **Umbrel**, **CasaOS**, or **ZimaOS**, this emergency lock instantly halts running Docker containers, corrupts SQLite databases (like Sonarr or Radarr), and causes write operations to fail with `Read-only file system (errno 30)`.

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **BTRFS transaction aborted due to sudden power cut or crash** | Inspect kernel logs with `dmesg -T \| grep -i btrfs` and mount with `usebackuproot` |
| **Corrupted free space tree cache or metadata balancing error** | Clear metadata cache with `mount -o remount,clear_cache,rw /mountpoint` |
| **Physical I/O block degradation or cabling disconnects** | Check drive health with `sudo smartctl -H /dev/sdX` and run non-destructive `btrfs scrub` |

## 🚀 Step-by-Step Implementation Guide

### Step 1: Inspect Kernel Logs for the Triggering Error
Before executing any write or repair commands, inspect the system kernel ring buffer to determine why BTRFS locked the filesystem:
```bash
sudo dmesg -T | grep -iE "(btrfs|read-only|abort)"
```
Common diagnostic triggers include:
- `BTRFS: error (device sdb1) in btrfs_commit_transaction`: The kernel could not flush the tree transaction block to the hardware.
- `BTRFS critical: corrupt leaf/node`: A metadata checksum mismatch occurred during leaf node verification.

### Step 2: Gracefully Stop Container Services and Unmount the Drive
To prevent background Docker daemons or systemd units from attempting concurrent write retries:
```bash
# Stop application services relying on the mount
sudo systemctl stop docker
sudo systemctl stop containerd

# Unmount the affected filesystem cleanly
sudo umount /dev/sdb1
```
*(Replace `/dev/sdb1` with the exact block device identified via `lsblk -f`).*

### Step 3: Run a Non-Destructive Offline Check
Run the BTRFS integrity check tool in strictly read-only mode to evaluate extent tree integrity:
```bash
sudo btrfs check --readonly /dev/sdb1
```
Review the terminal output:
- If the report indicates only minor discrepancies in the free space cache (`free-space-cache` or `free space tree`), the file data itself is intact.
- **Caution on `--repair`:** Never run `btrfs check --repair` immediately on complex errors without creating a raw block image backup (e.g., via `ddrescue`), as aggressive metadata repair can delete orphaned subvolumes if trees cannot be reconnected.

### Step 4: Mount with BTRFS Recovery and Backup Root Flags
If standard mounting fails, use BTRFS recovery options to roll back to a previously healthy metadata tree root:
```bash
# Mount utilizing valid backup superblocks and clearing corrupted transaction caches
sudo mount -o usebackuproot,clear_cache,rw /dev/sdb1 /mnt/storage
```
If the filesystem still rejects write access, mount in read-only mode with the `rescue=all` option to immediately backup essential files to another drive:
```bash
sudo mount -o ro,rescue=all /dev/sdb1 /mnt/storage
rsync -avP /mnt/storage/ /backup/safe_destination/
```

### Step 5: Execute an Online Scrub to Validate Data Checksums
Once the volume is remounted, run an online BTRFS scrub to recalculate and verify CRC32c/xxhash data checksums across all stored blocks:
```bash
# Start background scrub
sudo btrfs scrub start /mnt/storage

# Monitor progress
sudo btrfs scrub status /mnt/storage
```
If your array is configured with RAID1 or DUP metadata, the scrub will automatically repair corrupted blocks using healthy parity copies.

## 🛡️ Best Practices & Hardware Resilience
- **Deploy an Uninterruptible Power Supply (UPS):** Sudden power outages during BTRFS metadata tree splits are the leading cause of read-only locks. A basic line-interactive UPS configured with Network UPS Tools (NUT) prevents sudden dirty dismounts.
- **Enable `noatime` in Mount Options:** In `/etc/fstab`, ensure your mount string includes `noatime,compress=zstd:1` to minimize unnecessary disk writes for access timestamps.

## Frequently Asked Questions (FAQ)

### Can I fix a BTRFS read-only error with standard fsck?
No. Standard `fsck.btrfs` is merely a dummy wrapper that calls `btrfs check`. Never attempt to run `fsck.ext4` or generic filesystem checkers on a BTRFS partition, as this will irreparably damage the partition table.

### What should I do if smartctl reports reallocated sectors on the drive?
If `smartctl -a /dev/sdb` displays increasing `Reallocated_Sector_Ct` or `Current_Pending_Sector`, the disk hardware is failing physically. Immediately extract all data using `btrfs restore` or read-only `rsync` and replace the physical drive.

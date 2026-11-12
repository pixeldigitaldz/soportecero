---
title: How to Fix Out of Memory (SWAP) Game Crashes in Linux (CachyOS / Bazzite / SteamOS)
description: >-
  Prevent memory-intensive PC games and Docker instances from crashing abruptly by
  configuring swapfiles, swappiness kernel tuning, and zRAM on Linux.
category: Gaming Tech
tags:
  - Linux
  - Optimization
  - Gaming
  - Sysadmin
  - CachyOS
readTime: 5 min
date: '2026-07-20'
---

When running resource-heavy games (such as *Starfield*, *Helldivers 2*, or heavily modded *Cyberpunk 2077*) under performance-oriented Linux gaming distributions like **CachyOS**, **Bazzite**, or **SteamOS**, games may freeze, stutter violently, or vanish from the screen without an error dialog. Inspecting the system journal (`dmesg` or `journalctl -xe`) typically reveals an invocation of the Linux kernel **Out-of-Memory (OOM) Killer** or `systemd-oomd`, which terminates the memory-hogging game process to protect the operating system kernel from panicking.

This abrupt crash occurs when physical RAM capacity is completely saturated and the system lacks sufficient, responsive virtual memory (**swap space**) to absorb transient memory spikes or offload idle background anonymous pages.

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Zero active swap space causing immediate SIGKILL when RAM fills** | Allocate an 8 GB to 16 GB swapfile formatted with `mkswap` |
| **Btrfs filesystem error: swapfile copy-on-write (COW) not disabled** | Disable COW with `chattr +C /swapfile` before preallocation |
| **Aggressive default swappiness flushing pages prematurely to disk** | Tune `vm.swappiness` between 10 and 20 for responsive gaming |

## 🚀 Step-by-Step Implementation Guide

### Step 1: Audit Current Memory and Swap State
Open your Linux terminal and query active memory pools using native utilities:
```bash
# Inspect active swap devices and files
swapon --show

# Check total, used, and available physical memory
free -h
```
If `swapon --show` returns blank or displays `0B` available, your Linux installation is operating without swap protection, leaving your games vulnerable to instant OOM termination.

### Step 2: Create a High-Performance 8 GB Swapfile
For systems running 16 GB or 32 GB of RAM, an 8 GB to 16 GB swapfile on an NVMe SSD provides the ideal safety buffer.

*(Note for Btrfs filesystems: CachyOS and Bazzite frequently use Btrfs. You must disable Copy-on-Write (`chattr +C`) on the file before allocating space to prevent filesystem corruption)*:
```bash
# 1. Allocate a zeroed 8GB file safely
sudo btrfs filesystem mkswapfile --size 8G /swapfile 2>/dev/null || sudo fallocate -l 8G /swapfile

# 2. Enforce strict permissions (owner read/write only)
sudo chmod 600 /swapfile

# 3. Format the file structure as Linux swap
sudo mkswap /swapfile

# 4. Activate the swapfile immediately in memory
sudo swapon /swapfile
```
Verify activation with `swapon --show`. You will see `/swapfile` listed with an active priority.

### Step 3: Persist Swap Mounting Across System Reboots
Ensure your swapfile mounts automatically upon system initialization by appending it to `/etc/fstab`:
```bash
# Backup fstab before editing
sudo cp /etc/fstab /etc/fstab.bak

# Append the swapfile mount line
echo '/swapfile none swap defaults 0 0' | sudo tee -a /etc/fstab
```

### Step 4: Tune Kernel Swappiness for Gaming Performance
By default, standard Linux desktop kernels are configured with `vm.swappiness = 60`, which instructs the virtual memory subsystem to start swapping pages early. For low-latency gaming, you want the kernel to favor physical RAM, paging out only when memory pressure is acute:
```bash
# Set runtime swappiness to 15
sudo sysctl vm.swappiness=15

# Persist swappiness across reboots in sysctl configuration
echo 'vm.swappiness=15' | sudo tee /etc/sysctl.d/99-gaming-swap.conf
```

## 🛡️ Best Practices: zRAM vs Physical Swapfile
While physical NVMe swapfiles protect against hard OOM crashes, **zRAM** provides vastly superior performance. zRAM creates an in-RAM compressed block device (typically using the fast `zstd` or `lz4` compression algorithm). Paging out to zRAM is up to 10× faster than writing to an NVMe SSD and causes zero SSD write wear. On distributions like Fedora, Bazzite, and CachyOS, ensure `zram-generator` is active alongside a secondary fallback swapfile.

## Frequently Asked Questions (FAQ)

### Does having a swapfile cause micro-stutters when gaming?
No, when paired with `vm.swappiness=15` and modern NVMe storage, the kernel only swaps truly dormant background pages (such as Discord, Spotify, or browser tabs), keeping the game's active working set entirely in low-latency physical RAM.

### Why did fallocate fail with 'Operation not supported' on my system?
If your root partition uses the Btrfs filesystem, traditional `fallocate` is blocked to prevent fragmented Copy-on-Write allocation. Always use `sudo btrfs filesystem mkswapfile --size 8G /swapfile` on Btrfs systems.

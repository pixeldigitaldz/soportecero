---
title: "[SOLVED] Could not get lock /var/lib/dpkg/lock-frontend in Ubuntu & Debian"
description: "Learn how to resolve Could not get lock /var/lib/dpkg/lock-frontend caused by unattended-upgrades or frozen background apt sessions."
category: "Systems & Servers"
tags: ["Ubuntu","Debian","apt","Linux"]
readTime: "4 min"
date: "2026-09-23"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Background system auto-updater (unattended-upgrades) is actively patching packages** | Allow the automated routine to finish or safely terminate hanging PID with kill |
| **Orphaned lock files remaining after a hard reboot or aborted apt run** | Clear stale lock handles and repair package database with dpkg --configure -a |

When invoking `apt update` or `apt install` on Ubuntu or Debian machines, the command frequently aborts with: `E: Could not get lock /var/lib/dpkg/lock-frontend - open (11: Resource temporarily unavailable)` followed by `E: Unable to acquire the dpkg frontend lock, is another process using it?`. dpkg enforces a strict single-writer mutex lock to prevent concurrent operations from corrupting installed package status.

> **Quick Solution (1 Minute):**
> 1. Check which PID holds the frontend lock:
>    `sudo lsof /var/lib/dpkg/lock-frontend`
> 2. If stale, terminate the hanging PID and repair:
>    `sudo kill -9 <PID> && sudo dpkg --configure -a`

## 🚀 Step-by-Step Solution

### Step 1: Identify the Active Locking Process
Never delete lock files blindly without auditing active processes. Check whether `unattended-upgrades` or `apt.systemd.daily` is in progress:
```bash
sudo lsof /var/lib/dpkg/lock-frontend
# Or list active package managers
ps aux | grep -i -E 'apt|dpkg'
```
If unattended-upgrades is active, waiting 2-3 minutes for security patches to conclude is the safest approach.

### Step 2: Terminate Hung or Orphaned Package Daemons
If a prior SSH shell crashed midway through an install, terminate the orphaned apt process:
```bash
sudo killall apt apt-get dpkg
# If stubborn
sudo killall -9 apt apt-get dpkg
```

### Step 3: Remove Stale Lock Files and Reconfigure Corrupted State
Once all apt processes are confirmed stopped, purge the stale lock indicators and re-index package dependencies:
```bash
sudo rm -f /var/lib/dpkg/lock-frontend
sudo rm -f /var/lib/dpkg/lock
sudo rm -f /var/lib/apt/lists/lock
sudo rm -f /var/cache/apt/archives/lock

# Repair half-installed packages
sudo dpkg --configure -a
sudo apt-get install -f
```

## 🛡️ Prevention Tips
* Never power cycle or disconnect servers while dpkg is committing binaries to disk.
* In automated Ansible or Cloud-Init workflows, configure a `wait-for-lock` polling loop before triggering apt commands.

## Frequently Asked Questions

### Can deleting lock files corrupt my Linux distribution?
Only if another apt process is actively writing to the filesystem. Deleting the lock while dpkg unpacks can cause binary fragmentation and broken symlinks.

### How can I stop background apt timers from clashing with automated CI/CD runners?
Disable automatic package checking with `sudo systemctl disable --now apt-daily.timer apt-daily-upgrade.timer`.

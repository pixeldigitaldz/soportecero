---
title: 'Could not get lock /var/lib/dpkg/lock-frontend in Ubuntu & Debian'
description: >-
  Learn how to resolve Could not get lock /var/lib/dpkg/lock-frontend caused by
  unattended-upgrades or frozen background apt sessions.
category: Systems & Servers
tags:
  - Ubuntu
  - Debian
  - apt
  - Linux
readTime: 5 min
date: '2026-09-23'
---

Running `apt update`, `apt install`, or `apt upgrade` on Ubuntu or Debian systems—especially right after booting a fresh cloud VM—often fails with `E: Could not get lock /var/lib/dpkg/lock-frontend. It is held by process <PID> (unattended-upgr)` or `open (11: Resource temporarily unavailable)`. This occurs because `apt` and `dpkg` enforce an exclusive file lock to prevent two package managers from modifying `/var/lib/dpkg/status` simultaneously.

## Quick Diagnostics

| Cause | Symptom | Solution |
|---|---|---|
| **Active `unattended-upgrades` run** | Lock held by `unattended-upgr` or `apt.systemd.daily` | Wait for completion or pass `-o DPkg::Lock::Timeout=60` |
| **Frozen SSH / terminal `apt` session** | Lock held by a stalled `apt` or `dpkg` PID | Gracefully `kill` the hung PID, then `dpkg --configure -a` |
| **Stale lock after power loss / crash** | `lsof` shows no active PID holding the file | Remove stale lock files and run `dpkg --configure -a` |
| **GUI updater (Ubuntu Software) open** | Lock held by `packagekitd` or `snap-store` | Close updater or restart `packagekit.service` |

## Root Cause & Technical Mechanics

On Debian-based distributions, package installation is a non-atomic, multi-step operation: archives are unpacked into system directories, maintainer scripts (`preinst`, `postinst`) execute, and `/var/lib/dpkg/status` plus `/var/lib/dpkg/info/` are rewritten.

To prevent database corruption from concurrent writes, `apt` acquires an advisory `fcntl()` (`F_SETLK`) write lock on `/var/lib/dpkg/lock-frontend` before invoking `dpkg`, which in turn locks `/var/lib/dpkg/lock`. On Ubuntu Server and Desktop, systemd timers (`apt-daily.timer` and `apt-daily-upgrade.timer`) trigger `unattended-upgrades` in the background shortly after boot. If you invoke `apt install` while that background job holds the `fcntl` lock, the kernel returns `EAGAIN` (`Resource temporarily unavailable`), and `apt` exits immediately. Note that **simply deleting the lock file while a process still holds an open file descriptor does not release the kernel lock**—and if you kill `dpkg` mid-unpack, the package database is left in a half-configured state.

## Step-by-Step Solution

### Step 1: Identify Which Process Holds the Lock

Check whether an active process holds the lock file descriptor before touching anything:

```bash
sudo lsof /var/lib/dpkg/lock-frontend /var/lib/dpkg/lock /var/lib/apt/lists/lock
ps aux | grep -E 'apt|dpkg|unattended'
```

If `unattended-upgr` is actively installing security patches, the safest option is to wait 1–3 minutes—or tell `apt` to wait automatically for the lock to clear:

```bash
sudo apt-get -o DPkg::Lock::Timeout=120 install -y <package-name>
```

### Step 2: Terminate Only Truly Hung Processes

If `lsof` shows a crashed or frozen `apt` process from a dropped SSH session that has made zero CPU/I/O progress, terminate it gracefully first with `SIGTERM` before resorting to `SIGKILL`:

```bash
# Replace <PID> with the exact PID returned by lsof
sudo kill -15 <PID>

# Only if unresponsive after 10 seconds:
sudo kill -9 <PID>
```

### Step 3: Remove Stale Locks and Repair Interrupted Packages

Once `lsof` confirms **no process** holds any lock file, clear orphaned lock files and repair any half-configured packages:

```bash
sudo rm -f /var/lib/dpkg/lock-frontend /var/lib/dpkg/lock /var/lib/apt/lists/lock /var/cache/apt/archives/lock
sudo dpkg --configure -a
sudo apt-get install -f
```

### Step 4: Verify Package Database Health

Run a clean index refresh and check for broken dependencies:

```bash
sudo apt-get update && sudo apt-get check
```

If both commands exit with status `0` and no held/broken packages are reported, `apt` is fully recovered.

## Frequently Asked Questions

### Why is `rm -f /var/lib/dpkg/lock-frontend` dangerous if a process is still running?
Deleting the directory entry unlinks the filename while the running `apt` process still writes via its open file descriptor. A second `apt` invocation will then create a *new* lock file and write concurrently to `/var/lib/dpkg/status`, corrupting the package database.

### How do I make Ansible, Packer, or Cloud-Init wait instead of failing on lock-frontend?
Use `DPkg::Lock::Timeout` (supported in `apt` 1.9.11+ on Ubuntu 20.04+ and Debian 11+): `apt-get -o DPkg::Lock::Timeout=300 update`.

### Should I disable `unattended-upgrades` permanently on production servers?
Only if you manage patching via an external orchestration pipeline (Ansible, golden AMI rebuilds). If you disable `apt-daily-upgrade.timer`, ensure you have another scheduled mechanism for critical kernel and OpenSSL security updates.

## Prevention Advice

- Always pass `-o DPkg::Lock::Timeout=120` in provisioning scripts so `apt` polls cleanly instead of aborting during boot-time `unattended-upgrades`.
- Run long `apt upgrade` sessions over SSH inside `tmux` or `screen` so a network drop never leaves `dpkg` interrupted mid-postinst.
- Avoid `kill -9` on `dpkg` unless the process is completely deadlocked; `dpkg --configure -a` is mandatory afterward if `SIGKILL` is used.
- In Packer or Terraform image builds, wait for `cloud-init status --wait` before running `apt-get` commands.

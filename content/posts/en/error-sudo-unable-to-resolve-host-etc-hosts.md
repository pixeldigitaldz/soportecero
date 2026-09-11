---
title: "[SOLVED] Error: sudo: unable to resolve host in Ubuntu & Debian"
description: "Fix the annoying sudo: unable to resolve host warning in Linux. Fast guide to reconciling /etc/hostname with /etc/hosts on cloud servers."
category: "Systems & Servers"
tags: ["Linux","Ubuntu","Sysadmin","Bash"]
readTime: "3 min"
date: "2026-09-16"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **System hostname in /etc/hostname is missing from local loopback mapping in /etc/hosts** | Add 127.0.1.1 mapped to the exact system hostname in /etc/hosts |
| **VPS or cloud instance hostname was changed without updating local hosts resolution** | Sync hostnamectl configuration with /etc/hosts |

Whenever running commands with `sudo`, the terminal stutters and prints `sudo: unable to resolve host <server-name>: Name or service not known`. While the requested command often completes, this DNS resolution timeout adds annoying delays to CLI interactions, breaks CI/CD automated runners, and can disrupt daemons dependent on local hostname validation.

> **Quick Solution (1 Minute):**
> 1. Check system hostname:
>    `hostname`
> 2. Append local loopback resolver to /etc/hosts:
>    `echo "127.0.1.1 $(hostname)" | sudo tee -a /etc/hosts`

## 🚀 Step-by-Step Solution

### Step 1: Verify Current System Hostname
Check the exact static hostname assigned to your running Linux kernel:
```bash
hostname
# Or via systemd
hostnamectl --static
```
Suppose the terminal outputs `vps-prod-01`.

### Step 2: Update /etc/hosts Local IP Mapping
Open your system hosts lookup table with root privileges:
```bash
sudo nano /etc/hosts
```
Ensure an entry links loopback IP `127.0.1.1` to your hostname:
```plaintext
127.0.0.1 localhost
127.0.1.1 vps-prod-01
```
Save and exit the editor (`Ctrl + O`, `Ctrl + X`).

### Step 3: Confirm Warning Elimination
Run an immediate sudo execution to verify resolution latency is zero:
```bash
sudo true
```
The command should return immediately without emitting any host lookup warning.

## 🛡️ Prevention Tips
* Whenever renaming a server with `hostnamectl set-hostname`, update `/etc/hosts` in the same deployment step.
* On cloud VPS instances deploying `cloud-init`, ensure `/etc/cloud/cloud.cfg` preserves custom hostname settings across reboots.

## Frequently Asked Questions

### Why does sudo attempt hostname lookups on every execution?
sudo consults NSS to check whether the current user is restricted to running commands on specific remote hosts listed in the sudoers ruleset.

### Why do Ubuntu and Debian utilize 127.0.1.1 instead of 127.0.0.1?
127.0.0.1 is standard localhost. Debian distributions map the host domain/FQDN to 127.0.1.1 so systems with dynamic DHCP IPs can still resolve their own hostnames locally.

---
title: "[SOLVED] rsync error: error in rsync protocol data stream (code 12) connection unexpectedly closed"
description: "Fix rsync error code 12 connection unexpectedly closed when copying large files or automated backups over SSH."
category: "Systems & Servers"
tags: ["rsync","SSH","Linux","Backup"]
readTime: "4 min"
date: "2026-09-21"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **rsync binary is missing or not in $PATH on the destination remote server** | Install rsync on the remote host with sudo apt install rsync |
| **SSH connection timeout or stateful NAT firewall killing idle TCP pipes** | Configure ServerAliveInterval and leverage -P --partial in rsync commands |

While transferring backups or replicating directory trees over SSH, your transfer abruptly aborts with `rsync: connection unexpectedly closed (0 bytes received so far) [sender]` followed by `rsync error: error in rsync protocol data stream (code 12) at io.c`. Exit code 12 signifies that the bidirectional data stream between the local sender and remote receiver process collapsed prematurely.

> **Quick Solution (1 Minute):**
> 1. Verify remote rsync binary availability:
>    `ssh user@server "which rsync"`
> 2. Run transfer with resilient TCP keepalive options:
>    `rsync -avzP -e "ssh -o ServerAliveInterval=30" src/ user@server:/dest/`

## 🚀 Step-by-Step Solution

### Step 1: Verify and Install rsync on Remote Destination Host
The most common root cause when rsync fails instantly at 0 bytes transferred is the absence of the rsync executable on the target machine:
```bash
# On remote Ubuntu / Debian
sudo apt update && sudo apt install -y rsync

# On remote RHEL / Rocky Linux / AlmaLinux
sudo dnf install -y rsync
```

### Step 2: Block Stateful NAT Dropouts with SSH KeepAlive Flags
When syncing multi-gigabyte ISOs or databases, intermediate firewalls frequently drop connections deemed idle. Enforce active probing packets:
```bash
rsync -avzP -e "ssh -o ServerAliveInterval=15 -o ServerAliveCountMax=4" /local/dir/ user@server:/remote/dir/
```

### Step 3: Enable Resumable Partial Transfers (-P)
Prevent network blips from forcing a complete restart of huge transfers by adding the `-P` argument (combines `--partial` and `--progress`):
```bash
rsync -avhP /var/backups/ user@server:/backups/
```
If a network disconnect occurs, re-running the command resumes transmission from the exact byte where it paused.

## 🛡️ Prevention Tips
* Add `ClientAliveInterval 30` inside remote `/etc/ssh/sshd_config` to sustain background batch transfers.
* For enterprise-scale migrations, wrap rsync commands inside detachable sessions using `tmux` or `screen`.

## Frequently Asked Questions

### Why does rsync trigger Out of Memory before code 12 on budget VPSs?
Building recursive in-memory file indexes for millions of files exhausts constrained RAM. Pass `--no-inc-recursive` or sync partitioned subtrees.

### How can I inspect the exact reason for the abrupt termination?
Invoke rsync in hyper-verbose mode combined with SSH debugging: `rsync -vvv -e "ssh -vvv" ...` to expose the initiating termination signal.

---
title: >-
  rsync error: error in rsync protocol data stream (code 12) connection
  unexpectedly closed
description: >-
  Fix rsync error code 12 connection unexpectedly closed when copying large
  files or automated backups over SSH.
category: Systems & Servers
tags:
  - rsync
  - SSH
  - Linux
  - Backup
readTime: 5 min
date: '2026-09-17'
---

When synchronizing backups or large directory trees over SSH, `rsync` can abort abruptly with `rsync: connection unexpectedly closed (0 bytes received so far) [sender]` followed by `rsync error: error in rsync protocol data stream (code 12) at io.c`. Exit code 12 means the bidirectional multiplexed data stream between the local `rsync` sender and the remote `rsync --server` receiver collapsed before the transfer finished.

## Quick Diagnostics

| Cause | Symptom | Solution |
|---|---|---|
| **Missing `rsync` on remote host** | Fails instantly at `0 bytes received so far` | Install `rsync` on remote or pass `--rsync-path` |
| **Noisy `.bashrc` / MOTD on remote SSH** | Protocol stream corrupted at handshake | Guard interactive output in remote `~/.bashrc` |
| **Idle SSH / NAT firewall timeout** | Fails mid-transfer on huge files or slow disks | Pass `-e "ssh -o ServerAliveInterval=15"` and `-P` |
| **Remote OOM killer or full disk** | Drops after scanning millions of files | Pass `--no-inc-recursive` or check `df -h` / `dmesg` |

## Root Cause & Technical Mechanics

`rsync` operates as a client-server pair over a single SSH channel: the local process invokes `ssh user@host rsync --server ...` on the remote machine and exchanges a binary protocol stream over `stdin`/`stdout`.

Exit code 12 (`RERR_STREAMIO`) is triggered whenever that pipe closes unexpectedly:
1. **Immediate Failure (0 bytes received):** Either the `rsync` binary is missing from the remote `$PATH` (common in minimal container images or Synology/BSD NAS setups where `rsync` lives in `/usr/local/bin/rsync`), or the remote user's shell startup script (`~/.bashrc` / `/etc/profile`) prints text to `stdout` on non-interactive SSH logins, corrupting the binary `rsync` handshake.
2. **Mid-Transfer Failure:** During multi-gigabyte transfers or heavy delta-checksum computation, the TCP connection sits idle from the perspective of stateful NAT gateways, causing firewall state expiration. Alternatively, on low-RAM VPS instances, `rsync`'s file-list index can trigger the Linux OOM killer on the remote receiver, or the destination partition hits 100% capacity (`ENOSPC`).

## Step-by-Step Solution

### Step 1: Verify Remote `rsync` Binary and Clean Non-Interactive SSH Output

Test whether `rsync` is reachable and whether the remote shell emits stray output on non-interactive SSH:

```bash
ssh user@server "which rsync && df -h /remote/dir"
```

If `rsync` is missing, install it on the remote host (`sudo apt install -y rsync` or `sudo dnf install -y rsync`). If your remote `~/.bashrc` prints a banner, ensure it exits early for non-interactive shells (`[[ $- != *i* ]] && return`).

### Step 2: Keep the SSH Tunnel Alive and Enable Resumable Transfers

Configure SSH keepalive probes so NAT firewalls never drop the connection during long checksum phases, and pass `-P` (`--partial --progress`) so interrupted files resume rather than restarting from zero:

```bash
rsync -avhP -e "ssh -o ServerAliveInterval=15 -o ServerAliveCountMax=4" /local/dir/ user@server:/remote/dir/
```

### Step 3: Prevent Out-of-Memory Crashes on Huge File Trees

If `dmesg` on the remote server shows `Out of memory: Killed process ... (rsync)`, reduce memory overhead or limit bandwidth so disk I/O does not saturate:

```bash
rsync -avhP --no-inc-recursive --bwlimit=50000 /local/dir/ user@server:/remote/dir/
```

### Step 4: Diagnose Exact Termination Cause

If code 12 persists, run both `rsync` and `ssh` in verbose debug mode to capture the exact remote stderr line before the pipe closes:

```bash
rsync -vvv -e "ssh -vv" /local/dir/ user@server:/remote/dir/
```

## Frequently Asked Questions

### Why does `rsync` fail with code 12 when copying from macOS or to a Synology NAS?
Non-standard systems often install `rsync` outside `/usr/bin`. Specify the remote binary path explicitly with `--rsync-path=/usr/local/bin/rsync` (or `sudo rsync` if elevated destination permissions are needed).

### Does `-z` (compression) ever cause code 12?
On CPU-constrained servers transferring already-compressed archives (`.zip`, `.mp4`, `.tar.gz`), `-z` wastes CPU cycles and can stall the stream. Omit `-z` on fast LANs or for pre-compressed media.

### How can I check if the remote disk filled up mid-transfer?
Run `ssh user@server "df -h && df -i"`—exhausting either disk blocks *or* filesystem inodes (`df -i`) will cause the remote `rsync` receiver to abort with code 12.

## Prevention Advice

- Configure `ClientAliveInterval 30` and `ClientAliveCountMax 5` in `/etc/ssh/sshd_config` on backup targets so long-running transfers stay alive.
- Wrap large unattended migrations inside `tmux` or `screen` on the initiating host so local terminal disconnects never kill the transfer.
- Never place `echo` or `neofetch` commands in `~/.bashrc` without checking `[[ $- != *i* ]] && return` first.
- Monitor destination disk space and inode usage before scheduled `cron` or `systemd` `rsync` backup jobs run.

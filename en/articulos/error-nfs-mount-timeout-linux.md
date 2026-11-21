---
title: 'Solved: Linux Boot Delay due to Timeout Error in NFS Network Mounts'
description: >-
  Prevent your operating system from freezing for 90 seconds during boot when
  your NAS or local storage server is offline.
category: Systems & Servers
tags:
  - NFS
  - Network
  - Sysadmin
readTime: 5 min
date: '2026-07-27'
---

When an NFS (Network File System) share is defined in `/etc/fstab` with standard synchronous options, Linux attempts to mount the remote export during system startup. If the NAS is powered off, the network interface is not yet ready, or port `2049` is unreachable, the boot process stalls for a strict **90-second** `systemd` job timeout before dropping to a shell or continuing without the share.

## Quick Diagnostics

| Symptom / Cause | Verification | Immediate Fix |
|---|---|---|
| Boot hangs for 90s on `A start job is running for /mnt/nfs` | `systemd-analyze blame` / `journalctl -b \| grep nfs` | Add `noauto,x-systemd.automount` in `/etc/fstab` |
| NFS server unreachable or port `2049` firewalled | `nc -zv -w 3 <server_ip> 2049` | Allow TCP/UDP `2049` on server firewall |
| Export path missing or client IP unauthorized | `showmount -e <server_ip>` | Update `/etc/exports` and run `exportfs -ra` |
| `fstab` mounts before Wi-Fi/DHCP finishes | `journalctl -u NetworkManager-wait-online` | Use `x-systemd.automount` or `_netdev` |

## Root Cause & Technical Mechanics

At boot, `systemd-fstab-generator` translates every `/etc/fstab` line into a `.mount` unit. Even when `_netdev` is specified—which orders the mount after `network-online.target`—the mount still executes synchronously during startup.

If the target NFS server is offline or packet-filtered:

1. The Linux kernel's RPC/NFS client (`sunrpc`) sends `TCP SYN` or `PORTMAP`/`NFSv4` requests and enters exponential retry loops.
2. `systemd` monitors the mount job with a default `JobTimeoutSec=90s`. Until that timer expires or the server responds, `remote-fs.target` blocks boot progress.
3. With `hard` mounts (the kernel default), any subsequent I/O to a hung NFS mount point can also freeze file managers or terminal commands (`df`, `ls`) indefinitely unless `soft` or `timeo` bounds are configured.

Switching to **on-demand automounting** (`x-systemd.automount`) decouples boot from network availability: `systemd` creates a lightweight `.automount` stub at boot in milliseconds and only triggers the actual `mount.nfs` call when a process accesses the directory.

## Step-by-Step Solution

### Step 1: Verify NFS Server Reachability and Exports

Before modifying `/etc/fstab`, confirm the NFS server is exporting the share and port `2049` (NFSv4) is open:

```bash
nc -zv -w 3 192.168.1.50 2049
showmount -e 192.168.1.50
```

If `showmount` fails with a timeout, open port `2049/tcp` (and `111/tcp` + `111/udp` for NFSv3) on the NAS/server firewall.

### Step 2: Update `/etc/fstab` With Systemd Automount Options

Open `/etc/fstab` as root:

```bash
sudo nano /etc/fstab
```

Locate your NFS entry and replace `defaults` with non-blocking automount and timeout parameters:

```plaintext
192.168.1.50:/share /mnt/nfs nfs _netdev,noauto,x-systemd.automount,x-systemd.device-timeout=5,x-systemd.idle-timeout=300,timeo=14,retrans=3,soft 0 0
```

What each option controls:

- `_netdev`: Marks the mount as network-dependent so `systemd` waits for `network-online.target` and unmounts cleanly before shutting down the network at poweroff.
- `noauto`: Prevents `remote-fs.target` from blocking boot to mount the share immediately.
- `x-systemd.automount`: Creates an automount unit that mounts `/mnt/nfs` transparently on first file access.
- `x-systemd.device-timeout=5`: Bounds device wait time to 5 seconds instead of 90.
- `x-systemd.idle-timeout=300`: Automatically unmounts the share after 5 minutes of inactivity, preventing stale mounts when a laptop changes networks.
- `timeo=14,retrans=3,soft`: Configures a 1.4-second RPC timeout (`timeo` is in tenths of a second) with 3 retries, returning an I/O error instead of hanging processes forever if the NAS vanishes mid-session.

### Step 3: Reload Systemd and Activate the Automount Unit

Apply the updated `/etc/fstab` without rebooting:

```bash
sudo systemctl daemon-reload
sudo systemctl restart remote-fs.target
```

Verify the automount unit is active and trigger it by listing the directory:

```bash
systemctl status mnt-nfs.automount --no-pager
ls -la /mnt/nfs
findmnt /mnt/nfs
```

`findmnt /mnt/nfs` will show both the `autofs` trigger and the live `nfs4` mount once accessed.

## Frequently Asked Questions

### Is `soft` safe to use for all NFS mounts?
For read-mostly media shares, backups, or home directories where an I/O error is preferable to a frozen desktop, `soft` is ideal. However, for databases or active virtual machine disk images where silent partial writes could corrupt data, keep `hard,intr` (or `hard`) and rely on `x-systemd.automount` to avoid boot delays.

### Why does my system still hang during shutdown or reboot?
If an NFS share is mounted when the Wi-Fi or Ethernet interface goes down during shutdown, the kernel cannot flush pending RPCs. Ensuring `_netdev` is present in `/etc/fstab` tells `systemd` to unmount the NFS share *before* stopping `NetworkManager` or `systemd-networkd`.

### Can I use NFSv4 only to avoid `rpcbind` (port 111) issues?
Yes. Adding `nfsvers=4.2` (or `vers=4`) to your `/etc/fstab` options forces NFSv4 over a single TCP port (`2049`), eliminating `rpcbind`/`portmapper` firewall headaches.

## Prevention Advice

- **Never use synchronous NFS mounts on laptops:** Wireless interfaces authenticate after login; always pair mobile clients with `noauto,x-systemd.automount`.
- **Use `nofail` on non-critical shares:** Add `nofail` alongside `noauto` so missing network paths never trigger emergency mode.
- **Test with `systemd-analyze blame`:** After updating `/etc/fstab`, reboot and run `systemd-analyze blame` to confirm no mount unit takes longer than a few hundred milliseconds.
- **Pin static server IPs or local DNS:** Use a reserved DHCP lease or `/etc/hosts` entry for your NAS so IP changes do not break automounts.

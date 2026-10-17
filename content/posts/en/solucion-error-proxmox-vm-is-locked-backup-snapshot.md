---
title: "How to Fix 'VM is locked (backup/snapshot)' Error in Proxmox VE"
description: "Step-by-step technical guide to unlock stuck virtual machines and LXC containers in Proxmox VE using qm unlock and pct unlock after failed backup tasks."
category: "Systems & Servers"
date: "2026-10-17"
readTime: "3 min"
tags: ["Proxmox", "Virtualization", "SysAdmin"]
---

The error `TASK ERROR: can't lock file '/var/lock/qemu-server/lock-XXX.conf' - got timeout` or the persistent notification `VM is locked (backup)` / `VM is locked (snapshot)` in the Proxmox Virtual Environment (PVE) web console occurs when an automated or manual maintenance task terminates abnormally before releasing the internal safety lock.

Proxmox automatically places safety locks on QEMU virtual machines and LXC containers during critical operations such as live backups via Proxmox Backup Server (PBS), snapshot creations, or cross-node migrations to prevent concurrent disk writes and filesystem corruption. If the target backup storage encounters a network timeout or the job is forcefully killed, this administrative lock remains active indefinitely, preventing administrators from starting, stopping, or configuring the instance from the web interface.

## Quick Diagnostics

| Root Cause | Recommended Fix |
|---|---|
| **Interrupted backup job due to network drop or reboot (`locked: backup`)** | Release the safety lock from the node terminal using `qm unlock <vmid>` |
| **LXC container stuck after an ungraceful snapshot (`locked: snapshot`)** | Clear container lock state via CLI with `pct unlock <vmid>` |
| **Dangling vzdump background process holding the lock file** | Identify and kill the dead background backup task before unlocking |
| **Slow network storage (NFS/SMB) creating I/O backup timeouts** | Review storage latency and implement I/O bandwidth limits in backup jobs |

## Step-by-Step Solution

### Step 1: Check for and terminate orphaned backup processes
Before forcibly releasing the lock, make sure no background worker process is actively streaming data to or from the virtual disk. Access the Proxmox node shell over SSH or via the Web GUI console and list all running jobs associated with your VM ID:
```bash
# Replace 105 with your specific VMID
ps aux | grep qm | grep 105
ps aux | grep vzdump
```
If an inactive or hung `vzdump` process is still lingering in the process table with no I/O progression, terminate it:
```bash
kill -9 <PROCESS_PID>
```

### Step 2: Release virtual machine locks using qm unlock
For KVM/QEMU virtual machines, invoke the native Proxmox `qm unlock` CLI utility:
```bash
qm unlock 105
```
Once executed, refresh the Proxmox Web GUI. The yellow padlock icon will immediately vanish, and power actions (Start, Shutdown, Reboot) will be restored.

### Step 3: Unlock LXC containers using pct unlock
If the locked instance is an LXC container rather than a full virtual machine, use the `pct` management command:
```bash
pct unlock 200
```
Confirm the container has returned to an operational state:
```bash
pct status 200
```

### Step 4: Manually clear persistent locks from configuration files
In rare scenarios where the unlock command returns no errors but the GUI still indicates that the instance is locked, manually inspect the configuration file:
```bash
# For QEMU Virtual Machines:
nano /etc/pve/qemu-server/105.conf

# For LXC Containers:
nano /etc/pve/lxc/200.conf
```
Locate the line beginning with `lock:` (such as `lock: backup` or `lock: snapshot`), delete that line completely, save with `Ctrl + O`, and exit with `Ctrl + X`. The Proxmox cluster filesystem (`pmxcfs`) automatically syncs the edit across the cluster in real time.

## Prevention Tips
- **Configure backup bandwidth limits (BW Limit):** In `Datacenter -> Backup`, set an appropriate bandwidth throttling limit to avoid overwhelming network throughput on shared NFS or TrueNAS targets.
- **Avoid hard task cancellations:** Never hit the forced "Stop" button in the task log window while a ZFS or LVM disk snapshot is underway; allow I/O queues to drain naturally.
- **Health-check storage targets:** Ensure all mounted backup targets have reliable connectivity and adequate capacity before scheduling large recurring nightly backups.

## Frequently Asked Questions

### Is it safe to run qm unlock while a virtual machine is running?
Yes. The `qm unlock` command strictly removes Proxmox's metadata lock flag. However, ensure no background backup is actively transferring disk blocks to avoid producing a partially corrupt backup file.

### Why does Proxmox lack an unlock button in the web GUI?
This design choice is intentional. Forcing administrators to access the shell ensures that hung processes are manually reviewed before releasing the safeguard, preventing accidental dual-write scenarios on virtual disks.

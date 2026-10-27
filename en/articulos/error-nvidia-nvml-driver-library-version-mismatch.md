---
title: 'Fix Nvidia NVML Error: Driver/library version mismatch in Linux'
description: >-
  Fix 'Failed to initialize NVML: Driver/library version mismatch' when running nvidia-smi on Linux without rebooting the server.
category: Systems & Servers
tags:
  - Nvidia
  - Linux
  - GPU
  - Drivers
  - Ubuntu
  - Servidores
readTime: 5 min
date: '2026-10-26'
---

The error `Failed to initialize NVML: Driver/library version mismatch` occurs frequently on Linux servers and workstations (specifically Ubuntu and Debian distributions) when executing `nvidia-smi` or launching GPU-enabled Docker containers. This issue arises whenever automated package upgrades (such as `unattended-upgrades` or manual `apt upgrade`) update the userland libraries (`libnvidia-*.so`) on disk, while the earlier Nvidia kernel module (`nvidia.ko`) remains loaded in RAM.

## Quick Diagnostics

| Cause | Solution |
|---|---|
| **Discrepancy between running kernel module version and userland NVML libraries** | Unload and reload Nvidia kernel modules without rebooting the entire host |
| **Background processes holding GPU device handles (Docker, Xorg, Ollama, PyTorch)** | Identify active process IDs with fuser or lsof and terminate or stop them temporarily |
| **Multiple conflicting Nvidia driver versions installed simultaneously** | Purge residual packages and retain only the designated LTS driver package |

## Step-by-Step Solution

### Step 1: Verify version discrepancy between Kernel and NVML
Check the currently loaded kernel module version against the installed system package version:

```bash
# Version of the module currently active in the Linux kernel
cat /proc/driver/nvidia/version

# Version of installed userland packages and utilities
dpkg -l | grep -i nvidia-utils
```

If version numbers diverge (for example, kernel running `535.183.01` while userland libraries were upgraded to `535.183.06`), the driver modules must be reloaded.

### Step 2: Identify and stop all processes utilizing the GPU
To unload kernel modules cleanly, no active processes can hold open file descriptors on `/dev/nvidia*`:

```bash
# List processes interacting with Nvidia device files
sudo fuser -v /dev/nvidia* 2>/dev/null
```

Stop services utilizing GPU acceleration (such as Docker daemons, inference engines, or display managers):

```bash
# Stop Docker and AI background daemons
sudo systemctl stop docker
sudo systemctl stop ollama 2>/dev/null || true

# Stop desktop display manager if applicable
sudo systemctl stop gdm3 2>/dev/null || sudo systemctl stop lightdm 2>/dev/null || true
```

If lingering orphaned processes remain, terminate them directly:

```bash
sudo fuser -k -9 /dev/nvidia* 2>/dev/null
```

### Step 3: Unload Nvidia modules from kernel memory
Unload all Nvidia kernel modules in reverse dependency order:

```bash
sudo rmmod nvidia_uvm
sudo rmmod nvidia_drm
sudo rmmod nvidia_modeset
sudo rmmod nvidia
```

If `rmmod: ERROR: Module nvidia is in use` appears, verify with `sudo lsof /dev/nvidia*` to pinpoint any remaining process holding the module.

### Step 4: Reload the updated Nvidia kernel modules
Once unloaded, insert the freshly installed driver modules into the kernel:

```bash
sudo modprobe nvidia
sudo modprobe nvidia_modeset
sudo modprobe nvidia_uvm
sudo modprobe nvidia_drm
```

### Step 5: Confirm with nvidia-smi and restart services
Run the Nvidia management command to confirm NVML communication is fully restored:

```bash
nvidia-smi
```

You should immediately see the GPU status table, temperature, utilization, and the synchronized driver version. Then, resume your application services:

```bash
sudo systemctl start docker
sudo systemctl start ollama 2>/dev/null || true
```

## Frequently Asked Questions

### Why does this error happen automatically on Ubuntu and Debian systems?
The `unattended-upgrades` daemon runs security patches in the background. When upstream repositories release a minor driver point-release, `apt` downloads and extracts new library files on disk, but live Linux kernels cannot hot-swap in-memory modules without reloading them.

### What if I cannot reboot my production host?
The `rmmod` and `modprobe` cycle is engineered specifically for production servers and high-availability compute clusters where a system restart would drop unrelated active workloads and network connections.

### How can I prevent unwanted automatic Nvidia driver upgrades?
You can hold Nvidia driver packages to maintain version stability until scheduled maintenance windows:

```bash
sudo apt-mark hold nvidia-driver-* nvidia-utils-*
```

## Prevention Advice

* Hold GPU packages using `apt-mark hold` in production clusters to prevent unattended mid-week driver mismatches.
* Add Nvidia packages to the blacklist array in `/etc/apt/apt.conf.d/50unattended-upgrades` under `Unattended-Upgrade::Package-Blacklist`.
* Set up node health alerts via Prometheus `dcgm-exporter` to catch NVML initialization faults immediately.

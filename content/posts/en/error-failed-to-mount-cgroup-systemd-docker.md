---
title: 'How to Fix Failed to Mount cgroup (cgroup2 / systemd) in Docker & Linux'
description: >-
  Technical guide to resolve 'Failed to mount cgroup: No such file or directory' errors in Docker,
  runc, and Proxmox LXC containers across modern Linux distributions using cgroup v2.
category: Systems & Servers
tags:
  - Docker
  - systemd
  - Linux
  - DevOps
  - Proxmox
readTime: 6 min
date: '2026-09-14'
---

When launching containers with Docker, Podman, or nested LXC environments on modern Linux distributions (such as Ubuntu 24.04, Debian 12, Arch Linux, or Fedora), system administrators frequently encounter fatal startup errors like `Failed to mount cgroup: No such file or directory`, `unable to apply cgroup configuration`, or `mount: /sys/fs/cgroup/systemd: special device cgroup does not exist`.

This failure stems from a fundamental architectural transition in the Linux kernel: the deprecation of the multi-hierarchy legacy **cgroups v1** model in favor of the unified **cgroups v2** tree. On modern distributions managed by `systemd` v250+, the kernel mounts cgroup2 natively at `/sys/fs/cgroup`. When older container runtimes (`runc`, `containerd`), outdated Docker daemons, or unprivileged LXC containers attempt to mount independent controllers inside legacy cgroup v1 pseudo-paths, the host kernel rejects the mount calls.

## Quick Diagnostics
| Error Signature | Root Cause | Technical Solution |
|---|---|---|
| `Failed to mount cgroup: No such file or directory` | Container or runtime attempts to mount legacy cgroup v1 paths on pure cgroup v2 host | Switch to systemd cgroup driver or enable hybrid hierarchy via GRUB |
| `unable to start container process: error applying cgroup configuration` | Outdated `runc` binary unable to handle unified cgroup2 memory/CPU limits | Upgrade `containerd.io` and `docker-ce` to current upstream versions |
| `systemd[1]: Failed to mount cgroup /sys/fs/cgroup/systemd` (Proxmox LXC) | Unprivileged LXC container lacking namespace delegation or nesting rights | Enable `features: nesting=1` in `/etc/pve/lxc/<ID>.conf` |
| `cgroup v2 is not supported by driver cgroupfs` | Docker daemon configured with deprecated `cgroupfs` driver instead of `systemd` | Declare `native.cgroupdriver=systemd` in `/etc/docker/daemon.json` |

## 🚀 Step-by-Step Implementation Guide

### Step 1: Identify the Active cgroup Hierarchy Version
Query your host kernel's active filesystem type for the cgroup mountpoint:
```bash
stat -fc %T /sys/fs/cgroup/
```
- **Output `cgroup2fs`:** Confirms the host kernel is running the unified **cgroup v2** hierarchy.
- **Output `tmpfs`:** Indicates the host is running the legacy multi-root **cgroup v1** hierarchy.

To inspect which kernel resource controllers are actively exposed:
```bash
cat /sys/fs/cgroup/cgroup.controllers
```
You should see controllers such as `cpuset cpu io memory pids`.

---

### Step 2: Configure Docker to Use the Native systemd cgroup Driver
Running Docker with the legacy `cgroupfs` driver on a systemd-managed distribution causes both Docker and systemd to manage memory allocations concurrently, resulting in resource race conditions and mount failures.

Instruct Docker to delegate cgroup management to systemd by editing `/etc/docker/daemon.json`:
```json
{
  "exec-opts": ["native.cgroupdriver=systemd"],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "3"
  }
}
```
Reload and restart the Docker daemon:
```bash
sudo systemctl daemon-reload
sudo systemctl restart docker
```
Verify the active driver:
```bash
docker info | grep -i "cgroup driver"
```
*(The terminal must confirm: `Cgroup Driver: systemd`).*

---

### Step 3: Enable Hybrid / Legacy cgroup Fallback via GRUB (Legacy Workloads)
If your infrastructure relies on older legacy container images (such as CentOS 6/7 images, legacy Java 8 microservices, or tools that cannot parse `/sys/fs/cgroup/cgroup.controllers`), configure the Linux kernel to restore cgroup v1 compatibility:

1. Open the bootloader configuration file:
```bash
sudo nano /etc/default/grub
```
2. Locate the `GRUB_CMDLINE_LINUX_DEFAULT` parameter and append `systemd.unified_cgroup_hierarchy=0`:
```plaintext
GRUB_CMDLINE_LINUX_DEFAULT="quiet splash systemd.unified_cgroup_hierarchy=0"
```
3. Update GRUB and reboot the host:
```bash
# On Debian / Ubuntu:
sudo update-grub

# On RHEL / Rocky / Fedora / Arch:
sudo grub-mkconfig -o /boot/grub/grub.cfg

sudo reboot
```
Upon reboot, `stat -fc %T /sys/fs/cgroup/` will return `tmpfs`, enabling legacy containers to mount cgroup v1 controllers without friction.

---

### Step 4: Fix cgroup Mount Errors in Proxmox LXC Containers
If you run Docker inside a Proxmox LXC container, unprivileged containers are blocked from mounting cgroup pseudo-filesystems unless nested containerization is permitted.

On the **Proxmox VE host node**, edit the LXC configuration file:
```bash
sudo nano /etc/pve/lxc/<CONTAINER_ID>.conf
```
Add the following directives:
```ini
features: nesting=1,keyctl=1
lxc.apparmor.profile: unconfined
lxc.cgroup2.devices.allow: a
lxc.cap.drop:
```
Save the file and restart the container from the Proxmox UI or via `pct restart <CONTAINER_ID>`.

---

### Step 5: Update runc and containerd Runtime Packages
If your system was upgraded from an older Ubuntu release (e.g., Ubuntu 20.04 to 22.04 or 24.04), your `runc` binary may be outdated and unable to handle cgroup2 file descriptors.

Ensure your container runtime packages are up to date:
```bash
runc --version
sudo apt update && sudo apt install -y docker-ce docker-ce-cli containerd.io
```

## 🛡️ Production Best Practices & cgroup v2 Advantages
- **Accurate Out-Of-Memory (OOM) Accounting:** Under cgroup v1, memory and block I/O controllers were uncoordinated, often causing system-wide freezes when a single container ran out of RAM. cgroup v2 unifies anonymous memory, page caches, and swap, ensuring the kernel OOM Killer terminates only the specific offending container process.
- **Rootless Container Security:** cgroup v2 provides safe process ownership modeling, allowing developers to run rootless Docker and Podman environments without granting administrative host access.

## Frequently Asked Questions (FAQ)

### Should I keep cgroup v1 permanently enabled via GRUB?
No. Upstream Linux kernel maintainers, Kubernetes, and major distributions have deprecated cgroup v1. Using `systemd.unified_cgroup_hierarchy=0` should be treated as a temporary stepping stone while updating container images to versions supporting cgroup v2.

### How do I run systemd as PID 1 inside a Docker container?
To run systemd inside a container (e.g., for Ansible testing), mount the host cgroup tree with read-write access: `docker run -d --cgroupns host -v /sys/fs/cgroup:/sys/fs/cgroup:rw <image> /sbin/init`.

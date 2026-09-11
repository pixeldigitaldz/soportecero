---
title: "[SOLVED] Error: Failed to mount cgroup cgroup2 or systemd in Docker & Linux"
description: "Fix Failed to mount cgroup cgroup2 or cgroup hierarchy v2 in Docker, LXC, and systemd environments across modern Linux systems."
category: "Systems & Servers"
tags: ["Docker","systemd","Linux","DevOps"]
readTime: "4 min"
date: "2026-09-14"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Mismatch between legacy Docker/runc and unified cgroup v2 hierarchy in newer Linux kernels** | Upgrade Docker engine or enable hybrid cgroup parameters via GRUB |
| **Nested containerization or systemd inside LXC/Docker missing cgroup mounts** | Configure systemd.unified_cgroup_hierarchy=0 or configure systemd cgroup driver |

When booting containers with Docker, Podman, or inside LXC containers on modern distributions (Ubuntu 24.04, Debian 12, Arch), users often hit `Failed to mount cgroup: No such file or directory` or `unable to apply cgroup configuration`. This friction stems from Linux transitioning from the legacy split cgroup v1 architecture to the unified cgroup v2 hierarchy.

> **Quick Solution (1 Minute):**
> 1. Check your active cgroup version:
>    `stat -fc %T /sys/fs/cgroup/`
> 2. If cgroup2fs breaks legacy container shims, set in /etc/default/grub:
>    `systemd.unified_cgroup_hierarchy=0`

## 🚀 Step-by-Step Solution

### Step 1: Identify Host cgroup Tree Architecture
Run the filesystem type probe to inspect your running host kernel state:
```bash
stat -fc %T /sys/fs/cgroup/
```
- Output `cgroup2fs` confirms **cgroup v2** is governing resource accounting.
- Output `tmpfs` indicates legacy **cgroup v1**.

### Step 2: Fallback to Hybrid / Legacy cgroup Hierarchy via GRUB
If older orchestration tooling cannot parse cgroup v2, configure GRUB to restore compatibility:
```bash
sudo nano /etc/default/grub
```
Append the kernel boot flag inside `GRUB_CMDLINE_LINUX_DEFAULT`:
```plaintext
GRUB_CMDLINE_LINUX_DEFAULT="quiet splash systemd.unified_cgroup_hierarchy=0"
```
Update bootloader entries and reboot:
```bash
sudo update-grub
sudo reboot
```

### Step 3: Configure Native systemd cgroup Driver in Docker
For long-term reliability on modern kernels, configure Docker to natively utilize the `systemd` cgroup driver in `/etc/docker/daemon.json`:
```json
{
  "exec-opts": ["native.cgroupdriver=systemd"]
}
```
Restart daemon to apply:
```bash
sudo systemctl daemon-reload
sudo systemctl restart docker
```

## 🛡️ Prevention Tips
* Keep container runtimes (containerd, runc, Docker CE) pinned to supported upstream packages.
* Avoid permanently pinning cgroup v1, as upstream Linux kernels and Kubernetes are phasing out v1 support.

## Frequently Asked Questions

### What is the key advantage of cgroup v2 over v1 in production?
cgroup v2 prevents deadlocks caused by decoupled controller hierarchies and provides clean rootless container isolation alongside accurate memory OOM killing.

### How do I resolve this issue in Proxmox LXC containers?
Add `features: nesting=1` in your Proxmox container config (/etc/pve/lxc/ID.conf) to allow proper cgroup and systemd namespace delegation.

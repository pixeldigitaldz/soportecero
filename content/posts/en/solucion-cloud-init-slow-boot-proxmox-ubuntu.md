---
title: '[FIXED] cloud-init Slow Booting in Proxmox / Ubuntu Server'
description: >-
  Proxmox VM or Ubuntu Server taking minutes to boot due to 'cloud-init waiting
  for network config'? Step-by-step optimization guide.
category: Systems & Servers
tags:
  - Proxmox
  - Cloud-Init
  - Ubuntu
  - Sysadmin
readTime: 6 min
date: '2026-08-03'
---

When an Ubuntu Server virtual machine running on Proxmox VE, KVM, or a cloud hypervisor hangs for 2 to 5 minutes at `A start job is running for Wait for Network to be Configured` or `cloud-init: waiting for network config`, `systemd-networkd-wait-online` is blocking the boot sequence. This happens because `cloud-init` or Netplan expects DHCP or metadata responses on every defined network interface before allowing multi-user targets to proceed.

## Quick Diagnostics

| Symptom / Cause | Immediate Action |
|---|---|
| **`cloud-init` querying unreachable metadata endpoints** | Disable `cloud-init` post-provisioning via `/etc/cloud/cloud-init.disabled` |
| **`systemd-networkd-wait-online` timing out (120s)** | Add `optional: true` to unused interfaces in `/etc/netplan/` |
| **Proxmox Cloud-Init drive attached without DHCP** | Configure static IP in Proxmox Cloud-Init tab or detach the `cloudinit` ISO |
| **Slow DNS / reverse lookup during boot** | Verify `/etc/hosts` contains the VM's local hostname |

## Root Cause & Technical Mechanics

During early boot, Ubuntu Server executes `cloud-init-local.service` and `systemd-networkd-wait-online.service` in sequence. In a Proxmox VE environment, two conditions routinely stall this pipeline:

1. **Unconfigured or disconnected NICs in Netplan:** When a VM template is cloned with multiple virtual NICs (`ens18`, `ens19`) or when `cloud-init` generates `/etc/netplan/50-cloud-init.yaml` with `dhcp4: true` on an isolated VLAN without a DHCP server, `systemd-networkd-wait-online.service` blocks boot for its hardcoded default timeout of **120 seconds** waiting for every interface to reach the `routable` state.
2. **Repeated Metadata Datasource Probing:** Even after initial provisioning completes, `cloud-init.service` and `cloud-final.service` run on every subsequent reboot. If Proxmox's `NoCloud` config drive was detached or if `cloud-init` falls back to probing AWS/OpenStack link-local metadata endpoints (`169.254.169.254`), each HTTP retry adds 15–60 seconds of blocking delay before `sshd` starts.

## Step-by-Step Solution

### 1. Measure Exact Boot Service Timings
Log into your Proxmox VM via SSH or the noVNC console and inspect which unit is consuming boot time:
```bash
systemd-analyze blame | head -n 15
```

Inspect the critical dependency chain to confirm whether `systemd-networkd-wait-online.service` or `cloud-init` is the blocker:
```bash
systemd-analyze critical-chain
```

### 2. Disable `cloud-init` on Already-Provisioned VMs
If your VM already has its hostname, SSH keys, and static IP configured, prevent `cloud-init` from running on future boots without uninstalling the package (which could break template cloning if you revert):
```bash
sudo touch /etc/cloud/cloud-init.disabled
```

If you want to permanently remove `cloud-init` from a standalone production VM (not a template):
```bash
sudo dpkg-reconfigure cloud-init   # Uncheck all datasources except None
sudo apt purge -y cloud-init && sudo rm -rf /etc/cloud/ /var/lib/cloud/
```

### 3. Configure Non-Blocking Netplan Interfaces
Open `/etc/netplan/50-cloud-init.yaml` (or your active `.yaml` file under `/etc/netplan/`) and mark secondary or slow-negotiating interfaces as `optional: true`:

```yaml
network:
  version: 2
  ethernets:
    ens18:
      dhcp4: true
      optional: true
```

*(Note: Replace `ens18` with your actual interface name from `ip -br link`.)*

Validate and apply the Netplan configuration:
```bash
sudo netplan try
sudo netplan apply
```

### 4. Limit `systemd-networkd-wait-online` Timeout (Optional)
If the VM has multiple interfaces and only one needs to be online for services to start, override the wait service so it succeeds as soon as *any* interface is up:
```bash
sudo systemctl edit systemd-networkd-wait-online.service
```
Add:
```ini
[Service]
ExecStart=
ExecStart=/lib/systemd/systemd-networkd-wait-online --any --timeout=10
```

Reboot the VM and verify the new boot duration:
```bash
sudo reboot
# After reconnecting:
systemd-analyze time
```

## Frequently Asked Questions

**Will creating `/etc/cloud/cloud-init.disabled` break Proxmox Cloud-Init if I convert the VM back to a template later?**
Yes. If you plan to clone the VM and inject new IPs or SSH keys via Proxmox's Cloud-Init tab, remove `/etc/cloud/cloud-init.disabled` and run `sudo cloud-init clean --logs` before shutting down the template.

**Why did `systemd-analyze blame` show `systemd-networkd-wait-online.service` taking exactly 2 minutes?**
`120s` is the built-in default timeout for `systemd-networkd-wait-online`. It triggers whenever an interface defined in Netplan lacks `optional: true` and fails to obtain a carrier or DHCP lease.

**Is it safe to mask `systemd-networkd-wait-online.service` completely?**
Not always. Services like Docker, NFS mounts, or databases bound to a specific LAN IP may fail on boot if they start before the primary interface receives its address. Using `--any --timeout=10` is safer than masking it.

## Prevention Advice

* Always configure static IPs or verify DHCP availability on the target Proxmox bridge (`vmbr0`) before cloning Cloud-Init templates.
* Use `optional: true` in `/etc/netplan/` for secondary storage, heartbeat, or isolated management interfaces that do not carry default routes.
* Run `sudo cloud-init clean --logs` right before converting a customized Ubuntu VM into a Proxmox template so stale instance IDs are cleared cleanly.

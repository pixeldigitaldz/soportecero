---
title: 'Error: sudo: unable to resolve host in Ubuntu & Debian'
description: >-
  Fix the annoying sudo: unable to resolve host warning in Linux. Fast guide to
  reconciling /etc/hostname with /etc/hosts on cloud servers.
category: Systems & Servers
tags:
  - Linux
  - Ubuntu
  - Sysadmin
  - Bash
readTime: 5 min
date: '2026-09-16'
---

Whenever you run a command with `sudo` on Ubuntu or Debian, the terminal pauses for several seconds and prints `sudo: unable to resolve host <hostname>: Name or service not known` (or `Temporary failure in name resolution`). Although the underlying command usually still executes, the DNS timeout slows down interactive shells and can break automated scripts or daemons expecting clean `stderr`.

## Quick Diagnostics

| Symptom / Cause | Verification | Immediate Fix |
|---|---|---|
| Hostname in `/etc/hostname` missing from `/etc/hosts` | `cat /etc/hostname && grep 127.0.1.1 /etc/hosts` | Map `127.0.1.1 <hostname>` in `/etc/hosts` |
| Server renamed via `hostnamectl` without updating `/etc/hosts` | `hostnamectl --static` vs `/etc/hosts` | Sync `/etc/hosts` with exact static hostname |
| `cloud-init` overwriting `/etc/hosts` on VPS reboot | `grep manage_etc_hosts /etc/cloud/cloud.cfg` | Enable `preserve_hostname` or update cloud-init template |

## Root Cause & Technical Mechanics

Unlike many commands that never query the machine's own name, `sudo` supports host-specific rules inside `/etc/sudoers` (for example, `alice web01=(ALL) ALL`, allowing `alice` to run commands only on `web01`). To evaluate those rules on every invocation, `sudo` calls `gethostname()` and then resolves that hostname via **NSS (Name Service Switch)** (`getaddrinfo()`, governed by `/etc/nsswitch.conf`).

By default, `/etc/nsswitch.conf` specifies:

```plaintext
hosts: files dns
```

If your current hostname (stored in `/etc/hostname` and loaded into the kernel at boot) is missing from `/etc/hosts` (`files`), `sudo` falls back to external **DNS** queries. Because local server hostnames like `vps-prod-01` rarely exist in public DNS, `systemd-resolved` or your upstream resolver waits through UDP query retries before timing out and returning `Name or service not known`.

## Step-by-Step Solution

### Step 1: Check Your Exact Kernel Hostname

Display the current static hostname and compare it with `/etc/hosts`:

```bash
hostname
cat /etc/hostname
cat /etc/hosts
```

Suppose `hostname` outputs `vps-prod-01`, while `/etc/hosts` still lists an old default name like `ubuntu-2204` or lacks a `127.0.1.1` line entirely.

### Step 2: Map the Hostname in `/etc/hosts`

Open `/etc/hosts` with root privileges (note that `sudo` will print the warning one last time while opening the editor):

```bash
sudo nano /etc/hosts
```

Add or update the `127.0.1.1` entry so it matches your exact hostname (and optionally your FQDN first):

```plaintext
127.0.0.1 localhost
127.0.1.1 vps-prod-01.example.com vps-prod-01
```

Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X`).

### Step 3: Prevent `cloud-init` From Reverting `/etc/hosts` (Cloud VPS Only)

On AWS, DigitalOcean, Hetzner, or Proxmox cloud-init images, `cloud-init` can regenerate `/etc/hosts` from `/etc/cloud/templates/hosts.debian.tmpl` on reboot. Check `/etc/cloud/cloud.cfg` if present:

```bash
grep -E "preserve_hostname|manage_etc_hosts" /etc/cloud/cloud.cfg 2>/dev/null
```

If `manage_etc_hosts: true` is set, either set `preserve_hostname: true` when using custom hostnames or update the hostname cleanly through your cloud provider metadata / `hostnamectl`.

### Step 4: Verify Instant Resolution With `sudo` and `getent`

Test NSS resolution directly and run `sudo true` to confirm zero delay and zero warnings:

```bash
getent hosts "$(hostname)"
sudo true
```

`getent hosts` should immediately return `127.0.1.1 vps-prod-01`, and `sudo true` should exit silently with code `0` in milliseconds.

## Frequently Asked Questions

### Why do Ubuntu and Debian use `127.0.1.1` instead of `127.0.0.1`?
`127.0.0.1` is reserved for `localhost`. Debian-based distributions map the machine's hostname to `127.0.1.1` (still within the `127.0.0.0/8` loopback block) so servers without a permanent static IP—or laptops on DHCP—can always resolve their own hostname locally without breaking services that check `localhost` separately.

### Does this error mean my DNS server is broken?
No. Your internet DNS resolution for external domains (like `apt` or `curl`) is usually fine. The error strictly means your **local hostname** is missing from `/etc/hosts` and is not registered in your upstream DNS server.

### Can I disable hostname lookups in `sudo` instead?
In modern `sudo` versions, you can add `Defaults !fqdn` in `visudo`, though this is not recommended—fixing `/etc/hosts` takes 10 seconds and also prevents similar NSS delays in Postfix, Apache, RabbitMQ, and Java applications.

## Prevention Advice

- **Update `/etc/hosts` whenever running `hostnamectl set-hostname`:** Treat both files as a pair in Ansible, Terraform, or cloud-init provisioning scripts.
- **Avoid uppercase or underscores in hostnames:** Stick to lowercase RFC-1123 characters (`a-z`, `0-9`, hyphens) so DNS and NSS parsers behave consistently.
- **Verify `hosts: files dns` in `/etc/nsswitch.conf`:** Ensure `files` precedes `dns` so `/etc/hosts` is always consulted before external resolvers.
- **Check `getent hosts $(hostname)` in health checks:** Add it to post-provisioning smoke tests to catch resolution mismatches early.

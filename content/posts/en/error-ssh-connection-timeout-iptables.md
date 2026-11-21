---
title: How to Fix SSH Connection Timeout Errors Due to Firewall Rules
description: >-
  Learn how to diagnose connection blocks on port 22 and correctly configure
  IPTables or UFW rules to allow secure remote access.
category: Systems & Servers
tags:
  - SSH
  - Sysadmin
  - Firewall
readTime: 5 min
date: '2026-07-25'
---

The error `ssh: connect to host <ip> port 22: Connection timed out` occurs when your SSH client sends a TCP `SYN` packet to port 22 (or a custom SSH port) and receives no `SYN-ACK` or `RST` response within the kernel's retransmission window. Unlike `Connection refused`—which means the host is reachable but `sshd` is not listening—a timeout almost always indicates silent packet dropping by a firewall or cloud security group.

## Quick Diagnostics

| Symptom / Cause | Verification | Immediate Fix |
|---|---|---|
| UFW enabled without allowing SSH | `sudo ufw status verbose` | Run `sudo ufw allow 22/tcp` before enabling UFW |
| `iptables` / `nftables` `DROP` policy on `INPUT` | `sudo iptables -L INPUT -v -n` | Insert `ACCEPT` rule for `--dport 22` |
| Cloud Security Group or ISP blocking port 22 | `nc -zv -w 5 <ip> 22` from external host | Add inbound TCP/22 rule in AWS/GCP/Azure/VPS panel |
| `sshd` listening on a non-standard port or wrong IP | `sudo ss -tlnp \| grep sshd` | Connect with `ssh -p <port>` or fix `ListenAddress` |

## Root Cause & Technical Mechanics

During a TCP three-way handshake, your client sends a `SYN` packet to the server's SSH port. Two firewall actions produce different client errors:

- **`REJECT` (returns ICMP unreachable or TCP `RST`):** Fails immediately with `Connection refused`.
- **`DROP` (silently discards the packet):** No reply leaves the server. Your local TCP stack retries `SYN` with exponential backoff until the socket times out after ~60–120 seconds, printing `Connection timed out`.

Silent `DROP` behavior typically occurs in host firewalls (`ufw`, `iptables`, `nftables`, `firewalld`), cloud Security Groups/ACLs (AWS, Azure, GCP), or intermediate NAT port-forwarding rules. Enabling `ufw` on a remote VPS without allowing SSH first immediately drops all new handshakes under its default `deny (incoming)` policy.

## Step-by-Step Solution

### Step 1: Confirm Whether Packets Reach the Server

From your local machine, test raw TCP connectivity on port 22 with a 5-second timeout:

```bash
nc -zv -w 5 203.0.113.10 22
```

If it hangs and times out, packets are being dropped in transit or by the server's firewall. Log in via your hosting provider's web/VNC/serial console to inspect the host directly.

### Step 2: Verify the SSH Daemon Is Listening

On the server, confirm `sshd` is active and bound to the expected interface and port:

```bash
sudo systemctl status sshd --no-pager
sudo ss -tlnp | grep sshd
```

You should see `LISTEN` on `0.0.0.0:22` or `[::]:22` (or your custom port). If `sshd` is stopped, start it with `sudo systemctl enable --now sshd`.

### Step 3: Allow SSH in UFW (Ubuntu / Debian)

If your server uses UFW, check its current rules and allow OpenSSH or your custom port:

```bash
sudo ufw status numbered
sudo ufw allow 22/tcp comment 'Allow SSH'
sudo ufw reload
```

If you are enabling UFW for the first time, **always** run `sudo ufw allow 22/tcp` before `sudo ufw enable`.

### Step 4: Allow SSH in Raw IPTables (or Firewalld)

If the system uses raw `iptables`, inspect the `INPUT` chain and insert the `ACCEPT` rule **above** any catch-all `DROP` rule using `-I INPUT 1`:

```bash
sudo iptables -L INPUT -n --line-numbers
sudo iptables -I INPUT 1 -p tcp --dport 22 -m state --state NEW,ESTABLISHED -j ACCEPT
sudo netfilter-persistent save
```

*(On RHEL/Rocky/AlmaLinux with `firewalld`, run `sudo firewall-cmd --permanent --add-service=ssh && sudo firewall-cmd --reload`.)*

### Step 5: Verify From Your Local Machine

```bash
nc -zv -w 5 203.0.113.10 22
ssh -v user@203.0.113.10
```

`nc` should report `succeeded!` and `ssh` should proceed to key exchange.

## Frequently Asked Questions

### Why did `iptables -A INPUT -p tcp --dport 22 -j ACCEPT` not fix the timeout?
`iptables` evaluates rules top-to-bottom. If a `DROP` or `REJECT` rule appears earlier in `INPUT`, `-A` appends your `ACCEPT` rule *after* the drop rule, so it is never reached. Use `-I INPUT 1` instead.

### What if UFW is inactive and `iptables` has no rules, yet SSH still times out?
Check your cloud provider's external firewall (AWS Security Group, GCP VPC Firewall, Azure NSG). Cloud firewalls drop traffic before it reaches the Linux kernel.

### Could `fail2ban` cause a Connection Timed Out error?
Yes. When `fail2ban` uses a `DROP` action instead of `REJECT`, banned IPs experience `Connection timed out` while other IPs connect normally.

## Prevention Advice

- **Restrict SSH by source IP:** Instead of allowing `0.0.0.0/0`, restrict port 22 to your office/VPN CIDR (e.g., `sudo ufw allow from 198.51.100.0/24 to any port 22 proto tcp`).
- **Keep a second session open:** When editing firewall rules over SSH, keep an active root/sudo terminal open and test a *new* SSH connection in a separate window before disconnecting.
- **Avoid running conflicting firewalls:** Do not run `ufw`, `firewalld`, and manual `iptables` scripts simultaneously, as they overwrite each other's chains on boot.
- **Use out-of-band console access:** Verify your VPS provider's serial/VNC console works before locking down network rules.

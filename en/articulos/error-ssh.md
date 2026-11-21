---
title: How to Fix SSH Connection Refused Error (Port 22) on Linux
description: >-
  Learn how to fix the SSH connection refused error on port 22 in Linux. Fast troubleshooting for stopped sshd services, UFW/iptables firewall rules, and custom port misconfigurations.
category: Systems & Servers
tags:
  - SSH
  - Linux
  - Firewall
readTime: 5 min
date: '2026-06-26'
---

Encountering `ssh: connect to host <IP> port 22: Connection refused` means your client reached the target host's network stack, but the server immediately returned a TCP `RST` (Reset) packet because no process is listening on TCP port 22—or a local firewall is actively rejecting the handshake. Unlike a `Connection timed out` error (which indicates packets are being silently dropped), `Connection refused` points directly to daemon state, socket binding, or port mismatch on the destination machine.

## Quick Diagnostics

| Symptom / Cause | Immediate Action |
|---|---|
| **`sshd` service stopped or crashed** | Start and enable the daemon: `sudo systemctl enable --now ssh` |
| **SSH bound to a non-standard port** | Inspect `sshd_config` and connect using `ssh -p <PORT> user@host` |
| **UFW / firewalld / iptables rejecting port 22** | Allow SSH traffic: `sudo ufw allow 22/tcp && sudo ufw reload` |
| **`ListenAddress` bound only to `127.0.0.1`** | Update `ListenAddress 0.0.0.0` in `/etc/ssh/sshd_config` and restart |

## Root Cause & Technical Mechanics

During an SSH connection attempt, the client initiates a standard TCP three-way handshake by sending a `SYN` packet to port 22. When the Linux kernel receives a `SYN` on a port with no bound `LISTEN` socket in the TCP state table, it responds immediately with a `TCP RST/ACK` packet. The OpenSSH client translates that `RST` into `Connection refused`.

Three mechanisms commonly trigger this response:
1. **Unstarted or failed `sshd` daemon:** On fresh container images, minimal server installs, or after a syntax error in `/etc/ssh/sshd_config`, `systemd` either never started `ssh.service` (Debian/Ubuntu) / `sshd.service` (RHEL/Arch) or aborted startup during configuration parsing. On Ubuntu 24.04+, `ssh.socket` activation may also fail if port overrides conflict with `sshd_config`.
2. **Socket binding restrictions:** If `/etc/ssh/sshd_config` defines a specific `Port` (e.g., `2222`) or restricts `ListenAddress` to loopback (`127.0.0.1`), port 22 on the public interface has no listener.
3. **Active firewall rejection:** Rules configured with `REJECT` (rather than `DROP`) in `iptables`, `nftables`, or `firewalld` explicitly send back an ICMP port-unreachable or TCP `RST` packet.

## Step-by-Step Solution

Because SSH is unavailable, log in via your VPS provider's web console, Proxmox noVNC, or local terminal to run these checks.

### 1. Check `sshd` Service Status and Configuration Syntax
Inspect whether the OpenSSH daemon is running (use `ssh` on Ubuntu/Debian or `sshd` on RHEL/CentOS/Arch):
```bash
sudo systemctl status ssh || sudo systemctl status sshd
```

If the service is inactive or failed, validate `/etc/ssh/sshd_config` before starting it so syntax errors are caught immediately:
```bash
sudo sshd -t
```

If `sshd -t` returns no errors, enable and start the daemon:
```bash
sudo systemctl enable --now ssh
```

### 2. Verify Listening Sockets and Active Port
Confirm which IP addresses and ports `sshd` is actually bound to using `ss`:
```bash
sudo ss -tlnp | grep sshd
```

Check `/etc/ssh/sshd_config` and `/etc/ssh/sshd_config.d/*.conf` for custom `Port` or `ListenAddress` directives:
```bash
sudo grep -E "^(Port|ListenAddress)" /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf 2>/dev/null
```

If `sshd` is listening on a custom port such as `2222`, connect from your local machine using:
```bash
ssh -p 2222 user@server-ip
```

### 3. Open the Port in Your Host Firewall
Ensure your host firewall permits incoming TCP traffic on the configured SSH port:

* **UFW (Ubuntu/Debian):**
  ```bash
  sudo ufw allow 22/tcp
  sudo ufw reload
  sudo ufw status numbered
  ```
* **firewalld (RHEL/AlmaLinux/Fedora):**
  ```bash
  sudo firewall-cmd --permanent --add-service=ssh
  sudo firewall-cmd --reload
  ```

From your client workstation, verify TCP reachability before initiating a full SSH session:
```bash
nc -zv server-ip 22
```

## Frequently Asked Questions

**What is the difference between `Connection refused` and `Connection timed out`?**
`Connection refused` means the server is reachable and actively rejected the TCP `SYN` with a `RST` packet (service down, wrong port, or firewall `REJECT`). `Connection timed out` means packets are being dropped silently by a cloud security group, NAT gateway, or `DROP` firewall rule.

**Why does `systemctl restart ssh` still keep port 22 on Ubuntu 24.04 after I changed `Port` in `sshd_config`?**
Ubuntu 24.04 uses `ssh.socket` systemd socket activation by default, which overrides `Port` in `sshd_config`. You must run `sudo systemctl edit ssh.socket` to change `ListenStream`, followed by `sudo systemctl daemon-reload && sudo systemctl restart ssh.socket`.

**Could `fail2ban` cause `Connection refused`?**
Yes, if your `fail2ban` action uses `iptables` with `--reject-with icmp-port-unreachable` or `tcp-reset` instead of `DROP`, banned client IPs will see `Connection refused`.

## Prevention Advice

* Always run `sudo sshd -t` to validate configuration syntax before restarting the SSH daemon on a remote server.
* Keep an existing SSH session open while testing new `sshd_config` or firewall rules in a second terminal window.
* Disable root password login (`PermitRootLogin prohibit-password`) and enforce Ed25519 key-based authentication (`PasswordAuthentication no`).
* Install and configure `fail2ban` or move SSH to a non-standard port alongside cloud security group IP allowlisting.

---
title: 'Troubleshooting: kex_exchange_identification: Connection closed by remote host in SSH'
description: 'How to troubleshoot and fix kex_exchange_identification Connection closed by remote host in SSH caused by Fail2ban, MaxStartups limits, or TCP Wrappers.'
category: 'Systems & Servers'
date: '2026-08-25'
readTime: '3 min'
tags: ['SSH', 'Linux', 'Security']
---

The error `kex_exchange_identification: Connection closed by remote host` (or `read: Connection reset by peer`) occurs prior to user authentication during the initial cryptographic Key Exchange phase, typically caused by `MaxStartups` concurrency limits, Fail2ban jails, or TCP Wrapper restrictions.

When the remote SSH daemon terminates the connection socket during the initial TCP handshake, the client never reaches the public key or password challenge prompt.

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Simultaneous connection limit exceeded (`MaxStartups`)** | Increase `MaxStartups` limit in `/etc/ssh/sshd_config` |
| **Client IP banned by Fail2ban or `/etc/hosts.deny`** | Unban using `fail2ban-client set sshd unbanip YOUR_IP` or check TCP Wrappers |
| **Firewall rate-limiting (UFW/iptables limit)** | Inspect SSH connection throttling rules on firewall |

## Step-by-Step Solution

**Run SSH in full verbose debugging mode**
Run the SSH client with `-vvv` to pinpoint the exact stage where the remote server drops the connection:
```bash
ssh -vvv user@server-ip
```
If the connection is severed immediately following `SSH2_MSG_KEXINIT sent`, the remote daemon is actively closing the socket due to security filtering or connection throttling.

**Tune MaxStartups on the remote SSH daemon**
When multiple CI/CD runners, deployment scripts, or IDEs (like VS Code Remote SSH) establish concurrent sessions, `sshd` drops unauthenticated handshakes by default. Edit `/etc/ssh/sshd_config`:
```ini
# Format: start:rate:full
MaxStartups 50:30:100
MaxSessions 50
```
Restart the SSH daemon:
```bash
sudo systemctl restart sshd
```

**Check Fail2ban status for banned IP addresses**
If multiple fast connections or bad key attempts triggered a security jail:
```bash
sudo fail2ban-client status sshd
# Unban specific IP:
sudo fail2ban-client set sshd unbanip 203.0.113.45
```

**Verify TCP Wrappers configuration**
On systems utilizing TCP Wrappers, check `/etc/hosts.deny`:
```bash
sudo cat /etc/hosts.deny
```
If `sshd: ALL` is present, whitelist your trusted IP in `/etc/hosts.allow`:
```ini
sshd: 203.0.113.45, 192.168.1.0/24
```

## Prevention Tips
- **Fail2ban whitelisting:** Add administrative static IPs and VPN subnets to the `ignoreip` setting in `/etc/fail2ban/jail.local`.
- **SSH Connection Multiplexing:** Enable `ControlMaster` in your local `~/.ssh/config` to reuse a single authenticated TCP connection across multiple terminals and remote tools.

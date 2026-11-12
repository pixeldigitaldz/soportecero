---
title: How to Fix SSH Connection Refused Error (Port 22) on Linux
description: >-
  Learn how to fix the SSH connection refused error on port 22 in Linux. Fast troubleshooting for stopped sshd services, UFW/iptables firewall rules, and custom port misconfigurations.
category: Systems & Servers
tags:
  - SSH
  - Linux
  - Firewall
readTime: 3 min
date: '2026-06-26'
---

Encountering the ssh connection refused error on port 22 means your remote Linux server actively rejected the incoming TCP handshake because the OpenSSH daemon is down or unreachable. In this guide, you will learn how to verify if sshd is running, fix firewall blocks in UFW or iptables, and restore secure access immediately.

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **SSH daemon service (sshd) stopped on target server** | Start SSH service daemon: `sudo systemctl start sshd` |
| **Security filter or custom port blocked** | Test connection on custom port: `ssh -p PORT user@host` |

## 🚀 Step-by-Step Solution

### Step 1: Verify the service status on the server
If you have local access or access through your VPS web console, execute:
```bash
sudo systemctl status ssh
```
If the status is inactive (dead), start and enable the service so it loads with the system immediately:
```bash
sudo systemctl enable --now ssh
```

### Step 2: Check the active port
If the service is running, verify if the default port 22 was changed for security reasons:
```bash
sudo grep "Port" /etc/ssh/sshd_config
```
If the output shows an alternative port (e.g., Port 2222), connect by specifying it in your local terminal using: `ssh user@ip -p 2222`.

### Step 3: Configure Firewall rules (UFW)
Ensure the firewall allows incoming connections on the SSH port:
```bash
sudo ufw allow ssh
sudo ufw reload
```

## 🛡️ Prevention Advice
Recommended security practices:
* Do not use the default port 22 on public servers.
* Disable direct access for the root user by modifying the sshd_config file.
* Force authentication using SSH Keys instead of conventional passwords.

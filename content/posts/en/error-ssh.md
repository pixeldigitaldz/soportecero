---
title: "How to Fix SSH Connection Refused (Port 22)"
description: "Can't connect to your server? Learn how to verify if OpenSSH daemon is running, check the active port, and fix Connection Refused errors."
category: "Systems & Servers"
tags: ["SSH", "Linux", "Firewall"]
readTime: "3 min"
date: "2026-06-26"
---

The `Connection Refused` error when trying to connect via SSH means that the client successfully reached the host server, but the server actively rejected the request on port 22. This usually happens because the OpenSSH service is not active, the port was changed, or a firewall is blocking access.

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

---
title: "How to Fix SSH Connection Timeout Errors Due to Firewall Rules"
description: "Learn how to diagnose connection blocks on port 22 and correctly configure IPTables or UFW rules to allow secure remote access."
category: "Systems & Servers"
tags: ["SSH", "Sysadmin", "Firewall"]
readTime: "4 min"
date: "2026-07-25"
---

The time limit reached error on **port 22** (`ssh: connect to host ... port 22: Connection timed out`) occurs when the destination server's firewall (typically IPTables or UFW on Ubuntu/Debian) silently drops or blocks incoming network packets on port 22, preventing client authentication.

## 🚀 Step-by-Step Solution

### Step 1: Diagnose if the SSH port is blocked or closed
Perform a direct network check towards the server's port from your local terminal to verify if it responds to TCP handshakes:
```bash
# Check port 22 (SSH) status on your remote server
nc -zv 192.168.1.100 22
```
*(If the output returns "Connection timed out" or hangs indefinitely, the port is being blocked by a local or cloud network firewall).*

### Step 2: Allow SSH traffic in UFW (Uncomplicated Firewall)
If your server uses UFW, explicitly allow secure remote access and reload kernel rules:
```bash
# Allow incoming TCP traffic on the default SSH port
sudo ufw allow 22/tcp

# Enable UFW if inactive, then reload active rules
sudo ufw enable && sudo ufw reload
```

### Step 3: Configure explicit rules in IPTables
If you do not use UFW or need fine-grained rules in raw IPTables, open port 22 directly in your input chain:
```bash
# Accept incoming TCP packets on port 22
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Save the active rules to persist across system reboots
sudo iptables-save | sudo tee /etc/iptables/rules.v4
```

## 🛡️ Prevention Advice
Recommended security practices:
- Do not expose your default SSH port (22) openly to all Internet IP addresses (`0.0.0.0/0`). Doing so will saturate your authentication logs with automated brute-force attempts in minutes. Instead, restrict access to your specific subnet or VPN IP range, or change the listening port in `/etc/ssh/sshd_config` to a non-standard one.

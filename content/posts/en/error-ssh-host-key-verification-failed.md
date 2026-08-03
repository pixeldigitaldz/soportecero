---
title: "[FIXED] Error 'Host key verification failed' in SSH"
description: "Getting 'Host key verification failed' or 'REMOTE HOST IDENTIFICATION HAS CHANGED' error when connecting via SSH? 1-minute step-by-step fix."
category: "Systems & Servers"
tags: ["SSH", "Linux", "Sysadmin", "Security"]
readTime: "3 min"
date: "2026-08-03"
---

The error **`Host key verification failed`** (accompanied by the warning `WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!`) occurs when your SSH client detects that the remote server's cryptographic host key fingerprint does not match the entry saved in your local `~/.ssh/known_hosts` file.

This commonly happens when you reinstall your server OS, rebuild a VPS instance with the same IP address, or regenerate OpenSSH keys.

> **Quick Solution (1 Minute):**
> Remove the outdated key entry from your known_hosts file:
> `ssh-keygen -R your-server-ip-or-domain`

## 🚀 Step-by-Step Fixes

### Step 1: Remove the Outdated Fingerprint
Execute the built-in `ssh-keygen` command specifying your target server IP or hostname:

```bash
ssh-keygen -R 192.168.1.100
```
*(Replace `192.168.1.100` with your target IP or domain).*

This automatically purges the offending key line from `~/.ssh/known_hosts` and creates a backup named `known_hosts.old`.

### Step 2: Reconnect and Accept the New Fingerprint
Attempt to SSH back into your server:

```bash
ssh user@192.168.1.100
```
Your terminal will prompt you to accept the new fingerprint:
```plaintext
Are you sure you want to continue connecting (yes/no/[fingerprint])?
```
Type `yes` and hit **Enter**. SSH will save the updated key fingerprint and establish connection.

### Step 3: Manual Line Removal (Alternative)
If the error specifies an exact line number (e.g., `Offending RSA key in /home/user/.ssh/known_hosts:42`), edit the file directly:

```bash
nano +42 ~/.ssh/known_hosts
```
Delete line 42, save and exit.

## 🛡️ Critical Security Warning
* If you **did not** reinstall your server or change its IP configuration and this error appears unexpectedly on a remote production server, **do not remove the key blindly**. This could indicate a Man-in-the-Middle (MITM) network attack. Verify host key fingerprints with your cloud provider or network administrator first.

---
title: How to Fix 'Permission Denied (publickey)' Error in SSH Connections
description: >-
  Learn how to troubleshoot and resolve the 'Permission denied (publickey)' error in SSH.
  Fix client private key permissions, server authorized_keys configuration, and sshd StrictModes.
category: Systems & Servers
tags:
  - SSH
  - Linux
  - Security
  - Sysadmin
  - DevOps
readTime: 5 min
date: '2026-07-27'
---

Encountering the fatal error `Permission denied (publickey)` or `git@github.com: Permission denied (publickey)` when attempting to authenticate to a remote Linux server or Git repository via SSH is one of the most common security roadblocks in system administration.

This error occurs when the remote OpenSSH daemon (`sshd`) rejects the authentication credentials presented by your client. While developers often assume their SSH key is corrupted, the OpenSSH server daemon enforces rigorous security checks under its `StrictModes` policy. If permissions on the client private key (`~/.ssh/id_rsa`), the remote `.ssh` folder, the remote `authorized_keys` file, or even the remote user's home directory are too permissive (allowing group or other users write access), OpenSSH deliberately and silently aborts public key authentication to protect the server from privilege escalation.

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Client private key file has overly permissive permissions (`chmod 644` or `777`)** | Set strict permissions on client private key: `chmod 600 ~/.ssh/id_ed25519` |
| **Remote server `.ssh` directory or `authorized_keys` writable by group/others** | Enforce `chmod 700 ~/.ssh` and `chmod 600 ~/.ssh/authorized_keys` on server |
| **User's remote home directory (`/home/username`) group-writable** | Restrict home directory permissions: `chmod 755 /home/username` |
| **`PubkeyAuthentication` disabled in remote `/etc/ssh/sshd_config`** | Verify `PubkeyAuthentication yes` is active in `sshd_config` |

## 🚀 Step-by-Step Implementation Guide

### Step 1: Diagnose the Failure with Verbose SSH Output
Before altering files, run the SSH connection with maximum verbosity (`-vvv`) to inspect the exact handshake phase where authentication fails:
```bash
ssh -vvv -i ~/.ssh/id_ed25519 user@remote_server_ip
```
Review the debug stream:
- Look for `Offering public key: ... ED25519 SHA256:...`: Confirms your client offered the key.
- Look for `Server refused our key` or `Next authentication method: password`: Confirms the server's `sshd` process evaluated the key and rejected it.

### Step 2: Enforce Strict Permissions on the Client Machine
OpenSSH client software will refuse to use a private key if it can be read by other users on your local machine:
```bash
# Secure the local .ssh configuration directory
chmod 700 ~/.ssh

# Secure private keys (owner read/write only)
chmod 600 ~/.ssh/id_rsa ~/.ssh/id_ed25519 ~/.ssh/*.pem 2>/dev/null

# Public keys can remain readable by all
chmod 644 ~/.ssh/*.pub 2>/dev/null
```

### Step 3: Fix Permissions on the Remote Server (StrictModes Compliance)
Log into the remote server (via your hosting provider's web VNC console, serial console, or password authentication) and audit your home directory permissions:
```bash
# 1. The home directory must NOT be writable by group or others
chmod 755 ~

# 2. The remote .ssh directory must be restricted strictly to the user
chmod 700 ~/.ssh

# 3. The authorized_keys file must be restricted strictly to the user
chmod 600 ~/.ssh/authorized_keys

# 4. Ensure your user owns the entire hierarchy
chown -R $USER:$USER ~/.ssh
```
*(Crucial Note: If `/home/username` has permissions `777` or `775`, `sshd` will reject public keys even if `authorized_keys` itself is `600`, because another local user could theoretically rename or swap the `.ssh` directory).*

### Step 4: Verify the Public Key Match in authorized_keys
Confirm that your client's exact public key string is appended to the server's `authorized_keys` file without extraneous carriage returns or line wrapping:
- On your **local machine**, display the public key:
```bash
cat ~/.ssh/id_ed25519.pub
```
- On the **remote server**, verify that the exact string appears on a single line in `~/.ssh/authorized_keys`:
```bash
cat ~/.ssh/authorized_keys
```
If you have password access, copy the key automatically using the standard utility:
```bash
ssh-copy-id -i ~/.ssh/id_ed25519.pub user@remote_server_ip
```

### Step 5: Verify OpenSSH Server Configuration (sshd_config)
Ensure the server daemon is configured to accept public key credentials. Inspect `/etc/ssh/sshd_config` (or `/etc/ssh/sshd_config.d/*.conf`):
```bash
sudo grep -iE "(PubkeyAuthentication|AuthorizedKeysFile)" /etc/ssh/sshd_config
```
Confirm the presence of:
```plaintext
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
```
If you made modifications to `sshd_config`, test the configuration syntax before restarting:
```bash
sudo sshd -t && sudo systemctl restart sshd
```

## 🛡️ Security Best Practices
- **Adopt Modern Ed25519 Keys:** Deprecate legacy 1024-bit or 2048-bit RSA keys. Modern Ed25519 keys (`ssh-keygen -t ed25519 -C "admin@domain.com"`) provide superior cryptographic security, resistance to side-channel attacks, and faster signature verification.
- **Always Protect Private Keys with a Passphrase:** If a laptop or development workstation is stolen, an unencrypted private key grants instantaneous access to your entire infrastructure. Use an SSH agent (`ssh-agent` / `ssh-add`) to keep keys decrypted in memory during active work sessions.

## Frequently Asked Questions (FAQ)

### Why does SSH say 'Load key: bad permissions' before failing?
This warning is emitted locally by your client when the private key file has permissions broader than `600` (e.g., `644` or `755`). The client skips the key because it considers it compromised.

### What should I do if SELinux is blocking authorized_keys on RHEL/CentOS?
If SELinux labels on `~/.ssh/authorized_keys` are incorrect (e.g., after copying files from another directory), `sshd` will be blocked from reading the key. Run `restorecon -R -v ~/.ssh` to restore the proper `ssh_home_t` security context.

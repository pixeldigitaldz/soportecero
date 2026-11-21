---
title: '[FIXED] Error ''Host key verification failed'' in SSH'
description: >-
  Getting 'Host key verification failed' or 'REMOTE HOST IDENTIFICATION HAS
  CHANGED' error when connecting via SSH? 1-minute step-by-step fix.
category: Systems & Servers
tags:
  - SSH
  - Linux
  - Sysadmin
  - Security
readTime: '5 min'
date: '2026-08-03'
---

The error `Host key verification failed`—almost always preceded by `WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!`—means your OpenSSH client aborted the connection because the server's public host key no longer matches the cryptographic fingerprint stored in your local `~/.ssh/known_hosts` file. OpenSSH refuses to proceed by default to protect you from Man-in-the-Middle (MitM) interception.

## Quick Diagnostics

| Symptom / Cause | Immediate Action |
|---|---|
| **VPS rebuilt or OS reinstalled on the same IP** | Remove stale key with `ssh-keygen -R <host-or-ip>` |
| **SSH port changed or behind NAT/jump host** | Run `ssh-keygen -R "[host]:port"` with brackets |
| **Unexpected change on an untouched production server** | Stop and verify key fingerprint out-of-band before trusting |
| **CI/CD pipeline failing on first host connection** | Pre-populate `known_hosts` via `ssh-keyscan` |

## Root Cause & Technical Mechanics

During the SSH-2 transport handshake, the remote `sshd` daemon proves its identity using an asymmetric host key pair (typically `ssh-ed25519` or `ecdsa-sha2-nistp256` stored in `/etc/ssh/ssh_host_*_key`). On your first connection, OpenSSH records the server's hostname/IP, key algorithm, and public key into `~/.ssh/known_hosts` (often hashed if `HashKnownHosts yes` is enabled).

On every subsequent connection, the client challenges the server to sign a session exchange with the private half of that host key. If the server presents a different public key, `StrictHostKeyChecking` (which defaults to `ask`) blocks authentication immediately—even if your username, password, or `~/.ssh/id_ed25519` client key is valid.

Legitimate triggers include:
- Re-imaging a cloud VM or container while retaining the same elastic IP.
- Regenerating `/etc/ssh/ssh_host_*` keys after an OpenSSH upgrade.
- Dynamic DHCP reassignment on a local LAN (`192.168.1.x`) where another machine took the old IP.

## Step-by-Step Solution

### 1. Verify the Server's Authentic Fingerprint Out-of-Band

If this is a remote production server you did **not** rebuild, log in via your cloud provider's serial console (AWS EC2 Serial Console, Hetzner VNC, DigitalOcean Recovery Console) and print the server's true SHA256 fingerprint:

```bash
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

Compare that hash with the `ED25519 key fingerprint is SHA256:...` line printed in your local error output.

### 2. Remove the Stale Entry with `ssh-keygen -R`

Once you confirm the key change is legitimate, purge the outdated entry cleanly using `ssh-keygen -R` (this works even when `HashKnownHosts` is enabled and automatically saves a backup at `~/.ssh/known_hosts.old`):

```bash
# Standard port 22 (by IP or hostname)
ssh-keygen -R 192.168.1.100
ssh-keygen -R app.example.com

# Custom SSH port (brackets are mandatory)
ssh-keygen -R "[192.168.1.100]:2222"
```

Verify the old entry is gone:

```bash
ssh-keygen -F 192.168.1.100
```

This command should return no output.

### 3. Reconnect and Persist the New Host Key

Initiate a fresh SSH connection and inspect the fingerprint prompt:

```bash
ssh user@192.168.1.100
```

When prompted with `Are you sure you want to continue connecting (yes/no/[fingerprint])?`, verify the SHA256 string matches Step 1 and type `yes`. OpenSSH writes the new key to `~/.ssh/known_hosts` and opens your shell.

### 4. Fix Non-Interactive CI/CD Runners (Optional)

In GitHub Actions or GitLab CI, interactive prompts fail with `Host key verification failed`. Instead of disabling security with `StrictHostKeyChecking=no`, explicitly pin the verified key before running `ssh` or `scp`:

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
ssh-keyscan -H -p 22 192.168.1.100 >> ~/.ssh/known_hosts
```

## Frequently Asked Questions

### Why did `ssh-keygen -R example.com` not fix the error?
OpenSSH stores both the hostname and the resolved IP address in `known_hosts`. If your `known_hosts` contains a separate line for the IP address (or a `[host]:port` entry), run `ssh-keygen -R` for both the hostname and the IP.

### Is it safe to set `StrictHostKeyChecking no` in `~/.ssh/config`?
No, not globally. Disabling strict checking silently accepts any host key on untrusted networks, exposing your session to MitM attacks. If you work with ephemeral local lab VMs, scope `StrictHostKeyChecking accept-new` or `UserKnownHostsFile /dev/null` strictly to a dedicated subnet block like `Host 192.168.56.*`.

### What if the error points to `/etc/ssh/ssh_known_hosts` instead of `~/.ssh/known_hosts`?
Some Linux distributions or enterprise setups maintain a system-wide `/etc/ssh/ssh_known_hosts` file. Check the exact file path and line number in the `Offending ... key in <path>:<line>` message and update it with `sudo`.

## Prevention Advice

- **Back up `/etc/ssh/ssh_host_*` keys** before OS reinstalls on long-lived servers if you want clients to reconnect seamlessly without fingerprint warnings.
- **Use SSHFP DNS records with DNSSEC** or SSH Certificate Authorities (`@cert-authority` in `known_hosts`) in large fleets so host key rotation does not break developer machines.
- **Scope ephemeral lab configs:** In `~/.ssh/config`, restrict `UserKnownHostsFile /dev/null` only to disposable test subnets (`Host 10.0.99.*`), never `Host *`.
- **Inspect `known_hosts.old`:** After running `ssh-keygen -R`, delete `~/.ssh/known_hosts.old` if you do not need the backup.

---
title: "[SOLVED] fatal: unable to access: SSL certificate problem: unable to get local issuer certificate in Git"
description: "Fix Git SSL certificate problem: unable to get local issuer certificate when cloning or pushing to GitHub, GitLab, or corporate self-hosted repos."
category: "Web & Code"
tags: ["Git","SSL","DevOps","Security"]
readTime: "4 min"
date: "2026-10-07"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Local Git CA bundle is missing, corrupted, or out of sync with upstream certificate chains** | Reinstall system ca-certificates and link path using git config --global http.sslCAInfo |
| **Corporate proxy, enterprise VPN, or antivirus performing SSL man-in-the-middle decryption** | Import corporate root certificate into Git configuration using http.sslCAInfo |

When running `git clone`, `git fetch`, or `git push` against remote endpoints (GitHub, GitLab, Bitbucket), Git frequently halts with: `fatal: unable to access "https://...": SSL certificate problem: unable to get local issuer certificate`. This security exception indicates that the underlying cURL transport library inside Git cannot verify the remote certificate against trusted local root authorities.

> **Quick Solution (1 Minute):**
> 1. On Linux, refresh system trust anchors:
>    `sudo apt update && sudo apt install --reinstall ca-certificates`
> 2. Point Git to valid local CA bundle:
>    `git config --global http.sslCAInfo /etc/ssl/certs/ca-certificates.crt`

## 🚀 Step-by-Step Solution

### Step 1: Refresh Operating System Certificate Authorities
Expired intermediate CA certs cause immediate rejection of modern TLS handshakes. Refresh your system bundle:
```bash
# On Debian / Ubuntu
sudo apt-get update
sudo apt-get install --reinstall ca-certificates
sudo update-ca-certificates

# On RHEL / Fedora
sudo dnf reinstall ca-certificates
sudo update-ca-trust
```

### Step 2: Configure Explicit CA Bundle Location in Git
Isolated Git installs (Flatpak, Snap, custom toolchains) may fail to discover default system stores. Set path explicitly:
```bash
# Debian / Ubuntu
git config --global http.sslCAInfo /etc/ssl/certs/ca-certificates.crt

# RHEL / CentOS
git config --global http.sslCAInfo /etc/pki/tls/certs/ca-bundle.crt

# Windows (Git for Windows standard path)
git config --global http.sslCAInfo "C:/Program Files/Git/mingw64/etc/ssl/certs/ca-bundle.crt"
```

### Step 3: Resolve Corporate Proxy / VPN SSL Interception
Enterprise security appliances (Zscaler, Fortinet) decrypt HTTPS traffic using private root certs.
**Never disable verification with `git config --global http.sslVerify false`**, which invites MITM credential theft.
Instead, export your organization's internal root certificate in PEM format and instruct Git to trust it:
```bash
git config --global http.sslCAInfo /path/to/corporate-root.crt
```

## 🛡️ Prevention Tips
* Never leave `http.sslVerify false` active on development machines.
* Prefer SSH remotes (`git@github.com:...`) to bypass HTTP SSL handshake complexities on enterprise networks.

## Frequently Asked Questions

### Why is http.sslVerify false dangerous?
Disabling verification turns off certificate authentication completely, allowing rogue actors on local networks to intercept private code and OAuth tokens.

### How do I migrate an existing HTTPS repo to SSH?
Run `git remote set-url origin git@github.com:user/repo.git` after uploading your public key (`~/.ssh/id_ed25519.pub`) to your Git host.

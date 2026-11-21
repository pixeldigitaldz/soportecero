---
title: 'Fix: server certificate verification failed in Git'
description: >-
  Learn how to resolve SSL certificate verification failed errors (fatal: unable
  to access) in Git across Linux, Windows, and macOS securely.
category: Web & Code
tags:
  - Git
  - SSL
  - Linux
  - Security
  - GitHub
  - DevOps
readTime: '5 min'
date: '2026-06-25'
---

The Git error `fatal: unable to access 'https://...': server certificate verification failed. CAfile: none CRLfile: none` (or `SSL certificate problem: unable to get local issuer certificate`) occurs when Git's underlying TLS library (`libcurl` + OpenSSL/GnuTLS/Schannel) cannot build a trusted chain from the remote Git server's leaf certificate up to a root Certificate Authority (CA) in your local trust store.

## Quick Diagnostics

| Symptom / Cause | Immediate Action |
|---|---|
| **`CAfile: none` in minimal Linux/Docker image** | Install and refresh `ca-certificates` package |
| **Corporate proxy / TLS inspection (Zscaler, Netskope)** | Export corporate root CA and set `http.sslCAInfo` |
| **Windows Git failing behind enterprise PKI** | Switch Git TLS backend to `http.sslBackend schannel` |
| **System clock skewed into past or future** | Sync system clock with NTP (`timedatectl set-ntp true`) |

## Root Cause & Technical Mechanics

During an HTTPS `git clone`, `git fetch`, or `git push`, Git delegates network transport to `libcurl`. When the remote server (GitHub, GitLab, Bitbucket, or a self-hosted Gitea/GitLab instance) completes the TLS handshake, `libcurl` validates three things:

1. **Chain of Trust:** The server's leaf and intermediate certificates must chain to a root CA stored in the `CAfile` or `CApath` configured for OpenSSL/GnuTLS. Minimal container images (Alpine, Debian slim) often omit `ca-certificates`, leaving `CAfile: none`.
2. **Enterprise TLS Interception:** Corporate firewalls frequently terminate outbound HTTPS traffic and re-sign it with an internal root CA. Browsers read the OS trust store, whereas Git on Linux or Git for Windows (when configured with OpenSSL) reads a separate static PEM bundle that lacks the corporate root.
3. **Validity Window:** X.509 certificates carry `Not Before` and `Not After` timestamps. A drifted CMOS/VM clock causes valid certificates to fail verification.

## Step-by-Step Solution

### 1. Inspect the Certificate Chain with `openssl`

Diagnose which certificate is failing (missing root CA, self-signed proxy, or expired chain) by querying the remote host directly:

```bash
openssl s_client -connect github.com:443 -showcerts </dev/null 2>/dev/null | grep -E "s:|i:|Verify return code"
```

If you see `Verify return code: 20 (unable to get local issuer certificate)` or an unfamiliar `i:` (issuer) belonging to your company firewall, you are missing a root CA in Git's trust bundle.

### 2. Refresh the OS Root Certificate Store (Linux)

On Debian/Ubuntu, Arch/CachyOS, or RHEL/Fedora, reinstall `ca-certificates` and rebuild the trust store:

```bash
# Debian / Ubuntu
sudo apt-get update && sudo apt-get install --reinstall -y ca-certificates
sudo update-ca-certificates

# Arch Linux / CachyOS
sudo pacman -Sy --noconfirm ca-certificates

# Fedora / RHEL / Rocky
sudo dnf reinstall -y ca-certificates && sudo update-ca-trust
```

Verify that Git points to the updated bundle if `CAfile: none` appeared previously:

```bash
git config --global http.sslCAInfo /etc/ssl/certs/ca-certificates.crt
```

*(On RHEL/Fedora, use `/etc/pki/tls/certs/ca-bundle.crt` instead).*

### 3. Switch to Native Windows Trust Store (Windows)

On Windows, corporate CAs are pushed via Group Policy into the Windows Certificate Store, not Git's bundled `ca-bundle.crt`. Switch Git to use Microsoft's native Schannel backend:

```bash
git config --global http.sslBackend schannel
```

### 4. Register a Custom Corporate or Self-Signed CA

If your organization uses a custom root CA (`.crt` or `.pem` exported from your IT team or browser), configure Git to trust it globally or per-domain without disabling TLS:

```bash
# Scope to a specific internal Git server
git config --global http."https://git.internal.corp/".sslCAInfo /etc/ssl/certs/corp-root-ca.pem
```

Verify the fix by running a lightweight read operation:

```bash
GIT_CURL_VERBOSE=1 git ls-remote https://github.com/torvalds/linux.git HEAD
```

Look for `SSL certificate verify ok.` in the verbose output.

### 5. Synchronize System Clock

If your VM or WSL2 instance drifted out of sync, re-enable NTP:

```bash
sudo timedatectl set-ntp true
date -u
```

## Frequently Asked Questions

### Why does GitHub work in Chrome/Edge but fail in Git CLI?
Chrome and Edge query the operating system's native certificate store (Windows Certificate Store or macOS Keychain), which includes corporate or enterprise root CAs. Git CLI using OpenSSL reads a standalone `.crt` file unless you switch to `schannel` on Windows or set `http.sslCAInfo`.

### Is `git config --global http.sslVerify false` a good permanent fix?
No. Disabling `sslVerify` globally turns off all TLS server authentication, allowing anyone on the same network to intercept your Personal Access Tokens (PATs) or inject malicious commits. Use `GIT_SSL_NO_VERIFY=1` only as a one-off emergency command if you have verified the endpoint.

### Can I switch to SSH to avoid HTTPS certificate issues?
Yes. Cloning via `git@github.com:org/repo.git` uses SSH host keys (`~/.ssh/known_hosts`) over port 22 (or `ssh.github.com:443`) and bypasses X.509 CA bundles entirely.

## Prevention Advice

- **Include `ca-certificates` in Dockerfiles:** Always install `ca-certificates` in CI/CD build images before running `git clone` or `npm install`.
- **Use per-URL `http.<url>.sslCAInfo`:** Scope custom self-signed certificates to internal hostnames rather than overwriting the global CA bundle for public repositories.
- **Prefer SSH keys with passphrases:** Configure SSH authentication for daily development to decouple Git transport from corporate HTTPS proxies.
- **Check WSL2 clock drift:** On Windows laptops that hibernate frequently, run `sudo hwclock -s` if WSL2 timestamps lag behind the host.

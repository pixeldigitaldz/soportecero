---
title: >-
  fatal: unable to access: SSL certificate problem: unable to get local
  issuer certificate in Git
description: >-
  Fix Git SSL certificate problem: unable to get local issuer certificate when
  cloning or pushing to GitHub, GitLab, or corporate self-hosted repos.
category: Web & Code
tags:
  - Git
  - SSL
  - DevOps
  - Security
readTime: 5 min
date: '2026-10-07'
---

Running `git clone`, `git fetch`, or `git push` against HTTPS remotes such as GitHub, GitLab, or an internal enterprise server can fail abruptly with `fatal: unable to access "https://...": SSL certificate problem: unable to get local issuer certificate`. This TLS verification error means Git's underlying HTTP transport library (`libcurl` or Schannel) could not build a valid trust chain from the remote server's leaf certificate up to a trusted root Certificate Authority (CA) on your machine.

## Quick Diagnostics

| Cause | Symptom | Solution |
|---|---|---|
| **Corporate proxy / VPN SSL inspection** | Fails on all HTTPS repos inside company network | Export corporate root CA PEM and set `http.sslCAInfo` |
| **Outdated or missing system CA bundle** | Fails after OS install or container minimal image | Reinstall `ca-certificates` and run `update-ca-certificates` |
| **Self-hosted Git server missing intermediate** | Works in browser, fails in `git` CLI | Fix server chain or append intermediate CA to trust bundle |
| **Windows Schannel vs OpenSSL mismatch** | Fails in Git for Windows behind enterprise proxy | Switch `http.sslBackend` to `schannel` or point `sslCAInfo` |

## Root Cause & Technical Mechanics

During a `git` HTTPS operation, Git delegates the TLS handshake to `libcurl`, which validates the server's X.509 certificate chain against a local CA bundle (such as `/etc/ssl/certs/ca-certificates.crt` on Debian/Ubuntu or `ca-bundle.crt` on RHEL/Git for Windows).

`unable to get local issuer certificate` (OpenSSL error code 20) occurs in three distinct scenarios:
1. **TLS Interception (MITM Proxy):** Enterprise firewalls like Zscaler, Palo Alto, or Netskope terminate outbound HTTPS connections and re-sign them using an internal corporate root CA. While browsers often trust this root via OS or group policy stores, `libcurl` inside Git only checks its configured PEM bundle unless explicitly told otherwise.
2. **Incomplete Server Certificate Chain:** A self-hosted GitLab or Gitea instance serves only its leaf certificate without the intermediate CA certificate. Browsers may fetch intermediates via AIA, whereas `libcurl` strictly rejects incomplete chains.
3. **Stale or Stripped CA Store:** Minimal Docker images (`alpine`, `debian-slim`) or isolated Snap/Flatpak Git builds ship without updated root certificates.

## Step-by-Step Solution

### Step 1: Inspect the Remote Certificate Chain with OpenSSL

Identify which CA is signing the connection before changing any Git settings:

```bash
openssl s_client -showcerts -connect github.com:443 </dev/null 2>/dev/null | grep -E "s:|i:"
```

If the issuer (`i:`) shows your company proxy or firewall vendor rather than DigiCert/Let's Encrypt, you need to trust your corporate root CA.

### Step 2: Refresh Operating System CA Certificates

On Linux servers or containers, reinstall and rebuild the system trust store:

```bash
# Debian / Ubuntu
sudo apt-get update && sudo apt-get install --reinstall -y ca-certificates
sudo update-ca-certificates

# RHEL / Fedora / Rocky Linux
sudo dnf reinstall -y ca-certificates && sudo update-ca-trust
```

### Step 3: Point Git to the Explicit CA Bundle or Corporate Root

**On Linux / macOS:** Append your organization's Base64-encoded `.crt`/`.pem` root certificate to a combined bundle (or reference the system bundle) and configure `http.sslCAInfo`:

```bash
git config --global http.sslCAInfo /etc/ssl/certs/ca-certificates.crt
```

If using a corporate proxy certificate, combine the system CA bundle and your corporate root so both public and internal repos validate:

```bash
cat /etc/ssl/certs/ca-certificates.crt /path/to/corporate-root.crt > ~/.git-ca-bundle.pem
git config --global http.sslCAInfo ~/.git-ca-bundle.pem
```

**On Windows (Git for Windows):** Switch Git's TLS backend to Windows native `schannel`, which automatically reads certificates pushed by Active Directory / Group Policy:

```bash
git config --global http.sslBackend schannel
```

### Step 4: Verify the TLS Handshake

Test a read-only remote reference lookup to confirm Git validates the chain cleanly:

```bash
GIT_CURL_VERBOSE=1 git ls-remote https://github.com/git/git.git HEAD
```

Look for `SSL certificate verify ok.` in the verbose output.

## Frequently Asked Questions

### Why should I never fix this with `git config --global http.sslVerify false`?
Setting `http.sslVerify false` disables certificate verification globally, exposing your Git credentials, Personal Access Tokens, and source code to trivial man-in-the-middle interception on untrusted Wi-Fi or compromised networks.

### Can I trust a self-signed certificate for just one internal repository?
Yes. Scope `http.sslCAInfo` to a single repository or URL prefix rather than globally: `git config --global http."https://git.internal.corp/".sslCAInfo /path/to/internal-ca.crt`.

### How do I bypass HTTPS certificate issues permanently by switching to SSH?
Generate an Ed25519 key (`ssh-keygen -t ed25519`), add the public key to your Git host, and update the remote: `git remote set-url origin git@github.com:org/repo.git`.

## Prevention Advice

- Never commit `sslVerify = false` in `.gitconfig`, Dockerfile layers, or CI/CD runner scripts.
- Use `http.<url>.sslCAInfo` per domain when working with internal Git servers so public GitHub/GitLab validation remains strict.
- In Docker CI images, always include `ca-certificates` in your base image installation step.
- Prefer SSH remotes with hardware-backed keys or short-lived OIDC/deploy tokens in automated pipelines.

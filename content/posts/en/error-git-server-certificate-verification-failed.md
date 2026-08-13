---
title: 'Solved: server certificate verification failed in Git'
description: 'How to fix the SSL certificate error in Git when trying to clone, pull or push from a remote repository.'
category: 'Web & Code'
date: '2026-08-15'
readTime: '3 min'
tags: ['Git', 'Security', 'DevOps']
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Outdated system certificates** | Update `ca-certificates` |
| **Proxy or Antivirus blocking SSL** | Use SSH instead of HTTPS |
| **Server with self-signed certificate** | Disable global verification (Temporary) with `http.sslVerify false` |

## Step-by-Step Solution

**Update your system's root certificates (Recommended)**
Most of the time, the error occurs because your server's (or PC's) operating system has expired certificate authorities (CA).
On Ubuntu/Debian:
```bash
sudo apt-get update
sudo apt-get install --reinstall ca-certificates
```
On CentOS/RHEL:
```bash
sudo yum update ca-certificates
```

**Use SSH instead of HTTPS**
If Github/Gitlab is blocking your traffic due to corporate proxy issues or your local CA, changing the remote URL to SSH usually bypasses HTTPS SSL validation:
```bash
git remote set-url origin git@github.com:user/repository.git
```
Make sure you have your SSH keys configured (`ssh-keygen`).

**Disable global SSL verification (Risky, only for testing)**
If you are connecting to an internal server (local Gitea/Gitlab) with a self-signed certificate, you can tell Git to ignore SSL security for that repository:
```bash
git config http.sslVerify false
```
*If you want to apply it to all projects on your machine:*
```bash
git config --global http.sslVerify false
```

## Prevention Tips
- **CA Management:** If your company uses internally signed certificates, make sure to add them to the `/etc/ssl/certs/` path and run `update-ca-certificates`.
- **Prefer SSH:** Get used to using SSH keys for Git operations; they are faster and do not suffer from SSL certificate expiration issues in the same way as HTTPS.

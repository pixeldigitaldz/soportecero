---
title: 'Fix: chmod Operation not permitted (Even as Root) in Linux'
description: 'How to fix the Operation not permitted error when using chmod or chown in Linux, caused by immutable attributes (chattr).'
category: 'Systems & Servers'
date: '2026-08-13'
readTime: '2 min'
tags: ['Linux', 'Security', 'Permissions']
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **File marked as Immutable** | Use `chattr -i` to remove the attribute |
| **Read-Only File System** | Remount with `mount -o remount,rw /` |
| **SELinux or AppArmor issues** | Check security contexts |

## Step-by-Step Solution

**Check the extended attributes of the file**
If you are root but still get "Operation not permitted", the file probably has the `i` (immutable) attribute. Check it with:
```bash
lsattr filename
```
You will see an output similar to `----i---------e--- filename`. The `i` indicates it is immutable.

**Remove the immutable attribute**
Use the `chattr` command to remove this lock:
```bash
sudo chattr -i filename
```

**Apply your permission changes**
Now that the file is no longer locked at the file system level, you can use `chmod` or `chown` normally:
```bash
sudo chmod 755 filename
```

**Restore the attribute if necessary**
If the file was immutable for security reasons (like `/etc/resolv.conf` or an `authorized_keys` file), make sure to protect it again:
```bash
sudo chattr +i filename
```

## Prevention Tips
- **Documentation:** If you use `chattr +i` on servers, document it to avoid headaches for other administrators.
- **Auditing:** Use `lsattr` routinely when trying to modify critical system files that resist `chmod` changes.

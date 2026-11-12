---
title: The Definitive Linux File and Folder Permissions Guide to Secure WordPress
description: >-
  Learn how to harden WordPress file and folder permissions on Linux servers. Configure optimal
  chmod 755/644 masks, protect wp-config.php with chmod 600, and resolve uploads ownership issues.
category: Web & Code
tags:
  - WordPress
  - Security
  - Linux
  - Sysadmin
  - Nginx
readTime: 5 min
date: '2026-07-27'
---

Operating a **WordPress** site on an unmanaged Linux Virtual Private Server (VPS), dedicated host, or Docker environment requires strict enforcement of the principle of least privilege across the filesystem. A significant percentage of WordPress malware infections, webshell injections, and defacements occur because developers and site administrators set overly permissive file permissions (`chmod -R 777`) to bypass media upload errors or automatic plugin update failures.

Allowing world-writable permissions invites disaster: any compromised plugin or unauthenticated vulnerability in a theme file can write malicious PHP scripts into the webroot, rewrite `.htaccess` rules, or exfiltrate plaintext database credentials from `wp-config.php`.

Applying the official WordPress hardening schema guarantees seamless functionality for core auto-updates and media uploads while completely locking out unauthorized write access.

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **World-writable directories or files (chmod 777) exposing server to webshells** | Reset directory permissions to `755` and file permissions to `644` |
| **Media uploads or automatic plugin updates failing with permission denied** | Align ownership with web server daemon user: `sudo chown -R www-data:www-data` |
| **`wp-config.php` database credentials readable by other local server users** | Restrict `wp-config.php` permissions strictly to owner read-only: `chmod 600` or `440` |
| **WordPress prompting for FTP credentials when installing plugins** | Add `define('FS_METHOD', 'direct');` to `wp-config.php` after fixing ownership |

## 🚀 Step-by-Step Implementation Guide

### Step 1: Assign Proper Web Server User and Group Ownership
Before adjusting permission masks, ensure that your files belong to the user account running the web server daemon:
- **Ubuntu / Debian (Nginx or Apache):** Default user is `www-data:www-data`.
- **RHEL / CentOS / Rocky Linux / AlmaLinux:** Default user is `apache:apache` or `nginx:nginx`.
- **Docker Container Stacks:** Usually runs under UID `33` (`www-data`) or `101` (`nginx`).

Reclaim ownership of the entire WordPress root directory:
```bash
# Set ownership to the web server daemon user
sudo chown -R www-data:www-data /var/www/html/wordpress
```

### Step 2: Apply the Standard 755 / 644 Permission Schema
Never apply permissions uniformly across an entire directory tree using a single recursive command. Directories require the execute (`+x`) bit to allow directory traversal, whereas standard files must never possess execute rights:
```bash
# 1. Enforce 755 (rwxr-xr-x) on all directories
sudo find /var/www/html/wordpress/ -type d -exec chmod 755 {} +

# 2. Enforce 644 (rw-r--r--) on all regular files
sudo find /var/www/html/wordpress/ -type f -exec chmod 644 {} +
```
*(Explanation: `755` gives the owner read/write/traverse rights and all others read/traverse rights. `644` gives the owner read/write access and all others read-only access).*

### Step 3: Hardening the Critical wp-config.php File
The `wp-config.php` file stores your raw MySQL database username, password, host, table prefix, and cryptographic authentication salts. No process other than the web server worker should be permitted to read this file:
```bash
# Set wp-config.php to owner read-only or owner read/write
sudo chmod 600 /var/www/html/wordpress/wp-config.php
```
If your web server worker runs under `www-data` and you edit files over SSH as a distinct system user (e.g., `ubuntu` in the `www-data` group), use:
```bash
sudo chmod 640 /var/www/html/wordpress/wp-config.php
```

### Step 4: Secure the .htaccess and Nginx Server Blocks
If your server runs Apache or LiteSpeed, protect the `.htaccess` routing file against plugin tampering:
```bash
sudo chmod 644 /var/www/html/wordpress/.htaccess
```
If your server runs Nginx, ensure your server configuration blocks direct browser requests to hidden files and sensitive locations:
```nginx
# Block browser access to hidden files (.git, .env, .htaccess)
location ~ /\. {
    deny all;
    access_log off;
    log_not_found off;
}

# Block direct execution of PHP scripts in uploads directory
location ~* /(?:uploads|files)/.*\.php$ {
    deny all;
}
```

### Step 5: Configure Direct Filesystem Access in wp-config.php
If WordPress prompts for FTP credentials when installing plugins or updates, it indicates that the PHP worker process believes it does not own the webroot. Add this configuration to `wp-config.php` above the `/* That's all, stop editing! */` line:
```php
define('FS_METHOD', 'direct');
```

## 🛡️ Security Hardening & Best Practices
- **Never Use `chmod 777` as a 'Quick Fix':** If an image upload in `wp-content/uploads` fails, the issue is user/group ownership (`chown`), not a need for `777`. Applying `777` allows an attacker who uploads an obfuscated PHP script to execute arbitrary shell commands with full server privileges.
- **Disable File Editing in the Admin Dashboard:** Add `define('DISALLOW_FILE_EDIT', true);` to `wp-config.php` to prevent compromised administrator accounts from editing plugin and theme PHP code directly through the WordPress dashboard.

## Frequently Asked Questions (FAQ)

### What should permissions be on the wp-content/uploads directory?
The `wp-content/uploads` folder should carry `755` permissions for subdirectories and `644` for uploaded image/media files, with ownership assigned to `www-data:www-data`. There is never a valid operational reason for `uploads` to require `777`.

### Why does 'find -exec chmod {} +' perform better than 'chmod -R'?
Using `find -type d -exec chmod 755 {} +` bundles hundreds of directory paths into a single system call execution, completing in milliseconds even on massive WordPress installations with tens of thousands of media uploads.

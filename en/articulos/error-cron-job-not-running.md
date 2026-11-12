---
title: Why Is My Cron Job Not Running? Step-by-Step Linux Troubleshooting Guide
description: >-
  Learn how to diagnose why scheduled cron jobs fail silently in Linux. Troubleshoot PATH environment
  variables, missing trailing newlines, systemd logging, and permission issues.
category: Systems & Servers
tags:
  - Linux
  - Sysadmin
  - Cron
  - Automation
  - Bash
readTime: 5 min
date: '2026-07-24'
---

The most frustrating aspect of debugging automated **Cron jobs** in Linux is that a script or command will execute flawlessly when triggered manually in an interactive terminal session, yet fail silently or refuse to start when invoked by the background cron daemon (`cron` or `crond`).

This disparity is almost never a bug in the script itself. Instead, it is caused by the fundamental differences between an interactive login shell and the non-interactive, isolated execution environment instantiated by the cron daemon. Understanding how cron initializes environment variables, handles stdout/stderr streams, and checks crontab syntax is key to building reliable automation.

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Restricted execution PATH (cron defaults to `/usr/bin:/bin` without `/usr/local/bin`)** | Define explicit absolute binary paths or set `PATH=...` at the top of the crontab |
| **Missing trailing newline at the end of the crontab file** | Ensure the crontab file terminates with a trailing empty newline |
| **Cron daemon inactive or masked by systemd** | Enable and start the daemon: `sudo systemctl enable --now cron` |
| **Silent stderr output discarded to `/dev/null`** | Append `>> /var/log/my_task.log 2>&1` to capture standard output and error messages |

## 🚀 Step-by-Step Implementation Guide

### Step 1: Enforce Absolute Paths and Shell Environment Variables
When you log into an interactive shell, files like `/etc/profile`, `~/.bashrc`, and `~/.profile` populate your `$PATH` variable with user directories (`/usr/local/bin`, `~/.local/bin`, Node Version Manager paths, etc.). 

Cron does not execute your shell profile scripts. By default, cron's execution path is stripped down to `/usr/bin:/bin`. Consequently, commands like `python3`, `node`, `docker`, or `aws` will fail with `command not found`.

Always declare full absolute paths or set your environment explicitly at the top of your user crontab (`crontab -e`):
```plaintext
# Declare shell interpreter and complete search path
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin:/home/username/.local/bin

# Example using explicit absolute interpreter:
* * * * * /usr/bin/python3 /home/username/scripts/sync_data.py
```
*(Tip: In your interactive shell, run `which python3` or `which docker` to discover exact absolute paths).*

### Step 2: Capture Standard Output and Error Streams to Disk
Because cron runs as a detached background daemon without an active TTY/terminal, any unhandled error, stack trace, or warning is sent to the local user's mail spool (`/var/mail/username`), which is frequently unconfigured or ignored on modern servers.

Direct all output and error streams to a physical log file:
```plaintext
# Redirect stdout (1) and stderr (2) to an operational audit log
0 4 * * * /usr/local/bin/automated_backup.sh >> /var/log/automated_backup.log 2>&1
```
Check the generated log file immediately after the scheduled minute passes:
```bash
tail -n 25 /var/log/automated_backup.log
```

### Step 3: Verify the Cron Daemon Status and Journal Logs
Confirm that the underlying cron scheduler is actively ticking:
```bash
# On Debian, Ubuntu, and derivatives:
sudo systemctl status cron --no-pager

# On Arch Linux, CachyOS, Fedora, and RHEL:
sudo systemctl status crond --no-pager
```
If the service is stopped or inactive, start and enable it:
```bash
sudo systemctl enable --now cron
```
Inspect real-time execution dispatches using systemd journal logs:
```bash
sudo journalctl -u cron -f --no-pager
```
When cron executes a job, you will see entries like `(username) CMD (/usr/bin/python3 ...)`.

### Step 4: Ensure Proper Permissions and the Trailing Newline
Two classical syntax traps frequently prevent cron jobs from registering:
1. **The Missing Newline:** The POSIX crontab parser requires the configuration file to end with a blank newline. If the last line of your crontab does not contain an `Enter` carriage return, cron will silently ignore that line without throwing an error.
2. **Executable Permissions:** If your cron entry calls an external `.sh` script, confirm that the script has executable permissions:
```bash
chmod +x /home/username/scripts/sync_data.sh
```

## 🛡️ Production Best Practices & Alternatives
- **Never Run Development Scripts via Root Crontab:** Maintain least privilege by scheduling jobs in the specific application user's crontab (`crontab -e -u www-data`) rather than stuffing everything into root's crontab.
- **Consider systemd Timers for Complex Infrastructure:** For mission-critical tasks requiring dependency resolution, automatic restarts on failure, and deep journal logging, modern systemd timers (`.timer` + `.service` units) provide superior telemetry compared to legacy cron.

## Frequently Asked Questions (FAQ)

### Why does my script fail with 'Permission denied' only under cron?
When you run a script manually, you might possess active `sudo` tokens or specific group memberships loaded during login. Cron runs with the strict non-interactive permissions of the crontab owner. Verify that the destination directories are writable by that specific user.

### How do I run a cron job with a specific Python virtual environment (venv)?
Point directly to the Python binary inside the virtual environment:
`0 * * * * /home/username/project/venv/bin/python /home/username/project/main.py >> /var/log/project.log 2>&1`.

---
title: 'How to fix and understand active (exited) or failed services in Systemd'
description: 'Step-by-step guide to diagnose why a Linux service ends in active (exited) or failed state when launched with systemctl.'
category: 'Systems & Servers'
date: '2026-08-20'
readTime: '3 min'
tags: ['Linux', 'Systemd', 'DevOps']
---

The `active (exited)` status in Systemd indicates that the command configured under `ExecStart` successfully completed its execution and finished, while a `failed` or `activating (auto-restart)` status indicates that the binary crashed due to configuration syntax errors, missing paths, or insufficient permissions.

Understanding the difference between `Type=oneshot` and `Type=simple` service definitions is essential to know whether your application is running as expected or silently dropping connections.

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Service configured as `Type=oneshot`** | Expected behavior for single-run provisioning scripts or cron alternatives |
| **Configuration file error or missing env vars** | Inspect runtime logs with `journalctl -u service-name -e --no-pager` |
| **Permission denied on binary or working directory** | Ensure the user configured under `User=` has access to `WorkingDirectory=` |

## Step-by-Step Solution

**Inspect detailed service logs**
When a service crashes or produces unexpected exit codes, standard `systemctl status` only shows truncated lines. Use `journalctl` to view the full stderr stream:
```bash
sudo journalctl -u my-service.service -n 50 --no-pager
```

**Verify the service type in the unit file**
Open the Systemd unit file located at `/etc/systemd/system/my-service.service`. If your app is a persistent background worker (like a Node, Python, or Go daemon) but has `Type=oneshot`, Systemd will not supervise it as an ongoing daemon:
```ini
[Unit]
Description=My Background Daemon
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/my-app
ExecStart=/usr/bin/node /var/www/my-app/server.js
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

**Reload the Systemd daemon and restart the unit**
Whenever you modify a `.service` configuration file, inform the Linux init system before restarting the service:
```bash
sudo systemctl daemon-reload
sudo systemctl restart my-service.service
sudo systemctl status my-service.service
```

**Use absolute paths for all executables**
Systemd does not inherit your personal shell's `$PATH` variable. Always provide the full absolute path to binaries (e.g., `/usr/bin/python3` instead of `python3`). Find absolute paths using:
```bash
which node
which python3
```

## Prevention Tips
- **Syntax validation:** Run `systemd-analyze verify /etc/systemd/system/my-service.service` to catch syntax and path warnings prior to deploying.
- **Restart throttle limits:** Always declare `RestartSec=5s` and `StartLimitBurst=5` to prevent broken binaries from entering aggressive CPU-hogging restart loops.

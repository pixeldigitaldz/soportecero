---
title: 'How to fix and understand active (exited) or failed services in Systemd'
description: 'Step-by-step guide to diagnose why a Linux service ends in active (exited) or failed state when launched with systemctl.'
category: 'Systems & Servers'
date: '2026-08-20'
readTime: '5 min'
tags: ['Linux', 'Systemd', 'DevOps']
---

When inspecting a Linux service with `systemctl status`, seeing `active (exited)` or `failed` (with `Result: exit-code`) indicates two very different behaviors in `systemd`. `active (exited)` means the process launched by `ExecStart=` terminated with exit code `0` and `systemd` considers the unit healthy—which is normal for initialization scripts, but a bug if you expected a persistent daemon. Conversely, `failed` means the binary crashed or returned a non-zero exit status.

## Quick Diagnostics

| Symptom / Cause | Verification | Immediate Fix |
|---|---|---|
| Persistent app shows `active (exited)` | `systemctl show -p Type,RemainAfterExit <unit>` | Change `Type=oneshot` to `Type=simple` (or `exec`) |
| `status=203/EXEC` (binary not found or not executable) | `journalctl -u <unit> -n 30 --no-pager` | Use absolute path in `ExecStart=` and `chmod +x` |
| `status=200/CHDIR` or permission denied | `ls -ld <WorkingDirectory>` | Fix `User=` / `Group=` ownership or directory path |
| Daemon forks to background then gets killed | `systemctl show -p Type <unit>` | Use `Type=forking` with `PIDFile=`, or run in foreground |

## Root Cause & Technical Mechanics

`systemd` tracks a service's lifecycle based on its `Type=` directive in the `[Service]` section:

- **`Type=simple` (default):** `systemd` expects the process spawned by `ExecStart=` to stay in the foreground as the main service PID. If that process forks into the background and exits `0`, `systemd` assumes the service finished and tears down any remaining cgroup child processes.
- **`Type=oneshot` + `RemainAfterExit=yes`:** Designed for setup tasks (e.g., applying `iptables` rules or running a migration). Once `ExecStart=` exits `0`, `systemd` marks the unit `active (exited)` and keeps it marked active without supervising any running process.
- **`Type=forking`:** Used for legacy daemons that daemonize (`fork()` + parent exit). If `PIDFile=` is missing or wrong, `systemd` loses track of the child PID and marks the unit `failed`.

When a unit enters **`failed`**, `systemd` logs numeric exit codes (`status=203/EXEC`, `status=217/USER`, `status=1/FAILURE`) or signals (`SIGKILL`/`OOM`). Additionally, `systemd` does **not** load your interactive `~/.bashrc` or `$PATH`, so relative commands like `node server.js` fail immediately with `203/EXEC`.

## Step-by-Step Solution

### Step 1: Read the Full Journal and Exit Status

Never rely solely on the truncated output of `systemctl status`. Query `journalctl` and `systemctl show` for the exact exit code and stderr output:

```bash
sudo journalctl -u my-app.service -n 50 --no-pager
systemctl show my-app.service -p ActiveState,SubState,ExecMainStatus,Result
```

Match `ExecMainStatus` against common `systemd` codes (`203` = exec path/permissions, `200` = bad `WorkingDirectory`, `1`–`255` = application-level error).

### Step 2: Fix the Unit Definition (`Type=` and Absolute Paths)

Open the unit file (e.g., `/etc/systemd/system/my-app.service`) and ensure it uses `Type=simple` (or `Type=exec`) for foreground daemons, an absolute binary path, and explicit `User=`/`WorkingDirectory=` settings:

```ini
[Unit]
Description=My Node.js API Service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/my-app
EnvironmentFile=/var/www/my-app/.env
ExecStart=/usr/bin/node /var/www/my-app/server.js
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

Find exact binary paths with `command -v node` or `which python3`.

### Step 3: Validate Syntax, Reload Daemon, and Restart

Before starting the service, run `systemd-analyze verify` to catch typos, missing paths, or invalid unit directives:

```bash
sudo systemd-analyze verify /etc/systemd/system/my-app.service
```

Reload `systemd` so it parses the updated unit file, reset any `failed` latch, and restart:

```bash
sudo systemctl daemon-reload
sudo systemctl reset-failed my-app.service
sudo systemctl restart my-app.service
```

### Step 4: Verify `active (running)` State

Confirm the unit now reports `active (running)` with a live `Main PID`:

```bash
sudo systemctl status my-app.service --no-pager
```

## Frequently Asked Questions

### When is `active (exited)` actually the intended, healthy state?
For one-time configuration units (`Type=oneshot` with `RemainAfterExit=yes`), such as `ufw.service`, `netfilter-persistent.service`, or `systemd-sysctl.service`. They apply kernel settings at boot and exit cleanly, leaving no daemon running in memory.

### Why does my service work when I run it manually in the terminal, but fail under `systemd`?
Interactive shells load `/etc/profile`, `~/.bashrc`, and custom `$PATH` or environment variables (like `NVM` paths or `DATABASE_URL`). `systemd` runs in a minimal, clean environment; you must pass variables via `Environment=` or `EnvironmentFile=` and specify full binary paths.

### What causes `Start request repeated too quickly` (`start-limit-hit`)?
If a broken service crashes multiple times within `StartLimitIntervalSec` (default 10s, 5 restarts), `systemd` stops retrying and locks the unit in `failed`. Fix the underlying crash, then run `sudo systemctl reset-failed <unit>` before starting it again.

## Prevention Advice

- **Always run `systemd-analyze verify`:** Catch invalid directives and missing `ExecStart` binaries prior to reloading.
- **Configure `Restart=on-failure` with `RestartSec=5s`:** Avoid tight crash loops that exhaust CPU and hit `start-limit-hit`.
- **Keep daemons in the foreground:** Modern apps (Node, Go, Python, Gunicorn) should not daemonize themselves; run them in foreground mode with `Type=simple` or `Type=exec`.
- **Isolate secrets in `EnvironmentFile=`:** Store API keys and DB strings in a `0600` file rather than hardcoding them in world-readable `/etc/systemd/system/*.service` files.

---
title: '[FIXED] Error 502 Bad Gateway in Nginx with PHP-FPM'
description: >-
  Nginx returning 502 Bad Gateway while processing PHP requests? Learn how to
  fix PHP-FPM socket path mismatches and permissions in 3 steps.
category: Systems & Servers
tags:
  - Nginx
  - PHP-FPM
  - Sysadmin
  - Linux
readTime: 5 min
date: '2026-08-12'
---

An HTTP **`502 Bad Gateway`** error on an Nginx + PHP-FPM stack occurs when Nginx successfully accepts the client's HTTP request and forwards it via FastCGI, but the PHP-FPM upstream either fails to answer, drops the socket connection, or denies access to its Unix socket file.

## Quick Diagnostics

| Nginx `error.log` Message | Immediate Action |
|---|---|
| **`connect() to unix:/run/php/php8.2-fpm.sock failed (2: No such file or directory)`** | Start `php8.2-fpm` or update `fastcgi_pass` to the installed PHP version |
| **`failed (13: Permission denied)` on `.sock`** | Match `listen.owner` / `listen.group` in `www.conf` to Nginx's user (`www-data`) |
| **`recv() failed (104: Connection reset by peer)`** | PHP-FPM worker crashed/OOM'd or `pm.max_children` is exhausted |
| **`upstream sent too big header`** | Increase `fastcgi_buffers` and `fastcgi_buffer_size` in Nginx |

## Root Cause & Technical Mechanics

In a LEMP stack, Nginx does not execute PHP code itself; it proxies `.php` requests over the FastCGI binary protocol to a separate `php-fpm` master process, which manages a pool of worker processes. Communication happens either over a TCP loopback socket (`127.0.0.1:9000`) or, more commonly on Linux, a filesystem Unix domain socket (`/run/php/php8.2-fpm.sock`).

Three specific breakdowns produce a 502:
1. **Version/path mismatch:** After an OS or PHP upgrade (e.g., PHP 8.1 → 8.3), `php8.3-fpm` creates `/run/php/php8.3-fpm.sock`, while the Nginx server block still points `fastcgi_pass` to the obsolete `php8.2-fpm.sock` path (`ENOENT`).
2. **Socket ownership mismatch:** On Ubuntu/Debian, Nginx workers run as `www-data`, whereas on RHEL/AlmaLinux Nginx runs as `nginx` while PHP-FPM pools may default to `apache` or `root:root` with `0660` permissions—blocking Nginx from writing to the socket (`EACCES`).
3. **Worker crash or OOM:** A fatal segmentation fault or `pm.max_children` exhaustion kills the PHP worker mid-response, closing the socket before FastCGI headers are returned.

## Step-by-Step Solution

### Step 1: Read the exact Nginx error log and PHP-FPM status

Never guess a 502—read the last 20 lines of `/var/log/nginx/error.log` and check the PHP-FPM systemd unit:

```bash
sudo tail -n 20 /var/log/nginx/error.log
sudo systemctl status 'php*-fpm' --no-pager
```

If the service is inactive or failed, start and enable it:

```bash
sudo systemctl enable --now php8.2-fpm
```

### Step 2: Match the exact `.sock` path in Nginx

List the actual socket files created in `/run/php/` (or `/var/run/php-fpm/` on RHEL derivatives):

```bash
ls -la /run/php/
```

Open your Nginx virtual host file (e.g., `/etc/nginx/sites-available/yourdomain.conf`) and ensure `fastcgi_pass` matches the exact filename shown by `ls`:

```nginx
location ~ \.php$ {
    include snippets/fastcgi-php.conf;
    fastcgi_pass unix:/run/php/php8.2-fpm.sock;
    fastcgi_buffers 16 16k;
    fastcgi_buffer_size 32k;
}
```

### Step 3: Align socket ownership and permissions in `www.conf`

Check which user Nginx workers run as:

```bash
ps aux | grep "nginx: worker"
```

Edit `/etc/php/8.2/fpm/pool.d/www.conf` (adjusting for your PHP version) and confirm `listen.owner`, `listen.group`, and `listen.mode` match that user (`www-data` on Debian/Ubuntu, `nginx` on RHEL):

```ini
listen = /run/php/php8.2-fpm.sock
listen.owner = www-data
listen.group = www-data
listen.mode = 0660
```

Also verify PHP-FPM config syntax, restart both services, and test a PHP endpoint:

```bash
sudo php-fpm8.2 -t
sudo nginx -t
sudo systemctl restart php8.2-fpm nginx
curl -I https://yourdomain.com/index.php
```

## Frequently Asked Questions

**Should I use a Unix socket (`/run/php/php8.2-fpm.sock`) or TCP (`127.0.0.1:9000`)?**
Unix sockets avoid TCP/IP stack overhead and are faster when Nginx and PHP-FPM share the same host. Use TCP `127.0.0.1:9000` (or container service name `php:9000`) when PHP-FPM runs in a separate Docker container or remote node.

**Why do I get 502 only on heavy WordPress or Laravel admin pages?**
Your PHP-FPM worker is likely hitting `memory_limit` or `max_execution_time`, or `fastcgi_buffer_size` is too small for large response headers (like huge cookies). Check `/var/log/php8.2-fpm.log` for `SIGSEGV` or `server reached pm.max_children`.

**Why did `/run/php/` disappear after a reboot?**
`/run` is a `tmpfs` mounted in RAM. If `php8.2-fpm` is not enabled via `systemctl enable php8.2-fpm`, it will not boot and recreate `/run/php/` after a restart.

## Prevention Advice

- **Tune `pm.max_children` to available RAM:** Divide free RAM by average PHP worker footprint (typically 40–80 MB) so traffic spikes do not trigger OOM kills.
- **Enable `php-fpm` slowlog:** Set `slowlog = /var/log/php-fpm-slow.log` and `request_slowlog_timeout = 5s` to catch hung scripts before workers saturate.
- **Use a symlink or explicit version pinning:** Update Nginx `fastcgi_pass` paths immediately as part of any `apt` PHP upgrade checklist.
- **Monitor `error.log`:** Alert on `connect() to unix:` and `upstream prematurely closed connection` lines.

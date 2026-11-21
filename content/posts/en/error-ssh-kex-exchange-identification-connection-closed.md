---
title: 'Troubleshooting: kex_exchange_identification: Connection closed by remote host in SSH'
description: 'How to troubleshoot and fix kex_exchange_identification Connection closed by remote host in SSH caused by Fail2ban, MaxStartups limits, or TCP Wrappers.'
category: 'Systems & Servers'
date: '2026-08-24'
readTime: '5 min'
tags: ['SSH', 'Linux', 'Security']
---

The error `kex_exchange_identification: Connection closed by remote host` (often paired with `Connection reset by peer`) occurs **before** user authentication during the initial SSH protocol handshake. Because the remote `sshd` daemon or an intermediary security layer severs the TCP socket right after the banner/key-exchange phase begins, your client never reaches the password or public-key prompt.

## Quick Diagnostics

| Symptom / Cause | Verification | Immediate Fix |
|---|---|---|
| Concurrent unauthenticated connections exceed `MaxStartups` | `sudo grep MaxStartups /etc/ssh/sshd_config` & `journalctl -u sshd` | Increase `MaxStartups 50:30:100` in `sshd_config` |
| Client IP banned by `fail2ban` jail | `sudo fail2ban-client status sshd` | Unban IP with `fail2ban-client set sshd unbanip <IP>` |
| TCP Wrappers blocking client in `/etc/hosts.deny` | `cat /etc/hosts.deny` | Whitelist IP in `/etc/hosts.allow` |
| Firewall rate-limiting (`ufw limit` / `iptables recent`) | `sudo ufw status` or `sudo iptables -L -n` | Raise burst threshold or whitelist trusted CIDR |

## Root Cause & Technical Mechanics

An SSH connection progresses through three phases: TCP handshake, **Protocol Version & Key Exchange (`KEX`)**, and User Authentication. When `kex_exchange_identification: Connection closed by remote host` appears, the TCP handshake succeeded, but the server closed the socket right after `SSH2_MSG_KEXINIT` or before sending its `SSH-2.0` banner.

This pre-auth termination has four primary causes:

1. **`MaxStartups` exhaustion:** OpenSSH defaults to `MaxStartups 10:30:100`—once 10 concurrent *unauthenticated* connections exist, `sshd` drops 30% of new connections and 100% at 100. CI/CD runners, Ansible, or VS Code Remote-SSH often hit this ceiling.
2. **Fail2ban or firewall throttling:** Rapid bursts (e.g., `ufw limit ssh`, 6 connections/30s) or failed auth bans cause `netfilter` to reset or drop handshakes.
3. **TCP Wrappers (`libwrap`):** Builds compiled with `libwrap` check `/etc/hosts.deny` right after `accept()` and close the socket if `sshd: ALL` is denied.
4. **Corrupt host keys or `Match` errors:** Missing `/etc/ssh/ssh_host_*_key` files cause the forked `sshd` worker to exit mid-handshake.

## Step-by-Step Solution

### Step 1: Capture Verbose Client Output

Run SSH with `-vvv` to see the exact line where the remote host drops the socket:

```bash
ssh -vvv -o ConnectTimeout=10 user@203.0.113.45
```

If it fails right after `Local version string SSH-2.0-OpenSSH_...` or `SSH2_MSG_KEXINIT sent`, connect to the server via your cloud provider's serial/VNC console (or an already-open session) and check server logs:

```bash
sudo journalctl -u ssh -u sshd -n 50 --no-pager
```

Look for messages such as `drop connection #10 from [...]` (`MaxStartups`), `refused connect from ...` (TCP Wrappers), or `error: Could not load host key`.

### Step 2: Check and Unban IPs in Fail2ban

Inspect the `sshd` jail to see if your workstation or NAT gateway IP was banned:

```bash
sudo fail2ban-client status sshd
sudo fail2ban-client set sshd unbanip 198.51.100.25
```

If you are using `ufw limit`, check `sudo ufw status numbered` and replace `LIMIT` with `ALLOW` for trusted static IPs.

### Step 3: Tune `MaxStartups` and `MaxSessions`

If parallel automation or IDE sessions trigger `drop connection` in `journalctl`, edit `/etc/ssh/sshd_config`:

```ini
# Allow up to 50 unauthenticated handshakes before probabilistic dropping
MaxStartups 50:30:100
# Allow more multiplexed channels per TCP connection
MaxSessions 50
```

Validate syntax before restarting `sshd` so you do not lock yourself out:

```bash
sudo sshd -t && sudo systemctl restart sshd
```

### Step 4: Inspect TCP Wrappers and Host Keys

Verify `/etc/hosts.deny` is not blocking SSH:

```bash
cat /etc/hosts.deny
```

If `ALL: ALL` or `sshd: ALL` is present, add your trusted subnet to `/etc/hosts.allow`:

```ini
sshd: 198.51.100.25, 10.0.0.0/8
```

If `journalctl` reported missing or unreadable host keys, regenerate them cleanly:

```bash
sudo ssh-keygen -A
sudo sshd -t && sudo systemctl restart sshd
```

### Step 5: Verify From the Client

Test the connection again with `-v` to confirm `KEX` completes and authentication starts:

```bash
ssh -v user@203.0.113.45
```

## Frequently Asked Questions

### Why does VS Code Remote-SSH trigger this error more than a normal terminal?
VS Code Remote-SSH, Git extensions, and file watchers often open multiple simultaneous SSH connections or tunnels in rapid succession, tripping `ufw limit` (6 connections/30s) or OpenSSH's default `MaxStartups 10:30:100`.

### Can an ISP or corporate proxy cause `kex_exchange_identification` errors?
Yes. Deep Packet Inspection (DPI) firewalls or transparent proxies that block port 22 or reset non-HTTP traffic after inspecting the `SSH-2.0` banner will produce the exact same `Connection closed by remote host` message on the client even though `sshd` on the server never saw a problem.

### Does `MaxStartups` affect already-authenticated SSH sessions?
No. `MaxStartups` only caps concurrent **unauthenticated** connections in the pre-login handshake state. Once a user authenticates, the connection no longer counts toward `MaxStartups`.

## Prevention Advice

- **Enable SSH connection multiplexing:** Configure `ControlMaster auto`, `ControlPath ~/.ssh/cm-%r@%h:%p`, and `ControlPersist 10m` in `~/.ssh/config` so multiple terminals and IDEs share one TCP socket.
- **Whitelist admin IPs in Fail2ban:** Add your VPN or static office IP to `ignoreip` in `/etc/fail2ban/jail.local`.
- **Use `sshd -t` before every restart:** Always validate `/etc/ssh/sshd_config` syntax before reloading the daemon.
- **Replace `ufw limit` with Fail2ban for CI/CD hosts:** Rate-limiting at the packet layer breaks legitimate parallel deployments; use Fail2ban on failed auth logs instead.

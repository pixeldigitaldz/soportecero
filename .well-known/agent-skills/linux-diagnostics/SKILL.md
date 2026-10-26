# Linux Sysadmin Diagnostics

Inspect, diagnose, and remediate systemd failures, cgroup constraints, memory swap exhaustion, and storage inode limits on Linux distributions.

## When to Use

Use this skill when diagnosing server or workstation issues involving systemctl failures, out-of-memory kernel kills, disk space exhaustion (including inode limits), or network name resolution problems.

## Requirements

- Inspect system journal logs using `journalctl -xeu <service>`.
- Check memory and swap pressure using `free -h` and `swapon --show`.
- Check storage usage and inode exhaustion with `df -h` and `df -i`.
- Apply recommended configuration changes and restart affected units.

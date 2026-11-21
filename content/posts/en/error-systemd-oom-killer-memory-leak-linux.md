---
title: How to Fix Linux OOM Killer and Systemd Out of Memory Crashes
description: >-
  Learn how to diagnose and prevent Linux OOM Killer (Exit 137 / Out of memory) crashes using dmesg, journalctl, systemd-oomd, and cgroups v2 memory limits.
category: Systems & Servers
tags:
  - Linux
  - Systemd
  - Memory
  - Sysadmin
readTime: 7 min
date: '2026-11-21'
---

When a Linux server exhausts both physical RAM and available swap space, the kernel triggers the **OOM Killer (*Out-of-Memory Killer*)** to prevent a total system freeze or kernel panic. For web applications, databases, and background workers, this appears as an abrupt termination with no application-level stack trace (`Killed`, `Exit Code 137`, or `oom-kill` in system logs).

## Quick Diagnostics

| Cause | Solution |
|---|---|
| **Memory leak in Node.js, Java, Python, or PHP-FPM** | Enforce `MemoryHigh=` and `MemoryMax=` in the service's `systemd` unit |
| **No swap space configured on a low-RAM VPS** | Provision a `swapfile` or `zram` device to absorb transient allocation spikes |
| **Critical services sacrificed before runaway apps** | Set `OOMScoreAdjust=-500` on essential daemons like PostgreSQL or SSHD |
| **Proactive termination by `systemd-oomd`** | Inspect PSI (*Pressure Stall Information*) metrics with `oomctl` and tune limits |

---

## Root Cause & Technical Mechanics of the OOM Killer

The Linux kernel continuously computes a badness heuristic called **`oom_score`** for every running process (exposed in `/proc/<PID>/oom_score`). Processes consuming a large fraction of physical RAM and swap receive higher scores.

When the kernel's `page allocator` fails to reclaim enough memory from the LRU (*Least Recently Used*) lists and filesystem page cache, it invokes `out_of_memory()`. The kernel picks the process with the highest `oom_score`, sends an uncatchable **`SIGKILL` (`kill -9`)**, and writes a full memory dump summary to the kernel ring buffer.

On modern distributions using **cgroups v2** and **`systemd-oomd`** (Ubuntu 22.04+, Fedora, Arch/CachyOS), terminations can also happen *before* global RAM hits zero if an individual cgroup exceeds its memory pressure threshold (*Memory PSI*).

---

## Step-by-Step Solution: Diagnose and Contain Memory Crashes

### Step 1: Confirm the OOM Killer Terminated the Process

Search the kernel ring buffer for `oom` or `Killed process` entries with human-readable timestamps:

```bash
sudo dmesg -T | grep -iE "oom|killed process|out of memory"
```

Also inspect `systemd` and `systemd-oomd` logs via `journalctl`:

```bash
sudo journalctl -k --since "24 hours ago" | grep -iE "oom-kill|killed process"
sudo journalctl -u systemd-oomd --since "24 hours ago"
```

Look for a line such as `Out of memory: Killed process 4812 (node) total-vm:4192840kB, anon-rss:1984212kB`, which pinpoints the exact binary and its resident memory footprint (`anon-rss`).

### Step 2: Protect Critical Daemons with `OOMScoreAdjust`

Prevent the kernel from killing essential infrastructure (such as your database or SSH daemon) when an application worker leaks memory. Create a `systemd` drop-in override:

```bash
sudo systemctl edit postgresql
```

Add a negative adjustment so the kernel avoids targeting it:

```ini
[Service]
OOMScoreAdjust=-500
```

### Step 3: Isolate the Faulty Application with `cgroups v2` Limits

Instead of allowing one runaway service to crash the entire host, constrain it to its own memory ceiling inside its `.service` unit:

```bash
sudo systemctl edit my-app.service
```

```ini
[Service]
MemoryAccounting=yes
MemoryHigh=1200M
MemoryMax=1536M
Restart=on-failure
RestartSec=5s
```

* **`MemoryHigh`**: Throttles memory allocations and forces aggressive page reclaim once the service crosses `1200M`, without killing it immediately.
* **`MemoryMax`**: Hard cap at `1536M`. If exceeded, the OOM Killer terminates **only processes inside this cgroup**, leaving the rest of the server untouched.

Reload `systemd` and restart the service:

```bash
sudo systemctl daemon-reload
sudo systemctl restart my-app.service
```

### Step 4: Verify Active Limits and Memory Pressure

Confirm that `cgroups v2` accounting is active and inspect live Memory PSI metrics:

```bash
systemctl show my-app.service -p MemoryCurrent,MemoryHigh,MemoryMax,OOMScoreAdjust
cat /proc/pressure/memory
```

---

## Frequently Asked Questions

### Why did the OOM Killer trigger when `free -h` showed available memory minutes earlier?
OOM events are often triggered by sub-second allocation spikes—such as an unpaginated SQL query, a bundler build step, or a sudden `fork()`—that exhaust free pages faster than standard monitoring intervals can sample.

### Will adding a large swap file permanently stop OOM crashes?
Swap will not cure an unbounded memory leak, as the process will eventually exhaust both RAM and swap. However, having a reasonable swap file or `zram` buffer gives the kernel room to page out idle anonymous memory during legitimate traffic bursts.

---

## Prevention Advice

* Set `MemoryHigh` and `MemoryMax` on every application service (`Node.js`, `Python`, `Java`, Docker containers) so leaks stay isolated to a single cgroup.
* Capture heap snapshots before restarting services whose `anon-rss` grows linearly over time.
* Maintain at least 2 GB of `zram` or `swapfile` on small VPS instances and configure alerts when available memory drops below 15%.

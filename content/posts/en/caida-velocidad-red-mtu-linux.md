---
title: "How to Diagnose and Fix Network Speed Issues by Adjusting MTU Size"
description: "Learn how to diagnose packet fragmentation and optimize the Maximum Transmission Unit (MTU) size of your network card."
category: "Systems & Servers"
tags: ["Network", "Linux", "Sysadmin"]
readTime: "4 min"
date: "2026-07-19"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Misconfigured MTU causing packet fragmentation** | Set MTU to 1500 (or 1492 for PPPoE): `ip link set dev eth0 mtu 1500` |
| **Failed network speed auto-negotiation** | Force Gigabit speed: `ethtool -s eth0 speed 1000 duplex full autoneg on` |


Intermittent network speed issues, interrupted downloads, or the inability to load certain secure web portals often occur due to a poor configuration of the **Maximum Transmission Unit (MTU)** size of your network card. If your provider requires packages smaller than your system's standard, intermediate routers must fragment the data, degrading performance.

## 🚀 Step-by-Step Solution

### Step 1: Diagnose packet fragmentation using ping tests
We are going to find the maximum packet size that your network can transfer without needing to split the data. Run the test by subtracting the 28-byte IP/ICMP header from your target:
```bash
# Test packet size on Linux (example for 1472 bytes of payload)
ping -M do -s 1472 8.8.8.8
```
*(If the terminal returns `Packet needs to be fragmented but DF set`, the packet is too large. Reduce the size in increments of 10 until finding the exact payload that does not fragment, e.g., 1420 bytes, then add the 28-byte header: `1420 + 28 = 1448 MTU`).*

### Step 2: Apply optimal MTU size to your network interface
Once the correct value is detected, configure your operating system's network interface (replace `eth0` with your active card):
```bash
# Temporarily set MTU on Linux
sudo ip link set dev eth0 mtu 1448

# Verify updated network parameters
ip link show eth0
```

## 🛡️ Prevention Tips

Recommended safety practices:
- Do not arbitrarily increase the MTU size to values higher than 1500 (Jumbo Frames) unless you are certain that all switches and routers in your local network support this feature via hardware. Configuring an oversized MTU will cause network requests to be completely dropped due to buffer mismatches, leaving your machine cut off immediately.

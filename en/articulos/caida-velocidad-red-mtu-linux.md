---
title: How to Diagnose and Fix Network Speed Issues by Adjusting MTU Size
description: >-
  Learn how to diagnose packet fragmentation and optimize the Maximum
  Transmission Unit (MTU) size of your network card.
category: Systems & Servers
tags:
  - Network
  - Linux
  - Sysadmin
readTime: 5 min
date: '2026-07-19'
---

Severe throughput drops, stalled SSH sessions, or TLS handshakes hanging mid-transfer are classic symptoms of a **Maximum Transmission Unit (MTU)** mismatch on Linux. When your NIC transmits frames larger than an upstream PPPoE link, WireGuard tunnel, or cloud VPC fabric can carry—and ICMP "Fragmentation Needed" packets are dropped—TCP connections stall or crawl at kilobytes per second.

## Quick Diagnostics

| Symptom / Cause | Immediate Action |
|---|---|
| **`ping -M do -s 1472` fails with `Message too long` / `Frag needed`** | Probe lower payloads to find Path MTU (`payload + 28`) |
| **PPPoE DSL or VLAN-tagged fiber dropping large packets** | Set interface MTU to `1492` or `1480` |
| **WireGuard / IPSec / GRE VPN choking on HTTPS traffic** | Lower tunnel MTU (e.g., `1420` for WireGuard) and clamp MSS |
| **NIC stuck at 100 Mbps half-duplex instead of 1 Gbps** | Inspect link negotiation with `ethtool eth0` |

## Root Cause & Technical Mechanics

Standard Ethernet frames carry a 1500-byte L3 MTU (20 bytes IPv4 header + 20 bytes TCP header + 1460 bytes MSS payload). However, encapsulation protocols shrink the available payload space: **PPPoE** consumes 8 bytes (max MTU `1492`), **WireGuard** over IPv4 consumes 60 bytes (`1420` recommended), and **VXLAN** in cloud overlays consumes 50 bytes (`1450`).

Normally, **Path MTU Discovery (PMTUD)** prevents oversized packets by setting the IP `Don't Fragment` (DF) bit; any router with a smaller egress MTU returns an `ICMP Type 3 Code 4 (Fragmentation Needed)` message so the sender shrinks its TCP segment size. Unfortunately, misconfigured firewalls frequently drop all ICMP traffic—creating a **PMTUD black hole**. Small packets like DNS queries and SSH keystrokes pass normally, while bulk data transfers and TLS certificates exceed the hidden bottleneck and silently time out.

## Step-by-Step Solution

### Step 1: Measure the exact Path MTU with `ping`

Identify your active network interface and current MTU:

```bash
ip -br link show
```

Run a binary-search `ping` test with the `Don't Fragment` flag (`-M do`) against a reliable external host (such as `8.8.8.8` or your VPN gateway). Remember that IPv4 + ICMP headers add **28 bytes** to the `-s` payload size (`1472 + 28 = 1500`):

```bash
ping -M do -c 3 -s 1472 8.8.8.8
```

If you see `ping: local error: message too long, mtu=1450` or 100% packet loss, reduce `-s` until replies succeed cleanly:

```bash
ping -M do -c 3 -s 1422 8.8.8.8
```

Once you find the highest working payload (for example, `1422`), add `28` to get your optimal MTU (`1450`).

### Step 2: Apply the MTU immediately and verify throughput

Set the discovered MTU on your active interface (replace `eth0` with your interface name, such as `enp3s0` or `wg0`):

```bash
sudo ip link set dev eth0 mtu 1450
ip link show dev eth0
```

Also verify physical link speed and duplexing to rule out bad cabling or auto-negotiation fallback:

```bash
sudo ethtool eth0 | grep -E "Speed|Duplex|Link detected"
```

### Step 3: Persist MTU across reboots and clamp TCP MSS

Temporary `ip link` changes reset on reboot. Persist the MTU in your distribution's network manager:

- **Netplan (Ubuntu Server)** — edit `/etc/netplan/01-netcfg.yaml`:
  ```yaml
  network:
    version: 2
    ethernets:
      eth0:
        dhcp4: true
        mtu: 1450
  ```
  Apply with `sudo netplan apply`.

- **NetworkManager (`nmcli`)**:
  ```bash
  sudo nmcli connection modify "Wired connection 1" 802-3-ethernet.mtu 1450
  sudo nmcli connection up "Wired connection 1"
  ```

If your Linux host acts as a router or VPN gateway for LAN clients, clamp TCP MSS to the Path MTU using `iptables` or `nftables` so downstream devices do not send oversized segments:

```bash
sudo iptables -t mangle -A FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu
```

## Frequently Asked Questions

**Should I enable Jumbo Frames (MTU 9000) to get faster internet speeds?**
No. Jumbo Frames only work on isolated local LANs or storage networks (iSCSI/NFS) where every switch, NIC, and router supports MTU 9000. On the public internet, MTU is capped at 1500.

**Why does `ping -M do -s 1472` work, yet WireGuard traffic still stalls?**
The outer physical interface may support 1500 bytes, while the virtual `wg0` tunnel adds 60–80 bytes of UDP/ChaCha20 overhead. Test Path MTU *through* the tunnel by pinging the remote WireGuard peer IP directly.

**How do I test Path MTU on IPv6?**
IPv6 headers are 40 bytes plus 8 bytes for ICMPv6 (48 bytes total). Use `ping -6 -M do -s 1452 2001:4860:4860::8888` to test a 1500-byte IPv6 path.

## Prevention Advice

- **Never block all ICMP traffic blindly:** Always allow `ICMP Type 3 Code 4` (IPv4) and `ICMPv6 Type 2` (Packet Too Big) in host and edge firewalls so PMTUD functions properly.
- **Document encapsulation overhead:** Explicitly set `MTU = 1420` (or `1380` over PPPoE) in WireGuard, OpenVPN, and Docker overlay networks.
- **Verify cloud VPC defaults:** AWS, GCP, and Hetzner private networks often use `1450` or `1460` MTU; match your container bridge MTU to the host interface.
- **Test after ISP or router changes:** Re-run `ping -M do` whenever switching from cable/fiber DHCP to PPPoE or adding VLAN tags.

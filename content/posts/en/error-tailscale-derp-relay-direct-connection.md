---
title: "How to Fix High Latency and Force Direct Connection in Tailscale (Bypass DERP Relays)"
description: "Experiencing high ping spikes above 200ms or slow transfer speeds in Tailscale? Learn how to fix DERP relay fallback and force direct WireGuard P2P tunnels."
category: "Systems & Servers"
tags: ["Tailscale", "WireGuard", "VPN", "Linux", "Sysadmin"]
readTime: "5 min"
date: "2026-09-24"
---

When connecting your Linux servers, development workstations, or mobile devices using **Tailscale**, the mesh network is engineered to establish direct, peer-to-peer (P2P) tunnels encrypted with **WireGuard**. However, when operating behind restrictive home firewalls, symmetric NAT, or ISP-level CGNAT, Tailscale's NAT traversal process may fail to negotiate a direct UDP path, causing connections to fall back onto centralized relay servers known as **DERP (Designated Encrypted Relay for Packets)**.

While DERP relays ensure your infrastructure maintains continuous connectivity even under difficult network topologies, routing traffic through third-party servers causes major performance degradation: network latency surges to 150-300ms+ and throughput drops significantly, impacting SSH responsiveness, remote database synchronization, and file backups.

## Quick Diagnostics

| Cause | Solution |
|---|---|
| **Host firewall or cloud security group blocking inbound UDP packets** | Allow UDP port `41641` in UFW/iptables and update cloud network security group rules |
| **Symmetric NAT or CGNAT preventing STUN port mapping** | Enable UPnP / NAT-PMP in your router settings or configure static port forwarding for `41641/udp` |

## 🚀 Step-by-Step Fixes

### Step 1: Diagnose if your traffic is routed through DERP relays

Before altering system firewall configurations, inspect the exact route Tailscale uses between your local node and the target peer. Run:

```bash
# Ping the target machine over Tailscale IP
tailscale ping 100.x.y.z
```

If the terminal output returns lines such as `via DERP(mad) in 184ms`, your packets are traversing through an external relay server (e.g. Madrid) rather than a direct socket connection.

To view the connection status across all configured peers:

```bash
tailscale status
```
Relayed connections will display a `; relay "..."` annotation alongside the peer entry.

### Step 2: Allow inbound traffic on UDP Port 41641

Tailscale defaults to listening on UDP port `41641` for WireGuard handshakes and packet transport. If your host firewall denies incoming unsolicited UDP traffic on this port, Tailscale will fail NAT traversal.

On Linux machines using **UFW**, allow the port:

```bash
# Whitelist default WireGuard/Tailscale port
sudo ufw allow 41641/udp
sudo ufw reload
```

If you manage firewall rules via **iptables** or firewalld:

```bash
# For iptables
sudo iptables -A INPUT -p udp --dport 41641 -j ACCEPT

# For firewalld (RHEL/Rocky/Fedora)
sudo firewall-cmd --permanent --add-port=41641/udp
sudo firewall-cmd --reload
```

### Step 3: Configure Port Forwarding or UPnP on your router

If your target host is behind a residential gateway or strict NAT router, Tailscale's STUN discovery mechanism might struggle to puncture the firewall without port mapping:

1. Access your router management dashboard (usually `192.168.1.1` or `192.168.0.1`).
2. Navigate to **Port Forwarding / Virtual Servers**.
3. Create a port forwarding rule:
   - **Protocol:** UDP
   - **External Port:** `41641`
   - **Internal Port:** `41641`
   - **Internal IP:** Your server's local LAN address (e.g., `192.168.1.50`).
4. Alternatively, verify that **UPnP** or **NAT-PMP** is enabled on the router to allow the `tailscaled` daemon to negotiate dynamic port bindings automatically.

### Step 4: Restart the Tailscale daemon and verify direct transport

After modifying firewall and network rules, restart the Tailscale daemon to trigger an immediate STUN re-evaluation:

```bash
# Restart the background daemon
sudo systemctl restart tailscaled

# Verify direct peer latency
tailscale ping 100.x.y.z
```

You should now receive an immediate response similar to:
```text
pong from my-server (100.x.y.z) via 198.51.100.24:41641 in 14ms (direct)
```
The **`(direct)`** indicator confirms that end-to-end P2P WireGuard communication is active with minimal latency.

## Prevention Advice

Recommended security practices:
- Regularly update Tailscale (`sudo apt update && sudo apt install tailscale`) to benefit from updated NAT traversal heuristics and disco improvements.
- In cloud environments (AWS, Hetzner, GCP), ensure security groups allow bidirectional UDP traffic on port `41641`.
- If running Docker on the host, ensure Docker's automatic iptables chains do not conflict with the `tailscale0` network interface.

## Frequently Asked Questions

### Does routing through DERP relays compromise my data encryption?
No. DERP relays are blind forwarders handling end-to-end encrypted WireGuard packets. Neither Tailscale nor relay server operators hold the private cryptographic keys of your nodes, ensuring zero decryption capability.

### Why do peers on the same local subnet route through DERP?
This commonly happens when the router has "Client Isolation" or "AP Isolation" enabled on Wi-Fi networks, preventing devices on the same subnet from talking directly over their private LAN IP addresses.

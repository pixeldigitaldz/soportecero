---
title: "Fix: Linux Boot Delay due to Timeout Error in NFS Network Mounts"
description: "Prevent your operating system from freezing for 90 seconds during boot when your NAS or local storage server is offline."
category: "Systems & Servers"
tags: ["NFS", "Network", "Sysadmin"]
readTime: "3 min"
date: "2026-07-31"
---

When you configure network shared folders using the NFS (Network File System) protocol to move movies or backups between your main computer and your home server, the `/etc/fstab` file attempts to connect to the external server during system boot. If the storage server is offline or there is no local network connection, Linux freezes the boot screen for a strict timeout of **90 seconds** before allowing you to log in.

## 🚀 Step-by-Step Solution

### Step 1: Modify network mount parameters
We will configure the system to treat the network mount as a non-critical secondary element that should not block the machine's boot process if it does not respond immediately.
1. Open your terminal and edit the configuration table:
```bash
sudo nano /etc/fstab
```
2. Locate the line pointing to your NFS network IP address. It will look similar to this: `192.168.1.50:/share /mnt/nfs nfs defaults 0 0`.
3. Modify the parameters section by replacing `defaults` with the following protection options:
```plaintext
192.168.1.50:/share /mnt/nfs nfs defaults,noauto,x-systemd.automount,x-systemd.device-timeout=5,timeo=14 0 0
```

### Step 2: Understand the new added variables
- `noauto`: Prevents the system from trying to establish the connection immediately upon booting.
- `x-systemd.automount`: Transparently mounts the shared folder at the exact millisecond you double-click the folder in the file manager.
- `x-systemd.device-timeout=5`: If the server does not respond within 5 seconds, it immediately gives up, allowing you to use your computer without delays.

## 🛡️ Prevention Advice

Recommended security practices:
- If you work with wireless local networks (Wi-Fi), never use rigid NFS mounts during the boot process of mobile devices or laptops. Since wireless connections take a few extra seconds to authenticate with the router after the desktop environment starts, automatic requests from fstab will systematically fail, leaving your shortcuts broken until you force a manual refresh using commands.

---
title: "How to Fix Flatpak Permission Denied Errors in Linux using Flatseal"
description: "Learn how to diagnose and grant filesystem, network, and device permissions to isolated Flatpak applications using terminal commands and Flatseal."
category: "Systems & Servers"
tags: ["Flatpak", "Linux", "Permissions"]
readTime: "4 min"
date: "2026-08-02"
---

**Permission Denied** errors in Flatpak applications occur because of Flatpak's built-in sandbox security architecture, which isolates programs from user filesystems, hardware GPUs/USB devices, and Linux system sockets unless explicit permissions are granted by the maintainer or user.

## 🔍 Quick Diagnostics

| Symptom | Root Cause | Solution |
|---|---|---|
| Flatpak app fails to read/write files in `/media` or external drives, or crashes when saving to custom paths | Strict default security sandbox boundaries enforced by Flatpak | Adjust application filesystem permissions using `flatpak override` via terminal or visually with **Flatseal** |

## 🚀 How to Fix the Error Step-by-Step

### Step 1: Identify the Application ID

To modify the sandbox rules of a Flatpak application, you need its reverse-DNS ID format (for instance `org.gimp.GIMP` or `com.visualstudio.code`). List installed applications:

```bash
# List all installed Flatpak applications
flatpak list --app
```

### Step 2: Grant local filesystem access via Flatpak CLI

If an application cannot access files stored on secondary storage drives or custom directories like `/mnt` or `/media`, grant access using the `override` command:

```bash
# Grant access to the entire host filesystem (Filesystem=host)
flatpak override com.visualstudio.code --filesystem=host

# Or grant permission to a specific folder path (e.g. /media/external_drive)
flatpak override com.visualstudio.code --filesystem=/media/external_drive
```

To reset overrides back to default package permissions:
```bash
flatpak override com.visualstudio.code --reset
```

### Step 3: Use Flatseal GUI (Recommended for Desktop users)

**Flatseal** is a graphical utility designed specifically for managing Flatpak permissions without terminal commands.

1. Install Flatseal from Flathub by running:
   ```bash
   flatpak install flathub com.github.tchx84.Flatseal
   ```
2. Launch **Flatseal** from your desktop environment's application menu (GNOME, KDE Plasma, etc.).
3. Select the affected application in the left sidebar.
4. Scroll to the **Filesystem** section and toggle **All user files** (`~/`) or add custom paths under **Other files**.

### Step 4: Fix hardware acceleration and socket access errors

If an application requires GPU acceleration (Vulkan/OpenGL) or audio server access (PipeWire/PulseAudio) and crashes on launch, enable system sockets:

```bash
# Grant access to display servers (X11 / Wayland) and rendering hardware
flatpak override <APP_ID> --socket=x11 --socket=wayland --device=dri
```

## 🛡️ Prevention Advice

- **Avoid indiscriminate `--filesystem=host` overrides**: Granting complete host filesystem access compromises the security benefits of sandboxing. Restrict overrides to specific directory paths whenever possible.
- **Utilize XDG Desktop Portals**: Modern Flatpak applications utilize XDG Portals for file pickers, eliminating the need for manually overriding filesystem permissions.
- **Use `--user` for per-user overrides**: On multi-user systems, restrict permissions to your user profile by appending `flatpak override --user`.

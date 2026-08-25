---
title: "How to Fix Missing HDMI Audio in Linux Using PipeWire"
description: "Step-by-step guide to resolving missing sound and unrecognized HDMI/DisplayPort audio profiles in Linux using PipeWire and WirePlumber."
category: "Gaming Tech"
tags: ["PipeWire", "Audio", "Linux", "WirePlumber", "HDMI", "SysAdmin"]
readTime: "5 min"
date: "2026-06-25"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **HDMI/DisplayPort audio profile marked as 'Off' or unrecognized by WirePlumber** | Switch soundcard profile to Digital Stereo (HDMI) using `pactl` or `pavucontrol` |
| **PipeWire daemon stalled or in race condition with legacy ALSA/PulseAudio** | Restart user service stack: `systemctl --user restart pipewire pipewire-pulse wireplumber` |

In modern Linux distributions utilizing the PipeWire multimedia framework, plugging in an external monitor or TV via HDMI/DisplayPort frequently results in no audio output. This happens when the WirePlumber session manager fails to dynamically switch the graphics card ALSA subdevice into an active digital playback profile.

## 🚀 Step-by-Step Solution

### Step 1: Restart PipeWire and WirePlumber User Services
Force an immediate hardware rescan across all connected display endpoints:
```bash
# Restart the PipeWire audio stack for the active user session
systemctl --user restart pipewire pipewire-pulse wireplumber

# Confirm active running status
systemctl --user status pipewire wireplumber --no-pager
```

### Step 2: List Soundcards and Assign HDMI Profiles
Enumerate your audio hardware and assign the digital output profile:
```bash
# Inspect all audio cards and available profiles
pactl list cards

# Apply Digital Stereo HDMI profile to target GPU sound card
pactl set-card-profile alsa_card.pci-0000_01_00.1 output:hdmi-stereo
```

### Step 3: Unmute HDMI Channels in ALSAmixer
Low-level ALSA driver defaults often initialize digital audio ports in a muted state:
1. Run `alsamixer` in your terminal.
2. Press `F6` to choose your graphics card (HDA NVidia / HDA ATI / Intel HDMI).
3. Navigate to the **S/PDIF** or **HDMI** outputs.
4. If marked as `MM` (Muted), hit the `M` key to toggle to `00` (Unmuted).

### Step 4: Set HDMI Sink as Global Default
Direct application audio streams to the HDMI endpoint:
```bash
# List available audio sinks
pactl list short sinks

# Set HDMI sink as system default
pactl set-default-sink alsa_output.pci-0000_01_00.1.hdmi-stereo
```

## 🛡️ Prevention Advice
- **Avoid concurrent PulseAudio daemon packages:** Ensure `pulseaudio-server` is completely uninstalled to prevent port conflicts with `pipewire-pulse`.
- **Configure WirePlumber persistence:** Add custom scripts in `~/.config/wireplumber/` to automatically enforce preferred profiles on display hotplug events.

## ❓ Frequently Asked Questions (FAQ)

### Why does HDMI audio vanish after waking from sleep?
Displays sleep their internal DACs when entering standby. Disable ALSA node autosuspension in WirePlumber configuration to maintain a persistent connection.

### How do I test sound from the command line?
Run `speaker-test -t wav -c 2` to verify immediate multi-channel stereo playback.

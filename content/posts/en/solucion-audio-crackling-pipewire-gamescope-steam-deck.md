---
title: "[SOLVED] Audio Crackling, Popping & Stuttering with PipeWire & Gamescope on Linux"
description: "Fix audio crackling, popping, and static stuttering when gaming with PipeWire, Gamescope, and Proton on Steam Deck and Linux PCs."
category: "Gaming Tech"
tags: ["PipeWire","Audio","SteamDeck","Linux"]
readTime: "4 min"
date: "2026-09-29"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Audio buffer quantum is configured too aggressively, inducing buffer underruns (xruns)** | Enforce a stable 1024 quantum buffer size in PipeWire user settings |
| **Sampling rate mismatch between the PipeWire graph (48kHz) and the game process** | Standardize clock rate and disable aggressive ALSA resampling in pipewire.conf.d |

When gaming on Linux (Steam Deck, Bazzite, Fedora, Arch) through Gamescope or Proton, players often notice metallic clicking, static pops, or sound cutting out (*audio crackling*). This annoyance is rooted in **xruns** (buffer underruns), where PipeWire fails to deliver rendered audio buffers within the tight deadline demanded by the sound card.

> **Quick Solution (1 Minute):**
> 1. Enforce a resilient audio quantum in runtime:
>    `pw-metadata -n settings 0 clock.force-quantum 1024`
> 2. Restart user audio services:
>    `systemctl --user restart pipewire pipewire-pulse`

## 🚀 Step-by-Step Solution

### Step 1: Detect Audio Buffer Underruns (xruns) Live
Run the interactive PipeWire performance profiler while your game is active:
```bash
pw-top
```
Observe the **ERR** column. If counter values increment in tandem with audible pops, your system is dropping audio frames due to buffer starvation.

### Step 2: Configure a Resilient Audio Quantum Latency Profile
Create a dedicated configuration drop-in file to enforce stable buffer sizes:
```bash
mkdir -p ~/.config/pipewire/pipewire.conf.d/
nano ~/.config/pipewire/pipewire.conf.d/99-quantum-latency.conf
```
Add the following blocks:
```plaintext
context.properties = {
    default.clock.rate = 48000
    default.clock.quantum = 1024
    default.clock.min-quantum = 512
    default.clock.max-quantum = 2048
}
```

### Step 3: Tune ALSA and Proton Wine Audio Emulation
Games running under Proton interface through ALSA or PulseAudio bridges. Prevent resampling distortions:
```bash
mkdir -p ~/.config/pipewire/client.conf.d/
nano ~/.config/pipewire/client.conf.d/alsa-resample.conf
```
Paste:
```plaintext
alsa.properties = {
    alsa.deny = false
    alsa.format = "S16LE"
    alsa.rate = 48000
}
```
Apply the adjustments by restarting user audio daemons:
```bash
systemctl --user restart pipewire pipewire-pulse wireplumber
```

## 🛡️ Prevention Tips
* Avoid forcing ultralow latency buffers (64 or 128) during intensive 3D gaming.
* Ensure `rtkit` is running to grant PipeWire real-time scheduling priority under load.

## Frequently Asked Questions

### Does a 1024 quantum introduce noticeable input lag?
At 48 kHz, a 1024 sample window equals approximately 21 milliseconds of total audio latency—completely unnoticeable during gameplay while eliminating pops.

### How do I revert custom PipeWire overrides?
Delete the custom files in `~/.config/pipewire/` and reload with `systemctl --user restart pipewire`.

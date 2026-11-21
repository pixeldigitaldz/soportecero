---
title: >-
  Audio Crackling, Popping & Stuttering with PipeWire & Gamescope on
  Linux
description: >-
  Fix audio crackling, popping, and static stuttering when gaming with PipeWire,
  Gamescope, and Proton on Steam Deck and Linux PCs.
category: Gaming Tech
tags:
  - PipeWire
  - Audio
  - SteamDeck
  - Linux
readTime: '6 min'
date: '2026-09-29'
---

Metallic clicking, robotic distortion, and static pops when launching games through Proton or Gamescope on Steam Deck, Bazzite, Fedora, or Arch Linux are almost always caused by **PipeWire xruns** (audio buffer underruns). When the audio graph fails to deliver a filled PCM buffer to the ALSA sink before the hardware ring buffer empties, the sound card repeats or zeroes out samples—producing audible clicks.

## Quick Diagnostics

| Symptom / Cause | Immediate Action |
|---|---|
| **`ERR` counter climbing in `pw-top` during gameplay** | Raise `default.clock.quantum` to `1024` or `2048` |
| **Crackling only after waking Steam Deck from sleep** | Set `PULSE_LATENCY_MSEC=60` in Steam launch options |
| **Distortion in specific Proton/Wine titles** | Lock `alsa.rate = 48000` in PipeWire client config |
| **Audio glitches during CPU shader compilation spikes** | Verify `rtkit-daemon` is active for real-time priority |

## Root Cause & Technical Mechanics

PipeWire schedules audio nodes in a single processing graph driven by a **quantum** (number of samples per cycle) and a **clock rate** (typically `48000` Hz). By default, PipeWire dynamically scales the quantum down to `128` or `256` samples (~2.6 ms–5.3 ms) when low-latency clients request it.

Under heavy 3D gaming—especially inside **Gamescope** (micro-compositor) + **Proton/Wine**—two bottlenecks collide:
1. **CPU Scheduling Starvation:** When a game saturates all CPU threads compiling DXVK/VKD3D shaders, a 256-sample deadline (5.3 ms) is too tight for the Wine audio bridge (`winepulse` or `winealsa`) to wake up and write its buffer, causing continuous xruns.
2. **Sample Rate Mismatches:** Many Windows games output `44100` Hz audio while PipeWire's hardware sink runs at `48000` Hz. If WirePlumber or Wine repeatedly resamples or switches node clocks mid-frame, the ALSA driver resets the stream and emits a sharp pop.

## Step-by-Step Solution

### 1. Measure Live Buffer Underruns with `pw-top`

Launch your game, open a terminal (or SSH into your Steam Deck), and monitor PipeWire's real-time profiler:

```bash
pw-top
```

Watch the **`ERR`** column next to your game stream (`wine64-preloader` or `proton`) and your hardware sink (`alsa_output.*`). If `ERR` increments every time you hear a pop, and `QUANT` is sitting at `128`, `256`, or `512`, your buffer window is too small for the CPU load.

### 2. Enforce a Stable Quantum Profile (`1024` Samples)

Create a user-level PipeWire drop-in file so PipeWire never drops below a safe gaming floor:

```bash
mkdir -p ~/.config/pipewire/pipewire.conf.d/
cat << 'EOF' > ~/.config/pipewire/pipewire.conf.d/99-gaming-quantum.conf
context.properties = {
    default.clock.rate          = 48000
    default.clock.allowed-rates = [ 44100 48000 ]
    default.clock.quantum       = 1024
    default.clock.min-quantum   = 512
    default.clock.max-quantum   = 2048
}
EOF
```

### 3. Stabilize Wine/Proton PulseAudio Bridge Latency

For games that still crackle after resuming from suspend or during heavy loading screens, add `PULSE_LATENCY_MSEC` to the game's **Steam -> Properties -> Launch Options**:

```bash
PULSE_LATENCY_MSEC=60 %command%
```

To fix resampling glitches globally for ALSA-bridged applications, create a client drop-in:

```bash
mkdir -p ~/.config/pipewire/client.conf.d/
cat << 'EOF' > ~/.config/pipewire/client.conf.d/99-alsa-gaming.conf
alsa.properties = {
    alsa.format = "S16LE"
    alsa.rate   = 48000
}
EOF
```

### 4. Restart Audio Daemons and Verify Real-Time Priority

Reload PipeWire, WirePlumber, and verify `rtkit` is granting real-time scheduling:

```bash
systemctl --user restart pipewire pipewire-pulse wireplumber
systemctl status rtkit-daemon --no-pager
```

Re-run `pw-top` in-game and confirm `QUANT` stays at `1024` (or `512`) and `ERR` remains `0`.

## Frequently Asked Questions

### Will setting `default.clock.quantum = 1024` create noticeable audio lag?
No. At `48000` Hz, `1024` samples equals `21.3 ms` of buffer latency—well below human perception for single-player and action games, while completely eliminating xruns.

### Why does Steam Deck audio crackle specifically after waking from sleep?
Suspending the APU pauses PipeWire's ALSA clock while Wine's `dsound`/`wasapi` ring buffer stays out of sync upon resume. Setting `PULSE_LATENCY_MSEC=60` gives `winepulse` enough headroom to resynchronize pointers cleanly.

### Should I disable power saving on the sound card (`snd_hda_intel`)?
Yes, if you hear a sharp "pop" right when audio starts or stops after silence. Disable codec power-saving with `options snd_hda_intel power_save=0` in `/etc/modprobe.d/audio-powersave.conf`.

## Prevention Advice

- **Avoid forcing `64` or `128` quantum globally:** Reserve ultra-low-latency quantums for DAW/music production profiles, not 3D gaming.
- **Keep `rtkit` installed and enabled:** Without `rtkit-daemon`, PipeWire runs at normal user nice priority and loses CPU time to shader compilers.
- **Prefer native 48 kHz HDMI/USB DAC output:** If using an external USB DAC, verify its supported rates via `cat /proc/asound/card*/stream0` so PipeWire does not thrash clock rates.
- **Test changes incrementally:** Keep custom overrides isolated in `~/.config/pipewire/pipewire.conf.d/` rather than editing `/usr/share/pipewire/`, which gets overwritten on package updates.

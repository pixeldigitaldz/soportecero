---
title: "How to Fix HDMI Audio Loss in Linux Using PipeWire"
description: "Learn how to restore digital sound output from your HDMI-connected monitor or TV without having to restart your computer."
category: "Systems & Servers"
tags: ["Linux", "PipeWire", "Audio"]
readTime: "3 min"
date: "2026-07-22"
---

The sudden loss of sound output through the HDMI port (leaving the TV or monitor muted) typically occurs after suspending and waking up the machine, or when changing screens. This happens because the PipeWire sound server loses synchronization of the HDMI port's digital link descriptor with the kernel's ALSA graphic controller.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Reiniciar el servidor de sonido PipeWire y su gestor de enlaces
It is not necessary to restart your computer to restore the audio channel. You can force PipeWire to rescan the video outputs by running the following commands in your user terminal (without using sudo):
```bash
# Reiniciar el servicio principal de PipeWire y el subsistema de compatibilidad de PulseAudio
systemctl --user restart pipewire pipewire-pulse

# Reiniciar el planificador de rutas de audio (WirePlumber o Media Session)
systemctl --user restart wireplumber
```
*(Nota: Transcurridos un par de segundos, los controladores gráficos volverán a detectar la interfaz de sonido HDMI activa).*

### Paso 2: Forzar la salida de audio digital correcta
Open your system volume mixer or sound settings panel and make sure that the HDMI port is selected under the corresponding profile output (typically *Digital Stereo (HDMI) Output* or *Digital Surround*).

## 🛡️ Consejo de Prevención

Recommended safety practices:
- Avoid duplicate or conflicting audio profiles that confuse the PipeWire sound router. We recommend installing the graphical tool `pavucontrol` and, in the **Configuration** tab, disabling (changing to **Off**) all internal analog audio cards, headphone outputs, or other digital audio profiles that you are not using. This ensures that the HDMI output is prioritized and remains stable during hardware reconnections.

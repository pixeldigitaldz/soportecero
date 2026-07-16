---
title: "How to reduce input lag for competitive gaming in Linux"
description: "Optimize latency and the response of your peripherals by configuring the Wayland or X11 graphics server and system power profiles."
category: "Gaming Tech"
tags: ["Gaming", "Linux", "Performance"]
readTime: "4 min"
date: "2026-08-06"
---

Excessive input delay or *input lag* when playing competitive titles on Linux occurs due to the accumulation of buffers in the graphics composition server (especially in Wayland with forced vertical synchronization) and due to the default active power saving configuration that suspends or slows down the response frequency of USB ports.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Configurar la frecuencia de sondeo (polling rate) de tus periféricos
To make your competitive mouse and keyboard respond instantly, force the kernel driver to use a constant refresh rate of 1000 Hz on the USB ports:
```bash
# Crear un archivo de reglas para el módulo del ratón USB
echo "options usbhid mousepoll=1" | sudo tee /etc/modprobe.d/usbhid.conf

# Recargar el módulo HID para aplicar los cambios de inmediato
sudo rmmod usbhid && sudo modprobe usbhid
```

### Paso 2: Desactivar la sincronización vertical y activar desgarro (tearing) en Wayland
If you use KDE Plasma or GNOME environments under Wayland, vertical synchronization adds latency. Allow screen tearing in full-screen games to eliminate render delay:
```bash
# En KDE Plasma 6, añade esta regla a tu configuración local para permitir Tearing
kwriteconfig6 --file kwinrc --group Wayland --key AllowTearing true

# Reiniciar el compositor gráfico para aplicar
systemctl --user restart plasma-kwin_wayland
```

### Paso 3: Configurar el daemon de energía en modo Rendimiento
Prevent the Linux processor regulator from reducing the clock frequency of the system data bus during your game sessions:
```bash
# Cambiar el perfil de energía del sistema a alto rendimiento
powerprofilesctl set performance

# Verificar que el perfil se haya activado correctamente
powerprofilesctl get
```

## 🛡️ Consejo de Prevención

Recommended security practices:
- Do not configure polling rates higher than 1000 Hz (like 4000 Hz or 8000 Hz mice) if your processor does not have at least 6 modern dedicated physical cores. An oversized polling rate will consume massive processor cycles to constantly handle USB port interrupts, which will result in sudden graphic stutters (*frame drops*) and a lower average FPS rate during your game sessions.

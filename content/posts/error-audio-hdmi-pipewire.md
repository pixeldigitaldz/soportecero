---
title: "Cómo reparar la pérdida de audio por HDMI en Linux usando PipeWire"
description: "Aprende a solucionar la falta de sonido o perfil ausente por HDMI/DisplayPort en Linux usando PipeWire y WirePlumber paso a paso."
category: "Gaming Tech"
tags: ["PipeWire", "Audio", "Linux", "WirePlumber", "HDMI", "SysAdmin"]
readTime: "5 min"
date: "2026-06-25"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Perfil de audio HDMI/DisplayPort marcado como 'Off' o no detectado por WirePlumber** | Cambiar el perfil de la tarjeta de sonido a Digital Stereo (HDMI) con `pactl` o `pavucontrol` |
| **Daemon de PipeWire bloqueado o en conflicto con ALSA/PulseAudio heredado** | Reiniciar los servicios de usuario: `systemctl --user restart pipewire pipewire-pulse wireplumber` |

En distribuciones Linux modernas con PipeWire, es habitual que al conectar un monitor por HDMI o DisplayPort, el sistema no emita sonido o el dispositivo no aparezca en la lista de salidas de audio. Esto ocurre cuando el gestor de sesiones WirePlumber no activa automáticamente la salida digital de la tarjeta gráfica o el subsistema ALSA mantiene el endpoint en estado suspendido.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Reiniciar los servicios de usuario de PipeWire y WirePlumber
Reinicia los daemons de audio para forzar un re-escaneo de todos los dispositivos conectados por hardware:
```bash
# Reiniciar el stack de audio PipeWire para la sesión de usuario actual
systemctl --user restart pipewire pipewire-pulse wireplumber

# Verificar que todos los servicios estén activos (active/running)
systemctl --user status pipewire wireplumber --no-pager
```

### Paso 2: Listar tarjetas de audio y activar el perfil HDMI correcto
Identifica el identificador de la tarjeta gráfica y cambia su perfil a estéreo digital:
```bash
# Listar todas las tarjetas de audio y sus perfiles disponibles
pactl list cards

# Forzar el perfil Digital Stereo HDMI (reemplaza <numero_tarjeta> y <perfil_hdmi>)
# Ejemplo: pactl set-card-profile alsa_card.pci-0000_01_00.1 output:hdmi-stereo
pactl set-card-profile 0 output:hdmi-stereo
```

### Paso 3: Desmutear canales HDMI mediante ALSAmixer
En ocasiones, el driver del kernel ALSA silencia la salida digital por defecto:
1. Ejecuta `alsamixer` en tu terminal.
2. Presiona `F6` y selecciona tu tarjeta gráfica (HDA NVidia / HDA ATI / Intel HDMI).
3. Desplázate hasta las salidas **S/PDIF** o **HDMI**.
4. Si aparecen con las letras `MM` (Mute), presiona la tecla `M` para desmutearlas (cambiarán a `00`).

### Paso 4: Establecer el sink de salida HDMI como predeterminado
Asegura que las aplicaciones dirijan su flujo de audio al endpoint HDMI:
```bash
# Listar los sinks (salidas) disponibles
pactl list short sinks

# Establecer la salida HDMI como predeterminada
pactl set-default-sink alsa_output.pci-0000_01_00.1.hdmi-stereo
```

## 🛡️ Consejos de Prevención
- **No instales pulseaudio junto con pipewire-pulse:** Tener ambos paquetes instalados genera condiciones de carrera (race conditions) en el puerto de control de audio.
- **Mantén actualizadas las reglas de WirePlumber:** En `~/.config/wireplumber/` puedes definir reglas personalizadas para fijar el perfil HDMI cada vez que se detecte una pantalla externa.

## ❓ Preguntas Frecuentes (FAQ)

### ¿Por qué mi televisor HDMI se desconecta al suspender el equipo?
Las pantallas HDMI suspenden su receptor de audio al entrar en reposo. Para forzar a PipeWire a mantener el enlace abierto, desactiva el autosuspend de ALSA en las configuraciones de WirePlumber.

### ¿Cómo pruebo el sonido desde la terminal?
Ejecuta: `speaker-test -t wav -c 2` para comprobar la reproducción estéreo directa en los altavoces.

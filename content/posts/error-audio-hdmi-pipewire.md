---
title: "Cómo reparar la pérdida de audio por HDMI en Linux usando PipeWire"
description: "Aprende a restablecer la salida de sonido digital de tu monitor o televisor conectado por HDMI sin necesidad de reiniciar tu computadora."
category: "Sistemas y Servidores"
tags: ["Linux", "PipeWire", "Audio"]
readTime: "3 min"
date: "2026-06-27"
---

La pérdida repentina de salida de sonido a través del puerto HDMI (quedando el televisor o monitor mudo) suele ocurrir tras suspender y despertar el equipo, o al cambiar de pantalla. Esto sucede porque el servidor de sonido PipeWire pierde la sincronización del descriptor de enlace digital del puerto HDMI con el controlador gráfico ALSA del kernel.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Reiniciar el servidor de sonido PipeWire y su gestor de enlaces
No es necesario reiniciar la computadora para restablecer el canal de audio. Puedes forzar a PipeWire a escanear nuevamente las salidas de video ejecutando los siguientes comandos en tu terminal de usuario (sin usar sudo):
```bash
# Reiniciar el servicio principal de PipeWire y el subsistema de compatibilidad de PulseAudio
systemctl --user restart pipewire pipewire-pulse

# Reiniciar el planificador de rutas de audio (WirePlumber o Media Session)
systemctl --user restart wireplumber
```
*(Nota: Transcurridos un par de segundos, los controladores gráficos volverán a detectar la interfaz de sonido HDMI activa).*

### Paso 2: Forzar la salida de audio digital correcta
Abre tu mezclador de volumen o panel de sonido del sistema y asegúrate de que el puerto HDMI esté seleccionado bajo la salida de perfil correspondiente (típicamente *Digital Stereo (HDMI) Output* o *Digital Surround*).

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
- Evita la existencia de perfiles de audio duplicados o conflictivos que confundan al enrutador de sonido de PipeWire. Te recomendamos instalar la herramienta gráfica `pavucontrol` y, en la pestaña de **Configuración**, cambiar a la opción **Apagado (Off)** todas las tarjetas de audio internas analógicas, salidas de audífonos u otros perfiles de audio digital que no estés utilizando. Esto asegura que la salida HDMI sea priorizada y permanezca estable ante reconexiones de hardware.

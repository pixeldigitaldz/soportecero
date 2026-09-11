---
title: "[SOLUCIONADO] Chasquidos y cortes de audio en PipeWire y Gamescope en Steam Deck y Linux"
description: "Aprende a solucionar el audio crackling, chasquidos y retrasos de sonido al jugar con PipeWire, Gamescope y Proton en Linux."
category: "Gaming Tech"
tags: ["PipeWire","Audio","SteamDeck","Linux"]
readTime: "4 min"
date: "2026-09-29"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Tamaño del búfer de audio (quantum) demasiado bajo para la carga del juego, causando sobrecargas de búfer (xruns)** | Configurar un quantum fijo de 1024 o 2048 en la configuración de PipeWire |
| **Discordancia de frecuencia de muestreo entre el servidor PipeWire (48kHz) y el juego (44.1kHz)** | Establecer la tasa de muestreo fija en pipewire.conf y alsa.conf |

Al jugar en Linux con Steam Deck, ordenadores portátiles gaming o distribuciones de escritorio modernas (Fedora, Arch, Bazzite), es muy común escuchar chasquidos metálicos, ruidos de estática o pequeños saltos en el sonido (*audio crackling / popping*). Este fallo ocurre por la aparición de **xruns** (buffer underruns), donde el servidor de sonido PipeWire no recibe paquetes de audio a tiempo debido a la latencia del renderizado.

> **Solución Rápida (1 Minuto):**
> 1. Fija el quantum de latencia de PipeWire para evitar xruns:
>    `pw-metadata -n settings 0 clock.force-quantum 1024`
> 2. Reinicia los servicios de audio de usuario:
>    `systemctl --user restart pipewire pipewire-pulse`

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Comprobar la aparición de xruns en tiempo real
Ejecuta la herramienta de monitoreo de PipeWire mientras juegas para confirmar si el sonido está perdiendo paquetes:
```bash
pw-top
```
Fíjate en la columna **ERR** (errores). Si el número sube constantemente cada vez que escuchas un chasquido, tu búfer de audio es demasiado pequeño para la carga de trabajo.

### Paso 2: Configurar un tamaño de búfer de audio estable (Quantum)
Crea un archivo de configuración de usuario para forzar un búfer equilibrado de 1024 muestras (aproximadamente 21 ms de latencia a 48 kHz, totalmente imperceptible):
```bash
mkdir -p ~/.config/pipewire/pipewire.conf.d/
nano ~/.config/pipewire/pipewire.conf.d/99-quantum-latency.conf
```
Pega la siguiente configuración:
```plaintext
context.properties = {
    default.clock.rate = 48000
    default.clock.quantum = 1024
    default.clock.min-quantum = 512
    default.clock.max-quantum = 2048
}
```

### Paso 3: Ajustar la compatibilidad ALSA para juegos en Proton
Muchos juegos de Windows emulados con Proton se comunican a través del puente `pipewire-pulse` o `pipewire-alsa`. Ajusta el archivo de ALSA:
```bash
mkdir -p ~/.config/pipewire/client.conf.d/
nano ~/.config/pipewire/client.conf.d/alsa-resample.conf
```
Añade:
```plaintext
alsa.properties = {
    alsa.deny = false
    alsa.format = "S16LE"
    alsa.rate = 48000
}
```
Aplica los cambios reiniciando los servicios de audio del usuario:
```bash
systemctl --user restart pipewire pipewire-pulse wireplumber
```

## 🛡️ Consejo de Prevención
* Evita forzar tasas de quantum extremas (como 64 o 128) a menos que estés produciendo música profesional en tiempo real.
* Asegúrate de que el planificador de tiempo real (wireplumber y rtkit) tenga permisos para elevar la prioridad del hilo de audio.

## Preguntas Frecuentes

### ¿Afecta un quantum de 1024 al retardo del juego?
A 48.000 Hz, un búfer de 1024 muestras añade apenas 21 milisegundos de latencia, lo cual es indetectable para el oído humano y garantiza un audio 100% libre de cortes.

### ¿Cómo restauro la configuración de audio por defecto?
Simplemente elimina los archivos que creaste en `~/.config/pipewire/` y reinicia con `systemctl --user restart pipewire`.

---
title: "Guía: Error de audio distorsionado o sin sonido en Warframe bajo Proton Linux"
description: "Aprende a solucionar el audio entrecortado, crujidos (crackling) y falta de sonido en Warframe con Proton, FAudio y PipeWire."
category: "Gaming Tech"
tags: ["Warframe", "Proton", "Linux", "Gaming", "Audio", "Steam Deck"]
readTime: "5 min"
date: "2026-06-25"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Frecuencia de muestreo (sample rate) incompatible o tamaño de búfer de audio bajo en PipeWire/PulseAudio** | Configurar frecuencia fija a 48000 Hz y ajustar `default.clock.min-quantum` a 1024 en PipeWire |
| **Incompatibilidad en bibliotecas de decodificación de audio XAudio2/FAudio en el prefijo de Proton** | Utilizar Proton-GE y añadir `WINEDLLOVERRIDES="xaudio2_7=n,b"` en las opciones de lanzamiento |

Al ejecutar Warframe en Linux mediante Steam Proton o en Steam Deck, los jugadores a menudo experimentan audio distorsionado, crujidos constantes (crackling) o ausencia total de sonido en cinemáticas y combate. Esto ocurre por desajustes en el búfer de latencia entre el motor de sonido de Warframe (Wwise/XAudio2) y el servidor de sonido del sistema anfitrión.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Configurar la frecuencia de muestreo de PipeWire a 48000 Hz
La mayoría de motores de videojuegos modernos esperan una frecuencia de reloj estándar de 48 kHz. Evita el remuestreo forzando estos parámetros en `~/.config/pipewire/pipewire.conf` o mediante variables de entorno:
```bash
# Configurar latencia y reloj óptimos en la sesión de usuario
pw-metadata -n settings 0 clock.force-rate 48000
pw-metadata -n settings 0 clock.force-quantum 1024
```

### Paso 2: Usar GE-Proton y forzar bibliotecas nativas de XAudio2
El empaquetado comunitario GE-Proton integra parches actualizados de FAudio y WINE XAudio2:
1. En Steam, abre las propiedades de **Warframe > Compatibilidad**.
2. Selecciona la versión más reciente de **GE-Proton**.
3. En la pestaña **General > Parámetros de lanzamiento**, añade:
```bash
WINEDLLOVERRIDES="xaudio2_7=n,b" PULSE_LATENCY_MSEC=60 %command%
```
- `PULSE_LATENCY_MSEC=60`: Añade un pequeño margen de búfer para evitar cortes por subdesbordamiento (buffer underrun).

### Paso 3: Ajustar el motor de audio en el lanzador de Warframe
1. Al abrir el launcher de Warframe en Steam, pulsa en el icono de engranaje (Ajustes).
2. Desactiva la opción **Audio de 64 bits** si tu tarjeta de sonido sufre chasquidos.
3. Asegúrate de que el modo de salida esté configurado en **Altavoces 2.0 / Auriculares estéreo**.

### Paso 4: Eliminar prefijos de WINE corruptos si persiste el fallo
Si tras actualizar Proton el audio sigue mudo, borra el prefijo local del juego para que Steam lo regenere limpio:
```bash
# El AppID oficial de Warframe en Steam es 230410
rm -rf ~/.local/share/Steam/steamapps/compatdata/230410
```

## 🛡️ Consejos de Prevención
- **No uses frecuencias de 96 kHz o 192 kHz sin necesidad:** Las frecuencias de estudio muy altas saturan la capa de traducción WINE y aumentan el consumo de CPU innecesariamente.
- **Mantén actualizados los paquetes de WirePlumber:** Los parches recientes eliminan fallos de sincronización con clientes de 32 y 64 bits.

## ❓ Preguntas Frecuentes (FAQ)

### ¿Por qué el audio cruje solo cuando hay muchas explosiones en pantalla?
Porque la CPU entra en picos de alta carga y se produce un "underrun" de búfer. Aumentar `PULSE_LATENCY_MSEC=90` soluciona este problema de inmediato.

### ¿Se pierde el progreso de mi cuenta al borrar compatdata?
No. El progreso de Warframe se guarda en los servidores de Digital Extremes en la nube.

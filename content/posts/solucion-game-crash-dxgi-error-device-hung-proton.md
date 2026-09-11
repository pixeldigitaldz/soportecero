---
title: "[SOLUCIONADO] Error DXGI_ERROR_DEVICE_HUNG en juegos con Proton y Steam en Linux"
description: "Guía para reparar el crasheo fatal DXGI_ERROR_DEVICE_HUNG al jugar títulos DirectX 11 y 12 a través de Proton y VKD3D en Linux."
category: "Gaming Tech"
tags: ["Proton","Steam","Linux","Vulkan"]
readTime: "4 min"
date: "2026-09-27"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **TDR (Timeout Detection and Recovery) del kernel de la GPU al superar el tiempo de respuesta esperado** | Ajustar las variables de sincronización de VKD3D y habilitar PROTON_ENABLE_NVAPI=1 |
| **Incompatibilidad de memoria VRAM o overclocking inestable en la tarjeta de video** | Reducir la calidad de texturas un nivel y usar Proton Experimental o Proton GE |

Al ejecutar juegos modernos de Steam en Linux con Proton (como Cyberpunk 2077, God of War, Apex Legends o Elden Ring), el juego se congela repentinamente arrojando una ventana de error de Unreal Engine o DirectX: `Fatal error: The GPU device has been suspended or hung: DXGI_ERROR_DEVICE_HUNG (0x887A0006)`. Esto indica que el controlador gráfico perdió comunicación con el hardware de la GPU.

> **Solución Rápida (1 Minuto):**
> 1. Añade este parámetro de lanzamiento en Steam:
>    `VKD3D_CONFIG=dxr11,no_upload_hvv %command%`
> 2. Si tienes GPU NVIDIA, activa compatibilidad NVAPI:
>    `PROTON_ENABLE_NVAPI=1 %command%`

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Optimizar los parámetros de renderizado de VKD3D-Proton
VKD3D traduce llamadas de DirectX 12 a Vulkan. En juegos con alta demanda de ancho de banda, puedes estabilizar la canalización agregando estas directivas en las *Propiedades* del juego en Steam -> *Parámetros de lanzamiento*:
```bash
VKD3D_CONFIG=no_upload_hvv %command%
```
Esto evita que el traductor agote la memoria de intercambio de host a dispositivo en ciertas tarjetas gráficas.

### Paso 2: Ajustar la configuración de sincronización de Proton
Si el cuelgue ocurre por desincronización de hilos en procesadores multinúcleo, cambia a Proton GE (GloriousEggroll) o activa la biblioteca de sincronización `winesync` / `fsync`:
```bash
PROTON_NO_ESYNC=1 PROTON_USE_FSYNC=1 %command%
```

### Paso 3: Controlar el consumo de VRAM y la temperatura de la GPU
El error `DEVICE_HUNG` ocurre frecuentemente cuando un juego excede el 98% de la memoria VRAM física, obligando a la GPU a volcar datos en la memoria RAM lenta del sistema.
1. Entra a las opciones gráficas del juego y baja la calidad de las texturas de *Ultra* a *Alto*.
2. Desactiva el Ray Tracing si tu tarjeta dispone de 8 GB o menos de memoria VRAM.
3. Si utilizas perfiles de overclock en Linux (con programas como GreenWithEnvy o CoreCtrl), restablece los relojes a los valores de fábrica.

## 🛡️ Consejo de Prevención
* Actualiza regularmente tu distribución a los controladores gráficos más recientes (controladores NVIDIA 555+ con Explicit Sync o paquetes Mesa 24+).
* Comprueba si el juego funciona mejor con una versión específica de Proton seleccionándola en la pestaña *Compatibilidad* de Steam.

## Preguntas Frecuentes

### ¿Qué significa exactamente el código 0x887A0006 en DirectX?
Es el identificador hexadecimal de DXGI_ERROR_DEVICE_HUNG. Significa que el dispositivo de hardware de la tarjeta gráfica dejó de responder a comandos y el controlador lo reinició por seguridad.

### ¿Funciona este error igual en tarjetas AMD que en NVIDIA?
En AMD suele registrarse en dmesg como "amdgpu: ring gfx timeout". En NVIDIA se manifiesta con reinicio del módulo de kernel nvidia-modeset.

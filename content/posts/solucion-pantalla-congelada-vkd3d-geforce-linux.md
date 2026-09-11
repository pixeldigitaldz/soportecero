---
title: "[SOLUCIONADO] Pantalla congelada o cuelgue en juegos DirectX 12 con NVIDIA en Linux"
description: "Soluciona los congelamientos y caídas a escritorio en juegos DirectX 12 que utilizan VKD3D-Proton con tarjetas gráficas NVIDIA GeForce en Linux."
category: "Gaming Tech"
tags: ["NVIDIA","Gaming","Linux","Vulkan"]
readTime: "4 min"
date: "2026-10-05"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Falta de compatibilidad de sincronización explícita (Explicit Sync) en versiones antiguas del driver NVIDIA** | Actualizar al controlador NVIDIA 555 o superior y habilitar __GL_VRR_ALLOWED=1 |
| **Saturación del buffer de descriptores en juegos D3D12 exigentes** | Configurar la variable de entorno VKD3D_CONFIG=upload_hvv,single_queue |

Al ejecutar títulos modernos DirectX 12 (Cyberpunk 2077, Star Wars Jedi: Survivor, Forza Horizon 5) sobre Linux con tarjetas NVIDIA GeForce, es frecuente que el juego se congele por completo tras unos minutos de partida mientras el audio continúa reproduciéndose de fondo. Este bloqueo lo causa un desajuste en el gestor de memoria Vulkan de VKD3D al comunicarse con el controlador privativo de NVIDIA.

> **Solución Rápida (1 Minuto):**
> 1. Actualiza a los controladores NVIDIA 555 o 560+ con soporte Explicit Sync.
> 2. Agrega este parámetro en Steam:
>    `VKD3D_CONFIG=single_queue %command%`

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Actualizar a controladores NVIDIA con soporte de Explicit Sync
Las versiones anteriores a la serie 555 del driver privativo de NVIDIA presentaban problemas severos de sincronización implícita en entornos Wayland y X11, provocando congelamientos de pantalla.
```bash
# Comprobar la versión instalada
nvidia-smi
```
Asegúrate de instalar los controladores NVIDIA versión **555.58**, **560** o superior desde los repositorios oficiales de tu distribución.

### Paso 2: Estabilizar las colas de comandos de VKD3D
Algunas tarjetas de las series GTX 1000, RTX 2000 y 3000 sufren bloqueos de cola al despachar llamadas gráficas y de cómputo en paralelo. Forzar una única cola resuelve el congelamiento:
```bash
# En Parámetros de lanzamiento de Steam
VKD3D_CONFIG=single_queue %command%
```

### Paso 3: Ajustar la gestión de memoria de la GPU (__GL_MaxFramesAllowed)
Limita los fotogramas prerenderizados en la cola del controlador NVIDIA para evitar desbordamientos de memoria en el traductor:
```bash
# Configurar en Steam
__GL_MaxFramesAllowed=1 VKD3D_CONFIG=single_queue %command%
```
Esto reduce la latencia de entrada y evita que el búfer de comandos de la GPU se sature provocando el cuelgue.

## 🛡️ Consejo de Prevención
* Activa el modo de rendimiento en el panel de control de NVIDIA mediante `nvidia-settings -a "[gpu:0]/GpuPowerMizerMode=1"`.
* En entornos Wayland (KDE Plasma 6 / GNOME 46), asegúrate de que los paquetes `xwayland` y los protocolos de sincronización estén al día.

## Preguntas Frecuentes

### ¿Por qué el audio sigue sonando cuando la pantalla se congela?
Porque el hilo de audio del motor del juego opera independientemente del bucle de renderizado de la GPU. Cuando la llamada a Vulkan se bloquea en el controlador, la imagen se congela pero el motor de sonido sigue procesando.

### ¿Afecta la directiva single_queue a los fotogramas por segundo (FPS)?
La pérdida de rendimiento es prácticamente nula (menos del 1-2%), pero elimina por completo los bloqueos críticos del hilo de renderizado.

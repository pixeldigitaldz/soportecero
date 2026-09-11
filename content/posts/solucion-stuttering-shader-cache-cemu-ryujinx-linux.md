---
title: "[SOLUCIONADO] Solución a tirones y stuttering por Shader Cache en Cemu y Ryujinx en Linux"
description: "Elimina los microtirones y congelamientos al compilar shaders en emuladores como Ryujinx, Cemu y RPCS3 en Linux con controladores Mesa y Vulkan."
category: "Gaming Tech"
tags: ["Gaming","Linux","Vulkan","Emuladores"]
readTime: "4 min"
date: "2026-09-25"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Compilación de sombreadores en tiempo real al renderizar nuevos efectos por primera vez** | Habilitar compilación asíncrona de shaders (Async Shader Compilation) en los ajustes gráficos |
| **Límite de tamaño en la caché de shaders del controlador Mesa o Nvidia saturada** | Configurar MESA_SHADER_CACHE_MAX_SIZE y habilitar el backend RADV/ACO |

Al ejecutar títulos exigentes en emuladores modernos (como Ryujinx, Cemu o RPCS3) sobre distribuciones Linux (Steam Deck, Arch Linux, Bazzite, Ubuntu), es habitual experimentar microcongelamientos (*stuttering*) cada vez que un personaje lanza una habilidad o aparece una cinemática. Esto se debe a la compilación en tiempo real de pipelines de sombreado (*shader compilation stutter*).

> **Solución Rápida (1 Minuto):**
> 1. En GPUs AMD/Intel, habilita la compilación ACO ultrarrápida:
>    `export RADV_PERFTEST=aco`
> 2. Amplía el tamaño del caché de shaders en tu ~/.bashrc:
>    `export MESA_SHADER_CACHE_MAX_SIZE=10G`

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Habilitar compilación asíncrona de shaders en el emulador
En las opciones del emulador, activa la compilación asíncrona para que los sombreadores se construyan en hilos secundarios de la CPU en lugar de congelar el renderizado:
- **Cemu:** Entra en *Options* -> *General Settings* -> pestaña *Graphics* -> Marca **Async shader compile**.
- **Ryujinx:** En *Options* -> *Settings* -> *Graphics* -> Habilita **Enable Shader Cache** y activa **Backend Multithreading**.

### Paso 2: Configurar el compilador ACO de Mesa (GPUs AMD Radeon)
El compilador de shaders **ACO** de la comunidad de Valve/Mesa compila instrucciones Vulkan hasta 3 veces más rápido que LLVM. Asegúrate de tener los controladores Mesa actualizados y define en tus variables de entorno:
```bash
# Añade a tu archivo de inicio ~/.profile o ejecútalo en Steam
export RADV_PERFTEST=aco
```

### Paso 3: Aumentar el límite de almacenamiento de la caché de shaders
Por defecto, Mesa puede limitar la caché de sombreadores a 1 GB, provocando que los juegos expulsen shaders antiguos cuando juegas a varios títulos. Amplía el límite a 10 GB:
```bash
# En /etc/environment o ~/.bashrc
export MESA_SHADER_CACHE_MAX_SIZE=10G
export __GL_SHADER_DISK_CACHE_SKIP_CLEANUP=1
```
En GPUs NVIDIA, asegúrate de activar el control de caché en el panel de control o mediante `__GL_SHADER_DISK_CACHE_SIZE=10737418240`.

## 🛡️ Consejo de Prevención
* No borres las carpetas `shader_cache` de tus emuladores al actualizar versiones a menos que un cambio de arquitectura de renderizado lo requiera explícitamente.
* Utiliza el backend gráfico Vulkan en lugar de OpenGL en Linux para un rendimiento multihilo superior.

## Preguntas Frecuentes

### ¿Es normal que el emulador dé tirones durante los primeros minutos de juego?
Sí, durante la primera partida el emulador debe traducir los shaders de la consola a instrucciones legibles por tu tarjeta gráfica. Con la compilación asíncrona activa, los tirones se reemplazan por la aparición momentánea de texturas sin bloquear la tasa de cuadros.

### ¿Cómo compruebo si Vulkan está utilizando el compilador ACO en mi Steam Deck?
Ejecuta el juego con la variable `vulkaninfo | grep -i drivername` o lanza el emulador desde la terminal con `MESA_VK_DEVICE_SELECT=...`.

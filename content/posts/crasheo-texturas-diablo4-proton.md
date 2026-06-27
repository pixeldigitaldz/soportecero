---
title: "Solución al crasheo por carga de texturas en Diablo IV bajo Linux (Proton)"
description: "Aprende a mitigar las congelaciones y cierres inesperados de Diablo IV al entrar a zonas densas configurando las variables de VKD3D."
category: "Gaming Tech"
tags: ["Gaming", "Linux", "Diablo IV", "Proton"]
readTime: "3 min"
date: "2026-06-27"
---

El cierre inesperado de Diablo IV bajo entornos Linux mediante la capa de compatibilidad Proton suele manifestarse al ingresar a capitales o núcleos urbanos de alta densidad (como Kyovashad). Este crasheo ocurre debido a la sobrecarga e ineficiencia en el intercambio y asignación de texturas de alta resolución a través de la API de traducción de Direct3D 12 a Vulkan (VKD3D).

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Configurar variables de optimización de transferencia en Steam
Forzar al traductor de DirectX 12 a gestionar la carga de texturas y el mapeo de memoria del host de forma más eficiente previene el colapso del bus de datos de la GPU.
1. Abre Steam, haz clic derecho sobre Diablo IV y selecciona **Propiedades**.
2. En la sección de **Parámetros de lanzamiento**, ingresa exactamente el siguiente comando al principio de tus variables:
```bash
VKD3D_CONFIG=no_upload_hcm %command%
```
*(Nota: La variable `no_upload_hcm` desactiva la asignación agresiva de memoria de host visible para la GPU, estabilizando la carga de texturas de fondo sin penalizar el rendimiento).*

### Paso 2: Limitar la asignación física de texturas en los ajustes del juego
1. Ve al panel de opciones gráficas del juego.
2. Asegúrate de configurar la calidad de texturas en **Alto (High)** o **Medio (Medium)** en lugar de "Ultra". Esto previene que la traducción de memoria de video sature los límites del sistema.

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
- No utilices texturas en calidad "Ultra" en tarjetas gráficas que cuenten con menos de 12GB de VRAM física dedicada. Al ejecutarse mediante capas de traducción gráfica en Linux, el consumo de memoria se incrementa ligeramente; si el juego supera el límite físico de la tarjeta e intenta volcar texturas a la memoria RAM general del sistema, los tiempos de transferencia provocarán bloqueos y crasheos ineludibles.

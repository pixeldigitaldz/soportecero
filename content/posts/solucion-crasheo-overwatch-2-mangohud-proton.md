---
title: "[SOLUCIONADO] Crasheo de Overwatch 2 en Linux / Steam Deck"
description: "¿Overwatch 2 se cierra inesperadamente o se congela en Linux/Steam Deck al usar Proton? Solución paso a paso para DXVK y compilación de shaders."
category: "Gaming Tech"
tags: ["Gaming", "Linux", "Steam Deck", "Proton", "Overwatch 2"]
readTime: "4 min"
date: "2026-08-16"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Incompatibilidad de la capa MangoHud con el compilador DXVK/VKD3D** | Desactivar el parámetro `MANGOHUD=1` o actualizar MangoHud a la versión más reciente |
| **Conflicto de captura de pantalla u overlay de compatibilidad de Proton** | Utilizar `MANGOHUD_CONFIG=no_display %command%` en los parámetros de arranque |


El **cierre inesperado (*crash*) o congelamiento de Overwatch 2** al ejecutarse en Linux (CachyOS, Arch, Ubuntu, Fedora) o Steam Deck a través de Proton suele estar causado por la compilación síncrona de shaders de DXVK, capas de rendimiento incompatibles como MangoHud o la falta de parches en la versión estándar de Proton.

> **Solución Rápida (1 Minuto):**
> 1. En las Opciones de Lanzamiento de Steam para Overwatch 2, añade:
>    `MANGOHUD=0 %command%`
> 2. Cambia la versión de compatibilidad a **GE-Proton** (Proton GloriousEggroll).

## 🚀 Cómo solucionar el crasheo de Overwatch 2 paso a paso

### Paso 1: Desactivar la superposición de MangoHud
MangoHud y otros inyectores de métricas en pantalla pueden colisionar con el sistema antitrampas y la inicialización de la ventana de DXVK en juegos de Blizzard.

1. Abre Steam -> Biblioteca -> Clic derecho en **Overwatch 2** -> **Propiedades**.
2. En la pestaña **General**, ve al campo **Parámetros de lanzamiento** e introduce:
```bash
MANGOHUD=0 %command%
```

### Paso 2: Cambiar a GE-Proton (Proton-GE)
Las ejecuciones oficiales de Proton pueden generar pantallas negras o cierres al cargar videos de introducción de Battle.net.

1. Abre la aplicación **ProtonUp-Qt** (instalable desde Discover en Steam Deck o pacman/apt).
2. Descarga e instala la última versión de **GE-Proton** (ejemplo: `GE-Proton9-10`).
3. En Steam, ve a Propiedades de Overwatch 2 -> **Compatibilidad** -> Activa "Forzar el uso de una herramienta específica de compatibilidad" -> Selecciona `GE-Proton`.

### Paso 3: Limpiar la caché de Shaders corrupta de DXVK
Si el juego crashea justo al entrar a una partida multijugador:

Navega a la carpeta de caché de Steam en tu sistema y elimina la caché de shaders compilada previa:
```bash
rm -rf ~/.steam/steam/steamapps/shadercache/2357570
```
*(El ID `2357570` corresponde al código oficial de Overwatch 2 en Steam).*

## 🛡️ Consejo de Prevención
* Tras una actualización importante del juego o de los controladores de video, deja que el juego permanezca 2 minutos en el menú principal para que regenere la caché de shaders sin provocar tirones de FPS en medio de la partida.

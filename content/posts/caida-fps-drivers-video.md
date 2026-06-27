---
title: "Cómo solucionar la caída de FPS en juegos online tras la última actualización del driver de video"
description: "Aprende a corregir los tirones, stuttering y pérdidas drásticas de rendimiento gráfico tras actualizar los controladores de NVIDIA o AMD en tu PC."
category: "Gaming Tech"
tags: ["Gaming", "Drivers", "Optimización"]
readTime: "3 min"
date: "2026-06-26"
---

Actualizar los drivers de tu tarjeta gráfica es crucial para soportar nuevos juegos, pero en ocasiones la última versión llega con bugs de compatibilidad o corrompe configuraciones previas del sistema, provocando caídas drásticas de FPS o tartamudeo visual (*stuttering*) en tus partidas online.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Limpieza absoluta con DDU (Display Driver Uninstaller)
Instalar un driver sobre otro suele dejar archivos basura conflictivos. La solución es limpiar el sistema por completo.
1. Descarga la herramienta gratuita **DDU (Display Driver Uninstaller)**.
2. Reinicia tu computadora en **Modo Seguro** (Safe Mode).
3. Abre DDU, selecciona tu tipo de GPU (NVIDIA/AMD) y haz clic en **"Limpiar y reiniciar"** (Clean and restart).
4. Al iniciar el sistema normalmente, instala una versión anterior del driver que sepas que funcionaba de forma estable.

### Paso 2: Vaciar el caché de sombreadores (Shader Cache)
Muchas veces los tirones ocurren porque el juego intenta usar shaders compilados con el driver viejo.
- **En NVIDIA:** Ve al *Panel de Control de NVIDIA > Controlar la configuración 3D*, busca *Caché del sombreador* y cámbialo a desactivado, dale a aplicar, reinicia la PC y vuélvelo a activar en "Ilimitado".
- **En Linux (Steam/Proton):** Ve a los ajustes de Steam > *Sombreado de reproducción previa (Shader Pre-compilation)* y activa la casilla para permitir que Steam descargue los shaders actualizados antes de lanzar el juego.

## 🛡️ Consejo de Prevención
Prácticas de seguridad recomendadas:
- No actualices tus controladores de video el mismo día que salen al mercado, a menos que sea estrictamente necesario para abrir un juego nuevo. Espera una semana a que la comunidad reporte si la versión tiene fallos de rendimiento.

---
title: "Cómo solucionar la caída de FPS en juegos online tras la última actualización del driver de video"
description: "Aprende a diagnosticar y revertir controladores gráficos corruptos, limpiar cachés de shaders y restablecer el rendimiento de tus juegos en Windows y Linux."
category: "Gaming Tech"
tags: ["GPU", "Drivers", "Nvidia", "AMD", "Gaming", "FPS Drop"]
readTime: "5 min"
date: "2026-06-25"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Controlador gráfico recién instalado con perfiles corruptos o conflicto de registros previos** | Realizar una desinstalación limpia con DDU (Display Driver Uninstaller) y reinstalar driver WHQL |
| **Caché de shaders obsoleta o saturada tras la actualización del compilador de la GPU** | Purgar los directorios DirectX / Vulkan shader cache y regenerar los perfiles de sombreado |

Experimentar una caída drástica de fotogramas por segundo (FPS) o micro-tirones constantes en títulos competitivos después de actualizar los controladores de NVIDIA (GeForce Game Ready) o AMD (Adrenalin Edition) es un problema frecuente. Ocurre cuando los nuevos archivos binarios entran en conflicto con configuraciones previas del registro, perfiles de energía modificados o cachés de sombreadores incompatibles generadas con versiones anteriores.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Purgar la caché de sombreadores DirectX y Vulkan
Cuando se actualiza el controlador, los shaders antiguos en disco quedan desalineados respecto al nuevo motor de compilación:
1. En Windows, presiona `Win + R`, escribe `cleanmgr` y selecciona la unidad `C:`.
2. Marca la casilla **Caché del sombreador de DirectX** (DirectX Shader Cache) y pulsa Aceptar.
3. En Linux (Steam/Proton), elimina la caché de shaders del juego:
```bash
# Limpiar caché de shaders DXVK/Vulkan
rm -rf ~/.local/share/Steam/steamapps/shadercache/*
```

### Paso 2: Desinstalación limpia del controlador con DDU
Para eliminar cualquier rastro residual de registros o bibliotecas DLL conflictivas:
1. Descarga la herramienta gratuita **Display Driver Uninstaller (DDU)**.
2. Reinicia tu equipo en **Modo Seguro** (Safe Mode).
3. Abre DDU, selecciona tu tipo de GPU (**NVIDIA** o **AMD**) y haz clic en **Limpiar y reiniciar** (Clean and restart).
4. Al reiniciar en modo normal, instala la versión anterior estable (o la versión WHQL recomendada) descargada directamente de la web oficial.

### Paso 3: Configurar el modo de energía de la GPU a Máximo Rendimiento
A menudo las actualizaciones restablecen la administración de energía a un modo conservador que ralentiza la frecuencia de reloj del núcleo:
- **Panel de Control NVIDIA**: Ve a *Controlar la configuración 3D > Modo de control de energía* y selecciona **Preferir rendimiento máximo**.
- **Software AMD Adrenalin**: En la pestaña *Rendimiento > Ajuste*, desactiva límites de energía agresivos.

### Paso 4: Desactivar la superposición (Overlay) de software de terceros
Actualizaciones de drivers suelen causar incompatibilidades temporales con overlays que inyectan hooks en DirectX:
- Desactiva el overlay de **Discord**, **GeForce Experience** o **Steam Overlay** temporalmente para aislar si el hook gráfico es el causante del stuttering.

## 🛡️ Consejos de Prevención
- **No actualices drivers el día de lanzamiento:** A menos que el nuevo driver incluya soporte indispensable para un juego que acabas de adquirir, espera 4-7 días para comprobar si la comunidad reporta regresiones de rendimiento.
- **Evita programas automáticos de actualización de drivers:** Utiliza únicamente los instaladores oficiales firmados por AMD o NVIDIA.

## ❓ Preguntas Frecuentes (FAQ)

### ¿Es mejor hacer Rollback desde el Administrador de Dispositivos?
El botón "Revertir al controlador anterior" de Windows puede funcionar en emergencias, pero no limpia las ramas de registro huérfanas. DDU sigue siendo el método estándar recomendado para evitar conflictos.

### ¿Por qué mi juego tarda más en cargar tras borrar la caché de shaders?
Porque el juego recompila los sombreadores en el primer inicio. Tras los primeros minutos de juego, la carga volverá a su velocidad habitual sin tirones.

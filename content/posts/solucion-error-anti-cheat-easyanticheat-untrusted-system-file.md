---
title: "[SOLUCIONADO] Error Easy Anti-Cheat: Untrusted system file en Windows y Linux Proton"
description: "Cómo reparar el bloqueo Untrusted system file de Easy Anti-Cheat al jugar a Apex Legends, Fortnite o Elden Ring."
category: "Gaming Tech"
tags: ["Gaming","AntiCheat","Steam","Windows"]
readTime: "4 min"
date: "2026-10-01"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Librerías DLL modificadas por programas de terceros (ReShade, MSI Afterburner, grabadores de pantalla)** | Desactivar overlays de captura o eliminar archivos dll inyectados en la carpeta del juego |
| **Archivos del sistema corruptos en Windows o prefijo de Proton desincronizado en Linux** | Ejecutar sfc /scannow en Windows o verificar la integridad del runtime EasyAntiCheat en Steam |

Al intentar iniciar juegos multijugador protegidos por Easy Anti-Cheat (EAC), el proceso de carga se detiene y muestra una ventana emergente: `Easy Anti-Cheat - Untrusted system file (C:\...\archivo.dll)`. El sistema antitrampas rechaza la firma digital de esa biblioteca específica e impide la entrada al juego por motivos de seguridad.

> **Solución Rápida (1 Minuto):**
> 1. En Windows, repara archivos de sistema protegidos:
>    `sfc /scannow`
> 2. En Steam (Linux o Windows), verifica los archivos del juego:
>    *Propiedades -> Archivos instalados -> Verificar integridad de los archivos del juego*

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Identificar la ruta del archivo DLL marcado como no confiable
Observa con atención la ruta completa que aparece dentro del cuadro de error de Easy Anti-Cheat:
- Si apunta a una carpeta dentro de `C:\Windows\System32\` o `SysWOW64`, se trata de una librería del sistema dañada.
- Si apunta a la carpeta de instalación del juego o a programas de captura (OBS, RivaTuner, Overwolf, Discord), se trata de un conflicto con el overlay de ese programa.

### Paso 2: Desactivar capas superpuestas (Overlays) y programas de inyección
Cierra completamente los siguientes programas antes de abrir el juego:
1. **RivaTuner Statistics Server (RTSS):** Cambia el nivel de detección de *High* a *None* o añade una excepción para el ejecutable del juego.
2. **ReShade:** Si instalaste mods gráficos o ReShade, elimina temporalmente `dxgi.dll` de la carpeta del juego.
3. Desactiva la superposición de Discord y GeForce Experience.

### Paso 3: Reparar el servicio de Easy Anti-Cheat o el Runtime en Steam
Si el fallo persiste en Windows, reinstala el servicio:
1. Navega hasta la carpeta del juego y busca la subcarpeta `EasyAntiCheat`.
2. Haz clic derecho sobre `EasyAntiCheat_Setup.exe` y selecciona *Ejecutar como Administrador*.
3. Selecciona tu juego en el menú desplegable y haz clic en **Servicio de Reparación**.

En Linux con Steam / Proton:
Asegúrate de tener instalada en tu biblioteca de Steam la herramienta oficial **Proton EasyAntiCheat Runtime**.

## 🛡️ Consejo de Prevención
* Mantén actualizadas las bibliotecas de Microsoft Visual C++ Redistributable (2015-2022).
* Evita instalar DLLs de sitios no oficiales en las carpetas de sistema de Windows.

## Preguntas Frecuentes

### ¿Por qué ocurre este error con dlls oficiales de Windows como crypt32.dll o ntdll.dll?
Ocurre cuando una actualización de Windows quedó a medias o la firma digital del archivo caducó en la base de datos de EAC. Se resuelve ejecutando `DISM /Online /Cleanup-Image /RestoreHealth` seguido de `sfc /scannow`.

### ¿Easy Anti-Cheat funciona con juegos de Steam en Steam Deck?
Sí, siempre que los desarrolladores hayan habilitado la compatibilidad con Linux/Proton y tengas instalado el `Proton EasyAntiCheat Runtime` desde Steam.

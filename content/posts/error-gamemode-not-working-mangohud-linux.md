---
title: Cómo activar y solucionar fallos en GameMode y MangoHud para juegos en Linux
description: >-
  Soluciona problemas de integración donde Feral GameMode o MangoHud no se
  activan ni muestran la superposición FPS en juegos de Linux o Steam.
category: Gaming Tech
tags:
  - Linux
  - Gaming
  - Performance
readTime: 4 min
date: '2026-07-27'
---

Feral GameMode (`gamemoded`) y MangoHud son herramientas fundamentales en el ecosistema de juegos en Linux: la primera ajusta dinámicamente el gobernador de la CPU, prioridades de E/S y perfiles de energía de la GPU, mientras que la segunda renderiza una superposición (*overlay*) para monitorizar fotogramas (FPS), temperaturas y frecuencias. Sin embargo, inconsistencias en librerías de 32 bits, servicios DBus o variables de entorno pueden provocar que no se carguen en Steam o Lutris.

## Diagnóstico Rápido

| Causa | Solución |
|---|---|
| **MangoHud no aparece al ejecutar juegos en Steam**: Sintaxis incorrecta en parámetros de lanzamiento o falta paquete de librerías multilib de 32 bits (`lib32-mangohud`) | Usar `mangohud %command%` e instalar las librerías `lib32` / `i386` |
| **`gamemoded` no cambia el gobernador de CPU a `performance`**: El servicio de usuario systemd no está activo o falta incluir al usuario en el grupo de permisos | Hablitar `gamemoded.service` a nivel de usuario y comprobar con `gamemoded -t` |
| **Crasheo del juego al iniciar con MangoHud bajo servidores de pantalla Wayland**: Incompatibilidad en capas implícitas de Vulkan o conflictos de renderizado con el *compositor* | Configurar las capas de Vulkan explícitamente en el archivo `MangoHud.conf` |

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Verificar y activar el servicio de GameMode (`gamemoded`)
Comprueba que el demonio `gamemoded` esté instalado y corriendo correctamente en tu sesión de usuario mediante systemd:

```bash
# Comprobar el estado del servicio en tu usuario
systemctl --user status gamemoded.service

# Si está inactivo, inicialízalo y habilítalo para el inicio automático
systemctl --user enable --now gamemoded.service

# Ejecutar el test integral de autodiagnóstico de GameMode
gamemoded -t
```
*(Si el test falla en la sección de CPU governor, asegúrate de tener instalado `dbus` y el paquete `cpupower` en tu distribución).*

### Paso 2: Instalar las dependencias de 32 y 64 bits para MangoHud
Juegos antiguos o ejecutables en Proton de 32 bits requieren que MangoHud esté disponible en ambas arquitecturas (`x86` y `x86_64`):

```bash
# En Arch Linux / CachyOS / Manjaro:
sudo pacman -S mangohud lib32-mangohud gamemode lib32-gamemode

# En Ubuntu / Debian / Pop!_OS:
sudo apt install mangohud gamemode mangohud:i386
```

### Paso 3: Configurar las Opciones de Lanzamiento en Steam y Lutris
En Steam, haz clic derecho sobre el juego > *Propiedades* > *General* > *Parámetros de lanzamiento*, e ingresa la combinación de ambos comandos:

```bash
# Opción estándar recomendada para combinar GameMode y MangoHud
gamemoderun mangohud %command%

# Si deseas forzar parámetros específicos de MangoHud mediante variables de entorno
MANGOHUD=1 MANGOHUD_CONFIG=cpu_temp,gpu_temp,fps,fps_limit=144 gamemoderun %command%
```

### Paso 4: Ajustar el archivo de configuración global de MangoHud
Crea o edita el archivo de configuración en tu directorio personal para personalizar los paneles y solucionar fallos visuales en Wayland:

```bash
# Crear directorio de configuración si no existe
mkdir -p ~/.config/MangoHud/

# Crear o editar el archivo MangoHud.conf
nano ~/.config/MangoHud/MangoHud.conf
```

Añade los siguientes parámetros optimizados:
```ini
legacy_layout=false
gpu_stats
gpu_temp
cpu_stats
cpu_temp
fps
frametime=1
toggle_hud=Shift_R+F12
no_display
```
*(Nota: La opción `no_display` permite arrancar MangoHud oculto por defecto y mostrarlo únicamente cuando presiones `Shift Derecho + F12`).*

## 🛡️ Consejos de Prevención

Prácticas de seguridad recomendadas:
- **Verifica conflictos de superposiciones**: Evita ejecutar simultáneamente overlays de Discord (Vencord), RivaTuner o VKBasalt si experimentas micro-tirones (*stuttering*) o cierres inesperados.
- **Audita permisos en plataformas Flatpak**: Si ejecutas Steam o Heroic Games Launcher desde Flatpak, debes conceder permisos a la aplicación para comunicarse con el demonio DBus de GameMode mediante Flatseal o con el comando: `flatpak override --user --talk-name=org.freedesktop.gamemode com.valvesoftware.Steam`.

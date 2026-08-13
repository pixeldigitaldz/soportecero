---
title: Cómo solucionar la pantalla negra en OBS Studio bajo Wayland y PipeWire
description: >-
  Guía completa para reparar la pantalla negra al capturar pantalla o ventanas en OBS Studio usando Wayland, PipeWire y XDG Desktop Portal en Linux.
category: Gaming Tech
tags:
  - OBS
  - Wayland
  - Linux
readTime: 4 min
date: '2026-08-02'
---

Al ejecutar OBS Studio en distribuciones Linux modernas con entornos de escritorio basados en Wayland (como GNOME, KDE Plasma, Hyprland o Sway), es común encontrarse con una pantalla negra al intentar añadir una fuente de "Captura de pantalla" o "Captura de ventana". A diferencia de X11, Wayland prohíbe por diseño que las aplicaciones lean directamente el framebuffer de otras ventanas, delegando la captura al servidor de streaming de medios **PipeWire** a través de **XDG Desktop Portal**.

## Diagnóstico Rápido

| Causa | Solución |
|---|---|
| **La fuente "Captura de pantalla (PipeWire)" aparece totalmente negra o no muestra selector de ventana**: El servicio `xdg-desktop-portal` o el backend del entorno de escritorio no está instalado o falló | Instalar el backend portal correspondiente (GNOME/KDE/Hyprland) y reiniciar el servicio de usuario |
| **La opción de captura PipeWire no aparece en la lista de fuentes de OBS Studio**: Falta el módulo `obs-xdg-portal` o se está forzando a OBS a ejecutarse en modo Xwayland/X11 | Instalar la extensión portal de OBS e iniciar OBS nativamente en Wayland |
| **El cuadro de diálogo para seleccionar la pantalla aparece, pero OBS muestra un marco negro congelado**: Permisos denegados en PipeWire o sesión de portal colgada por cambios de resolución | Reiniciar los daemon `pipewire` y `wireplumber` sin reiniciar el sistema |

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Instalar XDG Desktop Portal y el backend de tu escritorio
Para que OBS pueda solicitar captura de pantalla a Wayland, necesitas tener el portal base y el backend específico de tu compositor:

```bash
# En Arch Linux / Manjaro / CachyOS
sudo pacman -S xdg-desktop-portal pipewire wireplumber

# Instala el backend de tu entorno de escritorio:
# Para GNOME:
sudo pacman -S xdg-desktop-portal-gnome
# Para KDE Plasma:
sudo pacman -S xdg-desktop-portal-kde
# Para Hyprland / Sway / wlroots:
sudo pacman -S xdg-desktop-portal-hyprland # o xdg-desktop-portal-wlr

# En Ubuntu / Debian / Pop!_OS
sudo apt install xdg-desktop-portal pipewire xdg-desktop-portal-gnome
```

### Paso 2: Reiniciar los servicios de Portal y PipeWire
Si los portales fueron instalados recientemente o sufrieron una desconexión, reinstancia las unidades de `systemd` del usuario:

```bash
# Reiniciar el demonio de PipeWire y el gestor de sesiones WirePlumber
systemctl --user restart pipewire wireplumber

# Detener e iniciar limpiamente XDG Desktop Portal
systemctl --user stop xdg-desktop-portal
systemctl --user start xdg-desktop-portal
```

### Paso 3: Verificar la ejecución nativa de OBS Studio en Wayland
Si inicias OBS Studio con variables de entorno que fuerzan X11 (`QT_QPA_PLATFORM=xcb`), la captura PipeWire no funcionará correctamente. Asegúrate de forzar la plataforma Qt para Wayland:

```bash
# Ejecutar OBS con backend nativo Wayland
QT_QPA_PLATFORM=wayland obs

# Si utilizas la versión Flatpak de OBS Studio:
flatpak override --user --socket=wayland com.obsproject.Studio
```

Dentro de OBS Studio, elimina cualquier fuente antigua de "Captura de pantalla (XSHM)" o "Captura de ventana (Xcomposite)" e inserta una nueva fuente llamada **Screen Capture (PipeWire)** / **Captura de pantalla (PipeWire)**. Al hacerlo, el sistema operativo mostrará una ventana emergente nativa para seleccionar qué monitor o ventana deseas transmitir.

## 🛡️ Consejos de Prevención

- **Evita forzar Xwayland en OBS**: Mantén OBS ejecutándose bajo el cliente nativo Wayland/Qt6 para evitar problemas de sincronización de frames y duplicación de cursores.
- **Mantén un solo backend portal activo**: Si usas compositores basados en wlroots (Sway, Hyprland), evita tener activos simultáneamente `xdg-desktop-portal-gnome` y `xdg-desktop-portal-wlr` sin una configuración explícita en `~/.config/xdg-desktop-portal/portals.conf`.
- **Verifica la integración con Flatpak**: Si usas OBS en versión Flatpak, asegúrate de que el paquete `org.freedesktop.portal.Desktop` tenga permisos de acceso ejecutando `flatpak update`.

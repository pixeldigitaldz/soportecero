---
title: "[SOLUCIONADO] Parpadeo y Stuttering con NVIDIA en Wayland (Linux Gaming)"
description: "¿Tus juegos sufren parpadeos (flickering) o lag en KDE, Hyprland o GNOME con tarjetas NVIDIA en Wayland? Activa Explicit Sync y optimiza controladores."
category: "Gaming Tech"
tags: ["NVIDIA", "Wayland", "Gaming", "Linux"]
readTime: "4 min"
date: "2026-08-03"
---

El **parpadeo visual (*flickering*), tartamudeo (*stuttering*) o desincronización de cuadros** al jugar en sistemas Linux con tarjetas gráficas **NVIDIA bajo entornos Wayland** (KDE Plasma 6, Hyprland, GNOME) se debe a la desincronización entre el búfer de renderizado del controlador y el compositor de ventanas.

> **Solución Rápida (1 Minuto):**
> 1. Actualiza al controlador **NVIDIA 555.58** o superior (soporte para el protocolo `linux-explicit-synchronization-v1`).
> 2. Añade en `/etc/environment`:
>    `GBM_BACKEND=nvidia-drm`
>    `__GLX_VENDOR_LIBRARY_NAME=nvidia`

## 🚀 Cómo corregir el rendimiento de NVIDIA en Wayland paso a paso

### Paso 1: Verificar e instalar controladores NVIDIA 555+ (Explicit Sync)
La causa raíz histórica del lag en NVIDIA/Wayland se solucionó con el protocolo de **Sincronización Explícita (Explicit Sync)** disponible a partir de la versión **555** de los controladores propietarios.

* **En CachyOS / Arch Linux:**
  ```bash
  sudo pacman -Syu nvidia-dkms nvidia-utils
  ```
* **En Ubuntu 24.04 / Pop!_OS:**
  ```bash
  sudo ubuntu-drivers install
  ```

### Paso 2: Activar el Modo KMS Directo (nvidia-drm.modeset=1)
Es obligatorio que el módulo del núcleo cargue la gestión de modos directos (*DRM modeset*):

Abre el archivo de configuración del cargador de arranque en `/etc/default/grub` o `/boot/loader/entries/`:
```bash
sudo nano /etc/default/grub
```
Añade dentro de `GRUB_CMDLINE_LINUX_DEFAULT`:
```plaintext
nvidia-drm.modeset=1 nvidia-drm.fbdev=1
```
Actualiza GRUB:
```bash
# En Ubuntu / Debian / Fedora
sudo update-grub

# En Arch Linux
sudo grub-mkconfig -o /boot/grub/grub.cfg
```

### Paso 3: Configurar variables de entorno para compositores Wayland
Edita el archivo global de variables de entorno:
```bash
sudo nano /etc/environment
```
Añade las siguientes directivas para forzar a las aplicaciones a utilizar la aceleración de hardware de NVIDIA:
```bash
GBM_BACKEND=nvidia-drm
__GLX_VENDOR_LIBRARY_NAME=nvidia
ELECTRON_OZONE_PLATFORM_HINT=wayland
LIBVA_DRIVER_NAME=nvidia
```

## 🛡️ Consejo de Prevención y Juegos en Steam
* En las opciones de lanzamiento de juegos de Steam en Wayland, puedes desactivar VSync interno si usas G-Sync / FreeSync activado en la pantalla.

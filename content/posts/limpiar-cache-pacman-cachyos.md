---
title: "Cómo liberar espacio en disco limpiando correctamente la caché de Pacman en CachyOS"
description: "Aprende a limpiar la caché de paquetes de Pacman y Yay en CachyOS y Arch Linux usando paccache, pacman -Sc y automatización por systemd."
category: "Sistemas y Servidores"
tags: ["CachyOS", "Arch Linux", "Pacman", "Linux", "SysAdmin", "Almacenamiento"]
readTime: "5 min"
date: "2026-06-25"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Directorio /var/cache/pacman/pkg saturado por cientos de versiones antiguas de paquetes** | Limpiar versiones antiguas manteniendo solo las últimas 2 con `sudo paccache -r` |
| **Caché huérfana de paquetes compilados por AUR helpers como Yay o Paru en ~/.cache** | Limpiar la caché AUR con `yay -Sc --aur` o purgar `~/.cache/yay` |

En CachyOS y distribuciones basadas en Arch Linux, el gestor de paquetes Pacman nunca elimina automáticamente los paquetes descargados (`.pkg.tar.zst`) de `/var/cache/pacman/pkg/`. Con el paso de las semanas, este directorio puede acumular fácilmente 20GB o 50GB de espacio en disco, provocando advertencias de poco espacio en la partición raíz.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Comprobar el tamaño actual de la caché de Pacman
Inspecciona cuánto espacio en disco está ocupando la carpeta de paquetes:
```bash
# Ver el tamaño exacto del directorio de caché de Pacman
du -sh /var/cache/pacman/pkg/
```

### Paso 2: Limpieza segura manteniendo versiones de respaldo con paccache
La herramienta oficial `paccache` (del paquete `pacman-contrib`) permite eliminar versiones antiguas conservando las últimas 2 versiones por si necesitas hacer rollback:
```bash
# 1. Instalar pacman-contrib si no está presente
sudo pacman -S pacman-contrib --noconfirm

# 2. Eliminar todas las versiones anteriores excepto las 2 más recientes
sudo paccache -r -k 2

# 3. Eliminar paquetes desinstalados que aún quedaron en caché
sudo paccache -ruk0
```

### Paso 3: Limpieza total de paquetes (Solo cuando necesitas espacio urgente)
Si requieres liberar todo el espacio posible de inmediato:
```bash
# Limpiar paquetes no instalados
sudo pacman -Sc --noconfirm

# Limpiar por completo TODA la caché de Pacman (0 archivos residuales)
sudo pacman -Scc --noconfirm
```

### Paso 4: Limpiar la caché de compilaciones AUR (Yay / Paru)
Los paquetes descargados y compilados desde AUR se guardan en la carpeta de usuario:
```bash
# Si usas Yay:
yay -Sc --aur --noconfirm
rm -rf ~/.cache/yay/*

# Si usas Paru:
paru -Scc --noconfirm
```

## 🛡️ Consejos de Prevención
- **Activa el temporizador de limpieza automática de systemd:** Habilita el timer oficial para que el sistema limpie la caché semanalmente de forma desatendida:
```bash
sudo systemctl enable --now paccache.timer
```
- **Elimina paquetes huérfanos periódicamente:** Ejecuta `sudo pacman -Rns $(pacman -Qtdq)` para desinstalar dependencias no utilizadas.

## ❓ Preguntas Frecuentes (FAQ)

### ¿Por qué Pacman guarda todas las versiones descargadas?
Para permitir volver a una versión anterior (`pacman -U /var/cache/pacman/pkg/paquete-antiguo.pkg.tar.zst`) de forma offline si una actualización reciente rompe alguna aplicación.

### ¿Es seguro activar paccache.timer?
Sí, es completamente seguro. Por defecto, el temporizador conserva las últimas 3 versiones de cada paquete y elimina versiones obsoletas cada semana.

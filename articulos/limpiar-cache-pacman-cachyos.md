---
title: >-
  Cómo liberar espacio en disco limpiando correctamente la caché de Pacman en
  CachyOS
description: >-
  Aprende a limpiar la caché de paquetes de Pacman y Yay en CachyOS y Arch Linux
  usando paccache, pacman -Sc y automatización por systemd.
category: Sistemas y Servidores
tags:
  - CachyOS
  - Arch Linux
  - Pacman
  - Linux
  - SysAdmin
  - Almacenamiento
readTime: 7 min
date: '2026-06-25'
---
En CachyOS y distribuciones basadas en Arch Linux, el gestor de paquetes Pacman nunca elimina automáticamente los paquetes descargados (`.pkg.tar.zst`) de `/var/cache/pacman/pkg/`. Con el paso de las semanas, este directorio puede acumular fácilmente 20GB o 50GB de espacio en disco, provocando advertencias de poco espacio en la partición raíz.

## Análisis de Arquitectura y Causa Raíz

En la arquitectura del sistema operativo **Linux**, las aplicaciones de usuario operan en espacio no privilegiado (*User Space*) y dependen de llamadas al sistema (*syscalls*) para interactuar con los recursos físicos de hardware a través del **Kernel de Linux**. El subsistema del kernel arbitra el acceso a la memoria virtual, los descriptores de archivos, la pila de protocolos de red TCP/IP y los dispositivos de almacenamiento en bloque a través de la capa de abstracción **VFS (Virtual File System)**.

La anomalía técnica identificada en esta incidencia proviene de una restricción o condición de fallo en los mecanismos de control del sistema:
1. **Límites de descriptores de archivos y cuotas de inodos:** Cada archivo, socket de red o tubería (*pipe*) abierto por un proceso consume un descriptor de archivo en la tabla del kernel. Si el proceso alcanza el límite de descriptores asignado por el subsistema `ulimit` o si el sistema de archivos agota su tabla de inodos libres (incluso cuando resta espacio en gigabytes en disco), el kernel rechaza cualquier operación de escritura con el código de error `ENOSPC (No space left on device)` o `EMFILE (Too many open files)`.
2. **Jerarquía de permisos POSIX y atributos inmutables del sistema:** Las llamadas al sistema como `open()`, `unlink()` o `chmod()` evalúan los bits de permiso estándar (Lectura `r`, Escritura `w`, Ejecución `x`) junto con el UID/GID del proceso ejecutor. Si el archivo posee atributos extendidos inmutables fijados a nivel del sistema de archivos mediante `chattr +i`, el kernel bloquea cualquier mutación incluso ante el usuario privilegiado `root`, retornando el error `EPERM (Operation not permitted)`.
3. **Administración de memoria virtual y Swapping:** Cuando el sistema experimenta presión de memoria y la memoria física disponible es insuficiente para satisfacer las solicitudes del gestor de páginas, el kernel recurre a la memoria swap. Si los umbrales de agresividad (`vm.swappiness`) están desajustados o el espacio de intercambio está fragmentado, el sistema entra en un estado de congestión (*thrashing*), degradando el rendimiento general hasta que el subsistema OOM Killer termina procesos para preservar la estabilidad del kernel.

## Entorno de Laboratorio y Diagnóstico

Antes de aplicar cualquier cambio destructivo o reiniciar servicios en un entorno de producción, es fundamental ejecutar una matriz de diagnóstico preliminar para identificar la capa exacta donde ocurre el fallo:

| Causa | Solución |
|---|---|
| **Directorio /var/cache/pacman/pkg saturado por cientos de versiones antiguas de paquetes** | Prune obsolete package tarballs while retaining the latest 2 versions via `sudo paccache -r` |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Comprobar el estado del servicio en el gestor de inicialización systemd
sudo systemctl status --no-pager -l pacman-sync

# 2. Inspeccionar los registros del diario del sistema filtrando por unidad
sudo journalctl -u pacman-sync -n 50 --no-pager

# 3. Auditar el espacio y tabla de inodos en todos los sistemas de archivos montados
df -Th && df -ih
```

- El flag `--no-pager` en `systemctl` y `journalctl` evita invocar el paginador interactivo (`less`), permitiendo redirigir la salida o analizar los registros sin interrumpir flujos de automatización.
- El comando `df` con los modificadores `-T` (tipo de sistema de archivos ext4/xfs/btrfs) y `-h` (formato legible en gigabytes/megabytes), combinado con `-i` (tabla de inodos disponibles), permite descartar si el disco está lleno por bytes reales o saturado por millones de archivos pequeños huérfanos.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

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

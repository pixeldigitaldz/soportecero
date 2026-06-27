---
title: "Cómo liberar espacio en disco limpiando correctamente la caché de Pacman en CachyOS"
description: "Evita quedarte sin espacio en tu SSD recuperando gigabytes de datos acumulados por el gestor de paquetes Pacman en distribuciones Arch Linux."
category: "Sistemas y Servidores"
tags: ["CachyOS", "Linux", "Mantenimiento"]
readTime: "3 min"
date: "2026-06-26"
---

A diferencia de otros sistemas operativos, las distribuciones basadas en Arch Linux (como CachyOS) no eliminan de forma automática los paquetes antiguos que descargas durante las actualizaciones. El gestor `pacman` los acumula indefinidamente en la ruta `/var/cache/pacman/pkg/` por si necesitas hacer un *downgrade*. Con el tiempo, esta carpeta puede devorarse 20GB o 30GB de tu almacenamiento SSD.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Medir el tamaño actual de la basura
Ejecuta este comando en tu terminal para ver exactamente cuánto espacio está consumiendo la caché acumulada de descargas:
```bash
du -sh /var/cache/pacman/pkg/
```

### Paso 2: Limpieza selectiva usando paccache (Recomendado)
No borres la carpeta entera a mano, ya que es peligroso. Usaremos la herramienta oficial paccache para eliminar todas las versiones viejas de los programas, manteniendo únicamente la versión actual instalada y la inmediatamente anterior por seguridad:
```bash
sudo paccache -r
```

### Paso 3: Eliminar paquetes huérfanos del sistema
Los paquetes huérfanos son librerías que se instalaron como dependencias de un programa que ya borraste, por lo que quedan flotando en el disco sin ninguna utilidad. Bórralos con este comando:
```bash
sudo pacman -Rns $(pacman -Qdtq)
```
Si el sistema te responde que no hay objetivos para eliminar, significa que tu árbol de dependencias está completamente limpio.

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
* Puedes automatizar este mantenimiento para no tener que recordarlo. Pídele a tu sistema que ejecute una limpieza automática cada semana programando un "Systemd Timer" ejecutando el comando: sudo systemctl enable --now paccache.timer.

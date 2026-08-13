---
title: "Cómo solucionar errores de permisos en aplicaciones Flatpak con Flatseal"
description: "Aprende a diagnosticar y otorgar permisos de archivos, red y dispositivos a aplicaciones sandbox de Flatpak utilizando comandos de CLI y Flatseal."
category: "Sistemas y Servidores"
tags: ["Flatpak", "Linux", "Permissions"]
readTime: "4 min"
date: "2026-08-02"
---

Los errores de tipo **Permission Denied** en aplicaciones instaladas mediante Flatpak ocurren debido a la arquitectura de aislamiento (*sandbox*) que limita el acceso del programa al sistema de archivos del usuario, a dispositivos USB/GPU o a las interfaces de red de Linux salvo que el empaquetador o el usuario le hayan concedido permisos explícitos.

## Diagnóstico Rápido

| Causa | Solución |
|---|---|
| **La aplicación Flatpak no puede abrir/guardar archivos en `/media` o discos secundarios, o falla al acceder a carpetas personalizadas**: Restricción de aislamiento de seguridad (*sandbox*) predeterminada del paquete Flatpak | Ajustar los permisos de acceso al sistema de archivos usando `flatpak override` por terminal o con la interfaz gráfica **Flatseal** |

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Identificar el nombre de ID de la aplicación Flatpak

Para modificar las reglas de aislamiento de una aplicación en Linux, primero debes conocer su identificador único en formato inverso de dominio (ejemplo: `org.gimp.GIMP` o `com.visualstudio.code`). Lista tus aplicaciones instaladas con:

```bash
# Listar todas las aplicaciones Flatpak instaladas
flatpak list --app
```

### Paso 2: Otorgar acceso a carpetas locales mediante la CLI de Flatpak

Si una aplicación no puede leer o escribir archivos ubicados en una partición secundaria o en directorios personalizados como `/mnt` o `/media`, concédele acceso con el comando `override`:

```bash
# Conceder acceso a todo el sistema de archivos (Filesystem=host)
flatpak override com.visualstudio.code --filesystem=host

# O conceder acceso exclusivo a una carpeta específica (ej. /media/disco_secundario)
flatpak override com.visualstudio.code --filesystem=/media/disco_secundario
```

Para revertir cualquier cambio personalizado y volver a la configuración por defecto de la aplicación:
```bash
flatpak override com.visualstudio.code --reset
```

### Paso 3: Usar la interfaz gráfica Flatseal (Recomendado para escritorio)

**Flatseal** es una utilidad gráfica diseñada específicamente para gestionar permisos de aplicaciones Flatpak sin necesidad de memorizar comandos de terminal.

1. Instala Flatseal desde Flathub ejecutando:
   ```bash
   flatpak install flathub com.github.tchx84.Flatseal
   ```
2. Abre **Flatseal** desde el menú de aplicaciones de tu entorno de escritorio (GNOME, KDE Plasma, etc.).
3. Selecciona la aplicación afectada en el panel lateral izquierdo.
4. Desplázate hasta la sección **Filesystem** (Sistema de Archivos) y activa el interruptor **All user files** (`~/`) o añade la ruta personalizada en **Other files**.

### Paso 4: Corregir fallos de acceso a sockets y GPU

Si una aplicación requiere aceleración por hardware (Vulkan/OpenGL) o integración con el servidor de sonido (PipeWire/PulseAudio) y se cierra con errores de permisos, otorga acceso a los sockets del sistema:

```bash
# Permitir acceso al servidor de renderizado X11 / Wayland y dispositivos de aceleración
flatpak override <ID_DE_LA_APP> --socket=x11 --socket=wayland --device=dri
```

## 🛡️ Consejos de Prevención

- **Evitar otorgar `filesystem=host` indiscriminadamente**: Dar acceso global al sistema de archivos anula el beneficio de seguridad del aislamiento sandbox. Otorga acceso únicamente a las rutas necesarias.
- **Verificar actualizaciones de manifiesto**: Tras actualizar un Flatpak, revisa si los mantenedores han añadido nuevos portales nativos (XDG Desktop Portals), lo que evita la necesidad de overrides manuales.
- **Usar `--user` para configuraciones locales**: Si compartes el equipo con varios usuarios, aplica las anulaciones de permisos exclusivamente a tu cuenta utilizando la bandera `flatpak override --user`.

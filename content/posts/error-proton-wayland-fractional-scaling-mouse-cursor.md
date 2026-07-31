---
title: Cómo solucionar problemas de cursor desalineado y escalado en juegos con Proton en Wayland
description: >-
  Guía para reparar la desalineación del cursor del ratón, clics fuera de objetivo y desenfoque por escalado fraccional en juegos ejecutados con Steam Proton en Wayland.
category: Gaming Tech
tags:
  - Proton
  - Wayland
  - Gaming
readTime: 4 min
date: '2026-08-04'
---

Al ejecutar juegos de Windows en Linux utilizando Steam Proton bajo un servidor de pantalla Wayland con **escalado fraccional** activado (por ejemplo, 125%, 150% o 175% en monitores 1440p o 4K), es habitual experimentar desincronía del cursor del ratón. Los síntomas incluyen un cursor de ratón desalineado que hace clic varios centímetros al lado de los botones de la interfaz del juego, una imagen borrosa por reescalado de Xwayland o la imposibilidad de atrapar (*mouse confinement*) el ratón dentro de la ventana del juego.

## 🔍 El Diagnóstico Rápido

| Síntoma | Causa Raíz | Solución |
| :--- | :--- | :--- |
| El ratón hace clic en una posición desplazada respecto a la ubicación del puntero visible en pantalla | Xwayland aplica un escalado por software a la ventana del juego mientras Wine lee las coordenadas del ratón sin escalar | Desactivar el escalado de Xwayland por el sistema o habilitar la captura nativa de ratón en Proton |
| La ventana del juego se ve borrosa a resolución nativa cuando el escalado de pantalla no es 100% | El compositor fuerza a Xwayland a renderizar a menor resolución y escalar el mapa de píxeles | Configurar `WAYLAND_DISPLAY` y utilizar el nuevo driver nativo Wayland en Wine (Wine 9.0+ / Proton Experimental) |
| El puntero del ratón se escapa de la pantalla del juego en configuraciones multimonitor | Falta la implementación del protocolo `relative-pointer` o `pointer-constraints` en Xwayland | Activar `PROTON_ENABLE_WAYLAND=1` o ajustar el bloqueo de cursor en Wine Explorer |

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Configurar el comportamiento de escalado de Xwayland en el escritorio
En entornos como KDE Plasma o GNOME, asegúrate de que las aplicaciones X11/Xwayland sean escaladas por la propia aplicación y no por el compositor:

En **KDE Plasma**:
1. Ve a *Preferencias del Sistema > Pantalla y Monitor > Escalado*.
2. En la opción **"Escalado para aplicaciones legacy (X11)"**, selecciona **"Aplicadas por las propias aplicaciones"** (Apply scaling themselves) en lugar de "Escaladas por el sistema".

En **GNOME / Hyprland**:
Para Hyprland, añade la regla de ventana o deshabilita la escala forzada de Xwayland en tu archivo de configuración:
```ini
# En hyprland.conf
xwayland {
    force_zero_scaling = true
}
```

### Paso 2: Habilitar el Driver Nativo de Wayland en Proton Experimental / Proton GE
A partir de Wine 9.0 y versiones recientes de Proton (Proton Experimental o GE-Proton 9+), es posible prescindir totalmente de Xwayland y ejecutar la ventana del juego usando la ventana nativa de Wayland, eliminando por completo la desalineación del ratón:

Abre las **Propiedades del juego en Steam > Parámetros de lanzamiento** e introduce las siguientes variables de entorno:

```bash
# Para versiones recientes de Proton GE o Wine 9.0+ con soporte Wayland nativo:
PROTON_ENABLE_WAYLAND=1 %command%

# Opcional: Para evitar que el juego altere la resolución del escritorio en pantallas primarias:
DISPLAY= PROTON_ENABLE_WAYLAND=1 %command%
```

### Paso 3: Configurar captura de ratón en el registro de Wine (Wineprefix)
Si un juego específico continúa perdiendo el foco o desalineando el cursor al pasar entre menús y pantalla completa, fuerza el confinamiento del puntero modificando las claves de registro de Wine dentro de la carpeta `compatdata` de Steam:

```bash
# Asumiendo AppID del juego (ejemplo: 1086940 para Baldur's Gate 3)
WINEPREFIX=~/.steam/steam/steamapps/compatdata/1086940/pfx winecfg
```
En la pestaña **Gráficos** de `winecfg`:
1. Marca **"Capturar automáticamente el ratón en ventanas a pantalla completa"**.
2. Desmarca **"Permitir al gestor de ventanas controlar las ventanas"** si el cursor no puede atrapar los bordes.

Alternativamente, puedes inyectarlo vía script en el prefijo:
```bash
WINEPREFIX=~/.steam/steam/steamapps/compatdata/<APPID>/pfx reg add "HKCU\\Software\\Wine\\DirectInput" /v "MouseWarpOverride" /d "force" /f
```

## 🛡️ Consejos de Prevención

- **Usa resoluciones nativas dentro del juego**: Cuando uses escalado fraccional en el escritorio (ej. 150%), selecciona la resolución física nativa del monitor (ej. 3840x2160) dentro de las opciones gráficas del juego y ajusta el tamaño de la UI con tecnologías de reescalado como FSR o DLSS.
- **Utiliza Proton-GE reciente**: Mantén tus versiones de Proton-GE actualizadas mediante herramientas como `ProtonUp-Qt` para obtener los últimos parches para los protocolos `relative-pointer-v1` y `pointer-constraints-v1` de Wayland.
- **Desactiva capas de Overlays incompatibles**: Desactiva overlays de terceros que usen ganchos X11 obsoletos, ya que pueden interferir con las coordenadas del cursor proyectadas en Xwayland.

---
title: "Cómo reducir el retraso de entrada (input lag) para gaming competitivo en Linux"
description: "Optimiza la latencia y la respuesta de tus periféricos configurando el servidor gráfico Wayland o X11 y los perfiles de energía del sistema."
category: "Gaming Tech"
tags: ["Gaming", "Linux", "Performance"]
readTime: "4 min"
date: "2026-07-06"
---

El retraso de entrada o *input lag* excesivo al jugar títulos competitivos en Linux ocurre por la acumulación de búferes en el servidor de composición gráfica (especialmente en Wayland con sincronización vertical forzada) y por la configuración de ahorro de energía activa por defecto que suspende o ralentiza la frecuencia de respuesta de los puertos USB.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Configurar la frecuencia de sondeo (polling rate) de tus periféricos
Para que tu ratón y teclado competitivo respondan instantáneamente, fuerza al controlador del kernel a usar una tasa de refresco constante de 1000 Hz en los puertos USB:
```bash
# Crear un archivo de reglas para el módulo del ratón USB
echo "options usbhid mousepoll=1" | sudo tee /etc/modprobe.d/usbhid.conf

# Recargar el módulo HID para aplicar los cambios de inmediato
sudo rmmod usbhid && sudo modprobe usbhid
```

### Paso 2: Desactivar la sincronización vertical y activar desgarro (tearing) en Wayland
Si usas entornos KDE Plasma o GNOME bajo Wayland, la sincronización vertical añade latencia. Permite el desgarro de pantalla en juegos a pantalla completa para eliminar el retraso de dibujado:
```bash
# En KDE Plasma 6, añade esta regla a tu configuración local para permitir Tearing
kwriteconfig6 --file kwinrc --group Wayland --key AllowTearing true

# Reiniciar el compositor gráfico para aplicar
systemctl --user restart plasma-kwin_wayland
```

### Paso 3: Configurar el daemon de energía en modo Rendimiento
Evita que el regulador del procesador de Linux reduzca la frecuencia de reloj del bus de datos del sistema durante tus partidas de juego:
```bash
# Cambiar el perfil de energía del sistema a alto rendimiento
powerprofilesctl set performance

# Verificar que el perfil se haya activado correctamente
powerprofilesctl get
```

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
- No configures frecuencias de sondeo superiores a 1000 Hz (como ratones de 4000 Hz u 8000 Hz) si tu procesador no cuenta con al menos 6 núcleos físicos modernos dedicados. Una tasa de sondeo sobredimensionada consumirá ciclos masivos del procesador para atender las interrupciones del puerto USB de manera constante, lo que resultará en tirones gráficos repentinos (*frame drops*) y una menor tasa media de FPS durante tus partidas de juego.

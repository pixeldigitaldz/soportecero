---
title: "Cómo configurar la velocidad del ventilador (Active Cooler) mediante consola de comandos"
description: "Aprende a controlar los umbrales de temperatura y ajustar la velocidad del ventilador en Mini PCs y placas de desarrollo mediante la terminal para evitar sobrecalentamientos."
category: "Sistemas y Servidores"
tags: ["Hardware", "Linux", "Raspberry Pi"]
readTime: "3 min"
date: "2026-06-26"
---

Las placas de desarrollo y Mini PCs modernos (como la Raspberry Pi 5) ofrecen un rendimiento increíble, pero disipan mucho calor cuando ejecutas servicios pesados de Docker o servidores multimedia. El uso de un **Active Cooler (disipador activo con ventilador)** es obligatorio para evitar el *thermal throttling* (reducción automática de potencia por exceso de temperatura).

Por defecto, el sistema operativo gestiona el ventilador de forma automática, pero muchas veces los umbrales de fábrica son muy altos, permitiendo que la placa alcance los 60°C antes de encender el aire, acortando la vida útil del hardware.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Verificar la temperatura actual por consola
Abre la terminal de tu sistema operativo basado en Linux y ejecuta el siguiente comando para conocer la temperatura exacta del procesador en tiempo real:
```bash
vcgencmd measure_temp
```

### Paso 2: Editar el archivo de configuración de arranque
En sistemas basados en Raspberry Pi OS, podemos modificar los parámetros de activación editando el archivo config.txt. Abre el editor con privilegios de administrador:
```bash
sudo nano /boot/firmware/config.txt
```
(Nota: En versiones antiguas de sistemas operativos, la ruta puede ser simplemente `/boot/config.txt`).

### Paso 3: Definir los nuevos umbrales de temperatura (Cooling Trip Points)
Desplázate hasta el final del archivo y añade las siguientes líneas para personalizar los grados exactos a los que el ventilador cambiará de velocidad (los valores corresponden a miligrados Celsius, por ejemplo 50000 equivale a 50°C):
```plaintext
# Ajuste personalizado del Active Cooler
dtparam=fan_temp0=45000
dtparam=fan_temp0_hyst=5000
dtparam=fan_temp1=52000
dtparam=fan_temp1_hyst=5000
dtparam=fan_temp2=60000
dtparam=fan_temp2_hyst=5000
```
Guarda el archivo presionando `Ctrl + O`, confirma con `Enter` y sal con `Ctrl + X`.

### Paso 4: Reiniciar el sistema
Para aplicar los cambios de hardware en las tablas de configuración internas, aplica un reinicio limpio:
```bash
sudo reboot
```

## 🛡️ Consejo de Prevención
Prácticas de seguridad recomendadas:
- Evita conexiones directas de ventiladores genéricos a los pines GPIO de 5V/GND sin control PWM, ya que si el ventilador consume demasiada corriente o intentas cablearlo de forma incorrecta, puedes provocar un cortocircuito letal que dañe la placa permanentemente (dejándola con un LED rojo fijo de muerte). Usa siempre accesorios oficiales conectados al conector dedicado de ventilador JST.

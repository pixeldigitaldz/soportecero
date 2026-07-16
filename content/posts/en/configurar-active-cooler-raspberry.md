---
title: "How to Configure Fan Speed (Active Cooler) via Command Console"
description: "Learn how to control temperature thresholds and adjust fan speed on Mini PCs and development boards using the terminal to prevent overheating."
category: "Systems & Servers"
tags: ["Hardware", "Linux", "Raspberry Pi"]
readTime: "3 min"
date: "2026-07-19"
---

Modern development boards and Mini PCs (such as the Raspberry Pi 5) offer incredible performance, but dissipate a lot of heat when running heavy Docker services or media servers. The use of an **Active Cooler (active heatsink with fan)** is mandatory to prevent *thermal throttling* (automatic power reduction due to excess temperature).

By default, the operating system manages the fan automatically, but often the factory thresholds are very high, allowing the board to reach 60°C before turning on the air, shortening the life of the hardware.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Verificar la temperatura actual por consola
Open the terminal of your Linux-based operating system and run the following command to know the exact processor temperature in real time:
```bash
vcgencmd measure_temp
```

### Paso 2: Editar el archivo de configuración de arranque
On systems based on Raspberry Pi OS, we can modify the activation parameters by editing the config.txt file. Open the editor with administrator privileges:
```bash
sudo nano /boot/firmware/config.txt
```
(Nota: En versiones antiguas de sistemas operativos, la ruta puede ser simplemente `/boot/config.txt`).

### Paso 3: Definir los nuevos umbrales de temperatura (Cooling Trip Points)
Scroll to the end of the file and add the following lines to customize the exact degrees at which the fan will change speed (the values correspond to millidegrees Celsius, for example 50000 is equivalent to 50°C):
```plaintext
# Ajuste personalizado del Active Cooler
dtparam=fan_temp0=45000
dtparam=fan_temp0_hyst=5000
dtparam=fan_temp1=52000
dtparam=fan_temp1_hyst=5000
dtparam=fan_temp2=60000
dtparam=fan_temp2_hyst=5000
```
Save the file by pressing `Ctrl + O`, confirm with `Enter` and exit with `Ctrl + X`.

### Paso 4: Reiniciar el sistema
To apply hardware changes in the internal configuration tables, perform a clean reboot:
```bash
sudo reboot
```

## 🛡️ Consejo de Prevención
Recommended safety practices:
- Avoid direct connections of generic fans to the 5V/GND GPIO pins without PWM control, because if the fan consumes too much current or you try to wire it incorrectly, you can cause a lethal short circuit that damages the board permanently (leaving it with a solid red LED of death). Always use official accessories connected to the dedicated JST fan connector.

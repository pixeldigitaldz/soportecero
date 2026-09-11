---
title: "[SOLUCIONADO] Desconexión de mandos Bluetooth (Xbox / PS5) en Steam y Linux"
description: "Elimina los cortes de conexión, retraso de entrada y desvinculaciones aleatorias de mandos Xbox y DualSense en Steam sobre distribuciones Linux."
category: "Gaming Tech"
tags: ["Gaming","Bluetooth","Linux","Steam"]
readTime: "4 min"
date: "2026-10-03"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Gestión de ahorro de energía agresiva del kernel en el adaptador Bluetooth (autosuspend)** | Deshabilitar el autosuspend de Bluetooth mediante reglas de udev o parámetros de kernel |
| **Controlador xpad predeterminado incompatible con el firmware reciente de mandos Xbox inalámbricos** | Instalar el módulo de kernel xpadneo para mandos Xbox o habilitar soporte DualSense nativo |

Al jugar en Linux o Steam Deck con mandos inalámbricos (Xbox Series, DualSense de PS5, Switch Pro), muchos usuarios sufren desconexiones continuas cada pocos minutos, luces parpadeantes o botones que no responden tras periodos breves de inactividad. Este comportamiento lo provoca la directiva de ahorro de energía del subsistema Bluetooth y la falta de controladores de vibración adecuados.

> **Solución Rápida (1 Minuto):**
> 1. Desactiva la suspensión de energía Bluetooth en runtime:
>    `sudo sed -i 's/#AutoEnable=false/AutoEnable=true/' /etc/bluetooth/main.conf`
> 2. Para mandos Xbox, instala el controlador xpadneo:
>    `sudo apt install dkms && git clone https://github.com/atar-axis/xpadneo && sudo ./xpadneo/install.sh`

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Instalar el controlador avanzado xpadneo para mandos Xbox
El controlador estándar del kernel (`xpad`) tiene problemas graves de desvinculación con el firmware moderno de mandos Xbox Series/One por Bluetooth. Instala `xpadneo`:
```bash
# En distribuciones basadas en Arch / Manjaro
yay -S xpadneo-dkms

# En Ubuntu / Debian / Fedora
sudo apt install -y dkms linux-headers-$(uname -r)
git clone https://github.com/atar-axis/xpadneo
cd xpadneo
sudo ./install.sh
```
Reinicia el sistema o vuelve a sincronizar el mando.

### Paso 2: Desactivar el ahorro de energía agresivo en adaptadores Bluetooth USB
Linux suspende los adaptadores Bluetooth USB para ahorrar energía si no detecta paquetes constantes. Desactiva el autosuspensión USB creando una regla de udev:
```bash
echo 'ACTION=="add", SUBSYSTEM=="usb", ATTR{idVendor}=="*", ATTR{bInterfaceClass}=="e0", ATTR{power/control}="on"' | sudo tee /etc/udev/rules.d/50-bluetooth-power.rules
sudo udevadm control --reload-rules
sudo udevadm trigger
```

### Paso 3: Configurar el servicio BlueZ para reconexión instantánea
Edita la configuración central del demonio Bluetooth en `/etc/bluetooth/main.conf`:
```ini
[General]
FastConnectable=true
ReconnectAttempts=7
ReconnectIntervals=1, 2, 4, 8, 16, 32, 64
AutoEnable=true
```
Aplica los cambios reiniciando el servicio:
```bash
sudo systemctl restart bluetooth
```

## 🛡️ Consejo de Prevención
* Actualiza el firmware de tu mando Xbox conectándolo temporalmente a un equipo con Windows usando la aplicación Accesorios de Xbox.
* Evita utilizar adaptadores Bluetooth USB 2.0 baratos conectados a puertos USB 3.0 adyacentes que puedan sufrir interferencias de radiofrecuencia.

## Preguntas Frecuentes

### ¿Por qué el mando DualSense de PS5 se desconecta al pulsar el touchpad en Linux?
Ocurre cuando el kernel interpreta el touchpad como un ratón de escritorio y entra en conflicto con Steam Input. Desactiva la opción "Usar como ratón" en los ajustes de Steam Controller.

### ¿Cómo verifico la señal de la conexión Bluetooth?
Ejecuta `bluetoothctl info <MAC_DEL_MANDO>` para comprobar el valor RSSI. Si es inferior a -75 dBm, la señal sufre interferencias físicas o distancia excesiva.

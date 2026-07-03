---
title: "Cómo evitar el estrangulamiento térmico (thermal throttling) en Raspberry Pi 5"
description: "Aprende a diagnosticar caídas de rendimiento por temperatura y configura los umbrales de enfriamiento en tu mini PC Raspberry Pi 5."
category: "Sistemas y Servidores"
tags: ["Raspberry Pi", "Hardware", "Linux"]
readTime: "4 min"
date: "2026-07-20"
---

El estrangulamiento térmico o *thermal throttling* en Raspberry Pi 5 ocurre cuando el procesador sobrepasa los 80 °C en tareas exigentes. Para evitar daños por calor, el controlador del microcódigo reduce automáticamente la frecuencia del procesador de 2.4 GHz a menos de 1.5 GHz, lo que degrada drásticamente el rendimiento de tus contenedores o emuladores.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Diagnosticar la temperatura y el estrangulamiento en tiempo real
Puedes comprobar la temperatura del procesador y verificar si el núcleo de Linux ha registrado alertas de reducción de velocidad de reloj mediante consola:
```bash
# Consultar la temperatura del CPU en grados Celsius
vcgencmd measure_temp

# Verificar si existen códigos de error por voltaje o calor (un valor distinto de 0x0 indica problemas)
vcgencmd get_throttled
```

### Paso 2: Ajustar los umbrales del ventilador oficial (Active Cooler)
Asegura que el ventilador de tu disipador oficial comience a girar al 100% antes de alcanzar la temperatura crítica de 80 °C editando los parámetros del firmware:
```bash
# Abrir el archivo de configuración del arranque
sudo nano /boot/firmware/config.txt
```
Agrega estas líneas al final del archivo para programar que el ventilador se active al máximo a partir de los 65 °C:
```plaintext
# Forzar enfriamiento agresivo
dtparam=fan_temp0=50000
dtparam=fan_temp0_hyst=5000
dtparam=fan_temp1=58000
dtparam=fan_temp1_hyst=5000
dtparam=fan_temp2=65000
dtparam=fan_temp2_hyst=5000
```

### Paso 3: Aplicar y validar la nueva tabla térmica
Guarda los cambios presionando `Ctrl + O` y reinicia tu placa de desarrollo para que el microcontrolador de energía aplique las directivas:
```bash
# Reiniciar el dispositivo
sudo reboot
```

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
- No utilices cajas o gabinetes completamente cerrados y sin rejillas de ventilación activa para alojar tu Raspberry Pi 5 en producción. La Pi 5 disipa casi el doble de calor bajo carga máxima comparada con la generación anterior, por lo que depender exclusivamente de disipación pasiva de aluminio sin flujo de aire constante saturará térmicamente el gabinete en pocos minutos, forzando al procesador a trabajar permanentemente en modo degradado.

---
title: "Cómo diagnosticar y solucionar problemas de velocidad de red ajustando el tamaño de MTU"
description: "Aprende a diagnosticar la fragmentación de paquetes y optimiza el tamaño de la Unidad de Transmisión Máxima (MTU) de tu tarjeta de red."
category: "Sistemas y Servidores"
tags: ["Network", "Linux", "Sysadmin"]
readTime: "4 min"
date: "2026-06-27"
---

Los problemas de velocidad de red intermitente, las descargas interrumpidas o la imposibilidad de cargar ciertos portales web seguros ocurren a menudo por una mala configuración del tamaño de la **Unidad de Transmisión Máxima (MTU)** de tu tarjeta de red. Si tu proveedor exige paquetes más pequeños que el estándar de tu sistema, los enrutadores intermedios deben fragmentar los datos, degradando el rendimiento.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Diagnosticar la fragmentación de paquetes mediante pruebas de Ping
Vamos a buscar el tamaño máximo de paquete que tu red puede transferir sin necesidad de dividir los datos. Corre la prueba restando la cabecera IP/ICMP de 28 bytes de tu objetivo:
```bash
# Probar el tamaño de paquete en Linux (ejemplo para 1472 bytes de datos)
ping -M do -s 1472 8.8.8.8
```
*(Si la terminal te responde `Packet needs to be fragmented but DF set`, significa que el paquete es demasiado grande. Reduce el número en incrementos de 10 hasta encontrar el valor exacto que responda sin fragmentar, por ejemplo 1420 bytes, y súmale los 28 bytes de cabecera: `1420 + 28 = 1448 MTU`).*

### Paso 2: Aplicar el tamaño de MTU óptimo en tu tarjeta de red
Una vez detectado el valor correcto, configura la interfaz de red de tu sistema operativo (reemplaza `eth0` por tu tarjeta activa):
```bash
# Cambiar el MTU temporalmente en Linux
sudo ip link set dev eth0 mtu 1448

# Verificar que los parámetros de red se hayan actualizado
ip link show eth0
```

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
- No incrementes de forma arbitraria el tamaño de MTU a valores superiores a 1500 (Jumbo Frames) si no tienes la certeza de que todos los conmutadores y enrutadores de tu red local soportan esta característica por hardware. Configurar un MTU sobredimensionado provocará que las solicitudes de red se descarten por completo debido a desajustes de búfer, dejando tu máquina incomunicada de forma inmediata.

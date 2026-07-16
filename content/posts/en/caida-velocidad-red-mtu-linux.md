---
title: "How to Diagnose and Fix Network Speed Issues by Adjusting MTU Size"
description: "Learn how to diagnose packet fragmentation and optimize the Maximum Transmission Unit (MTU) size of your network card."
category: "Systems & Servers"
tags: ["Network", "Linux", "Sysadmin"]
readTime: "4 min"
date: "2026-07-19"
---

Intermittent network speed issues, interrupted downloads, or the inability to load certain secure web portals often occur due to a poor configuration of the **Maximum Transmission Unit (MTU)** size of your network card. If your provider requires packages smaller than your system's standard, intermediate routers must fragment the data, degrading performance.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Diagnosticar la fragmentación de paquetes mediante pruebas de Ping
We are going to find the maximum packet size that your network can transfer without needing to split the data. Run the test by subtracting the 28-byte IP/ICMP header from your target:
```bash
# Probar el tamaño de paquete en Linux (ejemplo para 1472 bytes de datos)
ping -M do -s 1472 8.8.8.8
```
*(Si la terminal te responde `Packet needs to be fragmented but DF set`, significa que el paquete es demasiado grande. Reduce el número en incrementos de 10 hasta encontrar el valor exacto que responda sin fragmentar, por ejemplo 1420 bytes, y súmale los 28 bytes de cabecera: `1420 + 28 = 1448 MTU`).*

### Paso 2: Aplicar el tamaño de MTU óptimo en tu tarjeta de red
Once the correct value is detected, configure your operating system's network interface (replace `eth0` with your active card):
```bash
# Cambiar el MTU temporalmente en Linux
sudo ip link set dev eth0 mtu 1448

# Verificar que los parámetros de red se hayan actualizado
ip link show eth0
```

## 🛡️ Consejo de Prevención

Recommended safety practices:
- Do not arbitrarily increase the MTU size to values higher than 1500 (Jumbo Frames) unless you are certain that all switches and routers in your local network support this feature via hardware. Configuring an oversized MTU will cause network requests to be completely dropped due to buffer mismatches, leaving your machine cut off immediately.

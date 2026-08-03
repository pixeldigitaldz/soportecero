---
title: "[SOLUCIONADO] cloud-init Retarda el Arranque en Proxmox / Ubuntu Server"
description: "¿Tu máquina virtual Proxmox o Ubuntu Server tarda minutos en arrancar por 'cloud-init waiting for network config'? Solución paso a paso."
category: "Sistemas y Servidores"
tags: ["Proxmox", "Cloud-Init", "Ubuntu", "Sysadmin"]
readTime: "4 min"
date: "2026-08-03"
---

El mensaje **`cloud-init: waiting for network config`** o la demora de 2 a 5 minutos en la pantalla de inicio de máquinas virtuales Ubuntu Server en **Proxmox VE, KVM o AWS** ocurre cuando la suite de inicialización `cloud-init` intenta consultar servicios DHCP o metadatos de red en interfaces secundarias no configuradas.

> **Solución Rápida (1 Minuto):**
> Desactiva la espera del servicio de red al arrancar ejecutando:
> ```bash
> sudo systemctl disable cloud-init-main.service
> sudo touch /etc/cloud/cloud-init.disabled
> ```

## 🚀 Cómo solucionar la lentitud de inicio por cloud-init paso a paso

### Paso 1: Identificar el servicio bloqueante durante el arranque
Comprueba los tiempos de inicialización del sistema usando `systemd-analyze`:

```bash
systemd-analyze blame | grep cloud-init
```
Si la salida muestra `cloud-init-local.service` o `cloud-config.service` consumiendo más de 60 segundos, `cloud-init` está esperando respuestas de red inexistentes.

### Paso 2: Desactivar cloud-init tras la instalación inicial
En entornos donde la VM ya fue provisionada con IP estática o hostname fijo y no requiere reconfiguraciones continuas, desactiva la suite por completo:

```bash
# Crear el archivo indicador de desactivacion permanente
sudo touch /etc/cloud/cloud-init.disabled

# Detener y deshabilitar los servicios de systemd
sudo systemctl disable cloud-init.service
sudo systemctl disable cloud-init-local.service
sudo systemctl disable cloud-config.service
sudo systemctl disable cloud-final.service
```

### Paso 3: Optimizar Netplan en Ubuntu Server
Si utilizas **Netplan** (sistema de red predeterminado en Ubuntu Server), asegúrate de que la interfaz principal no bloquee la secuencia de booteo si DHCP tarda en responder:

Abre el archivo de red en `/etc/netplan/`:
```bash
sudo nano /etc/netplan/50-cloud-init.yaml
```
Añade el parámetro `optional: true` debajo de la interfaz:
```yaml
network:
  version: 2
  ethernets:
    eth0:
      dhcp4: true
      optional: true
```
Aplica la configuración con:
```bash
sudo netplan apply
```

## 🛡️ Consejo de Prevención
* En plantillas de Proxmox (*Templates*), configura correctamente la pestaña **Cloud-Init** asignando IP y gateway estáticos antes de convertir la VM en plantilla.

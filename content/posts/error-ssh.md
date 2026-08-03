---
title: "[SOLUCIONADO] Error SSH Connection Refused en Linux (Paso a Paso)"
description: "¿Te sale 'connection refused ssh' al conectar al puerto 22 de tu servidor? Soluciona el error de SSH en menos de 5 minutos con esta guía práctica."
category: "Sistemas y Servidores"
tags: ["SSH", "Linux", "Firewall"]
readTime: "3 min"
date: "2026-06-26"
---

El error **SSH Connection Refused** (o `connection refused ssh`) ocurre cuando tu cliente intenta conectarse a un servidor remoto, pero el puerto 22 rechaza la solicitud. Esto sucede principalmente porque el servicio **OpenSSH está detenido**, el **puerto SSH fue cambiado** o el **firewall (UFW/iptables)** bloquea el puerto 22.

> **Solución Rápida (1 Minuto):**
> 1. Inicia SSH: `sudo systemctl enable --now sshd`
> 2. Abre el puerto en el firewall: `sudo ufw allow 22/tcp && sudo ufw reload`
> 3. Verifica el puerto actual: `grep -i "port" /etc/ssh/sshd_config`

## 🚀 Cómo solucionar el error SSH Connection Refused paso a paso

### Paso 1: Verificar el estado del servicio OpenSSH en el servidor
Si tienes acceso local o mediante la consola KVM / Web Console de tu VPS, comprueba si el demonio SSH está ejecutándose:
```bash
sudo systemctl status ssh || sudo systemctl status sshd
```
Si el estado es `inactive` o `dead`, inicialízalo y habilítalo para que inicie automáticamente con el sistema:
```bash
sudo systemctl enable --now ssh
```

### Paso 2: Comprobar el puerto SSH activo (Puerto 22 u otro)
Si el servicio está activo pero sigues recibiendo el error, revisa si se cambió el puerto 22 por defecto en el archivo de configuración:
```bash
sudo grep -i "Port" /etc/ssh/sshd_config
```
Si el archivo muestra un puerto alternativo (por ejemplo `Port 2222`), debes especificarlo en tu cliente SSH:
```bash
ssh usuario@tu-ip -p 2222
```

### Paso 3: Configurar reglas del Firewall (UFW / iptables / Firewalld)
Asegúrate de que el cortafuegos permita las conexiones entrantes en el puerto de SSH (puerto 22):
```bash
# Para UFW (Ubuntu / Debian)
sudo ufw allow ssh
sudo ufw reload

# Para Firewalld (RHEL / CentOS / AlmaLinux)
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --reload
```

## 🛡️ Consejo de Prevención
Prácticas de seguridad recomendadas para SSH:
* No uses el puerto 22 por defecto en servidores de producción expuestos a internet.
* Deshabilita el acceso directo al usuario root modificando `/etc/ssh/sshd_config` (`PermitRootLogin no`).
* Configura la autenticación mediante Llaves SSH (`SSH Keys`) y deshabilita el acceso por contraseña.


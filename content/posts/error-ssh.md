---
title: "Cómo solucionar el error SSH Connection Refused (Rápido)"
description: "¿Te has quedado fuera de tu servidor? Soluciona el frustrante error de conexión SSH rechazada en menos de 5 minutos con nuestra guía paso a paso."
category: "Sistemas y Servidores"
tags: ["SSH", "Linux", "Firewall"]
readTime: "3 min"
date: "2026-06-26"
---

El error `Connection Refused` al intentar conectar por SSH significa que el cliente logró comunicarse con el servidor anfitrión, pero este rechazó activamente la solicitud en el puerto 22. Esto suele ocurrir porque el servicio OpenSSH no está activo, el puerto fue modificado o el firewall está bloqueando el acceso.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Verificar el estado del servicio en el servidor
Si tienes acceso local o mediante la consola web de tu VPS, ejecuta:
```bash
sudo systemctl status ssh
```
Si el estado es inactive (dead), inicialízalo y habilítalo para que cargue con el sistema de inmediato:
```bash
sudo systemctl enable --now ssh
```

### Paso 2: Comprobar el puerto activo
Si el servicio está corriendo, revisa si se cambió el puerto 22 por defecto por motivos de seguridad:
```bash
sudo grep "Port" /etc/ssh/sshd_config
```
Si la salida muestra un puerto alternativo (ej. Port 2222), conéctate especificándolo en tu terminal local usando: `ssh usuario@ip -p 2222`.

### Paso 3: Configurar reglas del Firewall (UFW)
Asegúrate de que el cortafuegos permita las conexiones entrantes en el puerto de SSH:
```bash
sudo ufw allow ssh
sudo ufw reload
```

## 🛡️ Consejo de Prevención
Prácticas de seguridad recomendadas:
* No uses el puerto 22 por defecto en servidores públicos.
* Deshabilita el acceso directo al usuario root modificando el archivo sshd_config.
* Fuerza la autenticación mediante Llaves SSH en lugar de contraseñas convencionales.

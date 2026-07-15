---
title: "Cómo solucionar el error Connection Timeout en conexiones SSH por reglas de firewall"
description: "Aprende a diagnosticar bloqueos de conexión en el puerto 22 y configura correctamente las reglas de IPTables o UFW para permitir el acceso remoto seguro."
category: "Sistemas y Servidores"
tags: ["SSH", "Sysadmin", "Firewall"]
readTime: "4 min"
date: "2026-07-25"
---

El error de tiempo de espera agotado en el **puerto 22** (`ssh: connect to host ... port 22: Connection timed out`) ocurre cuando el cortafuegos del servidor destino (generalmente IPTables o UFW en Ubuntu/Debian) bloquea o descarta silenciosamente los paquetes de red entrantes en el puerto 22, impidiendo la autenticación del cliente.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Diagnosticar si el puerto SSH está bloqueado o cerrado
Intenta realizar una comprobación directa de red hacia el puerto del servidor desde tu consola de comandos local para verificar si responde a peticiones TCP:
```bash
# Comprobar la respuesta del puerto 22 (SSH) en tu servidor
nc -zv 192.168.1.100 22
```
*(Si la salida indica "Connection timed out" o no devuelve nada, el puerto está bloqueado en el firewall local o de red).*

### Paso 2: Habilitar el tráfico SSH en UFW (Uncomplicated Firewall)
Si tu servidor utiliza UFW como front-end de firewall, habilita explícitamente el acceso remoto seguro y recarga las directivas del kernel:
```bash
# Permitir conexiones entrantes en el puerto de SSH por defecto
sudo ufw allow 22/tcp

# Habilitar el cortafuegos si estaba inactivo y recargar reglas
sudo ufw enable && sudo ufw reload
```

### Paso 3: Configurar reglas explícitas en IPTables
Si trabajas en sistemas sin UFW o necesitas mayor granularidad en IPTables, abre el puerto SSH de forma directa en tu cadena de entrada:
```bash
# Aceptar paquetes TCP de entrada para el puerto 22
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Guardar las reglas para que persistan tras reiniciar el servidor
sudo iptables-save | sudo tee /etc/iptables/rules.v4
```

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
- No expongas el puerto SSH predeterminado (22) de forma abierta a cualquier dirección IP de Internet (`0.0.0.0/0`). Hacer esto saturará tus registros de autenticación con ataques automatizados de fuerza bruta en cuestión de minutos; en su lugar, limita el acceso únicamente al rango de direcciones IP de tu red de trabajo o VPN, o cambia el puerto SSH de escucha a uno no estándar en el archivo `/etc/ssh/sshd_config`.

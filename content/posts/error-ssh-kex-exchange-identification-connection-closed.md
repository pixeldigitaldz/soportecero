---
title: 'Troubleshooting: kex_exchange_identification: Connection closed by remote host en SSH'
description: 'Cómo solucionar el error de conexión SSH kex_exchange_identification Connection closed by remote host provocado por Fail2ban, límites de MaxStartups o bloqueos de red.'
category: 'Sistemas y Servidores'
date: '2026-08-25'
readTime: '3 min'
tags: ['SSH', 'Linux', 'Seguridad']
---

El error `kex_exchange_identification: Connection closed by remote host` (o `read: Connection reset by peer`) ocurre antes de que comience la autenticación SSH, durante la fase inicial de negociación de claves criptográficas (Key Exchange), debido a bloqueos en `hosts.deny`, límites de concurrencia en `MaxStartups` o baneos automáticos de Fail2ban.

Cuando el servidor rechaza abruptamente el handshake inicial de TCP/SSH, el cliente no llega a recibir el prompt de contraseña o clave pública.

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Límite de conexiones simultáneas superado (`MaxStartups`)** | Aumentar `MaxStartups` en `/etc/ssh/sshd_config` |
| **IP bloqueada por Fail2ban o `hosts.deny`** | Desbanear la IP con `fail2ban-client set sshd unbanip TU_IP` o revisar `/etc/hosts.deny` |
| **Reglas de rate-limiting en UFW o iptables** | Comprobar reglas de límite de conexiones SSH en el cortafuegos |

## La Solución Paso a Paso

**Ejecuta SSH en modo depuración detallado**
Para identificar en qué milisegundo exacto se corta la negociación, conéctate con el flag `-vvv`:
```bash
ssh -vvv usuario@ip-del-servidor
```
Si el cierre ocurre inmediatamente después de `SSH2_MSG_KEXINIT sent`, el servidor remoto está cerrando el socket deliberadamente por reglas de seguridad.

**Ajusta la directiva MaxStartups en el servidor SSH**
Si múltiples desarrolladores, herramientas CI/CD o conexiones automáticas de VS Code Remote se conectan a la vez, el daemon `sshd` empieza a descartar conexiones no autenticadas. Edita `/etc/ssh/sshd_config`:
```ini
# Formato: start:rate:full (ejemplo: comenzar a descartar al llegar a 50, descartar el 50%, bloqueo total en 100)
MaxStartups 50:30:100
MaxSessions 50
```
Reinicia el servicio SSH:
```bash
sudo systemctl restart sshd
```

**Verifica si tu IP pública fue baneada por Fail2ban**
Si realizaste intentos fallidos de conexión o abriste muchas pestañas SSH rápidamente, Fail2ban pudo haber añadido tu IP a la tabla de bloqueo:
```bash
sudo fail2ban-client status sshd
# Para desbanear tu IP:
sudo fail2ban-client set sshd unbanip 203.0.113.45
```

**Comprueba los archivos TCP Wrappers (/etc/hosts.allow y /etc/hosts.deny)**
En distribuciones con soporte de TCP Wrappers heredado, verifica que no exista una regla de denegación:
```bash
sudo cat /etc/hosts.deny
```
Si `/etc/hosts.deny` contiene `sshd: ALL`, debes añadir tu IP de confianza en `/etc/hosts.allow`:
```ini
sshd: 203.0.113.45, 192.168.1.0/24
```

## Prevención
- **Lista blanca en Fail2ban:** Agrega tus IPs corporativas o VPN fijas en la directiva `ignoreip` dentro de `/etc/fail2ban/jail.local`.
- **Uso de multiplexación SSH:** Habilita `ControlMaster` en tu archivo local `~/.ssh/config` para reutilizar una única conexión TCP para múltiples sesiones y terminales de VS Code.

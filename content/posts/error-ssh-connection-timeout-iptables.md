---
title: >-
  Cómo solucionar el error Connection Timeout en conexiones SSH por reglas de
  firewall
description: >-
  Aprende a diagnosticar bloqueos de conexión en el puerto 22 y configura
  correctamente las reglas de IPTables o UFW para permitir el acceso remoto
  seguro.
category: Sistemas y Servidores
tags:
  - SSH
  - Sysadmin
  - Firewall
readTime: 7 min
date: '2026-07-25'
---
El error de tiempo de espera agotado en el **puerto 22** (`ssh: connect to host ... port 22: Connection timed out`) ocurre cuando el cortafuegos del servidor destino (generalmente IPTables o UFW en Ubuntu/Debian) bloquea o descarta silenciosamente los paquetes de red entrantes en el puerto 22, impidiendo la autenticación del cliente.

## Análisis de Arquitectura y Causa Raíz

El protocolo **SSH (Secure Shell)**, estandarizado en RFC 4251-4254, provee un canal de comunicación criptográficamente seguro sobre redes no confiables, operando en la capa de aplicación sobre el protocolo de transporte TCP (puerto estándar 22). Su arquitectura comprende tres componentes desacoplados: la capa de transporte (autenticación del servidor, cifrado simétrico y verificación de integridad), el protocolo de autenticación de usuario, y el protocolo de conexión para multiplexar múltiples canales lógicos.

La causa raíz de esta incidencia radica en fallos de negociación criptográfica o restricciones en la capa de filtrado de paquetes del kernel:
1. **Algoritmos de Intercambio de Claves (KEX) y obsolescencia criptográfica:** Durante el saludo inicial (*handshake*), el cliente y el demonio `sshd` negocian un algoritmo de intercambio de claves seguro (ej. `curve25519-sha256` o `diffie-hellman-group14-sha256`). Si el cliente o el servidor tienen deshabilitados algoritmos heredados (por ejemplo tras una actualización de OpenSSH que desactiva claves SHA-1 o algoritmos RSA débiles), la negociación aborta de inmediato con el error `kex_exchange_identification: read: Connection reset by peer`.
2. **Verificación de huella digital y archivos `known_hosts`:** El cliente SSH protege al usuario contra ataques de intermediario (*Man-in-the-Middle*) cotejando la clave pública del servidor con el registro histórico almacenado en `~/.ssh/known_hosts`. Si el servidor remoto ha sido reinstalado, ha cambiado su par de claves o se ha reasignado la dirección IP en un entorno dinámico de nube, la huella digital criptográfica no coincidirá, activando un bloqueo de seguridad estricto por advertencia de ataque de spoofing.
3. **Bloqueo a nivel de Netfilter y saturación de conexiones:** Si se producen múltiples intentos de conexión fallidos o peticiones de autenticación concurrentes, módulos de seguridad como `fail2ban` o reglas en `iptables` / `nftables` descartan los paquetes entrantes (`DROP`), provocando que el cliente permanezca a la espera hasta agotar el tiempo límite (`Connection timed out`).

## Entorno de Laboratorio y Diagnóstico

Antes de aplicar cualquier cambio destructivo o reiniciar servicios en un entorno de producción, es fundamental ejecutar una matriz de diagnóstico preliminar para identificar la capa exacta donde ocurre el fallo:

| Causa | Solución |
|---|---|
| **Reglas de firewall iptables o UFW bloqueando el puerto SSH (22)** | Allow SSH port 22 in firewall: `sudo ufw allow 22/tcp` |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Comprobar el estado del servicio en el gestor de inicialización systemd
sudo systemctl status --no-pager -l sshd

# 2. Inspeccionar los registros del diario del sistema filtrando por unidad
sudo journalctl -u sshd -n 50 --no-pager

# 3. Auditar el espacio y tabla de inodos en todos los sistemas de archivos montados
df -Th && df -ih
```

- El flag `--no-pager` en `systemctl` y `journalctl` evita invocar el paginador interactivo (`less`), permitiendo redirigir la salida o analizar los registros sin interrumpir flujos de automatización.
- El comando `df` con los modificadores `-T` (tipo de sistema de archivos ext4/xfs/btrfs) y `-h` (formato legible en gigabytes/megabytes), combinado con `-i` (tabla de inodos disponibles), permite descartar si el disco está lleno por bytes reales o saturado por millones de archivos pequeños huérfanos.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

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

## 🛡️ Consejos de Prevención

Prácticas de seguridad recomendadas:
- No expongas el puerto SSH predeterminado (22) de forma abierta a cualquier dirección IP de Internet (`0.0.0.0/0`). Hacer esto saturará tus registros de autenticación con ataques automatizados de fuerza bruta en cuestión de minutos; en su lugar, limita el acceso únicamente al rango de direcciones IP de tu red de trabajo o VPN, o cambia el puerto SSH de escucha a uno no estándar en el archivo `/etc/ssh/sshd_config`.

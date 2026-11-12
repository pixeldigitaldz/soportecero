---
title: Cómo solucionar el error SSH Connection Refused (Puerto 22) en Linux
description: >-
  Aprende cómo solucionar el error SSH connection refused en el puerto 22 en Linux. Diagnóstico rápido de sshd caído, reglas de firewall ufw/iptables y puertos bloqueados.
category: Sistemas y Servidores
tags:
  - SSH
  - Linux
  - Firewall
readTime: 6 min
date: '2026-06-26'
---
Si al intentar conectar a tu servidor recibes el error ssh connection refused en el puerto 22, significa que el demonio OpenSSH rechazó activamente la conexión TCP entrante o no está escuchando en ese puerto. Descubre cómo diagnosticar en minutos si el servicio sshd está detenido, si el puerto 22 está bloqueado por el firewall (UFW o iptables) o si la configuración de red rechaza tu IP.

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
| **Servicio SSH (sshd) detenido en el servidor de destino** | Start SSH service daemon: `sudo systemctl start sshd` |

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

## 🛡️ Consejos de Prevención

Prácticas de seguridad recomendadas para SSH:
* No uses el puerto 22 por defecto en servidores de producción expuestos a internet.
* Deshabilita el acceso directo al usuario root modificando `/etc/ssh/sshd_config` (`PermitRootLogin no`).
* Configura la autenticación mediante Llaves SSH (`SSH Keys`) y deshabilita el acceso por contraseña.

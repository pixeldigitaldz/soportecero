---
title: Error 'Host key verification failed' en SSH
description: >-
  ¿Te sale el error 'Host key verification failed' o 'WARNING: REMOTE HOST
  IDENTIFICATION HAS CHANGED' al conectar por SSH? Solución en 1 minuto.
category: Sistemas y Servidores
tags:
  - SSH
  - Linux
  - Sysadmin
  - Seguridad
readTime: 7 min
date: '2026-08-03'
---
El error **`Host key verification failed`** (acompañado de la advertencia en rojo `WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!`) ocurre cuando tu cliente SSH detecta que la huella digital criptográfica del servidor al que te intentas conectar no coincide con la llave guardada en tu archivo local `~/.ssh/known_hosts`.

Ocurre comúnmente cuando reinstalas el sistema operativo de tu VPS, cambias de servidor manteniendo la misma dirección IP o reconfiguras las llaves del servicio OpenSSH.

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
| **La clave pública de la máquina remota cambió en el archivo known_hosts** | Remove stale host entry: `ssh-keygen -R HOST_OR_IP` |

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

Ejecuta la herramienta nativa de `ssh-keygen` indicando la IP o nombre de host del servidor remoto:

```bash
ssh-keygen -R 192.168.1.100
```
*(Reemplaza `192.168.1.100` por la IP o dominio de tu servidor).*

Este comando busca y elimina automáticamente la línea en conflicto dentro de tu archivo `~/.ssh/known_hosts` y genera un respaldo de seguridad (`known_hosts.old`).

### Paso 2: Volver a conectar y aceptar la nueva huella digital
Intenta conectar nuevamente por SSH:

```bash
ssh usuario@192.168.1.100
```
La terminal mostrará la nueva huella criptográfica SHA256 e interactuará preguntando:
```plaintext
Are you sure you want to continue connecting (yes/no/[fingerprint])?
```
Escribe `yes` y presiona **Enter**. SSH registrará la nueva firma en `known_hosts` y establecerá la conexión normalmente.

### Paso 3: Limpieza manual en `known_hosts` (Alternativa)
Si la advertencia indica el número de línea exacto (por ejemplo: `Offending RSA key in /home/usuario/.ssh/known_hosts:42`):

Puedes abrir el archivo en tu editor de texto y eliminar la línea 42:
```bash
nano +42 ~/.ssh/known_hosts
```
Guarda los cambios (`Ctrl + O` -> `Enter`) y sal (`Ctrl + X`).

## 🛡️ Advertencia de Seguridad Importante
* Si **NO** has reinstalado el servidor ni cambiado su configuración y este error aparece de la nada en un servidor remoto de producción, **no elimines la clave a ciegas**. Podrías estar sufriendo un ataque de interceptación en la red conocido como **Man-in-the-Middle (MITM)**. Contacta primero al administrador de red o soporte de tu proveedor de hosting.

## 🛡️ Consejos de Prevención

- **Automatización de respaldos:** Mantén copias de seguridad de las configuraciones y estados críticos antes de aplicar parches o actualizaciones masivas.
- **Auditoría periódica de logs:** Establece alertas tempranas ante códigos de error HTTP 5xx o excepciones de software mediante herramientas como Prometheus, Grafana o logs centralizados.
- **Principio de mínimo privilegio:** No asignes permisos `777` indiscriminadamente; utiliza permisos granulares como `644` para archivos estáticos y `755` para directorios.

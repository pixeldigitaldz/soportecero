---
title: Recuperar o Cambiar Contraseña de Root en Linux (Sin Formatear)
description: >-
  ¿Olvidaste la contraseña de root en Linux? Aprende a restablecer la clave del
  usuario root en menos de 3 minutos modificando GRUB.
category: Sistemas y Servidores
tags:
  - Linux
  - Sysadmin
  - Seguridad
readTime: 7 min
date: '2026-06-27'
---
Perder la **contraseña de root en Linux** (o contraseña de administrador superusuario) bloquea el acceso total a tu servidor o máquina virtual. Afortunadamente, no necesitas formatear: si tienes acceso físico o consola web KVM / IPMI, puedes recuperar o cambiar la clave de root editando los parámetros de inicio de **GRUB**.

> **Resumen de la Solución (3 Pasos):**
> 1. En el menú de **GRUB**, presiona `e`.
> 2. Añade `init=/bin/bash` al final de la línea `linux`. Presiona `Ctrl + X`.
> 3. Ejecuta: `mount -o remount,rw /` y luego `passwd root`.

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
| **Contraseña de superusuario root olvidada o bloqueada** | Append `init=/bin/bash` to kernel line in GRUB and remount root with `rw` |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Comprobar el estado del servicio en el gestor de inicialización systemd
sudo systemctl status --no-pager -l systemd-logind

# 2. Inspeccionar los registros del diario del sistema filtrando por unidad
sudo journalctl -u systemd-logind -n 50 --no-pager

# 3. Auditar el espacio y tabla de inodos en todos los sistemas de archivos montados
df -Th && df -ih
```

- El flag `--no-pager` en `systemctl` y `journalctl` evita invocar el paginador interactivo (`less`), permitiendo redirigir la salida o analizar los registros sin interrumpir flujos de automatización.
- El comando `df` con los modificadores `-T` (tipo de sistema de archivos ext4/xfs/btrfs) y `-h` (formato legible en gigabytes/megabytes), combinado con `-i` (tabla de inodos disponibles), permite descartar si el disco está lleno por bytes reales o saturado por millones de archivos pequeños huérfanos.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

1. Reinicia tu servidor o equipo con Linux.
2. Al aparecer la pantalla del menú de selección de sistemas de **GRUB**, pulsa de inmediato la tecla `e` de tu teclado para editar las opciones del kernel.

### Paso 2: Modificar los parámetros del kernel
1. Desplázate con las flechas de dirección hasta ubicar la línea que comienza con la palabra `linux` o `linux16`.
2. Ve al final de la línea, elimina parámetros como `rhgb quiet` y añade exactamente:
```plaintext
init=/bin/bash
```
3. Presiona `Ctrl + X` o `F10` para arrancar el sistema con esta consola temporal de superusuario.

### Paso 3: Montar la partición en modo lectura-escritura y cambiar la contraseña de root
El sistema iniciará en una terminal sin pedir contraseña. Ejecuta los siguientes comandos para cambiar la clave:
```bash
# Remontar la partición raíz con permisos de escritura
mount -o remount,rw /

# Cambiar la contraseña del usuario root
passwd root

# Si usas SELinux (RHEL, Fedora, AlmaLinux, Rocky Linux), fuerza el reetiquetado:
touch /.autorelabel

# Reiniciar el servidor normalmente
exec /sbin/init
```

## 🛡️ Consejos de Prevención

- Si utilizas servidores en la nube o en producción local, protege la consola de GRUB asignando una contraseña en el gestor de arranque (`grub-mkpasswd-pbkdf2`) para evitar que personas con acceso físico modifiquen los parámetros del kernel sin autorización.

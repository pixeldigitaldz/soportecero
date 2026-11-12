---
title: 'Error chmod: Operation not permitted (Incluso como Root) en Linux'
description: >-
  Aprende a solucionar el error chmod / chown: Operation not permitted usando
  lsattr y chattr para desbloquear archivos inmutables en Linux.
category: Sistemas y Servidores
tags:
  - Linux
  - Permisos
  - SysAdmin
  - Seguridad
  - Ubuntu
  - Debian
readTime: 7 min
date: '2026-06-25'
---
En Linux, encontrarse con el error `chmod: changing permissions of 'archivo': Operation not permitted` o `chown: changing ownership of 'archivo': Operation not permitted` ejecutando el comando como superusuario `root` desconcierta a muchos administradores. Ocurre cuando el archivo tiene asignados atributos extendidos de inmutabilidad en el sistema de archivos (ext4/XFS) o el sistema de archivos fue bloqueado en modo de solo lectura tras un error de disco.

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
| **Archivo protegido con el atributo inmutable (+i) o append-only (+a) en el sistema de archivos ext4/xfs** | Check with `lsattr <file>` and clear attributes using `sudo chattr -i <file>` |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Comprobar el estado del servicio en el gestor de inicialización systemd
sudo systemctl status --no-pager -l auditd

# 2. Inspeccionar los registros del diario del sistema filtrando por unidad
sudo journalctl -u auditd -n 50 --no-pager

# 3. Auditar el espacio y tabla de inodos en todos los sistemas de archivos montados
df -Th && df -ih
```

- El flag `--no-pager` en `systemctl` y `journalctl` evita invocar el paginador interactivo (`less`), permitiendo redirigir la salida o analizar los registros sin interrumpir flujos de automatización.
- El comando `df` con los modificadores `-T` (tipo de sistema de archivos ext4/xfs/btrfs) y `-h` (formato legible en gigabytes/megabytes), combinado con `-i` (tabla de inodos disponibles), permite descartar si el disco está lleno por bytes reales o saturado por millones de archivos pequeños huérfanos.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

El comando estándar `ls -l` solo muestra los permisos POSIX convencionales. Para ver los atributos extendidos del kernel, utiliza `lsattr`:
```bash
# Inspeccionar atributos extendidos del archivo bloqueado
lsattr /ruta/al/archivo

# Ejemplo de salida típica bloqueada:
# ----i---------e---- /ruta/al/archivo  (La 'i' indica inmutable)
# -----a--------e---- /ruta/al/archivo  (La 'a' indica solo anexar)
```

### Paso 2: Eliminar el atributo de inmutabilidad con chattr
Como usuario `root`, desactiva los flags inmutables y de solo anexado:
```bash
# Quitar el flag inmutable (-i) y append-only (-a)
sudo chattr -i /ruta/al/archivo
sudo chattr -a /ruta/al/archivo

# Si es un directorio completo de forma recursiva:
sudo chattr -R -i /ruta/al/directorio
```

### Paso 3: Modificar los permisos con chmod o chown
Una vez retirado el bloqueo de atributos, ejecuta el cambio de permisos normalmente:
```bash
# Cambiar permisos a lectura y escritura estándar
sudo chmod 644 /ruta/al/archivo

# Cambiar propietario
sudo chown usuario:grupo /ruta/al/archivo
```

### Paso 4: Comprobar el estado del montaje del disco si persiste el error
Si `lsattr` no muestra atributos pero el archivo sigue bloqueado, comprueba si el disco entró en modo solo lectura por fallos de hardware:
```bash
# Verificar si el sistema de archivos está montado como 'ro' (Read-Only)
mount | grep -i " / "

# Remontar en modo lectura y escritura
sudo mount -o remount,rw /
```

## 🛡️ Consejos de Prevención

- **Usa el atributo inmutable para proteger archivos críticos:** Puedes proteger archivos de configuración clave (como `/etc/resolv.conf` o scripts de despliegue) contra sobreescrituras accidentales aplicando: `sudo chattr +i /etc/resolv.conf`.
- **Cuidado con malware o rootkits:** Algunos scripts maliciosos marcan sus archivos como `+i` para evitar que el antivirus o el administrador los elimine.

## ❓ Preguntas Frecuentes (FAQ)

### ¿Incluso el usuario root es bloqueado por el atributo inmutable (+i)?
Sí. El atributo `+i` es una directiva forzada por el kernel de Linux a nivel del sistema de archivos. Ningún proceso (ni siquiera con UID 0) puede modificar, renombrar o borrar el archivo hasta que se ejecute `chattr -i`.

### ¿Funciona chattr en sistemas de archivos NTFS o FAT32?
No. Los comandos `chattr` y `lsattr` son específicos de sistemas de archivos nativos de Linux como ext2, ext3, ext4, XFS y Btrfs.

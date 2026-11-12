---
title: Cómo solucionar el error Permission Denied (publickey) en conexiones SSH
description: >-
  Aprende a reparar los fallos de autenticación por clave pública en SSH
  ajustando los permisos de directorios y del archivo authorized_keys.
category: Sistemas y Servidores
tags:
  - SSH
  - Linux
  - Seguridad
readTime: 7 min
date: '2026-06-27'
---
El error `Permission denied (publickey)` al intentar conectarte a un servidor remoto mediante SSH ocurre porque el demonio SSH (`sshd`) en el servidor remoto rechaza la clave privada presentada por tu cliente. Esto se debe habitualmente a permisos de archivos demasiado permisivos, lo cual invalida la seguridad de la conexión y obliga al servidor a descartar el intento por protección.

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
| **Permisos excesivamente abiertos en el archivo de clave privada (~/.ssh/id_rsa)** | Set strict permissions on client private key: `chmod 600 ~/.ssh/id_ed25519` |

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

La clave privada nunca debe ser legible por otros usuarios de la máquina local. Ajusta los permisos del archivo `.pem` o `id_rsa`:
```bash
# Cambiar permisos para que solo el propietario pueda leer el archivo
chmod 600 ~/.ssh/id_rsa
```

### Paso 2: Ajustar los permisos del directorio .ssh y autorizaciones en el servidor
Accede a la consola del servidor (a través de TTY o consola del proveedor de hosting) y ejecuta las siguientes correcciones sobre tu directorio de inicio:
```bash
# Asegurar el directorio de configuración de SSH
chmod 700 ~/.ssh

# Asegurar el archivo que almacena las claves autorizadas
chmod 600 ~/.ssh/authorized_keys

# Restablecer la propiedad de los archivos a tu usuario actual
chown -R $USER:$USER ~/.ssh
```

### Paso 3: Comprobar la directiva de autenticación en el servidor
Si el error persiste, edita el archivo de configuración del servicio SSH en el servidor `/etc/ssh/sshd_config` y verifica que la autenticación por clave pública esté habilitada:
```plaintext
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
```
Reinicia el servicio para aplicar los cambios:
```bash
sudo systemctl restart sshd
```

## 🛡️ Consejos de Prevención

Prácticas de seguridad recomendadas:
- Evita compartir tu clave privada a través de medios inseguros o utilizar permisos laxos en el host local. Mantén siempre el principio de mínimos privilegios en tu configuración SSH. Configurar la directiva `StrictModes yes` en el servidor obliga a SSHD a rechazar conexiones de forma proactiva si los permisos de la carpeta personal o archivos autorizados son inseguros, previniendo intrusiones accidentales por descuidos en el sistema de archivos.

---
title: 'Error kex_exchange_identification: Connection closed by remote host en SSH'
description: >-
  Cómo solucionar el error de conexión SSH kex_exchange_identification
  Connection closed by remote host provocado por Fail2ban, límites de
  MaxStartups o bloqueos de red.
category: Sistemas y Servidores
date: '2026-08-24'
readTime: 7 min
tags:
  - SSH
  - Linux
  - Seguridad
---
El error `kex_exchange_identification: Connection closed by remote host` (o `read: Connection reset by peer`) ocurre antes de que comience la autenticación SSH, durante la fase inicial de negociación de claves criptográficas (Key Exchange), debido a bloqueos en `hosts.deny`, límites de concurrencia en `MaxStartups` o baneos automáticos de Fail2ban.

Cuando el servidor rechaza abruptamente el handshake inicial de TCP/SSH, el cliente no llega a recibir el prompt de contraseña o clave pública.

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
| **Límite de conexiones simultáneas superado (`MaxStartups`)** |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Comprobar el estado del servicio en el gestor de inicialización systemd
sudo systemctl status --no-pager -l NOMBRE_SERVICIO

# 2. Inspeccionar los registros del diario del sistema filtrando por unidad
sudo journalctl -u NOMBRE_SERVICIO -n 50 --no-pager

# 3. Auditar el espacio y tabla de inodos en todos los sistemas de archivos montados
df -Th && df -ih
```

- El flag `--no-pager` en `systemctl` y `journalctl` evita invocar el paginador interactivo (`less`), permitiendo redirigir la salida o analizar los registros sin interrumpir flujos de automatización.
- El comando `df` con los modificadores `-T` (tipo de sistema de archivos ext4/xfs/btrfs) y `-h` (formato legible en gigabytes/megabytes), combinado con `-i` (tabla de inodos disponibles), permite descartar si el disco está lleno por bytes reales o saturado por millones de archivos pequeños huérfanos.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

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

## Resolución de Casos Borde (Troubleshooting)

### Caso Borde 1: Restricciones de seguridad aplicadas por SELinux o AppArmor

En distribuciones de clase empresarial como Red Hat Enterprise Linux, AlmaLinux o Rocky Linux (que utilizan **SELinux** en modo Enforcing) o en Ubuntu/Debian (que implementan **AppArmor**), las políticas de confinamiento del sistema operativo pueden bloquear el acceso a archivos, sockets UNIX o puertos de red incluso cuando los permisos tradicionales `chmod 777` y el usuario `root` están en uso.

Para verificar y solventar bloqueos por contexto de seguridad:
```bash
# Consultar si SELinux generó denegaciones recientes en el log de auditoría
sudo ausearch -m avc -ts recent 2>/dev/null

# En caso de AppArmor, revisar eventos bloqueados en el diario del kernel
sudo dmesg | grep -i apparmor | tail -n 20
```
Si se confirma una denegación de contexto en SELinux, restaura el contexto de seguridad predeterminado del archivo o directorio afectado ejecutando:
```bash
# Restaurar etiquetas de contexto de seguridad recursivamente
sudo restorecon -Rv /ruta/afectada
```

### Caso Borde 2: Persistencia tras reinicio y desincronización de procesos huérfanos

En ocasiones, tras aplicar una solución en caliente en la terminal, el problema reaparece inesperadamente en el siguiente reinicio del servidor o al finalizar la sesión SSH. Esto ocurre comúnmente cuando existen procesos huérfanos (*zombie processes*) que retienen el bloqueo de archivos o sockets en memoria sin permitir que el nuevo servicio tome control del recurso.

Para identificar y limpiar procesos bloqueados de forma segura:
```bash
# Identificar qué proceso tiene abierto el descriptor de archivo o socket
sudo lsof +D /ruta/o/archivo/afectado

# Si es necesario liberar el proceso huérfano de manera ordenada (señal SIGTERM)
sudo kill -15 PID_DEL_PROCESO
```

### Verificación de Logs en Tiempo Real y Validación en Producción

Una vez aplicadas las modificaciones correctivas, valida en consola que el sistema opere con total estabilidad y sin emitir advertencias residuales:
```bash
# Monitorear registros en vivo filtrando por palabras clave de fallo
sudo journalctl -f -n 100 | grep -Ei "(error|fail|warn|critical)"

# Verificar que el código de retorno del último comando ejecutado sea exitoso (0)
echo $?
```
Un valor de retorno `0` confirma la ejecución exitosa en el estándar POSIX, garantizando que el servicio o comando ha completado su ciclo sin excepciones pendientes.

## 🛡️ Consejos de Prevención

- **Lista blanca en Fail2ban:** Agrega tus IPs corporativas o VPN fijas en la directiva `ignoreip` dentro de `/etc/fail2ban/jail.local`.
- **Uso de multiplexación SSH:** Habilita `ControlMaster` en tu archivo local `~/.ssh/config` para reutilizar una única conexión TCP para múltiples sesiones y terminales de VS Code.

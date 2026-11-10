---
title: >-
  rsync error: error in rsync protocol data stream (code 12) connection
  unexpectedly closed
description: >-
  Soluciona el fallo rsync error code 12 connection unexpectedly closed al
  transferir archivos grandes o copias de seguridad por SSH.
category: Sistemas y Servidores
tags:
  - rsync
  - SSH
  - Linux
  - Backup
readTime: 7 min
date: '2026-09-17'
---
Durante la sincronización de archivos o respaldos remotos a través de SSH, la transferencia se interrumpe abruptamente arrojando: `rsync: connection unexpectedly closed (0 bytes received so far) [sender]` seguido de `rsync error: error in rsync protocol data stream (code 12) at io.c`. Este código de salida 12 significa que la comunicación entre los procesos de rsync emisor y receptor se rompió antes de completar el apretón de manos o la transferencia.

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
| **El demonio rsync no está instalado en el servidor remoto de destino** |

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

La causa más habitual de que la conexión se cierre inmediatamente con 0 bytes recibidos es que el servidor remoto no tiene instalado el paquete `rsync`:
```bash
# En el servidor remoto (Debian/Ubuntu)
sudo apt update && sudo apt install -y rsync

# En el servidor remoto (RHEL/AlmaLinux/Rocky)
sudo dnf install -y rsync
```

### Paso 2: Prevenir cortes de conexión SSH por inactividad (KeepAlive)
Si la desconexión ocurre a mitad de transferir un archivo de varios gigabytes, el firewall o el enrutador intermedio está cerrando las conexiones TCP inactivas. Añade parámetros KeepAlive en el flag `-e`:
```bash
rsync -avzP -e "ssh -o ServerAliveInterval=15 -o ServerAliveCountMax=4" /ruta/local/ usuario@servidor:/ruta/remota/
```

### Paso 3: Habilitar reanudación de archivos parciales (--partial)
Evita tener que reiniciar desde cero las transferencias interrumpidas utilizando el flag `--partial` o el combo `-P` (que equivale a `--partial --progress`):
```bash
rsync -avhP /var/backups/ usuario@servidor:/respaldos/
```
Si la red se corta, al volver a ejecutar el comando continuará exactamente en el megabyte donde se detuvo.

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

* Configura `ClientAliveInterval 30` en `/etc/ssh/sshd_config` del servidor para evitar que sesiones de larga duración caigan en timeout.
* Para copias críticas de cientos de gigabytes, ejecuta rsync dentro de una sesión persistente de `tmux` o `screen`.

## Preguntas Frecuentes

### ¿Por qué rsync muestra "out of memory" antes del código de error 12?
Ocurre cuando rsync intenta construir la lista de millones de archivos en la memoria RAM de servidores con pocos recursos. Utiliza la bandera `--no-inc-recursive` o divide la sincronización por subcarpetas.

### ¿Cómo puedo ver el motivo exacto del fallo en la conexión?
Ejecuta rsync con doble nivel de detalle y depuración SSH: `rsync -vvv -e "ssh -vvv" ...` para ver qué extremo cerró la conexión TCP.

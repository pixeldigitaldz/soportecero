---
title: Cómo solucionar el error DNS_PROBE_FINISHED_NXDOMAIN en tu red local
description: >-
  Aprende a corregir el error DNS_PROBE_FINISHED_NXDOMAIN en Windows, Linux y
  macOS vaciando la caché DNS y cambiando los servidores DNS.
category: Web y Código
tags:
  - DNS
  - Redes
  - Windows
  - Linux
  - Chrome
  - SysAdmin
readTime: 7 min
date: '2026-06-25'
---
El error `DNS_PROBE_FINISHED_NXDOMAIN` (Non-Existent Domain) significa que el Resolvedor de Nombres de Dominio no pudo traducir el nombre de host solicitado (ej. `misitio.com`) a una dirección IP numérica válida. Esto sucede comúnmente por registros obsoletos en la caché DNS local, desconfiguración del archivo `hosts` o caídas temporales en los servidores DNS asignados por tu router.

## Análisis de Arquitectura y Causa Raíz

En la arquitectura del sistema operativo **Linux**, las aplicaciones de usuario operan en espacio no privilegiado (*User Space*) y dependen de llamadas al sistema (*syscalls*) para interactuar con los recursos físicos de hardware a través del **Kernel de Linux**. El subsistema del kernel arbitra el acceso a la memoria virtual, los descriptores de archivos, la pila de protocolos de red TCP/IP y los dispositivos de almacenamiento en bloque a través de la capa de abstracción **VFS (Virtual File System)**.

La anomalía técnica identificada en esta incidencia proviene de una restricción o condición de fallo en los mecanismos de control del sistema:
1. **Límites de descriptores de archivos y cuotas de inodos:** Cada archivo, socket de red o tubería (*pipe*) abierto por un proceso consume un descriptor de archivo en la tabla del kernel. Si el proceso alcanza el límite de descriptores asignado por el subsistema `ulimit` o si el sistema de archivos agota su tabla de inodos libres (incluso cuando resta espacio en gigabytes en disco), el kernel rechaza cualquier operación de escritura con el código de error `ENOSPC (No space left on device)` o `EMFILE (Too many open files)`.
2. **Jerarquía de permisos POSIX y atributos inmutables del sistema:** Las llamadas al sistema como `open()`, `unlink()` o `chmod()` evalúan los bits de permiso estándar (Lectura `r`, Escritura `w`, Ejecución `x`) junto con el UID/GID del proceso ejecutor. Si el archivo posee atributos extendidos inmutables fijados a nivel del sistema de archivos mediante `chattr +i`, el kernel bloquea cualquier mutación incluso ante el usuario privilegiado `root`, retornando el error `EPERM (Operation not permitted)`.
3. **Administración de memoria virtual y Swapping:** Cuando el sistema experimenta presión de memoria y la memoria física disponible es insuficiente para satisfacer las solicitudes del gestor de páginas, el kernel recurre a la memoria swap. Si los umbrales de agresividad (`vm.swappiness`) están desajustados o el espacio de intercambio está fragmentado, el sistema entra en un estado de congestión (*thrashing*), degradando el rendimiento general hasta que el subsistema OOM Killer termina procesos para preservar la estabilidad del kernel.

## Entorno de Laboratorio y Diagnóstico

Antes de aplicar cualquier cambio destructivo o reiniciar servicios en un entorno de producción, es fundamental ejecutar una matriz de diagnóstico preliminar para identificar la capa exacta donde ocurre el fallo:

| Causa | Solución |
|---|---|
| **Caché DNS del sistema operativo o del navegador corrupta o desactualizada** |

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

Elimina cualquier registro IP erróneo o corrupto almacenado en la memoria del equipo:
```bash
# En Windows (Símbolo del sistema como Administrador):
ipconfig /flushdns

# En Linux (con systemd-resolved):
sudo resolvectl flush-caches

# En macOS:
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
```

### Paso 2: Limpiar la caché interna del navegador Google Chrome / Brave
Los navegadores basados en Chromium mantienen su propio almacén DNS independiente:
1. Abre tu navegador y escribe en la barra de direcciones: `chrome://net-internals/#dns`
2. Haz clic en el botón **Clear host cache**.
3. Abre también `chrome://net-internals/#sockets` y pulsa **Flush socket pools**.

### Paso 3: Configurar servidores DNS públicos rápidos y seguros (Cloudflare / Google)
Sustituye los DNS automáticos de tu proveedor de telefonía por servidores públicos de baja latencia:
- **Cloudflare DNS**: Primario `1.1.1.1` | Secundario `1.0.0.1`
- **Google Public DNS**: Primario `8.8.8.8` | Secundario `8.8.4.4`

En Linux, configúralos editando `/etc/resolv.conf` o `/etc/systemd/resolved.conf`:
```ini
[Resolve]
DNS=1.1.1.1 8.8.8.8
FallbackDNS=1.0.0.1 8.8.4.4
```
Reinicia el servicio con: `sudo systemctl restart systemd-resolved`.

### Paso 4: Comprobar el archivo hosts del sistema
Asegúrate de que no haya entradas estáticas erróneas apuntando a IPs locales inválidas:
- En Windows: `C:\Windows\System32\drivers\etc\hosts`
- En Linux / macOS: `/etc/hosts`

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

- **Usa DNS sobre HTTPS (DoH):** Activa DNS sobre HTTPS en tu navegador para proteger tus consultas DNS contra secuestro de tráfico (DNS Spoofing).
- **Verifica la propagación DNS global:** Si eres el dueño del dominio, comprueba en herramientas como *whatsmydns.net* si los registros `A` o `CNAME` se han propagado correctamente tras un cambio de DNS.

## ❓ Preguntas Frecuentes (FAQ)

### ¿Qué significa exactamente NXDOMAIN?
Es un código de estado oficial del protocolo DNS que significa "Non-Existent Domain" (Dominio no existente). El servidor raíz confirmó que el dominio no posee ningún registro IP asignado.

### ¿Reiniciar el router puede solucionar este error?
Sí. Muchos routers domésticos almacenan en caché las respuestas DNS de tu red local. Reiniciarlo fuerza la descarga de tablas de enrutamiento limpias desde tu ISP.

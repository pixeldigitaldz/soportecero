---
title: 'Fallo de DNS en Linux: ''Could not resolve host'' / systemd-resolved'
description: >-
  Aprende a reparar el fallo de resolución DNS y el servicio systemd-resolved en
  Ubuntu, Debian y Arch Linux paso a paso.
category: Sistemas y Servidores
tags:
  - systemd
  - DNS
  - Linux
  - SysAdmin
  - Ubuntu
  - Redes
readTime: 7 min
date: '2026-06-25'
---
El fallo generalizado `Temporary failure in name resolution`, `Could not resolve host: google.com` o `Failed to start Network Name Resolution` en Linux ocurre cuando el subsistema de resolución DNS local (systemd-resolved o el archivo `/etc/resolv.conf`) pierde la configuración de servidores de nombres, bloqueando todas las conexiones a internet que utilicen nombres de dominio.

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
| **Enlace simbólico roto en /etc/resolv.conf apuntando a un stub de systemd-resolved inactivo** | Recreate symlink pointing to `/run/systemd/resolve/stub-resolv.conf` or apply static nameservers |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Comprobar el estado del servicio en el gestor de inicialización systemd
sudo systemctl status --no-pager -l systemd-resolved

# 2. Inspeccionar los registros del diario del sistema filtrando por unidad
sudo journalctl -u systemd-resolved -n 50 --no-pager

# 3. Auditar el espacio y tabla de inodos en todos los sistemas de archivos montados
df -Th && df -ih
```

- El flag `--no-pager` en `systemctl` y `journalctl` evita invocar el paginador interactivo (`less`), permitiendo redirigir la salida o analizar los registros sin interrumpir flujos de automatización.
- El comando `df` con los modificadores `-T` (tipo de sistema de archivos ext4/xfs/btrfs) y `-h` (formato legible en gigabytes/megabytes), combinado con `-i` (tabla de inodos disponibles), permite descartar si el disco está lleno por bytes reales o saturado por millones de archivos pequeños huérfanos.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

Si tu servidor no puede descargar paquetes por falta de DNS, añade manualmente un resolvedor temporal:
```bash
# Configurar DNS públicos directos de Cloudflare y Google
echo -e "nameserver 1.1.1.1\nnameserver 8.8.8.8" | sudo tee /etc/resolv.conf
```
Comprueba de inmediato si puedes resolver dominios:
```bash
ping -c 3 google.com
```

### Paso 2: Reparar el enlace simbólico oficial de systemd-resolved
En Ubuntu y distribuciones modernas con systemd, `/etc/resolv.conf` debe ser un enlace simbólico al stub del resolvedor:
```bash
# 1. Eliminar el archivo o enlace roto anterior
sudo rm -f /etc/resolv.conf

# 2. Crear el enlace simbólico correcto
sudo ln -s /run/systemd/resolve/stub-resolv.conf /etc/resolv.conf

# 3. Reiniciar y habilitar el servicio de resolución
sudo systemctl restart systemd-resolved
sudo systemctl enable systemd-resolved
```

### Paso 3: Configurar servidores DNS estables en resolved.conf
Abre el archivo de configuración principal de resolución (`/etc/systemd/resolved.conf`):
```ini
[Resolve]
DNS=1.1.1.1 8.8.8.8
FallbackDNS=1.0.0.1 8.8.4.4
Domains=~.
DNSSEC=allow-downgrade
```
Aplica los cambios reiniciando el servicio:
```bash
sudo systemctl restart systemd-resolved
```

### Paso 4: Validar el estado con resolvectl
Comprueba que el resolvedor tiene asignados servidores DNS en cada interfaz de red activa:
```bash
# Comprobar el estado global de DNS
resolvectl status
```

## 🛡️ Consejos de Prevención

- **Evita que gestores de red sobreescriban /etc/resolv.conf:** Si utilizas NetworkManager, asegúrate de que esté configurado para colaborar con systemd-resolved (`dns=systemd-resolved` en `/etc/NetworkManager/NetworkManager.conf`).
- **Bloquea el archivo si experimentas sobreescrituras no deseadas:** Puedes aplicar el atributo inmutable en caso de emergencia: `sudo chattr +i /etc/resolv.conf`.

## ❓ Preguntas Frecuentes (FAQ)

### ¿Por qué ping 8.8.8.8 funciona pero ping google.com falla?
Porque la conectividad IP a nivel de enrutamiento funciona correctamente, pero el subsistema de traducción de nombres (DNS) está caído.

### ¿Qué diferencia hay entre /run/systemd/resolve/stub-resolv.conf y resolv.conf normal?
El stub redirige las peticiones locales a la IP `127.0.0.53` gestionada por el daemon de systemd-resolved para permitir almacenamiento en caché y validación DNSSEC.

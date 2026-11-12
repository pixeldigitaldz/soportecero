---
title: 'Error: sudo: unable to resolve host en Ubuntu y Debian'
description: >-
  Elimina el molesto mensaje sudo: unable to resolve host al ejecutar comandos
  en Linux. Guía rápida para corregir /etc/hostname y /etc/hosts.
category: Sistemas y Servidores
tags:
  - Linux
  - Ubuntu
  - Sysadmin
  - Bash
readTime: 7 min
date: '2026-09-16'
---
Cada vez que ejecutas un comando con `sudo`, la terminal pausa brevemente y devuelve la advertencia `sudo: unable to resolve host <nombre-servidor>: Name or service not known`. Aunque el comando termine ejecutándose, esta advertencia retrasa la ejecución y puede provocar fallos en scripts automáticos, despliegues CI/CD y servicios que dependen de la resolución local de nombres.

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
| **El nombre de equipo configurado en /etc/hostname no está registrado en /etc/hosts** | Add 127.0.1.1 mapped to the exact system hostname in /etc/hosts |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Comprobar el estado del servicio en el gestor de inicialización systemd
sudo systemctl status --no-pager -l systemd-hostnamed

# 2. Inspeccionar los registros del diario del sistema filtrando por unidad
sudo journalctl -u systemd-hostnamed -n 50 --no-pager

# 3. Auditar el espacio y tabla de inodos en todos los sistemas de archivos montados
df -Th && df -ih
```

- El flag `--no-pager` en `systemctl` y `journalctl` evita invocar el paginador interactivo (`less`), permitiendo redirigir la salida o analizar los registros sin interrumpir flujos de automatización.
- El comando `df` con los modificadores `-T` (tipo de sistema de archivos ext4/xfs/btrfs) y `-h` (formato legible en gigabytes/megabytes), combinado con `-i` (tabla de inodos disponibles), permite descartar si el disco está lleno por bytes reales o saturado por millones de archivos pequeños huérfanos.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

Ejecuta el comando para verificar exactamente qué nombre tiene asignado tu máquina en el kernel:
```bash
hostname
# O mediante hostnamectl
hostnamectl --static
```
Imaginemos que tu servidor devuelve `vps-servidor01`.

### Paso 2: Editar el archivo /etc/hosts y añadir la resolución local
Abre el archivo de mapeo estático de hosts con permisos de superusuario:
```bash
sudo nano /etc/hosts
```
Verifica que exista la línea que vincula la dirección IP de bucle invertido `127.0.1.1` con tu nombre de host exacto:
```plaintext
127.0.0.1 localhost
127.0.1.1 vps-servidor01
```
Guarda los cambios con `Ctrl + O` y sal con `Ctrl + X`.

### Paso 3: Verificar la desaparición del error
Ejecuta cualquier comando con `sudo` para confirmar que la advertencia ha desaparecido por completo:
```bash
sudo true
```
Si no aparece ningún mensaje de error, la resolución local de nombres ha quedado reparada definitivamente.

## 🛡️ Consejos de Prevención

* Al cambiar el nombre de un servidor con `hostnamectl set-hostname nuevo-nombre`, actualiza simultáneamente `/etc/hosts`.
* En proveedores en la nube que regeneran configuraciones de red (cloud-init), edita la plantilla `/etc/cloud/cloud.cfg` para preservar los cambios locales.

## Preguntas Frecuentes

### ¿Por qué sudo necesita resolver el nombre de host del sistema?
sudo consulta la base de datos NSS (Name Service Switch) para verificar en el archivo sudoers si el usuario actual tiene privilegios para ejecutar comandos en el host específico.

### ¿Cuál es la diferencia entre 127.0.0.1 y 127.0.1.1 en Debian y Ubuntu?
127.0.0.1 está reservado para el nombre genérico "localhost". Debian y Ubuntu utilizan 127.0.1.1 para asociar el nombre de host FQDN de la máquina sin depender de una IP estática externa.

---
title: "Cómo solucionar el error 'VM is locked (backup/snapshot)' en Proxmox VE"
description: "Guía técnica para desbloquear máquinas virtuales y contenedores LXC bloqueados en Proxmox VE con qm unlock y pct unlock tras fallos de backup."
category: "Sistemas y Servidores"
date: "2026-10-17"
readTime: "3 min"
tags: ["Proxmox", "Virtualización", "SysAdmin"]
---

El error `TASK ERROR: can't lock file '/var/lock/qemu-server/lock-XXX.conf' - got timeout` o el mensaje persistente `VM is locked (backup)` / `VM is locked (snapshot)` en la interfaz web de Proxmox Virtual Environment (PVE) ocurre cuando una tarea de mantenimiento se interrumpe de forma abrupta antes de retirar el cerrojo de seguridad.

Proxmox bloquea preventivamente las máquinas virtuales (QEMU) y contenedores (LXC) durante tareas críticas como copias de seguridad con Proxmox Backup Server (PBS), instantáneas (snapshots) o migraciones en vivo para evitar escrituras simultáneas y corrupción de disco. Si el almacenamiento de destino sufre un corte de red o la tarea se cancela a la fuerza, el estado de bloqueo permanece activo indefinidamente impidiendo arrancar, apagar o modificar la máquina desde el panel web.

## Diagnóstico Rápido

| Causa Principal | Solución Recomendada |
|---|---|
| **Copia de seguridad interrumpida por apagón o pérdida de red (`locked: backup`)** | Liberar el cerrojo desde la terminal del nodo con `qm unlock <vmid>` |
| **Contenedor LXC bloqueado tras fallo de snapshot (`locked: snapshot`)** | Desbloquear el contenedor mediante CLI ejecutando `pct unlock <vmid>` |
| **Proceso zombie de backup o qemu bloqueando el archivo de configuración** | Identificar y matar el proceso colgado antes de retirar la directiva `lock` manual |
| **Almacenamiento de red lento (NFS/SMB) generando cuellos de botella en snapshots** | Revisar la estabilidad del almacenamiento y configurar límites de ancho de banda |

## La Solución Paso a Paso

### Paso 1: Verificar y cancelar tareas huérfanas en el nodo
Antes de forzar el desbloqueo, asegúrate de que ningún proceso en segundo plano continúe escribiendo datos en el disco de la VM. Conéctate por SSH o abre la consola Shell del nodo de Proxmox y lista los procesos activos relacionados con el ID de tu máquina virtual:
```bash
# Reemplaza 105 por el VMID de tu máquina virtual
ps aux | grep qm | grep 105
ps aux | grep vzdump
```
Si ves un proceso de `vzdump` colgado o sin actividad de entrada/salida (I/O), finalízalo limpiamente o fuerza su detención:
```bash
kill -9 <PID_DEL_PROCESO>
```

### Paso 2: Desbloquear máquinas virtuales QEMU con qm unlock
Si el recurso bloqueado es una máquina virtual KVM/QEMU, ejecuta el comando nativo `qm unlock` indicando el identificador numérico:
```bash
qm unlock 105
```
Una vez ejecutado, actualiza la interfaz web de Proxmox. El icono de candado amarillo desaparecerá de inmediato y los botones de control (Start, Stop, Reboot) volverán a estar operativos.

### Paso 3: Desbloquear contenedores LXC con pct unlock
Si el problema ocurre dentro de un contenedor Linux (LXC), la herramienta de gestión correspondiente es `pct`:
```bash
pct unlock 200
```
Comprueba el estado del contenedor con:
```bash
pct status 200
```

### Paso 4: Eliminar manualmente el bloqueo persistente en la configuración
En ocasiones excepcionales donde el comando `unlock` reporta que el cerrojo no existe pero la interfaz gráfica sigue mostrando el estado bloqueado, edita directamente el archivo de configuración de la máquina virtual:
```bash
# Para máquinas virtuales QEMU:
nano /etc/pve/qemu-server/105.conf

# Para contenedores LXC:
nano /etc/pve/lxc/200.conf
```
Busca la línea que comienza por `lock:` (por ejemplo, `lock: backup` o `lock: snapshot`), bórrala por completo, guarda los cambios con `Ctrl + O` y sal con `Ctrl + X`. La base de datos de clúster `pmxcfs` sincronizará el cambio en tiempo real.

## Prevención
- **Límites de ancho de banda (BW Limit):** Configura un límite de transferencia en `Datacenter -> Backup` para evitar saturar el enlace de red entre el nodo de Proxmox y tu almacenamiento NFS o TrueNAS.
- **Evitar cancelaciones forzadas:** No utilices la opción "Stop" brusca en la ventana de tareas mientras un snapshot de disco ZFS o LVM esté en progreso; espera a que la operación de I/O finalice de forma natural.
- **Monitoreo de almacenamiento de backups:** Verifica que tus destinos de almacenamiento montados tengan activada la opción de desconexión segura ante cortes y cuenten con espacio suficiente antes de programar backups nocturnos masivos.

## Preguntas Frecuentes

### ¿Es seguro ejecutar qm unlock con la máquina virtual encendida?
Sí, `qm unlock` solo retira la bandera de bloqueo administrativo a nivel de metadatos de Proxmox. Sin embargo, debes cerciorarte previamente de que no haya un snapshot o backup escribiendo activamente para evitar inconsistencias en la copia de seguridad resultante.

### ¿Por qué Proxmox no incluye un botón de desbloqueo en la interfaz gráfica?
Por seguridad. El bloqueo previene que los administradores inicien o reinicien máquinas mientras el motor de instantáneas modifica los bloques de disco. La exigencia de usar la línea de comandos garantiza que el operador humano haya verificado el estado real de los procesos del sistema.

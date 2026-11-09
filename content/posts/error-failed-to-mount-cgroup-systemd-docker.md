---
title: 'Error: Failed to mount cgroup cgroup2 o systemd en Docker y Linux'
description: >-
  Repara el fallo Failed to mount cgroup cgroup2 o cgroup hierarchy v2 en
  Docker, LXC y entornos systemd en distribuciones Linux modernas.
category: Sistemas y Servidores
tags:
  - Docker
  - systemd
  - Linux
  - DevOps
readTime: 7 min
date: '2026-09-14'
---
Al iniciar contenedores con Docker, Podman o entornos virtualizados LXC/Proxmox en distribuciones modernas (Ubuntu 24.04, Debian 12, Arch Linux), es habitual encontrarse con el error `Failed to mount cgroup: No such file or directory` o `OCI runtime error: unable to apply cgroup configuration`. Esto sucede por el cambio de la jerarquía heredada (cgroup v1) al árbol unificado moderno (cgroup v2).

## Contexto de Arquitectura y Causa Raíz del Fallo

En entornos contenerizados, el motor de **Docker** se apoya en primitivas fundamentales del kernel de Linux: **Namespaces** (PID, NET, MNT, IPC, UTS) para el aislamiento lógico de procesos y **Control Groups (cgroups v1/v2)** para el límite estricto de recursos de hardware (memoria RAM, ciclos de CPU y cuotas de I/O de disco).

Cuando se produce este fallo, la anomalía suele situarse en la frontera entre el demonio `dockerd`, el runtime OCI (`containerd` / `runc`) y el subsistema de red del host:
1. **Comunicación con el socket IPC (`/var/run/docker.sock`):** El cliente de Docker interactúa con la API REST local mediante llamadas al sistema sobre un socket de dominio UNIX. Si los permisos de usuario en el socket no pertenecen al grupo `docker` o si el demonio ha quedado bloqueado por un hilo zombie, la llamada al sistema devuelve inmediatamente un descriptor de error `EACCES` o `ECONNREFUSED`.
2. **Ciclo de vida del contenedor y estados OCI:** Durante la creación del contenedor (`container create / start`), `runc` solicita al kernel la creación de los namespaces y el montaje del sistema de archivos en capas mediante el driver de almacenamiento **Overlay2** (`lowerdir`, `upperdir` y `merged`). Si existe corrupción en las capas de imagen, agotamiento de inodos en `/var/lib/docker`, o incompatibilidad con la arquitectura del binario, el runtime aborta con códigos de salida específicos (ej. Exit Code 137 por OOM Killer o Exit Code 126/127 por permisos o dependencias ausentes).
3. **Pila de red virtual y cadenas de iptables:** Para exponer puertos (`-p`), Docker manipula directamente las tablas `nat` y `filter` del subsistema Netfilter mediante cadenas personalizadas (`DOCKER`, `DOCKER-USER`). Reinicios no sincronizados del firewall (`ufw` o `firewalld`) eliminan estas cadenas en memoria del kernel, provocando que los paquetes TCP entrantes sean descartados silenciosamente con paquetes TCP RST.

## Entorno de Laboratorio y Diagnóstico Previo

Antes de aplicar cualquier cambio destructivo o reiniciar servicios en un entorno de producción, es fundamental ejecutar una matriz de diagnóstico preliminar para identificar la capa exacta donde ocurre el fallo:

| Causa | Solución |
|---|---|
| **Incompatibilidad entre Docker daemon y la jerarquía unificada cgroup v2 en kernels recientes** |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Comprobar el estado general del demonio Docker
sudo systemctl status docker --no-pager -l

# 2. Inspeccionar los últimos logs del contenedor afectado
docker logs --tail 50 --timestamps NOMBRE_CONTENEDOR

# 3. Verificar el uso de recursos y memoria en tiempo real
docker stats --no-stream
```

- El comando `docker logs` con el parámetro `--tail 50` extrae únicamente las últimas 50 líneas emitidas en `stdout` y `stderr`, mientras que `--timestamps` permite correlacionar el segundo exacto del fallo con los registros del sistema operativo.
- El flag `--no-stream` en `docker stats` realiza un muestreo único del consumo de CPU y memoria de todos los contenedores en ejecución, evitando bloquear la terminal interactiva.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

Ejecuta este comando para comprobar si tu sistema está utilizando la jerarquía v1 tradicional o v2 unificada:
```bash
stat -fc %T /sys/fs/cgroup/
```
- Si la respuesta es `cgroup2fs`, el kernel opera en **cgroup v2**.
- Si la respuesta es `tmpfs`, opera en el modo tradicional **cgroup v1**.

### Paso 2: Ajustar la jerarquía de cgroups en el gestor de arranque GRUB
Si utilizas software o versiones de Docker antiguas incompatibles con cgroup v2, puedes forzar la compatibilidad heredada:
```bash
sudo nano /etc/default/grub
```
Localiza la variable `GRUB_CMDLINE_LINUX_DEFAULT` y añade el parámetro:
```plaintext
GRUB_CMDLINE_LINUX_DEFAULT="quiet splash systemd.unified_cgroup_hierarchy=0"
```
Actualiza la configuración de GRUB y reinicia:
```bash
sudo update-grub
sudo reboot
```

### Paso 3: Configurar Docker daemon para soporte nativo de cgroup v2
La solución recomendada a largo plazo es actualizar Docker y configurar el controlador nativo `systemd` en `/etc/docker/daemon.json`:
```json
{
  "exec-opts": ["native.cgroupdriver=systemd"]
}
```
Aplica el cambio reiniciando el servicio:
```bash
sudo systemctl daemon-reload
sudo systemctl restart docker
```

## Casos Borde (Troubleshooting) y Prácticas en Producción

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

* Mantén Docker Engine y containerd actualizados a versiones oficiales para evitar problemas de compatibilidad con cgroup v2.
* Evita desactivar cgroup v2 permanentemente, ya que el soporte para v1 será depreciado en futuras versiones del kernel Linux.

## Preguntas Frecuentes

### ¿Cuál es la diferencia entre cgroup v1 y cgroup v2 en Linux?
cgroup v1 permitía jerarquías independientes para CPU, memoria y E/S, lo que provocaba bloqueos. cgroup v2 unifica todos los controladores en un único árbol jerárquico gestionado eficientemente.

### ¿Cómo soluciono este fallo dentro de contenedores LXC en Proxmox?
En Proxmox VE añade `lxc.cgroup2.memory.max` o habilita la opción de virtualización de características avanzadas nesting=1 en el archivo /etc/pve/lxc/<ID>.conf.

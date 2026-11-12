---
title: 'Error: Failed to mount cgroup cgroup2 o systemd en Docker y Linux'
description: >-
  Guía técnica para solucionar fallos de montaje de cgroups v1 y cgroup2 en Docker,
  runc y contenedores LXC/Proxmox en distribuciones Linux modernas.
category: Sistemas y Servidores
tags:
  - Docker
  - systemd
  - Linux
  - DevOps
  - Proxmox
readTime: 7 min
date: '2026-09-14'
---

Al iniciar contenedores con Docker, Podman o entornos virtualizados LXC/Proxmox en distribuciones modernas (Ubuntu 24.04, Debian 12, Arch Linux, Fedora), es habitual encontrarse con el fallo fatal `Failed to mount cgroup: No such file or directory`, `unable to apply cgroup configuration` o `mount: /sys/fs/cgroup/systemd: special device cgroup does not exist`.

Este error se origina en la transición arquitectónica del kernel de Linux: el abandono de la jerarquía multirraíz heredada (**cgroups v1**) en favor del árbol unificado (**cgroups v2**). En sistemas modernos con `systemd` v250+, el kernel monta cgroup2 por defecto en `/sys/fs/cgroup`. Cuando versiones legacy de Docker, runtimes OCI desactualizados (`runc` o `containerd`) o contenedores anidados en Proxmox/LXC intentan montar controladores independientes en pseudo-directorios de cgroup v1, el kernel deniega la operación con errores de montaje.

## Matriz de Diagnóstico y Causa Raíz

Antes de alterar la configuración del gestor de arranque o de Docker, identifica la causa exacta según la firma del error:

| Firma del Error | Causa Raíz | Solución Técnica |
|---|---|---|
| `Failed to mount cgroup: No such file or directory` | El contenedor o runtime intenta montar controladores cgroup v1 en un host con cgroup v2 puro | Configurar el driver de cgroup de systemd o habilitar jerarquía híbrida en GRUB |
| `unable to start container process: error applying cgroup configuration` | Incompatibilidad de versión entre `runc` y las cuotas de memoria/CPU de cgroup2 | Actualizar Docker CE / containerd a la versión upstream más reciente |
| `systemd[1]: Failed to mount cgroup /sys/fs/cgroup/systemd` (LXC) | Contenedor Proxmox LXC sin delegación de namespaces o nesting habilitado | Habilitar `features: nesting=1` en `/etc/pve/lxc/ID.conf` |
| `cgroup v2 is not supported by driver cgroupfs` | Docker daemon configurado con el driver legacy `cgroupfs` en lugar de `systemd` | Declarar `native.cgroupdriver=systemd` en `/etc/docker/daemon.json` |

## Implementación Técnica Paso a Paso

### Paso 1: Identificar la Versión de cgroup en Ejecución en el Host
Inspecciona qué sistema de archivos de control groups está activo en el kernel de tu servidor:
```bash
stat -fc %T /sys/fs/cgroup/
```
- **Salida `cgroup2fs`:** Confirma que el host utiliza la jerarquía unificada **cgroup v2**.
- **Salida `tmpfs`:** Indica que el host está ejecutando la jerarquía heredada **cgroup v1**.

Para listar los controladores activos expuestos por el kernel:
```bash
cat /sys/fs/cgroup/cgroup.controllers
```
*(Deberías observar controladores como: `cpuset cpu io memory pids`).*

---

### Paso 2: Configurar Docker para Utilizar Nativamente el Driver de systemd
La causa más frecuente de incompatibilidad en servidores de producción es utilizar el driver heredado `cgroupfs`. En distribuciones con systemd, ambos sistemas intentan gestionar los límites de memoria y cuotas de forma concurrente, provocando deadlocks y fallos de montaje.

Configura a Docker para delegar la gestión de cgroups a systemd editando `/etc/docker/daemon.json`:
```json
{
  "exec-opts": ["native.cgroupdriver=systemd"],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "3"
  }
}
```
Aplica los cambios recargando el servicio:
```bash
sudo systemctl daemon-reload
sudo systemctl restart docker
```
Verifica que el driver se haya activado correctamente:
```bash
docker info | grep -i "cgroup driver"
```
*(Debe confirmar: `Cgroup Driver: systemd`).*

---

### Paso 3: Habilitar Compatibilidad Híbrida mediante Parámetros de GRUB (Fallback)
Si tu servidor debe ejecutar contenedores muy antiguos (como imágenes legacy basadas en CentOS 6/7 o herramientas de orquestación que no soportan cgroup v2), puedes instruir al kernel de Linux para que reactive la jerarquía híbrida o v1 heredada:

1. Abre el archivo de configuración del gestor de arranque:
```bash
sudo nano /etc/default/grub
```
2. Localiza la línea `GRUB_CMDLINE_LINUX_DEFAULT` y añade el parámetro `systemd.unified_cgroup_hierarchy=0`:
```plaintext
GRUB_CMDLINE_LINUX_DEFAULT="quiet splash systemd.unified_cgroup_hierarchy=0"
```
*(Opcional: Si necesitas compatibilidad total con swap accounting en cgroup v1, añade también `cgroup_enable=memory swapaccount=1`).*
3. Actualiza la configuración de GRUB y reinicia el servidor:
```bash
# En sistemas Debian / Ubuntu:
sudo update-grub

# En sistemas RHEL / Fedora / Arch:
sudo grub-mkconfig -o /boot/grub/grub.cfg

sudo reboot
```
Tras el reinicio, `stat -fc %T /sys/fs/cgroup/` devolverá `tmpfs`, permitiendo a los contenedores heredados montar cgroups v1 sin errores.

---

### Paso 4: Solucionar el Error en Contenedores LXC de Proxmox
Si ejecutas Docker dentro de un contenedor LXC en Proxmox VE, el contenedor se ejecuta sin privilegios de namespace por defecto, impidiendo que el motor interno monte los subárboles de cgroup.

En el nodo host de Proxmox, edita el archivo de configuración del contenedor LXC afectado:
```bash
sudo nano /etc/pve/lxc/100.conf
```
*(Reemplaza `100` por el ID exacto de tu contenedor LXC).*

Añade las siguientes directivas de nesting y compatibilidad con Docker:
```ini
features: nesting=1,keyctl=1
lxc.apparmor.profile: unconfined
lxc.cgroup2.devices.allow: a
lxc.cap.drop:
```
Guarda el archivo y reinicia el contenedor desde la interfaz web de Proxmox o mediante `pct restart 100`.

---

### Paso 5: Actualizar runc y containerd
En entornos actualizados desde versiones anteriores de Ubuntu (como migrar de 20.04 a 22.04/24.04), es común que el binario de `runc` haya quedado anclado a una versión antigua incompatible con los descriptores de archivo de cgroup2.

Verifica y actualiza los componentes del runtime:
```bash
# Comprobar la versión instalada de runc
runc --version

# Actualizar el runtime oficial de containerd y Docker
sudo apt update && sudo apt install -y docker-ce docker-ce-cli containerd.io
```

## Prácticas en Producción y Ventajas de cgroup v2
- **Aislamiento Seguro y Rootless Containers:** cgroup v2 fue diseñado con un modelo de propiedad de procesos estricto, permitiendo ejecutar Docker y Podman en modo Rootless (sin privilegios de superusuario) de manera segura.
- **Métricas Confiables de OOM Killer:** Bajo cgroup v1, un contenedor podía agotar la memoria y provocar el congelamiento de procesos ajenos debido a que el controlador de memoria estaba desacoplado del de I/O. En cgroup v2, la contabilidad de memoria anónima y de caché de páginas es unificada, garantizando que el OOM Killer elimine únicamente los procesos del contenedor infractor.

## Preguntas Frecuentes (FAQ)

### ¿Debo mantener cgroup v1 de forma permanente en mi servidor?
No. Upstream Linux, Kubernetes y las principales distribuciones han declarado cgroup v1 como obsoleto. El parámetro `systemd.unified_cgroup_hierarchy=0` debe utilizarse únicamente como una solución temporal mientras se actualizan las imágenes o runtimes de contenedores a versiones compatibles con cgroup v2.

### ¿Por qué falla systemd al ejecutarse dentro de un contenedor Docker?
Para ejecutar systemd como proceso PID 1 dentro de un contenedor (por ejemplo, para pruebas de Ansible), debes montar el cgroup del host en modo lectura/escritura (`-v /sys/fs/cgroup:/sys/fs/cgroup:rw`) y pasar el parámetro `--cgroupns host`.

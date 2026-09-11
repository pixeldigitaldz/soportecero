---
title: "[SOLUCIONADO] Error: Failed to mount cgroup cgroup2 o systemd en Docker y Linux"
description: "Repara el fallo Failed to mount cgroup cgroup2 o cgroup hierarchy v2 en Docker, LXC y entornos systemd en distribuciones Linux modernas."
category: "Sistemas y Servidores"
tags: ["Docker","systemd","Linux","DevOps"]
readTime: "4 min"
date: "2026-09-14"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Incompatibilidad entre Docker daemon y la jerarquía unificada cgroup v2 en kernels recientes** | Actualizar Docker a la última versión o habilitar compatibilidad híbrida en GRUB |
| **Contenedores privilegiados o systemd anidado en LXC/Docker sin permisos de cgroup** | Configurar systemd.unified_cgroup_hierarchy=0 o montar cgroups con volumen rw |

Al iniciar contenedores con Docker, Podman o entornos virtualizados LXC/Proxmox en distribuciones modernas (Ubuntu 24.04, Debian 12, Arch Linux), es habitual encontrarse con el error `Failed to mount cgroup: No such file or directory` o `OCI runtime error: unable to apply cgroup configuration`. Esto sucede por el cambio de la jerarquía heredada (cgroup v1) al árbol unificado moderno (cgroup v2).

> **Solución Rápida (1 Minuto):**
> 1. Revisa la versión de cgroups activa en tu kernel:
>    `stat -fc %T /sys/fs/cgroup/`
> 2. Si devuelve 'cgroup2fs' y tu software antiguo falla, agrega a /etc/default/grub:
>    `systemd.unified_cgroup_hierarchy=0`

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Identificar la versión de cgroup activa en el sistema
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

## 🛡️ Consejo de Prevención
* Mantén Docker Engine y containerd actualizados a versiones oficiales para evitar problemas de compatibilidad con cgroup v2.
* Evita desactivar cgroup v2 permanentemente, ya que el soporte para v1 será depreciado en futuras versiones del kernel Linux.

## Preguntas Frecuentes

### ¿Cuál es la diferencia entre cgroup v1 y cgroup v2 en Linux?
cgroup v1 permitía jerarquías independientes para CPU, memoria y E/S, lo que provocaba bloqueos. cgroup v2 unifica todos los controladores en un único árbol jerárquico gestionado eficientemente.

### ¿Cómo soluciono este fallo dentro de contenedores LXC en Proxmox?
En Proxmox VE añade `lxc.cgroup2.memory.max` o habilita la opción de virtualización de características avanzadas nesting=1 en el archivo /etc/pve/lxc/<ID>.conf.

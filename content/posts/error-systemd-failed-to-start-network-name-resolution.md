---
title: "[SOLUCIONADO] Fallo de DNS en Linux: 'Could not resolve host' / systemd-resolved"
description: "¿Tu servidor Linux perdió la conexión a internet por 'Could not resolve host'? Solución paso a paso para reparar la resolución DNS y resolv.conf."
category: "Sistemas y Servidores"
tags: ["Linux", "DNS", "Sysadmin", "Ubuntu"]
readTime: "4 min"
date: "2026-08-30"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Servicio systemd-resolved fallando por conflicto de permisos o configuración corrupta** | Revisar los logs del servicio con `journalctl -u systemd-resolved -b` |
| **Enlace simbólico del archivo /etc/resolv.conf roto** | Recrear el enlace simbólico hacia `/run/systemd/resolve/stub-resolv.conf` |


El error **`Could not resolve host: google.com`** o **`Temporary failure in name resolution`** al ejecutar `ping`, `apt update` o `curl` en servidores Linux (Ubuntu, Debian, CentOS) ocurre cuando el servicio local de resolución de nombres DNS (**`systemd-resolved`**) o el enlace simbólico del archivo `/etc/resolv.conf` está corrupto o desconfigurado.

> **Solución Rápida (1 Minuto):**
> 1. Restablece temporalmente un servidor DNS primario en `/etc/resolv.conf`:
>    `echo "nameserver 8.8.8.8" | sudo tee /etc/resolv.conf`
> 2. Reinicia el servicio de DNS nativo:
>    `sudo systemctl restart systemd-resolved`

## 🚀 Cómo solucionar los fallos de resolución DNS en Linux paso a paso

### Paso 1: Comprobar el servicio `systemd-resolved`
Verifica si el demonio de resolución DNS predeterminado de systemd se encuentra activo:

```bash
sudo systemctl status systemd-resolved
```
Si se encuentra detenido o bloqueado, inicialízalo:
```bash
sudo systemctl enable --now systemd-resolved
```

### Paso 2: Reconstruir el enlace simbólico de `/etc/resolv.conf`
En distribuciones modernas de Linux, `/etc/resolv.conf` debe ser un enlace simbólico que apunta al archivo administrado por systemd. Si un programa lo sobrescribió convirtiéndolo en un archivo estático roto:

```bash
# 1. Eliminar el archivo resolv.conf corrupto
sudo rm -f /etc/resolv.conf

# 2. Crear el enlace simbolico hacia la configuracion stub de systemd
sudo ln -s /run/systemd/resolve/stub-resolv.conf /etc/resolv.conf

# 3. Reiniciar servicios de red
sudo systemctl restart systemd-resolved
```

### Paso 3: Asignar servidores DNS estáticos en Netplan / NetworkManager
Para evitar que el proveedor de hosting o DHCP sobrescriba la configuración con servidores DNS no funcionales tras reiniciar:

* **En Ubuntu Server (Netplan `/etc/netplan/50-cloud-init.yaml`):**
  ```yaml
  network:
    version: 2
    ethernets:
      eth0:
        nameservers:
          addresses: [8.8.8.8, 1.1.1.1]
  ```
  Aplica los cambios con `sudo netplan apply`.

## 🛡️ Consejo de Prevención
* Evita modificar manualmente el archivo `/etc/resolv.conf` sin usar la herramienta de gestión de red de tu distribución (`netplan` o `nmcli`).

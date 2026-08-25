---
title: "[SOLUCIONADO] Fallo de DNS en Linux: 'Could not resolve host' / systemd-resolved"
description: "Aprende a reparar el fallo de resolución DNS y el servicio systemd-resolved en Ubuntu, Debian y Arch Linux paso a paso."
category: "Sistemas y Servidores"
tags: ["systemd", "DNS", "Linux", "SysAdmin", "Ubuntu", "Redes"]
readTime: "5 min"
date: "2026-06-25"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Enlace simbólico roto en /etc/resolv.conf apuntando a un stub de systemd-resolved inactivo** | Recrear el enlace simbólico a `/run/systemd/resolve/stub-resolv.conf` o restaurar archivo estático |
| **Daemon systemd-resolved caído con estado failed (status=failed)** | Reiniciar el servicio con `sudo systemctl restart systemd-resolved` y configurar DNS públicos |

El fallo generalizado `Temporary failure in name resolution`, `Could not resolve host: google.com` o `Failed to start Network Name Resolution` en Linux ocurre cuando el subsistema de resolución DNS local (systemd-resolved o el archivo `/etc/resolv.conf`) pierde la configuración de servidores de nombres, bloqueando todas las conexiones a internet que utilicen nombres de dominio.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Restablecer temporalmente la conectividad mediante nameservers estáticos
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

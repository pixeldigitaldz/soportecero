---
title: "Cómo actualizar el llavero archlinux-keyring cuando Pacman falla al instalar paquetes"
description: "Guía completa para solucionar errores de claves desactualizadas en Arch Linux, Manjaro y CachyOS con pacman-key y repositorios oficiales."
category: "Sistemas y Servidores"
tags: ["Arch Linux", "Pacman", "Linux", "CachyOS", "SysAdmin"]
readTime: "5 min"
date: "2026-08-04"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Paquete archlinux-keyring desactualizado en una instalación inactiva por semanas** | Actualizar exclusivamente el llavero con `sudo pacman -Sy archlinux-keyring` antes de la actualización general |
| **Directorio de firmas criptográficas corrupto en /etc/pacman.d/gnupg** | Reconstruir el llavero GPG con `sudo rm -rf /etc/pacman.d/gnupg && sudo pacman-key --init && sudo pacman-key --populate archlinux` |

El fallo recurrente `error: archlinux-keyring: signature is marginal trust` o `error: failed to commit transaction (invalid or corrupted package (PGP signature))` ocurre cuando los desarrolladores y empaquetadores de Arch Linux rotan o renuevan sus certificados criptográficos mientras tu sistema conserva un llavero antiguo, impidiendo que Pacman confíe en los nuevos paquetes oficiales.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Sincronizar la hora del sistema
Un reloj del sistema desfasado causará que todas las firmas PGP válidas sean rechazadas de inmediato:
```bash
# Forzar la sincronización horaria con los servidores NTP
sudo timedatectl set-ntp true
timedatectl status
```

### Paso 2: Actualizar el paquete archlinux-keyring de forma aislada
Antes de ejecutar una actualización general con `pacman -Syu`, fuerza la descarga e instalación del paquete de firmas más reciente:
```bash
# Sincronizar repositorios e instalar únicamente archlinux-keyring
sudo pacman -Sy archlinux-keyring --noconfirm

# En sistemas derivados como CachyOS o Manjaro, actualiza también sus llaveros:
# sudo pacman -Sy cachyos-keyring manjaro-keyring --noconfirm
```

### Paso 3: Regenerar el llavero GPG de Pacman si persiste el error
Si el paso anterior arroja fallos de base de datos o confianza marginal corrupta, reinicializa el subsistema de claves:
```bash
# 1. Eliminar el directorio de claves corrupto
sudo rm -rf /etc/pacman.d/gnupg

# 2. Inicializar la configuración criptográfica
sudo pacman-key --init

# 3. Poblar las firmas de los desarrolladores oficiales
sudo pacman-key --populate archlinux

# 4. Refrescar las claves con los servidores públicos
sudo pacman-key --refresh-keys
```

### Paso 4: Limpiar la caché de paquetes y actualizar el sistema
Elimina los paquetes que fallaron durante la descarga y procede con la actualización total:
```bash
# Limpiar archivos corruptos de /var/cache/pacman/pkg/
sudo pacman -Scc --noconfirm

# Ejecutar la actualización completa del sistema
sudo pacman -Syu
```

## 🛡️ Consejos de Prevención
- **Actualiza con regularidad:** Si utilizas una distribución rolling-release como Arch Linux o CachyOS, realiza actualizaciones al menos cada 1 o 2 semanas para evitar que los llaveros de seguridad queden desfasados.
- **No modifiques SigLevel a TrustAll:** Desactivar la verificación de firmas en /etc/pacman.conf elimina la protección contra ataques de suplantación y paquetes adulterados.

## ❓ Preguntas Frecuentes (FAQ)

### ¿Qué significa marginal trust en Pacman?
Significa que la clave pública con la que se firmó el paquete no tiene suficientes firmas de desarrolladores principales (Master Keys) en tu base de datos local para considerarse 100% de confianza.

### ¿Puedo actualizar paquetes individuales si el keyring está roto?
No de forma segura, ya que Pacman abortará la transacción completa antes de modificar cualquier archivo en el disco para proteger el sistema.

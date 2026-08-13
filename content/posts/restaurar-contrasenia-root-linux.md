---
title: "[SOLUCIONADO] Recuperar o Cambiar Contraseña de Root en Linux (Sin Formatear)"
description: "¿Olvidaste la contraseña de root en Linux? Aprende a restablecer la clave del usuario root en menos de 3 minutos modificando GRUB."
category: "Sistemas y Servidores"
tags: ["Linux", "Sysadmin", "Seguridad"]
readTime: "4 min"
date: "2026-06-27"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Contraseña de superusuario root olvidada o bloqueada** | Iniciar en modo monousuario (single-user) agregando `init=/bin/bash` en GRUB |
| **Sistema de archivos montado en modo lectura (read-only) durante la recuperación** | Remontar en modo lectura/escritura: `mount -o remount,rw /` y cambiar clave con `passwd` |


Perder la **contraseña de root en Linux** (o contraseña de administrador superusuario) bloquea el acceso total a tu servidor o máquina virtual. Afortunadamente, no necesitas formatear: si tienes acceso físico o consola web KVM / IPMI, puedes recuperar o cambiar la clave de root editando los parámetros de inicio de **GRUB**.

> **Resumen de la Solución (3 Pasos):**
> 1. En el menú de **GRUB**, presiona `e`.
> 2. Añade `init=/bin/bash` al final de la línea `linux`. Presiona `Ctrl + X`.
> 3. Ejecuta: `mount -o remount,rw /` y luego `passwd root`.

## 🚀 Cómo restablecer la contraseña de root paso a paso

### Paso 1: Interceptar el cargador de arranque GRUB
1. Reinicia tu servidor o equipo con Linux.
2. Al aparecer la pantalla del menú de selección de sistemas de **GRUB**, pulsa de inmediato la tecla `e` de tu teclado para editar las opciones del kernel.

### Paso 2: Modificar los parámetros del kernel
1. Desplázate con las flechas de dirección hasta ubicar la línea que comienza con la palabra `linux` o `linux16`.
2. Ve al final de la línea, elimina parámetros como `rhgb quiet` y añade exactamente:
```plaintext
init=/bin/bash
```
3. Presiona `Ctrl + X` o `F10` para arrancar el sistema con esta consola temporal de superusuario.

### Paso 3: Montar la partición en modo lectura-escritura y cambiar la contraseña de root
El sistema iniciará en una terminal sin pedir contraseña. Ejecuta los siguientes comandos para cambiar la clave:
```bash
# Remontar la partición raíz con permisos de escritura
mount -o remount,rw /

# Cambiar la contraseña del usuario root
passwd root

# Si usas SELinux (RHEL, Fedora, AlmaLinux, Rocky Linux), fuerza el reetiquetado:
touch /.autorelabel

# Reiniciar el servidor normalmente
exec /sbin/init
```

## 🛡️ Consejo de Prevención y Seguridad
- Si utilizas servidores en la nube o en producción local, protege la consola de GRUB asignando una contraseña en el gestor de arranque (`grub-mkpasswd-pbkdf2`) para evitar que personas con acceso físico modifiquen los parámetros del kernel sin autorización.


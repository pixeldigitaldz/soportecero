---
title: "Cómo restablecer la contraseña de usuario Root olvidada en sistemas Linux"
description: "Guía paso a paso para recuperar el acceso administrativo root a tu servidor físico o virtual modificando el cargador de arranque GRUB."
category: "Sistemas y Servidores"
tags: ["Linux", "Sysadmin", "Seguridad"]
readTime: "4 min"
date: "2026-06-27"
---

La pérdida de la contraseña de usuario administrador root en un servidor Linux físico o máquina virtual bloquea el acceso total a las configuraciones del sistema. Afortunadamente, si dispones de acceso físico o acceso a la consola del emulador de virtualización (KVM/IPMI), puedes saltar la autenticación editando los parámetros del núcleo en GRUB.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Acceder e interceptar el cargador de arranque GRUB
1. Reinicia el servidor.
2. Al aparecer la pantalla del menú de selección de sistemas operativos de **GRUB**, pulsa inmediatamente la tecla `e` de tu teclado para editar las variables de arranque del núcleo seleccionado.

### Paso 2: Modificar los parámetros del kernel
1. Desplázate hacia abajo utilizando las flechas de dirección hasta ubicar la línea que comienza con la palabra `linux` o `linux16`.
2. Ve al final de dicha línea, elimina las palabras de arranque silencioso (como `rhgb quiet`) y añade el siguiente comando para forzar al núcleo a abrir un intérprete de comandos seguro en lugar de la interfaz de inicio de sesión:
```plaintext
init=/bin/bash
```
3. Presiona la combinación de teclas `Ctrl + X` o `F10` para arrancar el servidor con esta nueva configuración temporal.

### Paso 3: Montar el disco en modo escritura y cambiar la clave
El sistema iniciará directamente como superusuario sin pedir clave, pero con el disco configurado en modo solo lectura. Habilita la escritura para guardar los cambios:
```bash
# Remontar la partición raíz con privilegios de escritura
mount -o remount,rw /

# Modificar la clave del usuario administrador root
passwd root

# Forzar el reetiquetado de seguridad si usas SELinux (esencial en RHEL/Fedora/Rocky)
touch /.autorelabel

# Reiniciar el equipo
exec /sbin/init
```

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
- La posibilidad de resetear contraseñas de esta forma es una característica del kernel, pero representa un gran riesgo de seguridad si un atacante tiene acceso físico a tus servidores locales. Protege el cargador de arranque de tu sistema de producción estableciendo una contraseña de acceso a la consola de GRUB (`grub-mkpasswd-pbkdf2`), lo que evitará que usuarios no autorizados editen los parámetros del núcleo sin autenticación previa.

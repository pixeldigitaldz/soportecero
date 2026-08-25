---
title: "Guía: chmod Operation not permitted (Incluso como Root) en Linux"
description: "Aprende a solucionar el error chmod / chown: Operation not permitted usando lsattr y chattr para desbloquear archivos inmutables en Linux."
category: "Sistemas y Servidores"
tags: ["Linux", "Permisos", "SysAdmin", "Seguridad", "Ubuntu", "Debian"]
readTime: "5 min"
date: "2026-06-25"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Archivo protegido con el atributo inmutable (+i) o append-only (+a) en el sistema de archivos ext4/xfs** | Comprobar con `lsattr <archivo>` y quitar el atributo con `sudo chattr -i <archivo>` |
| **Sistema de archivos montado en modo de solo lectura (Read-Only) o bloqueo por SELinux / AppArmor** | Remontar con permisos de escritura (`sudo mount -o remount,rw /`) o verificar contextos de seguridad |

En Linux, encontrarse con el error `chmod: changing permissions of 'archivo': Operation not permitted` o `chown: changing ownership of 'archivo': Operation not permitted` ejecutando el comando como superusuario `root` desconcierta a muchos administradores. Ocurre cuando el archivo tiene asignados atributos extendidos de inmutabilidad en el sistema de archivos (ext4/XFS) o el sistema de archivos fue bloqueado en modo de solo lectura tras un error de disco.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Inspeccionar atributos extendidos con lsattr
El comando estándar `ls -l` solo muestra los permisos POSIX convencionales. Para ver los atributos extendidos del kernel, utiliza `lsattr`:
```bash
# Inspeccionar atributos extendidos del archivo bloqueado
lsattr /ruta/al/archivo

# Ejemplo de salida típica bloqueada:
# ----i---------e---- /ruta/al/archivo  (La 'i' indica inmutable)
# -----a--------e---- /ruta/al/archivo  (La 'a' indica solo anexar)
```

### Paso 2: Eliminar el atributo de inmutabilidad con chattr
Como usuario `root`, desactiva los flags inmutables y de solo anexado:
```bash
# Quitar el flag inmutable (-i) y append-only (-a)
sudo chattr -i /ruta/al/archivo
sudo chattr -a /ruta/al/archivo

# Si es un directorio completo de forma recursiva:
sudo chattr -R -i /ruta/al/directorio
```

### Paso 3: Modificar los permisos con chmod o chown
Una vez retirado el bloqueo de atributos, ejecuta el cambio de permisos normalmente:
```bash
# Cambiar permisos a lectura y escritura estándar
sudo chmod 644 /ruta/al/archivo

# Cambiar propietario
sudo chown usuario:grupo /ruta/al/archivo
```

### Paso 4: Comprobar el estado del montaje del disco si persiste el error
Si `lsattr` no muestra atributos pero el archivo sigue bloqueado, comprueba si el disco entró en modo solo lectura por fallos de hardware:
```bash
# Verificar si el sistema de archivos está montado como 'ro' (Read-Only)
mount | grep -i " / "

# Remontar en modo lectura y escritura
sudo mount -o remount,rw /
```

## 🛡️ Consejos de Prevención
- **Usa el atributo inmutable para proteger archivos críticos:** Puedes proteger archivos de configuración clave (como `/etc/resolv.conf` o scripts de despliegue) contra sobreescrituras accidentales aplicando: `sudo chattr +i /etc/resolv.conf`.
- **Cuidado con malware o rootkits:** Algunos scripts maliciosos marcan sus archivos como `+i` para evitar que el antivirus o el administrador los elimine.

## ❓ Preguntas Frecuentes (FAQ)

### ¿Incluso el usuario root es bloqueado por el atributo inmutable (+i)?
Sí. El atributo `+i` es una directiva forzada por el kernel de Linux a nivel del sistema de archivos. Ningún proceso (ni siquiera con UID 0) puede modificar, renombrar o borrar el archivo hasta que se ejecute `chattr -i`.

### ¿Funciona chattr en sistemas de archivos NTFS o FAT32?
No. Los comandos `chattr` y `lsattr` son específicos de sistemas de archivos nativos de Linux como ext2, ext3, ext4, XFS y Btrfs.

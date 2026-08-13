---
title: 'Guía: chmod Operation not permitted (Incluso como Root) en Linux'
description: 'Cómo solucionar el error Operation not permitted al usar chmod o chown en Linux, provocado por atributos inmutables (chattr).'
category: 'Sistemas y Servidores'
date: '2026-08-13'
readTime: '2 min'
tags: ['Linux', 'Seguridad', 'Permisos']
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Archivo marcado como Inmutable** | Usar `chattr -i` para remover el atributo |
| **Sistema de archivos en Solo Lectura** | Remontar con `mount -o remount,rw /` |
| **Problemas de SELinux o AppArmor** | Revisar los contextos de seguridad |

## La Solución Paso a Paso

**Revisa los atributos extendidos del archivo**
Si eres root pero igual recibes "Operation not permitted", el archivo probablemente tenga el atributo `i` (inmutable). Compruébalo con:
```bash
lsattr nombre_del_archivo
```
Verás una salida similar a `----i---------e--- nombre_del_archivo`. La `i` indica que es inmutable.

**Remueve el atributo inmutable**
Usa el comando `chattr` para quitar este bloqueo:
```bash
sudo chattr -i nombre_del_archivo
```

**Aplica tus cambios de permisos**
Ahora que el archivo ya no está bloqueado a nivel de sistema de archivos, puedes usar `chmod` o `chown` normalmente:
```bash
sudo chmod 755 nombre_del_archivo
```

**Restaura el atributo si es necesario**
Si el archivo era inmutable por razones de seguridad (como `/etc/resolv.conf` o el archivo `authorized_keys`), asegúrate de volver a protegerlo:
```bash
sudo chattr +i nombre_del_archivo
```

## Prevención
- **Documentación:** Si usas `chattr +i` en servidores, documéntalo para evitar dolores de cabeza a otros administradores.
- **Auditoría:** Usa `lsattr` rutinariamente cuando intentes modificar archivos críticos del sistema que se resisten a cambios de `chmod`.

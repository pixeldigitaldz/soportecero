---
title: 'Cómo resolver: Error 2002 (HY000): Can''t connect to local MySQL server through socket'
description: 'Cómo diagnosticar y solucionar el error 2002 de MySQL/MariaDB cuando no puede conectarse a través del socket mysql.sock.'
category: 'Sistemas y Servidores'
date: '2026-08-16'
readTime: '3 min'
tags: ['MySQL', 'Bases de Datos', 'Linux']
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Servicio MySQL/MariaDB caído** | Iniciar el servicio: `systemctl start mysql` |
| **Archivo mysql.sock perdido/corrupto** | Reiniciar el servicio o crear la ruta manualmente |
| **Permisos incorrectos en /var/run/mysqld** | Cambiar dueño a mysql: `chown mysql:mysql /var/run/mysqld/` |

## La Solución Paso a Paso

**Verifica el estado del servicio**
El error más común es que MySQL o MariaDB simplemente no estén corriendo. Verifícalo:
```bash
sudo systemctl status mysql
# o si usas mariadb: sudo systemctl status mariadb
```
Si dice *inactive* o *failed*, inícialo:
```bash
sudo systemctl start mysql
```

**Busca el archivo de socket manualmente**
A veces, el cliente de MySQL busca el archivo `.sock` en `/tmp/mysql.sock` pero el servidor lo creó en `/var/run/mysqld/mysqld.sock`. Para encontrar dónde está realmente el socket, revisa tu archivo de configuración (`/etc/mysql/my.cnf` o `/etc/my.cnf`):
```bash
grep -i "socket" /etc/mysql/my.cnf
```
Si sabes que el servidor está corriendo pero el socket está en otra ubicación, puedes conectarte especificándolo:
```bash
mysql -u root -p -S /var/run/mysqld/mysqld.sock
```

**Problemas de permisos y directorios**
Si el servidor falla al arrancar quejándose del socket, puede que la carpeta `/var/run/mysqld` no exista o no tenga los permisos correctos (suele pasar tras reinicios bruscos o actualizaciones). 
Recrea la carpeta y dale permisos:
```bash
sudo mkdir -p /var/run/mysqld
sudo chown mysql:mysql /var/run/mysqld
sudo systemctl restart mysql
```

**Verifica si hay falta de espacio en disco**
A veces, MySQL se apaga inesperadamente porque la partición raíz (`/`) o `/var` se ha quedado sin espacio, impidiendo la creación del archivo socket temporal.
```bash
df -h
```
Si el disco está al 100%, libera espacio y reinicia el servicio.

## Prevención
- **Monitoreo del disco:** Asegúrate de configurar alertas de espacio en disco en tu servidor.
- **Configuración estandarizada:** Define la ruta del `socket` explícitamente bajo la sección `[client]` y `[mysqld]` en tu archivo `my.cnf` para que tanto el servidor como el cliente coincidan siempre en la ubicación.

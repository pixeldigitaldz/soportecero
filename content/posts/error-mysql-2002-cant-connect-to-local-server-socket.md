---
title: "Cómo resolver: Error 2002 (HY000): Can't connect to local MySQL server through socket"
description: "Aprende a solucionar el error 2002 Can't connect to MySQL server through socket '/var/run/mysqld/mysqld.sock' en Ubuntu, Debian y CentOS."
category: "Web y Código"
tags: ["MySQL", "MariaDB", "Linux", "SysAdmin", "Bases de Datos", "Ubuntu"]
readTime: "5 min"
date: "2026-06-25"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **El servidor MySQL / MariaDB está detenido o no pudo crear el socket UNIX por falta de espacio en disco** | Comprobar almacenamiento con `df -h` e iniciar el servicio con `sudo systemctl start mysql` |
| **Ruta del archivo de socket desincronizada entre my.cnf (/var/run/mysqld/mysqld.sock y /tmp/mysql.sock)** | Crear un enlace simbólico al socket o sincronizar la ruta en la sección `[client]` y `[mysqld]` |

El error `ERROR 2002 (HY000): Can't connect to local MySQL server through socket '/var/run/mysqld/mysqld.sock' (2)` ocurre cuando el cliente de línea de comandos de MySQL o una aplicación web local intenta comunicarse con el motor de base de datos a través del archivo de socket IPC de UNIX y este no existe en la ruta esperada o el daemon `mysqld` se ha detenido abruptamente.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Comprobar el estado del servicio y espacio en disco
Verifica si el proceso de base de datos está detenido y si la partición raíz tiene espacio libre para escribir archivos temporales:
```bash
# 1. Comprobar espacio disponible en disco
df -h

# 2. Comprobar el estado de MySQL / MariaDB
sudo systemctl status mysql # o mariadb

# 3. Iniciar el servicio si está inactivo
sudo systemctl start mysql
```

### Paso 2: Crear el directorio del socket y asignar permisos correctos
Si el directorio `/var/run/mysqld` fue eliminado tras un reinicio del sistema (común en sistemas con `tmpfs`):
```bash
# Crear la carpeta del socket
sudo mkdir -p /var/run/mysqld

# Asignar la propiedad al usuario mysql
sudo chown -R mysql:mysql /var/run/mysqld
sudo chmod -R 755 /var/run/mysqld

# Reiniciar el servicio
sudo systemctl restart mysql
```

### Paso 3: Sincronizar la ruta del socket en my.cnf
Asegúrate de que la sección cliente y la sección servidor apunten exactamente a la misma ruta de socket:
```ini
# /etc/mysql/my.cnf o /etc/mysql/mysql.conf.d/mysqld.cnf
[mysqld]
socket = /var/run/mysqld/mysqld.sock

[client]
socket = /var/run/mysqld/mysqld.sock
```

### Paso 4: Crear un enlace simbólico de compatibilidad si es necesario
Si tu aplicación busca el socket en `/tmp/mysql.sock` mientras MySQL lo crea en `/var/run/mysqld/mysqld.sock`:
```bash
sudo ln -s /var/run/mysqld/mysqld.sock /tmp/mysql.sock
```

## 🛡️ Consejos de Prevención
- **Monitorea los logs de error de MySQL:** Revisa periódicamente `/var/log/mysql/error.log` para detectar tablas InnoDB corruptas antes de que provoquen cierres del servidor.
- **Configura límites de memoria en servidores pequeños:** En VPS con 1GB de RAM, ajusta `innodb_buffer_pool_size` a 256M para evitar que el proceso sea terminado por el OOM Killer.

## ❓ Preguntas Frecuentes (FAQ)

### ¿Por qué puedo conectar con 127.0.0.1 pero fallo con localhost?
Porque en sistemas UNIX, conectar a `localhost` fuerza la comunicación por socket de archivos (`mysqld.sock`), mientras que conectar a `127.0.0.1` utiliza la pila de red TCP/IP (puerto 3306).

### ¿Qué significa el código de error (2) al final del mensaje?
El número (2) es el código de error estándar del kernel Linux `ENOENT` (No such file or directory), indicando que el archivo de socket físico no existe en disco.

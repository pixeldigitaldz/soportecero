---
title: "Solución al fallo: \"Too many connections\" en bases de datos MySQL / MariaDB"
description: "Aprende a diagnosticar y corregir el error de exceso de conexiones abiertas en MySQL optimizando las directivas de conexión de tu servidor."
category: "Web y Código"
tags: ["MySQL", "MariaDB", "Database"]
readTime: "3 min"
date: "2026-06-27"
---

El error `Error 1040: Too many connections` detiene de inmediato las consultas a tu base de datos y ocurre cuando el número de hilos de conexión abiertos por tu aplicación excede la directiva máxima definida en los ajustes internos del servidor MySQL o MariaDB.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Acceder al motor y diagnosticar hilos inactivos
Si el servidor web aún te permite interactuar por consola mediante la cuenta administrativa, inspecciona qué procesos de consultas están reteniendo el tráfico de datos:
```bash
# Entrar al motor de base de datos
mysql -u root -p

# Ejecutar el comando para listar procesos
SHOW PROCESSLIST;
```
*(Busca consultas con estado "Sleep" prolongado. Si existen cientos de ellas, la aplicación no está cerrando los canales de conexión tras responder).*

### Paso 2: Ajustar límites globales en el archivo de configuración
Abre la configuración del servidor de base de datos (`/etc/mysql/my.cnf` o `/etc/my.cnf.d/server.cnf` en MariaDB) e incrementa el límite máximo de conexiones concurrentes admisibles por hardware:
```plaintext
[mysqld]
max_connections = 250
interactive_timeout = 180
wait_timeout = 60
```
*(Nota: Reducir `wait_timeout` obliga al motor a matar conexiones inactivas en desuso tras 60 segundos, liberando ranuras automáticamente).*

### Paso 3: Reiniciar el servicio para liberar memoria
```bash
sudo systemctl restart mysql   # En MySQL
sudo systemctl restart mariadb # En MariaDB
```

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
- No incrementes de forma arbitraria la directiva `max_connections` a valores astronómicos (como 1000 o 2000) si tu hardware tiene poca RAM física. Cada canal de conexión consume recursos del procesador y memoria caché; exceder las capacidades del servidor provocará que el sistema se quede congelado por falta de espacio en disco de paginación o dispare fallos críticos. Implementa pools de conexiones en tu aplicación web para reutilizar canales en lugar de abrir uno nuevo con cada consulta.

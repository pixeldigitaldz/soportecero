---
title: La guía definitiva de permisos de archivos y carpetas para asegurar WordPress
description: >-
  Protege tu sitio web WordPress de inyecciones de código y accesos no
  autorizados aplicando el esquema de permisos de seguridad óptimo.
category: Web y Código
tags:
  - WordPress
  - Seguridad
  - Linux
readTime: 7 min
date: '2026-06-27'
---
Los fallos de seguridad en WordPress que permiten a atacantes subir scripts maliciosos o modificar archivos de configuración suelen ocurrir por tener permisos demasiado permisivos en los directorios de tu hosting. Mantener la configuración por defecto de algunos instaladores automáticos es el vector de ataque más explotado.

## Análisis de Arquitectura y Causa Raíz

El protocolo **SSH (Secure Shell)**, estandarizado en RFC 4251-4254, provee un canal de comunicación criptográficamente seguro sobre redes no confiables, operando en la capa de aplicación sobre el protocolo de transporte TCP (puerto estándar 22). Su arquitectura comprende tres componentes desacoplados: la capa de transporte (autenticación del servidor, cifrado simétrico y verificación de integridad), el protocolo de autenticación de usuario, y el protocolo de conexión para multiplexar múltiples canales lógicos.

La causa raíz de esta incidencia radica en fallos de negociación criptográfica o restricciones en la capa de filtrado de paquetes del kernel:
1. **Algoritmos de Intercambio de Claves (KEX) y obsolescencia criptográfica:** Durante el saludo inicial (*handshake*), el cliente y el demonio `sshd` negocian un algoritmo de intercambio de claves seguro (ej. `curve25519-sha256` o `diffie-hellman-group14-sha256`). Si el cliente o el servidor tienen deshabilitados algoritmos heredados (por ejemplo tras una actualización de OpenSSH que desactiva claves SHA-1 o algoritmos RSA débiles), la negociación aborta de inmediato con el error `kex_exchange_identification: read: Connection reset by peer`.
2. **Verificación de huella digital y archivos `known_hosts`:** El cliente SSH protege al usuario contra ataques de intermediario (*Man-in-the-Middle*) cotejando la clave pública del servidor con el registro histórico almacenado en `~/.ssh/known_hosts`. Si el servidor remoto ha sido reinstalado, ha cambiado su par de claves o se ha reasignado la dirección IP en un entorno dinámico de nube, la huella digital criptográfica no coincidirá, activando un bloqueo de seguridad estricto por advertencia de ataque de spoofing.
3. **Bloqueo a nivel de Netfilter y saturación de conexiones:** Si se producen múltiples intentos de conexión fallidos o peticiones de autenticación concurrentes, módulos de seguridad como `fail2ban` o reglas en `iptables` / `nftables` descartan los paquetes entrantes (`DROP`), provocando que el cliente permanezca a la espera hasta agotar el tiempo límite (`Connection timed out`).

## Entorno de Laboratorio y Diagnóstico

Antes de aplicar cualquier cambio destructivo o reiniciar servicios en un entorno de producción, es fundamental ejecutar una matriz de diagnóstico preliminar para identificar la capa exacta donde ocurre el fallo:

| Causa | Solución |
|---|---|
| **Permisos excesivamente abiertos (ej. 777) en archivos o carpetas de WordPress** | Reset directory permissions to `755` and file permissions to `644` |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Comprobar el estado del servicio en el gestor de inicialización systemd
sudo systemctl status --no-pager -l nginx

# 2. Inspeccionar los registros del diario del sistema filtrando por unidad
sudo journalctl -u nginx -n 50 --no-pager

# 3. Auditar el espacio y tabla de inodos en todos los sistemas de archivos montados
df -Th && df -ih
```

- El flag `--no-pager` en `systemctl` y `journalctl` evita invocar el paginador interactivo (`less`), permitiendo redirigir la salida o analizar los registros sin interrumpir flujos de automatización.
- El comando `df` con los modificadores `-T` (tipo de sistema de archivos ext4/xfs/btrfs) y `-h` (formato legible en gigabytes/megabytes), combinado con `-i` (tabla de inodos disponibles), permite descartar si el disco está lleno por bytes reales o saturado por millones de archivos pequeños huérfanos.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

Los directorios de WordPress deben pertenecer al usuario de tu servidor web (como `www-data`, `apache` o `nginx`) y tener una máscara de permisos que impida la escritura a otros usuarios:
```bash
# Cambiar la propiedad de los archivos al usuario del servidor web
sudo chown -R www-data:www-data /var/www/html/wordpress

# Forzar a todas las carpetas a tener permisos 755
find /var/www/html/wordpress -type d -exec chmod 755 {} \;

# Forzar a todos los archivos a tener permisos 644
find /var/www/html/wordpress -type f -exec chmod 644 {} \;
```

### Paso 2: Proteger al máximo el archivo crítico wp-config.php
El archivo `wp-config.php` contiene las credenciales de tu base de datos y llaves de seguridad de la sesión. Nadie excepto el servidor web y tú deben poder leerlo:
```bash
# Cambiar permisos de lectura exclusiva al dueño del archivo
chmod 600 /var/www/html/wordpress/wp-config.php
```

### Paso 3: Proteger el archivo de reescritura .htaccess
Si utilizas el servidor web Apache, asegura el archivo de control de rutas frente a manipulaciones de plugins o inyecciones de código maliciosas:
```bash
chmod 644 /var/www/html/wordpress/.htaccess
```

## 🛡️ Consejos de Prevención

Prácticas de seguridad recomendadas:
- **Nunca apliques permisos 777 (lectura, escritura y ejecución para todo el mundo) a ninguna carpeta o archivo de tu sitio web bajo ninguna circunstancia**, ni siquiera de manera temporal para solucionar problemas de subida de imágenes en la carpeta `wp-content/uploads`. Si un plugin tiene problemas para guardar archivos, esto se debe a un conflicto de propiedad del usuario del sistema de archivos (`chown`) y no a la falta de permisos de escritura globales; abrir las puertas por completo permitirá que cualquier script inyectado en el servidor tome el control total de tu host.

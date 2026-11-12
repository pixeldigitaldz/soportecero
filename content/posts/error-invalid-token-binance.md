---
title: Error de token inválido o expirado en la API de Binance Pay
description: >-
  Aprende a corregir el fallo de autenticación 'Invalid Signature' o token
  expirado al integrar pasarelas de pago cripto en tu aplicación web.
category: Web y Código
tags:
  - Binance
  - API
  - Crypto
readTime: 7 min
date: '2026-06-27'
---
El error `Invalid Signature` o `Token Expired` en la API de Binance Pay ocurre cuando intentas procesar un pago en USDT u otra criptomoneda y los servidores de Binance rechazan la petición. La causa principal es una desincronización de la marca de tiempo (Timestamp) entre tu servidor local y el reloj oficial de Binance, o una concatenación incorrecta de las claves API al generar la firma criptográfica HMAC-SHA512.

## Análisis de Arquitectura y Causa Raíz

En la arquitectura del sistema operativo **Linux**, las aplicaciones de usuario operan en espacio no privilegiado (*User Space*) y dependen de llamadas al sistema (*syscalls*) para interactuar con los recursos físicos de hardware a través del **Kernel de Linux**. El subsistema del kernel arbitra el acceso a la memoria virtual, los descriptores de archivos, la pila de protocolos de red TCP/IP y los dispositivos de almacenamiento en bloque a través de la capa de abstracción **VFS (Virtual File System)**.

La anomalía técnica identificada en esta incidencia proviene de una restricción o condición de fallo en los mecanismos de control del sistema:
1. **Límites de descriptores de archivos y cuotas de inodos:** Cada archivo, socket de red o tubería (*pipe*) abierto por un proceso consume un descriptor de archivo en la tabla del kernel. Si el proceso alcanza el límite de descriptores asignado por el subsistema `ulimit` o si el sistema de archivos agota su tabla de inodos libres (incluso cuando resta espacio en gigabytes en disco), el kernel rechaza cualquier operación de escritura con el código de error `ENOSPC (No space left on device)` o `EMFILE (Too many open files)`.
2. **Jerarquía de permisos POSIX y atributos inmutables del sistema:** Las llamadas al sistema como `open()`, `unlink()` o `chmod()` evalúan los bits de permiso estándar (Lectura `r`, Escritura `w`, Ejecución `x`) junto con el UID/GID del proceso ejecutor. Si el archivo posee atributos extendidos inmutables fijados a nivel del sistema de archivos mediante `chattr +i`, el kernel bloquea cualquier mutación incluso ante el usuario privilegiado `root`, retornando el error `EPERM (Operation not permitted)`.
3. **Administración de memoria virtual y Swapping:** Cuando el sistema experimenta presión de memoria y la memoria física disponible es insuficiente para satisfacer las solicitudes del gestor de páginas, el kernel recurre a la memoria swap. Si los umbrales de agresividad (`vm.swappiness`) están desajustados o el espacio de intercambio está fragmentado, el sistema entra en un estado de congestión (*thrashing*), degradando el rendimiento general hasta que el subsistema OOM Killer termina procesos para preservar la estabilidad del kernel.

## Entorno de Laboratorio y Diagnóstico

Antes de aplicar cualquier cambio destructivo o reiniciar servicios en un entorno de producción, es fundamental ejecutar una matriz de diagnóstico preliminar para identificar la capa exacta donde ocurre el fallo:

| Causa | Solución |
|---|---|
| **API Key o Secret Key de Binance expirada, mal copiada o con IP no autorizada** | Generate new Binance API Key and whitelist server static IP |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Comprobar el estado del servicio en el gestor de inicialización systemd
sudo systemctl status --no-pager -l bot-trading

# 2. Inspeccionar los registros del diario del sistema filtrando por unidad
sudo journalctl -u bot-trading -n 50 --no-pager

# 3. Auditar el espacio y tabla de inodos en todos los sistemas de archivos montados
df -Th && df -ih
```

- El flag `--no-pager` en `systemctl` y `journalctl` evita invocar el paginador interactivo (`less`), permitiendo redirigir la salida o analizar los registros sin interrumpir flujos de automatización.
- El comando `df` con los modificadores `-T` (tipo de sistema de archivos ext4/xfs/btrfs) y `-h` (formato legible en gigabytes/megabytes), combinado con `-i` (tabla de inodos disponibles), permite descartar si el disco está lleno por bytes reales o saturado por millones de archivos pequeños huérfanos.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

Binance rechaza cualquier petición cuyo Timestamp varíe por más de unos pocos segundos respecto a su servidor. En tu servidor Linux, fuerza la sincronización horaria ejecutando:
```bash
sudo timedatectl set-ntp true
sudo systemctl restart systemd-timesyncd
```

Verifica que la hora esté perfectamente cuadrada con el comando `timedatectl`.

### Paso 2: Ordenar las variables para la firma (Payload)

La firma criptográfica requiere que unas el Timestamp, un string aleatorio (Nonce) y el cuerpo de la petición (Body JSON) en un formato estricto. Asegúrate de que tu código concatene los elementos exactamente en este orden antes de pasarlo por la función de hash:
```plaintext
TIMESTAMP + "\n" + NONCE + "\n" + BODY_JSON_STRING + "\n"
```

Un error común es que el JSON de tu código ordene las llaves de forma distinta a como las envías en el cuerpo HTTP, rompiendo la firma de inmediato.

## 🛡️ Consejos de Prevención

Prácticas de seguridad recomendadas:
- Nunca expongas tus llaves privadas (Secret Key) en el código frontend de tu aplicación (JavaScript del cliente). Cualquier usuario podría inspeccionar la página, robar tus credenciales de Binance Pay y vaciar los fondos de tu cuenta comercial. Realiza siempre las solicitudes de firma estrictamente desde el backend (Node.js, PHP o Python).

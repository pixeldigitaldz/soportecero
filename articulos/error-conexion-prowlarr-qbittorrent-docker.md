---
title: Solución al error de conexión rechazada entre Prowlarr y qBittorrent en Docker
description: >-
  Aprende a corregir el error 'Connection Refused' configurando correctamente
  las redes internas de Docker para tus aplicaciones de automatización.
category: Web y Código
tags:
  - Prowlarr
  - Docker
  - qBittorrent
readTime: 7 min
date: '2026-07-27'
---
El error de conexión rechazada (`Connection Refused` o `Test failed: Connection refused`) al intentar vincular Prowlarr con qBittorrent en Docker ocurre porque ambos servicios corren en contenedores aislados que no comparten la misma red lógica virtual de Docker, o porque qBittorrent rechaza conexiones externas debido a una mala configuración en su API de control.

## Análisis de Arquitectura y Causa Raíz

En entornos contenerizados, el motor de **Docker** se apoya en primitivas fundamentales del kernel de Linux: **Namespaces** (PID, NET, MNT, IPC, UTS) para el aislamiento lógico de procesos y **Control Groups (cgroups v1/v2)** para el límite estricto de recursos de hardware (memoria RAM, ciclos de CPU y cuotas de I/O de disco).

Cuando se produce este fallo, la anomalía suele situarse en la frontera entre el demonio `dockerd`, el runtime OCI (`containerd` / `runc`) y el subsistema de red del host:
1. **Comunicación con el socket IPC (`/var/run/docker.sock`):** El cliente de Docker interactúa con la API REST local mediante llamadas al sistema sobre un socket de dominio UNIX. Si los permisos de usuario en el socket no pertenecen al grupo `docker` o si el demonio ha quedado bloqueado por un hilo zombie, la llamada al sistema devuelve inmediatamente un descriptor de error `EACCES` o `ECONNREFUSED`.
2. **Ciclo de vida del contenedor y estados OCI:** Durante la creación del contenedor (`container create / start`), `runc` solicita al kernel la creación de los namespaces y el montaje del sistema de archivos en capas mediante el driver de almacenamiento **Overlay2** (`lowerdir`, `upperdir` y `merged`). Si existe corrupción en las capas de imagen, agotamiento de inodos en `/var/lib/docker`, o incompatibilidad con la arquitectura del binario, el runtime aborta con códigos de salida específicos (ej. Exit Code 137 por OOM Killer o Exit Code 126/127 por permisos o dependencias ausentes).
3. **Pila de red virtual y cadenas de iptables:** Para exponer puertos (`-p`), Docker manipula directamente las tablas `nat` y `filter` del subsistema Netfilter mediante cadenas personalizadas (`DOCKER`, `DOCKER-USER`). Reinicios no sincronizados del firewall (`ufw` o `firewalld`) eliminan estas cadenas en memoria del kernel, provocando que los paquetes TCP entrantes sean descartados silenciosamente con paquetes TCP RST.

## Entorno de Laboratorio y Diagnóstico

Antes de aplicar cualquier cambio destructivo o reiniciar servicios en un entorno de producción, es fundamental ejecutar una matriz de diagnóstico preliminar para identificar la capa exacta donde ocurre el fallo:

| Causa | Solución |
|---|---|
| **Nombre de host de red de Docker no alcanzable entre contenedores** |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Comprobar el estado general del demonio Docker
sudo systemctl status docker --no-pager -l

# 2. Inspeccionar los últimos logs del contenedor afectado
docker logs --tail 50 --timestamps NOMBRE_CONTENEDOR

# 3. Verificar el uso de recursos y memoria en tiempo real
docker stats --no-stream
```

- El comando `docker logs` con el parámetro `--tail 50` extrae únicamente las últimas 50 líneas emitidas en `stdout` y `stderr`, mientras que `--timestamps` permite correlacionar el segundo exacto del fallo con los registros del sistema operativo.
- El flag `--no-stream` en `docker stats` realiza un muestreo único del consumo de CPU y memoria de todos los contenedores en ejecución, evitando bloquear la terminal interactiva.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

Si tus contenedores no pueden hablar entre sí usando sus nombres de servicio, crea una red dedicada en tu archivo `docker-compose.yml`:
```yaml
# Definir una red puente común en tu compose
networks:
  arr-network:
    driver: bridge
```
Asegura que tanto el servicio de `prowlarr` como el de `qbittorrent` tengan asignada esta red:
```yaml
services:
  prowlarr:
    ...
    networks:
      - arr-network
  qbittorrent:
    ...
    networks:
      - arr-network
```

### Paso 2: Desactivar la protección CSRF y permitir acceso local en qBittorrent
El motor de seguridad de qBittorrent bloqueará las llamadas a la API hechas desde otros contenedores dentro de la red privada si no configuras los parámetros de acceso seguro en tu cliente web:
1. Accede a la interfaz web de qBittorrent.
2. Ve a **Alt+O** (Opciones) > **WebUI**.
3. Desmarca la casilla **Habilitar protección contra falsificación de petición en sitios cruzados (CSRF)**.
4. En el campo **Evitar la autenticación de clientes en subredes locales**, ingresa la subred interna de Docker:
```plaintext
172.16.0.0/12, 192.168.0.0/16
```

### Paso 3: Utilizar el nombre del contenedor como dirección de Host
Al configurar el cliente de Torrent dentro del panel de Prowlarr, nunca utilices `localhost` o `127.0.0.1`. En su lugar, ingresa el nombre exacto del contenedor asignado en Docker:
```plaintext
Host: qbittorrent
Port: 8080
```

## Resolución de Casos Borde (Troubleshooting)

### Caso Borde 1: Restricciones de seguridad aplicadas por SELinux o AppArmor

En distribuciones de clase empresarial como Red Hat Enterprise Linux, AlmaLinux o Rocky Linux (que utilizan **SELinux** en modo Enforcing) o en Ubuntu/Debian (que implementan **AppArmor**), las políticas de confinamiento del sistema operativo pueden bloquear el acceso a archivos, sockets UNIX o puertos de red incluso cuando los permisos tradicionales `chmod 777` y el usuario `root` están en uso.

Para verificar y solventar bloqueos por contexto de seguridad:
```bash
# Consultar si SELinux generó denegaciones recientes en el log de auditoría
sudo ausearch -m avc -ts recent 2>/dev/null

# En caso de AppArmor, revisar eventos bloqueados en el diario del kernel
sudo dmesg | grep -i apparmor | tail -n 20
```
Si se confirma una denegación de contexto en SELinux, restaura el contexto de seguridad predeterminado del archivo o directorio afectado ejecutando:
```bash
# Restaurar etiquetas de contexto de seguridad recursivamente
sudo restorecon -Rv /ruta/afectada
```

### Caso Borde 2: Persistencia tras reinicio y desincronización de procesos huérfanos

En ocasiones, tras aplicar una solución en caliente en la terminal, el problema reaparece inesperadamente en el siguiente reinicio del servidor o al finalizar la sesión SSH. Esto ocurre comúnmente cuando existen procesos huérfanos (*zombie processes*) que retienen el bloqueo de archivos o sockets en memoria sin permitir que el nuevo servicio tome control del recurso.

Para identificar y limpiar procesos bloqueados de forma segura:
```bash
# Identificar qué proceso tiene abierto el descriptor de archivo o socket
sudo lsof +D /ruta/o/archivo/afectado

# Si es necesario liberar el proceso huérfano de manera ordenada (señal SIGTERM)
sudo kill -15 PID_DEL_PROCESO
```

### Verificación de Logs en Tiempo Real y Validación en Producción

Una vez aplicadas las modificaciones correctivas, valida en consola que el sistema opere con total estabilidad y sin emitir advertencias residuales:
```bash
# Monitorear registros en vivo filtrando por palabras clave de fallo
sudo journalctl -f -n 100 | grep -Ei "(error|fail|warn|critical)"

# Verificar que el código de retorno del último comando ejecutado sea exitoso (0)
echo $?
```
Un valor de retorno `0` confirma la ejecución exitosa en el estándar POSIX, garantizando que el servicio o comando ha completado su ciclo sin excepciones pendientes.

## 🛡️ Consejos de Prevención

Prácticas de seguridad recomendadas:
- No expongas directamente los puertos de control de la interfaz WebUI de qBittorrent o de la API de Prowlarr a Internet sin establecer una contraseña de acceso fuerte y robusta. Si deseas acceder de forma remota a estas herramientas de automatización, utiliza túneles VPN seguros (como WireGuard o Tailscale) en lugar de realizar mapeos de puertos directos en tu router de red doméstico, protegiendo tus descargas de intrusiones no autorizadas.

---
title: >-
  Cómo liberar espacio en disco eliminando caché y contenedores huérfanos en
  Docker
description: >-
  Guía completa para recuperar gigabytes en /var/lib/docker limpiando capas
  BuildKit, imágenes no utilizadas y volúmenes huérfanos.
category: Sistemas y Servidores
tags:
  - Docker
  - Linux
  - DevOps
  - SysAdmin
  - Almacenamiento
readTime: 7 min
date: '2026-06-25'
---
El crecimiento desmedido del directorio `/var/lib/docker` en servidores Linux es una de las causas más frecuentes de agotamiento de espacio en disco (error `no space left on device`). Esto ocurre porque Docker almacena de forma indefinida imágenes intermedias, capas de compilación en caché de BuildKit, contenedores detenidos y volúmenes anónimos huérfanos.

## Contexto de Arquitectura y Causa Raíz del Fallo

En entornos contenerizados, el motor de **Docker** se apoya en primitivas fundamentales del kernel de Linux: **Namespaces** (PID, NET, MNT, IPC, UTS) para el aislamiento lógico de procesos y **Control Groups (cgroups v1/v2)** para el límite estricto de recursos de hardware (memoria RAM, ciclos de CPU y cuotas de I/O de disco).

Cuando se produce este fallo, la anomalía suele situarse en la frontera entre el demonio `dockerd`, el runtime OCI (`containerd` / `runc`) y el subsistema de red del host:
1. **Comunicación con el socket IPC (`/var/run/docker.sock`):** El cliente de Docker interactúa con la API REST local mediante llamadas al sistema sobre un socket de dominio UNIX. Si los permisos de usuario en el socket no pertenecen al grupo `docker` o si el demonio ha quedado bloqueado por un hilo zombie, la llamada al sistema devuelve inmediatamente un descriptor de error `EACCES` o `ECONNREFUSED`.
2. **Ciclo de vida del contenedor y estados OCI:** Durante la creación del contenedor (`container create / start`), `runc` solicita al kernel la creación de los namespaces y el montaje del sistema de archivos en capas mediante el driver de almacenamiento **Overlay2** (`lowerdir`, `upperdir` y `merged`). Si existe corrupción en las capas de imagen, agotamiento de inodos en `/var/lib/docker`, o incompatibilidad con la arquitectura del binario, el runtime aborta con códigos de salida específicos (ej. Exit Code 137 por OOM Killer o Exit Code 126/127 por permisos o dependencias ausentes).
3. **Pila de red virtual y cadenas de iptables:** Para exponer puertos (`-p`), Docker manipula directamente las tablas `nat` y `filter` del subsistema Netfilter mediante cadenas personalizadas (`DOCKER`, `DOCKER-USER`). Reinicios no sincronizados del firewall (`ufw` o `firewalld`) eliminan estas cadenas en memoria del kernel, provocando que los paquetes TCP entrantes sean descartados silenciosamente con paquetes TCP RST.

## Entorno de Laboratorio y Diagnóstico Previo

Antes de aplicar cualquier cambio destructivo o reiniciar servicios en un entorno de producción, es fundamental ejecutar una matriz de diagnóstico preliminar para identificar la capa exacta donde ocurre el fallo:

| Causa | Solución |
|---|---|
| **Directorio /var/lib/docker saturado por capas antiguas de compilación BuildKit e imágenes dangling** |

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

Antes de borrar nada, identifica qué componentes están consumiendo más espacio:
```bash
# Ver el resumen de consumo de imágenes, contenedores y volúmenes
docker system df

# Ver información detallada de cada elemento
docker system df -v
```

### Paso 2: Limpiar imágenes, contenedores y redes en desuso
Ejecuta una purga integral de todos los recursos no asociados a contenedores actualmente en ejecución:
```bash
# Eliminar contenedores detenidos, redes no utilizadas e imágenes sin contenedor activo
docker system prune -a --force

# Limpiar específicamente la caché de compilación de BuildKit
docker builder prune -a --force
```

### Paso 3: Eliminar volúmenes huérfanos (Dangling Volumes)
Los volúmenes anónimos creados por bases de datos o servicios temporales no se borran automáticamente con `docker rm`:
```bash
# Listar volúmenes que no están vinculados a ningún contenedor
docker volume ls -qf dangling=true

# Eliminar todos los volúmenes huérfanos de forma segura
docker volume prune --force
```

### Paso 4: Limpiar y limitar los archivos de logs de contenedores
Si los logs de contenedores en formato JSON han crecido hasta ocupar varios gigabytes:
```bash
# Truncar logs de todos los contenedores en vivo sin detenerlos
sudo sh -c 'truncate -s 0 /var/lib/docker/containers/*/*-json.log'
```
Para evitar que vuelvan a crecer descontroladamente, crea o edita `/etc/docker/daemon.json`:
```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "3"
  }
}
```
Reinicia el servicio Docker para aplicar la rotación de logs:
```bash
sudo systemctl restart docker
```

## Casos Borde (Troubleshooting) y Prácticas en Producción

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

- **Automatiza tareas de mantenimiento semanales:** Añade un cron job con `docker system prune -f` para evitar acumulaciones masivas en servidores CI/CD.
- **Usa el flag --rm al compilar:** Al ejecutar contenedores temporales de depuración, utiliza siempre `docker run --rm` para que se eliminen automáticamente al salir.

## ❓ Preguntas Frecuentes (FAQ)

### ¿docker system prune -a borra las bases de datos de mis contenedores activos?
No. Los volúmenes y contenedores que estén en ejecución no son afectados. Sin embargo, si tienes contenedores detenidos que piensas volver a iniciar, asegúrate de utilizar volúmenes nombrados para proteger sus datos.

### ¿Cómo muevo /var/lib/docker a un disco secundario más grande?
Configura la directiva `"data-root": "/nuevo/disco/docker"` en `/etc/docker/daemon.json` y reinicia el servicio tras migrar los archivos.

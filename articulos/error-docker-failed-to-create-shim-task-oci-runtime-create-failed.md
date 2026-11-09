---
title: 'Error Docker: failed to create shim task: OCI runtime create failed'
description: >-
  Cómo solucionar el fallo failed to create shim task OCI runtime create failed
  executable file not found al iniciar contenedores Docker.
category: Sistemas y Servidores
tags:
  - Docker
  - DevOps
  - Contenedores
  - Linux
readTime: 7 min
date: '2026-09-11'
---
Al ejecutar `docker run` o `docker compose up`, el demonio de containerd puede abortar con el error `failed to create shim task: OCI runtime create failed: runc create failed: unable to start container process: exec: "...": executable file not found in $PATH`. Este fallo impide que el contenedor arranque y se debe a que el kernel de Linux no puede ejecutar el comando de inicio declarado en el `ENTRYPOINT` o `CMD`.

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
| **El binario del ENTRYPOINT o CMD no existe dentro de la imagen o no tiene permisos de ejecución** |

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

Si editaste el archivo `entrypoint.sh` o scripts shell en Windows o con git autocrlf activo, el archivo contendrá caracteres de retorno de carro `\r`. Linux intentará ejecutar `/bin/sh\r`, lo cual falla inmediatamente:
```bash
# Instalar dos2unix y convertir el archivo a formato Unix
sudo apt-get install -y dos2unix
dos2unix entrypoint.sh
```

### Paso 2: Garantizar permisos de ejecución en el Dockerfile
Verifica que el script tenga permisos de ejecución tanto en tu máquina como dentro de la imagen Docker:
```dockerfile
# En tu Dockerfile
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
```

### Paso 3: Verificar la ruta absoluta y el intérprete (Shebang)
Asegúrate de que la primera línea de tu script contenga un intérprete válido que realmente exista en la imagen base (por ejemplo, en imágenes Alpine no existe `/bin/bash`, debes usar `/bin/sh`):
```bash
#!/bin/sh
set -e
exec "$@"
```
Si utilizas `ENTRYPOINT ["entrypoint.sh"]` en formato exec (corchetes), debes asegurarte de que la ruta esté en el `$PATH` o especificar la ruta completa `["/usr/local/bin/entrypoint.sh"]`.

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

* Añade un archivo `.gitattributes` con `* text eol=lf` en la raíz de tu proyecto para evitar que Git convierta finales de línea en Windows.
* Comprueba siempre la disponibilidad de `/bin/bash` vs `/bin/sh` al cambiar entre imágenes base como Ubuntu y Alpine.

## Preguntas Frecuentes

### ¿Por qué ocurre este error al usar imágenes Docker basadas en Alpine Linux?
Alpine Linux utiliza musl libc y ash en lugar de GNU libc y bash. Si un binario compilado o script hace referencia a /bin/bash o librerías dinámicas glibc, fallará con executable file not found.

### ¿Cómo puedo depurar el contenedor si no llega a arrancar?
Sobrescribe el punto de entrada desde la terminal ejecutando `docker run --rm -it --entrypoint /bin/sh mi-imagen` para inspeccionar los archivos internos interactivamente.

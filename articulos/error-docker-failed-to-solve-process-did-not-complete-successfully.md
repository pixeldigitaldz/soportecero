---
title: 'Error ''failed to solve: process did not complete successfully'' en Docker Build'
description: >-
  Aprende a diagnosticar y solucionar el error 'failed to solve: process did not
  complete successfully: exit code' en Dockerfile con Buildx paso a paso.
category: Sistemas y Servidores
date: '2026-10-17'
readTime: 8 min
tags:
  - Docker
  - DevOps
  - Linux
---
El error `ERROR: failed to solve: process "/bin/sh -c..." did not complete successfully: exit code: 1` es uno de los fallos más frecuentes y frustrantes al compilar imágenes con Docker BuildKit (Buildx). Este mensaje no es el problema en sí mismo, sino un contenedor genérico que indica que una instrucción `RUN` dentro de tu `Dockerfile` falló y devolvió un código de salida distinto de cero.

Dado que BuildKit agrupa y oculta los registros secundarios por defecto en su interfaz interactiva, la causa real (un fallo en `apt-get`, un paquete npm corrupto, falta de memoria o incompatibilidad de arquitectura) suele quedar oculta en la consola.

## Análisis de Arquitectura y Causa Raíz

En entornos contenerizados, el motor de **Docker** se apoya en primitivas fundamentales del kernel de Linux: **Namespaces** (PID, NET, MNT, IPC, UTS) para el aislamiento lógico de procesos y **Control Groups (cgroups v1/v2)** para el límite estricto de recursos de hardware (memoria RAM, ciclos de CPU y cuotas de I/O de disco).

Cuando se produce este fallo, la anomalía suele situarse en la frontera entre el demonio `dockerd`, el runtime OCI (`containerd` / `runc`) y el subsistema de red del host:
1. **Comunicación con el socket IPC (`/var/run/docker.sock`):** El cliente de Docker interactúa con la API REST local mediante llamadas al sistema sobre un socket de dominio UNIX. Si los permisos de usuario en el socket no pertenecen al grupo `docker` o si el demonio ha quedado bloqueado por un hilo zombie, la llamada al sistema devuelve inmediatamente un descriptor de error `EACCES` o `ECONNREFUSED`.
2. **Ciclo de vida del contenedor y estados OCI:** Durante la creación del contenedor (`container create / start`), `runc` solicita al kernel la creación de los namespaces y el montaje del sistema de archivos en capas mediante el driver de almacenamiento **Overlay2** (`lowerdir`, `upperdir` y `merged`). Si existe corrupción en las capas de imagen, agotamiento de inodos en `/var/lib/docker`, o incompatibilidad con la arquitectura del binario, el runtime aborta con códigos de salida específicos (ej. Exit Code 137 por OOM Killer o Exit Code 126/127 por permisos o dependencias ausentes).
3. **Pila de red virtual y cadenas de iptables:** Para exponer puertos (`-p`), Docker manipula directamente las tablas `nat` y `filter` del subsistema Netfilter mediante cadenas personalizadas (`DOCKER`, `DOCKER-USER`). Reinicios no sincronizados del firewall (`ufw` o `firewalld`) eliminan estas cadenas en memoria del kernel, provocando que los paquetes TCP entrantes sean descartados silenciosamente con paquetes TCP RST.

## Entorno de Laboratorio y Diagnóstico

Antes de aplicar cualquier cambio destructivo o reiniciar servicios en un entorno de producción, es fundamental ejecutar una matriz de diagnóstico preliminar para identificar la capa exacta donde ocurre el fallo:

| Causa Principal | Solución Recomendada |
|---|---|
| **Comando `RUN` con múltiples sentencias encadenadas (`&&`)** |

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

Por defecto, la interfaz TUI de BuildKit trunca los errores internos de los subprocesos. Fuerza la salida en texto plano sin usar la caché para identificar exactamente qué línea del script o gestor de paquetes provocó el fallo:
```bash
docker build --progress=plain --no-cache -t mi-imagen:latest .
```
Examina las líneas inmediatamente anteriores al mensaje `failed to solve`. Allí verás el error original, como `E: Unable to locate package`, `npm ERR! code ENOENT` o un fallo de compilación de GCC/Python.

### Paso 2: Desglosar comandos complejos en instrucciones individuales
Si tu `Dockerfile` agrupa múltiples pasos en un solo comando:
```dockerfile
# Difícil de depurar si falla a mitad de ejecución
RUN apt-get update && apt-get install -y python3-pip curl && pip install -r requirements.txt
```
Separa temporalmente cada comando en una directiva `RUN` independiente para aislar con precisión cuál instrucción genera el código de error:
```dockerfile
RUN apt-get update
RUN apt-get install -y python3-pip curl
RUN pip install --no-cache-dir -r requirements.txt
```
Una vez corregido el problema, puedes volver a unificarlos para minimizar las capas de la imagen final.

### Paso 3: Blindar el contexto de construcción con .dockerignore
Si el proceso se interrumpe con `exit code: 137` (OOMKilled) o `context canceled`, la causa habitual es que Docker está intentando transferir gigabytes innecesarios al demonio. Crea un archivo `.dockerignore` en la raíz de tu proyecto:
```text
.git
.github
node_modules
dist
build
*.log
.env
.venv
```
Esto reduce drásticamente el tiempo de compilación y evita que binarios locales de arquitectura incompatible se mezclen con el entorno del contenedor.

### Paso 4: Ajustar la compatibilidad de arquitectura y paquetes base
Si utilizas procesadores ARM (Apple Silicon, Raspberry Pi) y despliegas en x86_64 (o viceversa), ciertas librerías binarias fallarán al compilar en `/bin/sh`. Especifica explícitamente la plataforma de destino o fija la distribución base:
```dockerfile
# Especificar plataforma explícita si hay dependencias binarias x86
FROM --platform=linux/amd64 python:3.11-slim-bookworm

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "app.py"]
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

- **Fijación de versiones (Pinning):** Nunca uses etiquetas flotantes como `latest` en imágenes base de producción; define etiquetas inmutables (ej. `node:20.18-alpine3.20`).
- **Limpieza de caché en la misma capa:** Siempre combina la actualización e instalación limpiando la caché en la misma línea (`apt-get update && apt-get install -y pkg && rm -rf /var/lib/apt/lists/*`) para evitar residuos y garantizar reproducibilidad.
- **Validación de linter:** Pasa herramientas como `hadolint` a tus Dockerfiles en tu pipeline de CI/CD para detectar errores sintácticos antes de construir.

## Preguntas Frecuentes

### ¿Por qué obtengo exit code 100 durante apt-get install en Docker?
El código 100 en Debian/Ubuntu suele deberse a repositorios no sincronizados (falta ejecutar `apt-get update` en la misma directiva) o a versiones antiguas de Docker Engine que no soportan llamadas al sistema modernas de imágenes como Debian 12 Bookworm.

### ¿Qué diferencia hay entre usar docker build y docker buildx build?
Buildx es el generador moderno que utiliza el motor BuildKit. Soporta compilación paralela, caché avanzada y compilación multi-arquitectura, pero requiere el flag `--progress=plain` para mostrar trazas de error completas en terminales estándar.

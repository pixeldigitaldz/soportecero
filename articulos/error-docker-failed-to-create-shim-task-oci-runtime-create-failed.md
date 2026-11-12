---
title: 'Error Docker: failed to create shim task: OCI runtime create failed'
description: >-
  Guía definitiva para solucionar el error 'failed to create shim task: OCI runtime create failed: executable file not found' en Docker, containerd y Alpine Linux.
category: Sistemas y Servidores
tags:
  - Docker
  - DevOps
  - Contenedores
  - Linux
readTime: 8 min
date: '2026-09-11'
---
Al ejecutar `docker run` o `docker compose up`, el demonio de containerd puede abortar abruptamente el ciclo de vida del contenedor con el mensaje:

```text
failed to create shim task: OCI runtime create failed: runc create failed: unable to start container process: exec: "/entrypoint.sh": executable file not found in $PATH: unknown
```

A pesar de que el desarrollador compruebe que el archivo existe físicamente en el repositorio o dentro de la imagen, el contenedor entra en estado `Exit 127` de forma inmediata. Este fallo se produce en la capa de interoperabilidad entre el runtime OCI (`runc`), el kernel de Linux (`execve`) y la estructura binaria del ejecutable o script invocado.

---

## Análisis de Arquitectura y Causa Raíz

Para comprender por qué Docker emite un error de archivo no encontrado cuando el archivo sí existe, es indispensable examinar la cadena de ejecución de contenedores en Linux:

1. **El rol de `containerd-shim` y `runc`:** Docker no ejecuta contenedores directamente; delega la orquestación a `containerd`, que a su vez instancia un proceso ligero `containerd-shim` por contenedor. El shim invoca a `runc`, la implementación de referencia del Open Container Initiative (OCI).
2. **La llamada al sistema `execve`:** `runc` crea los namespaces de Linux (PID, Mount, Network, IPC) y el chroot / pivot_root sobre el sistema de archivos Overlay2. Posteriormente, ejecuta la syscall `execve(const char *filename, char *const argv[], char *const envp[])`.
3. **El origen del código `ENOENT` (Error 2):** El kernel devuelve `ENOENT` ("No such file or directory") bajo tres circunstancias críticas:
   * **El intérprete de la línea Shebang no existe:** Si el script declara `#!/bin/sh\r` (debido a retornos de carro de Windows CRLF) o `#!/bin/bash` en una imagen Alpine minimalista, el kernel no busca el script, sino que busca el intérprete binario indicado. Al no encontrar `/bin/sh\r` o `/bin/bash`, emite `ENOENT`.
   * **Falta el cargador dinámico ELF (Dynamic Linker):** Si un binario compilado (en Go, C++, Rust o Node.js con módulos nativos) fue enlazado dinámicamente con `glibc` (`/lib64/ld-linux-x86-64.so.2`) y se ejecuta dentro de un contenedor Alpine Linux (que utiliza `musl libc`), el kernel intenta cargar el linker dinámico de la cabecera ELF. Al no existir `/lib64/ld-linux-x86-64.so.2`, la syscall `execve` falla con `executable file not found`, desconcertando al usuario.
   * **Ruta relativa no presente en `$PATH`:** Declarar `ENTRYPOINT ["entrypoint.sh"]` sin una ruta absoluta (`/entrypoint.sh` o `/usr/local/bin/entrypoint.sh`) requiere que el directorio de trabajo (`WORKDIR`) esté explícitamente incorporado en la variable de entorno `$PATH`.

---

## Entorno de Laboratorio y Diagnóstico Previo

Antes de modificar el Dockerfile o la configuración de despliegue, utiliza esta matriz técnica para clasificar la causa raíz con exactitud:

| Firma del Error | Causa Raíz Subyacente | Estrategia de Mitigación Técnica |
|---|---|---|
| `exec: "/entrypoint.sh": executable file not found in $PATH` (Script Shell) | Retornos de carro Windows CRLF (`\r\n`) en el archivo local o script sin permisos de ejecución. | Convertir terminadores de línea con `dos2unix` y aplicar `chmod +x` antes del build. |
| `exec: "bash": executable file not found in $PATH` | Imagen base minimalista (Alpine Linux, BusyBox o Scratch) carece del intérprete Bash. | Cambiar el shebang a `#!/bin/sh` o instalar el paquete `bash` mediante el gestor del contenedor. |
| `exec: "./app": executable file not found in $PATH` (Binario compilado) | Incompatibilidad de ABI: binario enlazado dinámicamente contra `glibc` ejecutado en entorno `musl libc`. | Compilar binario estático (`CGO_ENABLED=0`) o instalar `gcompat` / `libc6-compat` en Alpine. |
| `exec: "entrypoint.sh": executable file not found in $PATH` | Sintaxis JSON exec con ruta relativa fuera de `$PATH`. | Especificar ruta canónica absoluta: `ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]`. |
| `runc create failed: ... Permission denied` | Falta de bit ejecutable (+x) en la capa Overlay2 del contenedor. | Incorporar instrucción `RUN chmod +x /ruta/script` explícita en el Dockerfile. |

### Comandos de Inspección Forense

Para confirmar el diagnóstico sin alterar el entorno del servidor:

```bash
# 1. Comprobar las terminaciones de línea del script en el host (debe devolver 'ASCII text', NO 'with CRLF line terminators')
file entrypoint.sh

# 2. Inspeccionar la primera línea exacta (Shebang) y verificar si contiene caracteres invisibles \r
head -n 1 entrypoint.sh | cat -v

# 3. Para binarios compilados, verificar el intérprete dinámico ELF requerido
readelf -l app | grep "program interpreter"

# 4. Inspeccionar interactivamente el contenedor sobrescribiendo el entrypoint a una shell nativa
docker run --rm -it --entrypoint /bin/sh mi-imagen:tag
```

---

## Implementación Técnica Paso a Paso

### Paso 1: Eliminar Retornos de Carro CRLF (Windows a Unix)

Si el proyecto fue clonado en Windows o procesado por un editor con configuración no estándar, convierte el archivo a terminaciones Unix estrictas (LF):

```bash
# Opción A: Mediante dos2unix en sistemas Debian/Ubuntu
sudo apt-get update && sudo apt-get install -y dos2unix
dos2unix entrypoint.sh

# Opción B: Mediante sed (sin necesidad de paquetes adicionales)
sed -i 's/\r$//' entrypoint.sh
```

Para prevenir que Git convierta los saltos de línea al sincronizar ramas entre equipos heterogéneos, crea o edita el archivo `.gitattributes` en la raíz de tu repositorio:

```gitattributes
# Forzar terminadores LF en todos los scripts de shell y archivos de configuración
*.sh text eol=lf
Dockerfile text eol=lf
docker-compose*.yml text eol=lf
```

### Paso 2: Ajustar el Shebang y la Shell de la Imagen Base

En imágenes ultraligeras como Alpine Linux (`alpine:3.20`), el binario `/bin/bash` no existe de forma predeterminada; el sistema utiliza `ash` enlazado a `/bin/sh`.

Asegúrate de que tus scripts de inicio utilicen el shebang estándar POSIX:

```bash
#!/bin/sh
set -eu

# Script de arranque en entorno de producción
echo "Iniciando servicio de aplicación..."
exec "$@"
```

Si el script utiliza extensiones exclusivas de Bash (como arrays asociativos, sintaxis `[[ ... ]]` o process substitution), instala `bash` explícitamente en el `Dockerfile`:

```dockerfile
FROM alpine:3.20

# Instalar bash si el script requiere sintaxis no POSIX
RUN apk add --no-cache bash ca-certificates

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["start"]
```

### Paso 3: Resolver Incompatibilidades de Enlazado Dinámico (glibc vs musl)

Cuando desarrollas en Go, Rust o C++ y generas un binario en tu máquina de desarrollo (o en un contenedor Ubuntu) para luego transferirlo a un contenedor Alpine, el cargador dinámico fallará.

#### Para proyectos en Golang:
Genera un binario puramente estático desactivando CGO:

```bash
# Compilar binario completamente autocontenido
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o app main.go
```

#### Para binarios de terceros o compilados con CGO dependiente de glibc:
Si es imperativo ejecutar un binario enlazado a `glibc` dentro de Alpine, instala la capa de compatibilidad:

```dockerfile
FROM alpine:3.20

# Instalar librería de compatibilidad binaria para glibc en Alpine
RUN apk add --no-cache gcompat libc6-compat

WORKDIR /app
COPY app /app/app
RUN chmod +x /app/app

ENTRYPOINT ["/app/app"]
```

O preferentemente, migra la imagen base de ejecución a una distribución con `glibc` nativo, como `debian:bookworm-slim`:

```dockerfile
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY app /app/app
RUN chmod +x /app/app

ENTRYPOINT ["/app/app"]
```

### Paso 4: Validar Sintaxis Exec y Permisos de Ejecución

El estándar OCI recomienda la forma vector (JSON array) para `ENTRYPOINT` y `CMD`:

```dockerfile
# CORRECTO: Ruta absoluta canónica y sintaxis exec
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod 755 /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

# INCORRECTO: Dependencia de ruta relativa que puede fallar según el WORKDIR
# ENTRYPOINT ["entrypoint.sh"]
```

Si se utiliza un volumen montado en tiempo de ejecución (bind mount) durante el desarrollo local (`-v $(pwd):/app`), asegúrate de que el script en el host tenga el permiso de ejecución activo:

```bash
chmod +x ./entrypoint.sh
```

---

## Resolución de Casos Borde (Troubleshooting)

### Caso Borde 1: Sobrescritura de Binarios por Bind Mounts en Docker Compose

Un escenario frecuente en entornos de desarrollo ocurre cuando el Dockerfile compila o copia un archivo a `/app/entrypoint.sh`, pero `docker-compose.yml` monta la carpeta local sobre `/app`:

```yaml
services:
  web:
    build: .
    volumes:
      # PELIGRO: Si en el host ./entrypoint.sh no tiene permisos o tiene CRLF,
      # sobreescribirá el archivo saneado por el Dockerfile
      - .:/app
```

**Solución:** Excluye el archivo montándolo individualmente o utiliza volúmenes anónimos para proteger las rutas críticas:

```yaml
services:
  web:
    build: .
    volumes:
      - .:/app
      - /app/node_modules
      - /app/entrypoint.sh
```

### Caso Borde 2: Incompatibilidad de Arquitecturas de CPU (AMD64 vs ARM64)

Al desplegar imágenes generadas en equipos Apple Silicon (M1/M2/M3) o servidores ARM64 (AWS Graviton) hacia servidores x86_64 sin emulación configurada, `runc` puede fallar con `executable file not found` o `exec format error`.

Comprueba la arquitectura del binario y de la imagen:

```bash
# Inspeccionar la arquitectura registrada en los metadatos de la imagen
docker inspect --format '{{.Architecture}}' mi-imagen:tag

# Generar la imagen para la arquitectura de producción mediante buildx
docker buildx build --platform linux/amd64 -t mi-imagen:tag . --load
```

---

## Preguntas Frecuentes

### ¿Por qué `docker logs` no muestra nada cuando ocurre este error?
Porque el proceso del contenedor nunca llega a iniciarse. El fallo ocurre en la llamada `execve` del runtime `runc` antes de que el kernel asigne el descriptor de archivo de salida estándar (`stdout`) al proceso de la aplicación.

### ¿Cuál es la diferencia entre la sintaxis Shell y la sintaxis Exec en ENTRYPOINT?
La sintaxis Exec (`["binario", "arg1"]`) ejecuta el comando directamente como PID 1 en el contenedor, permitiendo la recepción limpia de señales UNIX (`SIGTERM`, `SIGINT`). La sintaxis Shell (`ENTRYPOINT binario arg1`) envuelve el comando en `/bin/sh -c`, lo que requiere que `/bin/sh` exista obligatoriamente en la imagen.

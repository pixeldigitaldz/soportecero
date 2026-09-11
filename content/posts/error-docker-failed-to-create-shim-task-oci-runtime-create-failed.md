---
title: "[SOLUCIONADO] Error Docker: failed to create shim task: OCI runtime create failed"
description: "Cómo solucionar el fallo failed to create shim task OCI runtime create failed executable file not found al iniciar contenedores Docker."
category: "Sistemas y Servidores"
tags: ["Docker","DevOps","Contenedores","Linux"]
readTime: "4 min"
date: "2026-09-11"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **El binario del ENTRYPOINT o CMD no existe dentro de la imagen o no tiene permisos de ejecución** | Verificar la ruta absoluta del binario y aplicar chmod +x en el Dockerfile |
| **Finales de línea de Windows (CRLF) en el script de arranque entrypoint.sh** | Convertir el script a formato Unix LF con dos2unix entrypoint.sh |

Al ejecutar `docker run` o `docker compose up`, el demonio de containerd puede abortar con el error `failed to create shim task: OCI runtime create failed: runc create failed: unable to start container process: exec: "...": executable file not found in $PATH`. Este fallo impide que el contenedor arranque y se debe a que el kernel de Linux no puede ejecutar el comando de inicio declarado en el `ENTRYPOINT` o `CMD`.

> **Solución Rápida (1 Minuto):**
> 1. Revisa los saltos de línea de tu script de inicio:
>    `dos2unix entrypoint.sh`
> 2. Asegura permisos de ejecución antes de construir la imagen:
>    `chmod +x entrypoint.sh && docker build -t mi-app .`

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Comprobar saltos de línea CRLF en scripts de inicio
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

## 🛡️ Consejo de Prevención
* Añade un archivo `.gitattributes` con `* text eol=lf` en la raíz de tu proyecto para evitar que Git convierta finales de línea en Windows.
* Comprueba siempre la disponibilidad de `/bin/bash` vs `/bin/sh` al cambiar entre imágenes base como Ubuntu y Alpine.

## Preguntas Frecuentes

### ¿Por qué ocurre este error al usar imágenes Docker basadas en Alpine Linux?
Alpine Linux utiliza musl libc y ash en lugar de GNU libc y bash. Si un binario compilado o script hace referencia a /bin/bash o librerías dinámicas glibc, fallará con executable file not found.

### ¿Cómo puedo depurar el contenedor si no llega a arrancar?
Sobrescribe el punto de entrada desde la terminal ejecutando `docker run --rm -it --entrypoint /bin/sh mi-imagen` para inspeccionar los archivos internos interactivamente.

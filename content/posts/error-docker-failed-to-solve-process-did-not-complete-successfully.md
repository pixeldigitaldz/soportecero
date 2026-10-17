---
title: "[SOLUCIONADO] Error 'failed to solve: process did not complete successfully' en Docker Build"
description: "Aprende a diagnosticar y solucionar el error 'failed to solve: process did not complete successfully: exit code' en Dockerfile con Buildx paso a paso."
category: "Sistemas y Servidores"
date: "2026-10-17"
readTime: "4 min"
tags: ["Docker", "DevOps", "Linux"]
---

El error `ERROR: failed to solve: process "/bin/sh -c..." did not complete successfully: exit code: 1` es uno de los fallos más frecuentes y frustrantes al compilar imágenes con Docker BuildKit (Buildx). Este mensaje no es el problema en sí mismo, sino un contenedor genérico que indica que una instrucción `RUN` dentro de tu `Dockerfile` falló y devolvió un código de salida distinto de cero.

Dado que BuildKit agrupa y oculta los registros secundarios por defecto en su interfaz interactiva, la causa real (un fallo en `apt-get`, un paquete npm corrupto, falta de memoria o incompatibilidad de arquitectura) suele quedar oculta en la consola.

## Diagnóstico Rápido

| Causa Principal | Solución Recomendada |
|---|---|
| **Comando `RUN` con múltiples sentencias encadenadas (`&&`)** | Compilar con `docker build --progress=plain --no-cache .` para ver la salida exacta del comando fallido |
| **Incompatibilidad entre Docker Engine y distribuciones recientes (ej. Debian Bookworm)** | Actualizar Docker Engine o fijar la etiqueta de la imagen base (ej. cambiar a `bullseye`) |
| **Dependencia ausente, paquete descontinuado o repositorio sin actualizar** | Asegurar `apt-get update` antes de instalar y validar nombres de paquetes en la arquitectura de destino |
| **Contexto de compilación gigante que satura la memoria o genera timeout** | Crear o corregir `.dockerignore` para excluir `node_modules`, `.git` y volcados locales |

## La Solución Paso a Paso

### Paso 1: Ejecutar la compilación en modo plano para ver el error real
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

## Prevención
- **Fijación de versiones (Pinning):** Nunca uses etiquetas flotantes como `latest` en imágenes base de producción; define etiquetas inmutables (ej. `node:20.18-alpine3.20`).
- **Limpieza de caché en la misma capa:** Siempre combina la actualización e instalación limpiando la caché en la misma línea (`apt-get update && apt-get install -y pkg && rm -rf /var/lib/apt/lists/*`) para evitar residuos y garantizar reproducibilidad.
- **Validación de linter:** Pasa herramientas como `hadolint` a tus Dockerfiles en tu pipeline de CI/CD para detectar errores sintácticos antes de construir.

## Preguntas Frecuentes

### ¿Por qué obtengo exit code 100 durante apt-get install en Docker?
El código 100 en Debian/Ubuntu suele deberse a repositorios no sincronizados (falta ejecutar `apt-get update` en la misma directiva) o a versiones antiguas de Docker Engine que no soportan llamadas al sistema modernas de imágenes como Debian 12 Bookworm.

### ¿Qué diferencia hay entre usar docker build y docker buildx build?
Buildx es el generador moderno que utiliza el motor BuildKit. Soporta compilación paralela, caché avanzada y compilación multi-arquitectura, pero requiere el flag `--progress=plain` para mostrar trazas de error completas en terminales estándar.

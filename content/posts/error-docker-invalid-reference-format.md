---
title: "[SOLUCIONADO] Error 'invalid reference format' en Docker"
description: "¿Recibes el error 'docker: invalid reference format' al ejecutar docker run o docker build? Aprende a corregir sintaxis de comillas y rutas."
category: "Sistemas y Servidores"
tags: ["Docker", "DevOps", "Sysadmin", "Linux"]
readTime: "3 min"
date: "2026-08-18"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Error sintáctico en el nombre de la imagen o banderas del comando docker run** | Asegurar que el tag de la imagen esté en minúsculas y sin caracteres no válidos |
| **Rutas de volúmenes con espacios sin comillas en la sintaxis del comando** | Encerrar las rutas entre comillas dobles: `-v "/ruta local:/ruta contenedor"` |


El error **`docker: invalid reference format`** (o `invalid reference format: repository name must be lowercase`) ocurre al ejecutar comandos `docker run`, `docker pull` o `docker build` cuando la sintaxis de los nombres de imagen, banderas de volumen (`-v`) o variables de entorno contiene comillas mal formateadas, espacios o letras mayúsculas.

> **Solución Rápida (1 Minuto):**
> 1. Asegúrate de que el nombre de la imagen esté completamente en **minúsculas** (ej. `mi-app:latest` en lugar de `Mi-App:latest`).
> 2. Si usas PowerShell en Windows, usa comillas dobles `"$PWD"` en lugar de `'$(pwd)'`.

## 🚀 Cómo solucionar el error invalid reference format paso a paso

### Paso 1: Usar nombres de imagen en minúsculas
Docker impone estrictamente que los nombres de los repositorios e imágenes estén escritos en letras minúsculas:

* ❌ **Incorrecto:** `docker run -d MiEmpresa/Backend:v1`
* ✅ **Correcto:** `docker run -d miempresa/backend:v1`

### Paso 2: Corregir el formateo de volúmenes según tu sistema operativo

El error suele generarse al intentar montar volúmenes del sistema operativo anfitrión usando comandos copiados de tutoriales diseñados para otra terminal:

* **En Linux / macOS (Bash o Zsh):**
  ```bash
  docker run -v $(pwd):/app mi-imagen:latest
  ```
* **En Windows PowerShell:**
  ```powershell
  docker run -v "${PWD}:/app" mi-imagen:latest
  ```
* **En Windows CMD (Símbolo del sistema):**
  ```cmd
  docker run -v "%cd%:/app" mi-imagen:latest
  ```

### Paso 3: Evitar saltos de línea mal formateados en scripts
Si ejecutas un comando multilínea con barras invertidas (`\`) en Linux/macOS, asegúrate de que no haya espacios en blanco ocultos después de la barra:

```bash
# Correcto (sin espacios despues de la barra invertida):
docker run -d \
  --name mi-contenedor \
  -p 8080:80 \
  nginx:alpine
```

## 🛡️ Consejo de Prevención
* Utiliza archivos `docker-compose.yml` en lugar de comandos `docker run` muy largos para evitar errores de sintaxis en terminales de diferentes sistemas operativos.

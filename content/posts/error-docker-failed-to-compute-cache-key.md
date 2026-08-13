---
title: "[SOLUCIONADO] Error 'failed to compute cache key' en Docker Build"
description: "¿Recibes el error 'failed to compute cache key' al construir una imagen con docker build? Solución paso a paso para corregir rutas y Dockerfile."
category: "Sistemas y Servidores"
tags: ["Docker", "DevOps", "Sysadmin"]
readTime: "4 min"
date: "2026-08-03"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Ruta de origen especificada en el comando COPY/ADD del Dockerfile no existe** | Verificar la ruta exacta en la estructura de archivos local y el archivo `.dockerignore` |
| **Contexto de compilación de Docker apuntando a una carpeta incorrecta** | Ejecutar el comando `docker build` asegurando la sintaxis `.` al final del comando |


El error **`failed to compute cache key: failed to walk: lstat ...: no such file or directory`** durante el comando `docker build` ocurre cuando la instrucción `COPY` o `ADD` dentro del `Dockerfile` hace referencia a un archivo o directorio local que no existe dentro del **contexto de construcción** de Docker.

> **Solución Rápida (1 Minuto):**
> 1. Revisa que la ruta del archivo copiado exista dentro de la carpeta actual donde ejecutas `docker build .`
> 2. Comprueba que el archivo no esté excluido en el archivo `.dockerignore`.
> 3. Si usas subcarpetas, ejecuta la compilación especificando el contexto correcto: `docker build -f docker/Dockerfile .`

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Entender el contexto de construcción de Docker (Build Context)
Cuando ejecutas `docker build -t mi-imagen .`, el punto final `.` define el **contexto**. Docker empaqueta y envía todos los archivos de esa carpeta al daemon de Docker.

Si tu `Dockerfile` contiene:
```dockerfile
COPY package.json ./
```
Pero ejecutas `docker build` desde un directorio padre donde `package.json` no está en la raíz, Docker arrojará el error `failed to compute cache key`.

**Solución:** Múdate a la carpeta raíz de tu proyecto o ajusta la ruta en el comando de compilación:
```bash
# Ejecutar desde la raíz del proyecto indicando la ubicación del Dockerfile
docker build -t mi-app:latest -f ./docker/Dockerfile .
```

### Paso 2: Verificar reglas en `.dockerignore`
Abre el archivo `.dockerignore` ubicado en la raíz del proyecto. Si por accidente añadiste una regla que ignora el archivo que intentas copiar con `COPY`:
```plaintext
# Si tienes esto en .dockerignore:
src/config.json
```
Docker no incluirá `src/config.json` en el contexto y fallará con `failed to compute cache key`.

**Solución:** Elimina la regla del `.dockerignore` o añade una excepción usando `!`:
```plaintext
!src/config.json
```

### Paso 3: Mayúsculas y minúsculas en sistemas Linux
En sistemas operativos Linux, los nombres de archivos distinguen entre mayúsculas y minúsculas (*case-sensitive*). Si en tu código el archivo se llama `App.js` pero en el `Dockerfile` escribiste:
```dockerfile
COPY app.js ./
```
El motor de Docker no encontrará `app.js` y cancelará la construcción. Corrige el nombre para que coincida exactamente.

## 🛡️ Consejo de Prevención y Buenas Prácticas
* Utiliza Builds multi-etapa (*Multi-stage builds*) limpias para evitar copiar archivos innecesarios.
* Mantén un archivo `.dockerignore` ordenado que solo excluya `.git`, `node_modules`, y archivos de entorno `.env`.

---
title: 'Error ''fatal: refusing to merge unrelated histories'' en Git'
description: >-
  ¿Git rechaza fusionar tu repositorio local con GitHub por 'unrelated
  histories'? Aprende a resolverlo en 1 minuto con este comando.
category: Web y Código
tags:
  - Git
  - GitHub
  - DevOps
readTime: 7 min
date: '2026-08-03'
---
El error **`fatal: refusing to merge unrelated histories`** ocurre en Git al intentar hacer `git pull` o `git merge` entre dos repositorios que no comparten un historial de commits inicial común. Sucede con frecuencia cuando creas un repositorio local con `git init` y al mismo tiempo creas un repositorio en GitHub con un archivo `README.md` o `.gitignore` inicial.

## Análisis de Arquitectura y Causa Raíz

El sistema de control de versiones **Git** opera como una base de datos de objetos direccionables por contenido criptográfico (hashes SHA-1 / SHA-256) respaldada por un grafo acíclico dirigido (DAG). La integridad del repositorio descansa en el directorio interno `.git/`, donde se almacenan cuatro tipos de objetos atómicos: **blobs** (contenido puro de archivos), **trees** (representación de directorios y permisos POSIX), **commits** (metadatos del autor, mensaje y puntero al árbol raíz) y **annotated tags**.

La causa raíz de esta incidencia se produce por una alteración en los punteros de referencia o en el mecanismo de bloqueo transaccional del árbol de trabajo:
1. **Mecanismo de Lockfiles atómicos (`.git/*.lock`):** Para garantizar la atomicidad en operaciones concurrentes y evitar condiciones de carrera (*race conditions*), Git genera archivos efímeros de bloqueo (ej. `.git/refs/heads/main.lock` o `.git/index.lock`) antes de mutar cualquier puntero o actualizar el área de preparación (*staging index*). Si un proceso de Git finaliza inesperadamente (por apagado forzado, corte de IDE o fallo de memoria), el lockfile permanece huérfano en el sistema de archivos, impidiendo cualquier operación de lectura/escritura posterior con un error de bloqueo crítico.
2. **Desincronización del grafo DAG y divergencia de ramas:** Durante procesos de `rebase` o `cherry-pick`, Git reescribe la historia aplicando commits de forma secuencial sobre un nuevo commit base. Si se detectan cambios incompatibles en los mismos bloques de código sin un ancestro común directo (o si se fuerza la unión de árboles de commits independientes creados desde cero), el algoritmo de merge trifásico (*three-way merge*) detiene la ejecución para proteger la integridad del historial, dejando al repositorio en un estado transicional (`REBASE-i`, `MERGING` o `DETACHED HEAD`).
3. **Capa de transporte SSL/TLS y validación de certificados:** Al interactuar con remotos a través de HTTPS, el cliente Git delega la autenticación en la librería local `libcurl` y el almacén de certificados CA del sistema operativo. Si la cadena de certificación intermedia no se resuelve o existen desajustes en el reloj del sistema, el handshake criptográfico se cancela de inmediato.

## Entorno de Laboratorio y Diagnóstico

Antes de aplicar cualquier cambio destructivo o reiniciar servicios en un entorno de producción, es fundamental ejecutar una matriz de diagnóstico preliminar para identificar la capa exacta donde ocurre el fallo:

| Causa | Solución |
|---|---|
| **Intentando fusionar dos repositorios o ramas con historiales de commits no conectados** | Allow forced merge using `--allow-unrelated-histories` flag |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Inspeccionar el estado del árbol de trabajo y el área de preparación
git status --short --branch

# 2. Visualizar los últimos commits del historial de forma gráfica y compacta
git log --oneline --graph --decorate -n 10

# 3. Comprobar referencias de bloqueo activas en el repositorio
ls -la .git/*.lock .git/refs/heads/*.lock 2>/dev/null
```

- El flag `--short` en `git status` resume en dos caracteres por archivo el estado entre el staging index y el directorio de trabajo, facilitando identificar archivos en conflicto (`UU`) o no rastreados (`??`).
- El comando `git log` con los parámetros `--oneline` (un commit por línea), `--graph` (diagrama ASCII del árbol) y `-n 10` muestra la topología de las ramas y el punto exacto de divergencia con el repositorio remoto.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

Abre tu terminal en la carpeta de tu proyecto local y ejecuta:

```bash
git pull origin main --allow-unrelated-histories
```
*(Reemplaza `main` por el nombre de tu rama principal si usas `master`).*

Este indicador le ordena a Git que combine los árboles de ambos repositorios aunque hayan nacido de commits completamente independientes.

### Paso 2: Resolver conflictos de archivos iniciales
Al ejecutar el comando anterior, es posible que surgirán conflictos de fusión (*merge conflicts*) en archivos comunes como `README.md` o `.gitignore`.

1. Abre los archivos en conflicto en tu editor de código.
2. Selecciona las líneas que deseas conservar.
3. Añade los cambios resueltos al área de preparación:
```bash
git add .
```

### Paso 3: Confirmar la fusión y subir los cambios a GitHub
Una vez resueltos los conflictos, completa el commit de integración y envía la rama actualizada al servidor remoto:

```bash
git commit -m "Fix: Fusionar historias no relacionadas de GitHub y local"
git push origin main
```

## 🛡️ Consejos de Prevención

Para evitar este problema en futuros proyectos:
* Si creas el repositorio primero en GitHub con `README.md`, **clónalo** en tu equipo local (`git clone <url>`) en lugar de hacer `git init` localmente.
* Si inicias el proyecto en local (`git init`), crea el repositorio en GitHub completamente **vacío** (sin README, sin archivo de licencia y sin `.gitignore`).

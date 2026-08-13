---
title: "[SOLUCIONADO] Error 'fatal: refusing to merge unrelated histories' en Git"
description: "¿Git rechaza fusionar tu repositorio local con GitHub por 'unrelated histories'? Aprende a resolverlo en 1 minuto con este comando."
category: "Web y Código"
tags: ["Git", "GitHub", "DevOps"]
readTime: "3 min"
date: "2026-08-03"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Intentando fusionar dos repositorios o ramas con historiales de commits no conectados** | Permitir la fusión forzada usando la bandera `--allow-unrelated-histories` |
| **Repositorio remoto inicializado con archivos (README/LICENSE) de forma independiente** | Ejecutar `git pull origin main --allow-unrelated-histories` |


El error **`fatal: refusing to merge unrelated histories`** ocurre en Git al intentar hacer `git pull` o `git merge` entre dos repositorios que no comparten un historial de commits inicial común. Sucede con frecuencia cuando creas un repositorio local con `git init` y al mismo tiempo creas un repositorio en GitHub con un archivo `README.md` o `.gitignore` inicial.

> **Solución Rápida (1 Minuto):**
> Ejecuta el comando pull agregando el parámetro para autorizar historias no relacionadas:
> `git pull origin main --allow-unrelated-histories`

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Permitir la fusión de historias no relacionadas
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

## 🛡️ Consejo de Prevención
Para evitar este problema en futuros proyectos:
* Si creas el repositorio primero en GitHub con `README.md`, **clónalo** en tu equipo local (`git clone <url>`) en lugar de hacer `git init` localmente.
* Si inicias el proyecto en local (`git init`), crea el repositorio en GitHub completamente **vacío** (sin README, sin archivo de licencia y sin `.gitignore`).

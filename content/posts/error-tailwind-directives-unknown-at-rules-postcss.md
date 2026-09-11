---
title: "[SOLUCIONADO] Advertencia Unknown at rule @tailwind y @apply en VS Code y PostCSS"
description: "Elimina las advertencias Unknown at rule @tailwind, @apply y @layer en archivos CSS en Visual Studio Code, Tailwind CSS y PostCSS."
category: "Web y Código"
tags: ["TailwindCSS","CSS","Frontend","VSCode"]
readTime: "3 min"
date: "2026-10-15"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **El validador de CSS nativo de VS Code no reconoce la sintaxis de directivas especiales de Tailwind** | Instalar la extensión oficial Tailwind CSS IntelliSense y asociar los archivos como Tailwind CSS |
| **Falta de configuración de PostCSS o configuración de linter css.lint.unknownAtRules en ajustes** | Configurar css.lint.unknownAtRules en "ignore" en settings.json de VS Code |

Al abrir tu archivo `globals.css` o `style.css` en proyectos configurados con Tailwind CSS, Visual Studio Code subraya en amarillo o rojo las directivas `@tailwind base;`, `@apply` y `@layer` con la advertencia: `Unknown at rule @tailwind(unknownAtRules)` o `Unknown at rule @apply`. Aunque el proyecto compila correctamente, estas advertencias ensucian el editor y ocultan errores CSS reales.

> **Solución Rápida (1 Minuto):**
> 1. En VS Code, abre settings.json y añade:
>    `"css.lint.unknownAtRules": "ignore"`
> 2. Instala la extensión oficial 'Tailwind CSS IntelliSense'.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Ignorar advertencias de Unknown At Rules en VS Code
La solución más rápida y limpia es desactivar el aviso del linter nativo de CSS para directivas personalizadas:
1. Pulsa `Ctrl + Shift + P` (o `Cmd + Shift + P` en macOS).
2. Escribe **Preferences: Open User Settings (JSON)**.
3. Añade las siguientes líneas a tu archivo `settings.json`:
```json
{
  "css.lint.unknownAtRules": "ignore",
  "scss.lint.unknownAtRules": "ignore",
  "less.lint.unknownAtRules": "ignore"
}
```

### Paso 2: Instalar la extensión oficial Tailwind CSS IntelliSense
Instala la extensión oficial **Tailwind CSS IntelliSense** desarrollada por Tailwind Labs desde el marketplace de VS Code.
Esta extensión enseña al editor cómo autocompletar clases, validar nombres de utilidad y reconocer las directivas `@tailwind`, `@apply` y `@config`.

### Paso 3: Asociar archivos CSS con el modo de lenguaje de Tailwind
Para que VS Code entienda las directivas sin apagar completamente el linter, puedes asociar la extensión `.css` con el modo de lenguaje de Tailwind CSS en tu configuración:
```json
{
  "files.associations": {
    "*.css": "tailwindcss"
  }
}
```
Esto sustituye el analizador CSS antiguo por el motor de análisis sintáctico de Tailwind.

## 🛡️ Consejo de Prevención
* Añade la carpeta `.vscode/settings.json` a tu repositorio para que todos los miembros del equipo disfruten de la corrección sin configurar su editor manualmente.
* Asegúrate de tener `postcss.config.js` con `tailwindcss` y `autoprefixer` presentes en la raíz de tu proyecto.

## Preguntas Frecuentes

### ¿Afecta esta advertencia a la compilación final de Tailwind en producción?
No. Es exclusivamente una advertencia visual de la interfaz de VS Code. El compilador de PostCSS/Tailwind procesa las directivas correctamente en producción.

### ¿Cómo hago para que funcione con archivos SCSS o SASS?
Configura `"scss.lint.unknownAtRules": "ignore"` en settings.json y asegúrate de cargar PostCSS después del preprocesador Sass en tu canalización de Vite o Webpack.

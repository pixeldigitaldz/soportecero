---
title: "[SOLUCIONADO] Error Vite: Failed to load url / Dynamic import cannot load CommonJS module"
description: "Aprende a solucionar los fallos Failed to load url y Dynamic import cannot load CommonJS en proyectos Vite, React y Vue."
category: "Web y Código"
tags: ["Vite","JavaScript","React","Frontend"]
readTime: "4 min"
date: "2026-10-09"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Importación de paquetes antiguos empaquetados en CommonJS (CJS) que Vite espera como ESM** | Configurar optimizeDeps.include en vite.config.js o instalar @rollup/plugin-commonjs |
| **Rutas dinámicas con import() que no pueden ser resueltas por el optimizador de dependencias** | Utilizar import.meta.glob para cargar módulos dinámicos de forma compatible con ESM |

Durante el desarrollo de aplicaciones con Vite (en React, Vue o Svelte), la consola del navegador arroja errores como: `[vite] Internal server error: Failed to load url /src/... (does it exist?)` o `TypeError: Dynamic import cannot load CommonJS module`. Esto ocurre porque Vite sirve módulos directamente en formato ESM nativo y choca con dependencias que aún utilizan la sintaxis CommonJS (`require` / `module.exports`).

> **Solución Rápida (1 Minuto):**
> 1. Fuerza a Vite a preempaquetar la librería en vite.config.js:
>    `optimizeDeps: { include: ['nombre-libreria'] }`
> 2. Borra la caché local de Vite y reinicia:
>    `rm -rf node_modules/.vite && npm run dev`

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Preempaquetar dependencias CommonJS en vite.config.js
Si una librería externa en `node_modules` usa CommonJS, añade la dependencia en la sección `optimizeDeps` de tu archivo de configuración:
```javascript
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['libreria-problematica']
  }
});
```

### Paso 2: Reemplazar import() dinámicos por import.meta.glob
Vite no puede predecir rutas dinámicas arbitrarias como `import(`./views/${page}.vue`)`. Utiliza la API nativa de Vite `import.meta.glob`:
```javascript
// En lugar de import('./pages/' + name)
const modules = import.meta.glob('./pages/*.jsx');

export async function loadPage(name) {
  const importFn = modules[`./pages/${name}.jsx`];
  if (importFn) {
    const mod = await importFn();
    return mod.default;
  }
  throw new Error('Página no encontrada');
}
```

### Paso 3: Limpiar la caché interna de Vite
Vite guarda dependencias preempaquetadas en `node_modules/.vite`. Si modificaste la configuración, limpia el directorio de caché y relanza el servidor:
```bash
# Limpiar caché de Vite
rm -rf node_modules/.vite

# Iniciar Vite forzando reoptimización
npx vite --force
```

## 🛡️ Consejo de Prevención
* Prioriza paquetes con soporte oficial ESM en tu `package.json` revisando el campo `exports` en npm.
* Añade `"type": "module"` en tu `package.json` si escribes código moderno con imports.

## Preguntas Frecuentes

### ¿Por qué esta misma librería funcionaba en Webpack y falla en Vite?
Webpack empaqueta todo el código en un único bundle convirtiendo automáticamente CJS a su propio cargador. Vite sirve módulos ESM nativos sin empaquetar en modo desarrollo para máxima velocidad.

### ¿Cómo soluciono require is not defined en Vite?
Reemplaza `const pkg = require("pkg")` por `import pkg from "pkg"`, o usa `vite-plugin-require-transform` si no puedes modificar el código fuente.

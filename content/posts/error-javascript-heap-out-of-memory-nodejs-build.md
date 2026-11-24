---
title: Error JavaScript Heap Out of Memory en Node.js, Vite y Next.js
description: >-
  Cómo solucionar el error FATAL ERROR Reached heap limit Allocation failed - JavaScript heap out of memory en builds de Node.js, Next.js, Vite, TypeScript y Docker.
category: Web y Código
tags:
  - Node.js
  - Next.js
  - Vite
  - Docker
readTime: 7 min
date: '2026-11-23'
---

El fallo **`FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory`** aparece cuando el motor V8 de Node.js supera su límite máximo de memoria dinámica (*heap*) durante una compilación pesada (`next build`, `vite build`, `tsc`) o al ejecutar un proceso con fugas de memoria. Cuando esto ocurre, el recolector de basura (*Garbage Collector*) no logra liberar espacio suficiente y el proceso se aborta con código de salida `134`.

## Diagnóstico Rápido

| Causa | Solución |
|---|---|
| **Límite de heap V8 insuficiente (~2 GB–4 GB por defecto)** | Ampliar memoria con `NODE_OPTIONS="--max-old-space-size=4096"` (o `8192`) |
| **Generación de Source Maps en producción (`vite` / `webpack`)** | Desactivar `sourcemap: false` en builds de producción o usar `hidden` |
| **Contenedor Docker o CI/CD con RAM limitada sin swap** | Ajustar `NODE_OPTIONS` por debajo del límite del contenedor y optimizar capas |
| **Barrel files (`index.ts`) o `tsc` analizando `node_modules`** | Activar `skipLibCheck: true` en `tsconfig.json` y evitar re-exportaciones masivas |

---

## Arquitectura del Heap en V8 y Causa Raíz del Error

Node.js gestiona la memoria dentro del espacio **Old Space** de V8, donde residen los objetos de larga vida como árboles AST de TypeScript, grafos de módulos de Vite/Rollup, cachés de Webpack o páginas pre-renderizadas de Next.js.

En sistemas de 64 bits, V8 asigna un techo automático de memoria (habitualmente entre 2 GB y 4 GB según la versión de Node.js y la RAM física detectada). El problema surge en tres escenarios típicos:

1. **Picos de memoria durante el bundling y minificación:** Herramientas como Terser, SWC, PostCSS o `tsc --noEmit` mantienen miles de módulos simultáneamente en RAM al generar el bundle de producción.
2. **Desajuste en contenedores Docker y GitHub Actions:** En entornos con cgroups (por ejemplo un contenedor con 2 GB de RAM), si V8 intenta crecer más allá del límite del contenedor, el kernel Linux mata el proceso (`OOMKilled`), o V8 colapsa antes al no poder expandir el heap.
3. **Importaciones circulares o barrel files gigantes:** Librerías de iconos (`lucide-react`, `@mui/icons-material`) importadas desde un archivo índice sin *tree-shaking* adecuado obligan al compilador a cargar miles de archivos en memoria.

---

## Solución Paso a Paso en Node.js, CI/CD y Docker

### Paso 1: Verificar el límite actual de heap en tu entorno

Comprueba cuánta memoria tiene asignada Node.js actualmente ejecutando esta inspección en la terminal:

```bash
node -e "console.log('Heap limit (MB):', Math.round(require('v8').getHeapStatistics().heap_size_limit / 1024 / 1024))"
```

Si el valor está cerca de `2048` o `4096` MB y tu proyecto falla durante `npm run build`, el primer paso es elevar ese umbral de forma controlada.

### Paso 2: Configurar `NODE_OPTIONS` de forma multiplataforma

En lugar de fijar la variable solo en tu terminal, intégrala en el `package.json` usando `cross-env` (para que funcione igual en Linux, macOS, Windows y CI/CD) o directamente en Linux/macOS:

```bash
# Prueba inmediata en Linux / macOS
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

Para dejarlo permanente en `package.json`:

```json
{
  "scripts": {
    "build": "NODE_OPTIONS=\"--max-old-space-size=4096\" next build"
  }
}
```

Si trabajas en equipos mixtos (Windows + Linux), instala `cross-env` como dependencia de desarrollo y úsalo así:

```json
{
  "scripts": {
    "build": "cross-env NODE_OPTIONS=--max-old-space-size=4096 vite build"
  }
}
```

### Paso 3: Reducir el consumo real de RAM en Vite, Next.js y TypeScript

Aumentar la RAM es un parche útil, pero optimizar el bundler evita que el consumo siga creciendo:

1. **Desactiva Source Maps pesados en producción (`vite.config.ts`):**

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 1000
  }
});
```

2. **Acelera y aligera TypeScript (`tsconfig.json`):**

```json
{
  "compilerOptions": {
    "skipLibCheck": true,
    "incremental": true
  },
  "exclude": ["node_modules", "dist", ".next"]
}
```

3. **En Next.js (`next.config.mjs`), desactiva Source Maps de navegador y limita hilos si tienes poca RAM:**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: false,
  experimental: {
    workerThreads: false,
    cpus: 2
  }
};

export default nextConfig;
```

### Paso 4: Ajustar el heap dentro de un `Dockerfile` multi-stage

En servidores VPS pequeños (1 GB o 2 GB de RAM), un `docker build` falla si `--max-old-space-size` es igual o mayor que la RAM del host, o si es demasiado bajo para el bundler. Deja un margen de ~25% para el sistema operativo:

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
# Para un VPS/runner de 4 GB de RAM, reserva 3072 MB para V8
ENV NODE_OPTIONS="--max-old-space-size=3072"
RUN npm run build
```

---

## Preguntas Frecuentes

### ¿Cuánto `--max-old-space-size` debo asignar?
Asigna como máximo entre el **70% y el 75% de la RAM física disponible** en la máquina o contenedor. Por ejemplo: en una máquina de 4 GB usa `3072`; en una de 8 GB usa `4096` o `6144`. Nunca asignes más RAM de la que tiene el sistema sin swap, o Linux matará el proceso con `SIGKILL`.

### ¿Por qué pasa en `npm run build` pero no en desarrollo (`npm run dev`)?
Porque en desarrollo los servidores modernos (Vite, Turbopack, Next.js dev) compilan rutas y módulos bajo demanda (*lazy compilation*), mientras que `build` procesa, optimiza, minifica y analiza todo el grafo completo de la aplicación al mismo tiempo.

---

## Consejo de Prevención

* Evita re-exportaciones masivas (*barrel files*) en librerías grandes de UI o iconos; importa directamente el módulo específico cuando sea posible.
* Configura una partición o archivo `swap` de al menos 2 GB en VPS de compilación pequeños para evitar caídas abruptas durante despliegues.
* Ejecuta `node --heapsnapshot-signal=SIGUSR2` en servicios Node.js de larga duración si el error ocurre en tiempo de ejecución y no durante el build, para detectar fugas de memoria reales.

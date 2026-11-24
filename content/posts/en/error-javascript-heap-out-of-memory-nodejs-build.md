---
title: JavaScript Heap Out of Memory Error in Node.js, Vite, and Next.js
description: >-
  How to fix FATAL ERROR Reached heap limit Allocation failed - JavaScript heap out of memory in Node.js, Next.js, Vite, TypeScript, and Docker builds.
category: Web & Code
tags:
  - Node.js
  - Next.js
  - Vite
  - Docker
readTime: 7 min
date: '2026-11-23'
---

The **`FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory`** crash occurs when Node.js's V8 engine exceeds its maximum dynamic memory (*heap*) ceiling during heavy builds (`next build`, `vite build`, `tsc`) or a runtime memory leak. When the Garbage Collector can no longer free enough space, V8 aborts the process with exit code `134`.

## Quick Diagnostics

| Cause | Solution |
|---|---|
| **Default V8 heap limit (~2 GB–4 GB) is too low** | Raise the ceiling with `NODE_OPTIONS="--max-old-space-size=4096"` (or `8192`) |
| **Production source maps inflating bundler RAM (`vite` / `webpack`)** | Set `sourcemap: false` in production builds |
| **Docker container or CI runner hitting cgroup RAM limits** | Cap `NODE_OPTIONS` at ~75% of container RAM and limit build workers |
| **Heavy barrel files (`index.ts`) or `tsc` scanning `node_modules`** | Enable `skipLibCheck: true` in `tsconfig.json` and avoid mega-barrels |

---

## V8 Heap Mechanics and Root Causes

Node.js stores long-lived objects inside V8's **Old Space** segment—including TypeScript ASTs, Vite/Rollup module graphs, Webpack caches, and Next.js static generation payloads.

On 64-bit systems, V8 caps this heap automatically (typically between 2 GB and 4 GB depending on Node.js version and host RAM). Builds usually hit this ceiling for three reasons:

1. **Bundling and minification spikes:** Tools like Terser, SWC, PostCSS, and `tsc` hold thousands of parsed ASTs in memory simultaneously during production builds.
2. **Docker / CI cgroup mismatches:** Inside containers with strict memory limits (e.g., 2 GB RAM), V8 may either exhaust its internal heap limit early or trigger a Linux `OOMKilled` termination.
3. **Barrel files and circular imports:** Importing icon packs (`lucide-react`, `@mui/icons-material`) through top-level barrel files forces the compiler to parse thousands of unused modules in memory.

---

## Step-by-Step Solution for Node.js, CI/CD, and Docker

### Step 1: Inspect the Current V8 Heap Limit

Check how much heap memory Node.js allocates by default in your environment:

```bash
node -e "console.log('Heap limit (MB):', Math.round(require('v8').getHeapStatistics().heap_size_limit / 1024 / 1024))"
```

If the output sits around `2048` or `4096` MB and your build crashes at peak load, increase the heap limit safely.

### Step 2: Set `NODE_OPTIONS` Consistently in `package.json`

Test the build with an increased Old Space allocation first:

```bash
# Immediate test on Linux / macOS
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

Persist it inside `package.json`:

```json
{
  "scripts": {
    "build": "NODE_OPTIONS=\"--max-old-space-size=4096\" next build"
  }
}
```

For cross-platform teams (Windows + Linux/macOS), use `cross-env`:

```json
{
  "scripts": {
    "build": "cross-env NODE_OPTIONS=--max-old-space-size=4096 vite build"
  }
}
```

### Step 3: Reduce Real Memory Footprint in Vite, Next.js, and TypeScript

Raising the memory limit buys headroom, while trimming bundler overhead prevents future regressions:

1. **Disable heavy production source maps (`vite.config.ts`):**

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 1000
  }
});
```

2. **Speed up TypeScript type checking (`tsconfig.json`):**

```json
{
  "compilerOptions": {
    "skipLibCheck": true,
    "incremental": true
  },
  "exclude": ["node_modules", "dist", ".next"]
}
```

3. **Limit Next.js worker concurrency on low-RAM runners (`next.config.mjs`):**

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

### Step 4: Configure Heap Limits Inside a Multi-Stage `Dockerfile`

On small VPS instances or CI runners, reserve ~25% of total RAM for the OS and Docker daemon so the container isn't `OOMKilled`:

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
# On a 4 GB RAM runner, allocate 3072 MB to V8
ENV NODE_OPTIONS="--max-old-space-size=3072"
RUN npm run build
```

---

## Frequently Asked Questions

### What value should I set for `--max-old-space-size`?
Set it to **70%–75% of the available physical RAM** on the machine or container (e.g., `3072` on a 4 GB server, `4096` or `6144` on an 8 GB machine). Setting it higher than available RAM without swap will cause the Linux kernel to kill the process with `SIGKILL`.

### Why does this happen on `npm run build` but not `npm run dev`?
Development servers compile routes and dependencies lazily on demand, whereas production `build` commands parse, type-check, tree-shake, and minify the entire dependency graph at once.

---

## Prevention Advice

* Avoid importing from massive barrel files (`index.ts`) in UI or icon libraries; import specific subpaths when supported.
* Provision at least a 2 GB swap file on small build VPS instances to absorb temporary bundling spikes safely.
* Use `node --heapsnapshot-signal=SIGUSR2` on long-running Node.js services if the crash happens in production runtime rather than during build time.

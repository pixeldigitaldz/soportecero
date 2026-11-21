---
title: >-
  Vite Error: Failed to load url / Dynamic import cannot load CommonJS
  module
description: >-
  Fix Vite errors Failed to load url and Dynamic import cannot load CommonJS
  module in modern React, Vue, and Svelte frontend setups.
category: Web & Code
tags:
  - Vite
  - JavaScript
  - React
  - Frontend
readTime: '6 min'
date: '2026-10-09'
---

Encountering `[vite] Internal server error: Failed to load url /src/...` or `TypeError: Dynamic import cannot load CommonJS module` in React, Vue, or Svelte projects happens because Vite's development server serves unbundled native ES Modules (ESM) directly to the browser. Whenever Vite's module resolver fails to locate a file path or encounters a CommonJS (`require` / `module.exports`) package that escaped `esbuild` pre-bundling, the browser's native ESM loader rejects it.

## Quick Diagnostics

| Symptom / Cause | Immediate Action |
|---|---|
| **`Dynamic import cannot load CommonJS module`** | Add package name to `optimizeDeps.include` in `vite.config.js` |
| **`Failed to load url` on template `import(\`./pages/${name}\`)`** | Replace dynamic string templates with `import.meta.glob()` |
| **`Failed to load url` on `@/` alias or missing extension** | Configure `resolve.alias` in `vite.config.js` and check case sensitivity |
| **Stale pre-bundled cache after `npm install`** | Delete `node_modules/.vite` and run `npx vite --force` |

## Root Cause & Technical Mechanics

Unlike Webpack—which bundles your entire dependency graph into CommonJS-compatible chunks before serving a single byte—Vite splits development into two pipelines:
1. **Dependency Pre-Bundling (`esbuild`):** At startup, Vite crawls static `import` statements, converts legacy CommonJS packages inside `node_modules` into clean ESM, and caches them in `node_modules/.vite/deps/`.
2. **Native Browser ESM (`src/`):** Your source files are transformed on-demand and sent to the browser via native `<script type="module">`.

This architecture breaks in two exact ways:
- **Missed CJS Dependencies:** If a CommonJS library is imported dynamically, conditionally, or via a subpath (e.g., `pkg/lib/helper`), Vite's static scanner may miss it during startup. The browser then fetches the raw CJS file directly, triggering `Dynamic import cannot load CommonJS module` or `ReferenceError: module is not defined`.
- **Unanalyzable Dynamic `import()`:** Rollup and Vite rewrite relative imports at transform time. A runtime template like `import(variable)` or `import(\`./${folder}/${file}.jsx\`)` cannot be statically resolved into a valid module URL, producing `Failed to load url`.

## Step-by-Step Solution

### 1. Force CommonJS Pre-Bundling in `vite.config.js`

Explicitly list any offending CJS package (or subpath) inside `optimizeDeps.include` so `esbuild` compiles it to ESM before the browser requests it:

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['legacy-cjs-package', 'lodash/debounce'],
  },
});
```

If the issue also appears during `vite build` (Rollup production bundle), ensure `@rollup/plugin-commonjs` handles mixed modules via `build.commonjsOptions`:

```javascript
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
```

### 2. Replace Dynamic Template Imports with `import.meta.glob`

Rewrite non-static `import()` expressions using Vite's built-in `import.meta.glob`, which statically indexes matching files at compile time:

```javascript
// Before (fails in Vite):
// const mod = await import(`./widgets/${name}.jsx`);

// After (works in dev & production):
const widgetModules = import.meta.glob('./widgets/*.jsx');

export async function loadWidget(name) {
  const importer = widgetModules[`./widgets/${name}.jsx`];
  if (!importer) {
    throw new Error(`Widget "${name}" not found`);
  }
  const mod = await importer();
  return mod.default;
}
```

### 3. Verify Path Aliases and Case-Sensitive Filenames

If `Failed to load url /@/components/Button` appears, register the `@` alias in `vite.config.js` (and `tsconfig.json` if using TypeScript), and verify exact filename casing (Linux CI servers are case-sensitive even if Windows/macOS are not):

```javascript
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### 4. Purge Stale `.vite` Cache and Verify

Clear cached pre-bundles and restart Vite with `--force` to confirm zero module-loading errors:

```bash
rm -rf node_modules/.vite
npx vite --force
```

Check both the terminal and browser DevTools Network tab (filter by `JS`) to verify every module returns `200 OK` with `Content-Type: application/javascript`.

## Frequently Asked Questions

### Why did the exact same code work in Webpack or Create React App?
Webpack wraps every module inside a simulated CommonJS runtime (`__webpack_require__`), allowing `require()` and dynamic paths to coexist. Vite relies on the browser's strict native ESM specification, which rejects CommonJS globals (`module`, `exports`, `require`) in client code.

### Why does `Failed to load url` only happen in `vite build` or only in `vite dev`?
`vite dev` uses `esbuild` for dependency pre-bundling, while `vite build` uses Rollup. If a package works in dev but breaks in production (or vice versa), check `optimizeDeps.include` for dev and `build.commonjsOptions` for production.

### Can I use `vite-plugin-commonjs` for browser-side `require()` calls?
Only as a temporary migration bridge. Long-term, converting `require()` to static `import` or `await import()` eliminates runtime polyfill overhead and unlocks tree-shaking.

## Prevention Advice

- **Prefer ESM-native npm packages:** Check `package.json` for `"type": "module"` or an `"exports"` map before adopting new UI or utility libraries.
- **Avoid variable-only `import()` paths:** Always keep at least a static directory prefix and file extension, or use `import.meta.glob()`.
- **Keep `vite` and `@vitejs/plugin-*` updated:** Newer Vite releases continuously improve `esbuild` CJS interop and subpath discovery.
- **Run `vite build` in CI:** Never rely solely on `vite dev` passing—always verify the Rollup production bundle builds cleanly.

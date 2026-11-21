---
title: 'npm ERR! ERESOLVE unable to resolve dependency tree in npm install'
description: >-
  Learn how to resolve npm ERR! ERESOLVE unable to resolve dependency tree when
  installing packages in Node.js and modern React projects.
category: Web & Code
tags:
  - npm
  - Nodejs
  - JavaScript
  - React
readTime: 5 min
date: '2026-10-13'
---

Running `npm install` in modern JavaScript and TypeScript repositories frequently aborts with `npm ERR! code ERESOLVE` and `npm ERR! ERESOLVE unable to resolve dependency tree`. This happens when npm's Arborist dependency resolver detects incompatible `peerDependencies` version ranges between your root project and one or more third-party packages.

## Quick Diagnostics

| Cause | Symptom | Solution |
|---|---|---|
| **React / framework major version mismatch** | `peer react@"^17.0.0"` vs root `react@18/19` | Upgrade package, or add `overrides` in `package.json` |
| **Legacy plugin lagging behind ESLint/Vite** | `ERESOLVE` on `@typescript-eslint` or `eslint@9` | Align plugin versions or use `--legacy-peer-deps` |
| **Stale `package-lock.json` conflict** | Works on fresh clone, fails locally | Delete `package-lock.json` + `node_modules` and reinstall |
| **CI/CD pipeline failing on `npm ci`** | Local install used `--legacy-peer-deps` | Persist `legacy-peer-deps=true` in `.npmrc` or fix `overrides` |

## Root Cause & Technical Mechanics

Starting with **npm v7**, the package manager replaced its permissive v6 installer with **Arborist**, which automatically installs `peerDependencies` and enforces strict semantic versioning (SemVer) satisfaction across the entire dependency graph.

Unlike regular `dependencies`—which npm can nest at multiple versions inside `node_modules/<pkg>/node_modules/`—`peerDependencies` must resolve to a **single shared instance** at the top of the tree (for example, a single copy of `react` or `@angular/core` so hooks and context singletons do not break). When package `A` declares `peerDependencies: { "react": "^18.0.0" }` while your `package.json` pins `"react": "^19.0.0"`, Arborist refuses to guess which version to hoist and aborts with `ERESOLVE` before writing to `node_modules`.

## Step-by-Step Solution

### Step 1: Read the Arborist Conflict Tree

Inspect the `While resolving:` and `Could not resolve dependency:` lines in the terminal output to pinpoint the exact package causing the mismatch:

```text
npm error Could not resolve dependency:
npm error peer react@"^17.0.0 || ^18.0.0" from legacy-chart-lib@2.4.0
npm error node_modules/legacy-chart-lib
npm error   legacy-chart-lib@"^2.4.0" from the root project
```

First check if a newer release of `legacy-chart-lib` already supports your React or ESLint major version (`npm view legacy-chart-lib versions --json`).

### Step 2: Pin Deterministic Versions with `package.json` `overrides`

When an upstream library works at runtime on a newer peer version but has an outdated `peerDependencies` range, use `overrides` (npm 8.3+) to force a single deterministic resolution without disabling checks globally:

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "legacy-chart-lib": "^2.4.0"
  },
  "overrides": {
    "legacy-chart-lib": {
      "react": "$react"
    }
  }
}
```

The `$react` syntax tells npm to reuse the exact `react` version declared in your root `dependencies`. Regenerate the lockfile afterward:

```bash
rm -rf node_modules package-lock.json
npm install
```

### Step 3: Bypass Peer Resolution with `--legacy-peer-deps` (Fallback)

If multiple transitive packages have incompatible peer ranges and `overrides` is impractical during an urgent build, instruct npm to restore v6 peer-ignoring behavior:

```bash
npm install --legacy-peer-deps
```

To ensure `npm ci` in CI/CD runners (GitHub Actions, Vercel) honors the same rule, commit a project-level `.npmrc`:

```ini
legacy-peer-deps=true
```

### Step 4: Verify the Resolved Dependency Graph

Confirm the installed tree has no broken or duplicate peer singletons:

```bash
npm ls react
npm explain legacy-chart-lib
```

If `npm ls react` exits with `0` and shows a single shared version, your tree is consistent.

## Frequently Asked Questions

### What is the difference between `--legacy-peer-deps` and `--force`?
`--legacy-peer-deps` skips automatic installation and conflict checking of `peerDependencies` altogether. `--force` continues installing even on conflict by overwriting or fetching duplicate incompatible versions, which frequently introduces subtle runtime crashes in singleton libraries like React.

### Why does `npm ci` fail in CI even after `npm install --legacy-peer-deps` worked locally?
`npm ci` reads `package-lock.json` strictly and still validates peer compatibility unless `legacy-peer-deps=true` is present in `.npmrc` or passed as a CLI flag (`npm ci --legacy-peer-deps`).

### Can `overrides` cause runtime bugs?
Yes, if the overridden package relies on a removed API from the older major version. Always run your unit/integration test suite and TypeScript check (`npx tsc --noEmit`) after adding an `overrides` entry.

## Prevention Advice

- Prefer `overrides` (or `resolutions` in Yarn / `pnpm.overrides` in pnpm) over global `legacy-peer-deps=true` so you only relax the specific package that lags behind.
- Run `npm outdated` and upgrade ecosystem plugins together when bumping major framework versions (e.g., React, Next.js, ESLint).
- Commit `package-lock.json` and `.npmrc` to version control so local machines and CI runners resolve identical graphs.
- Check a package's maintenance activity and `peerDependencies` (`npm info <pkg> peerDependencies`) before adopting it.

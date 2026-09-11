---
title: "[SOLVED] npm ERR! ERESOLVE unable to resolve dependency tree in npm install"
description: "Learn how to resolve npm ERR! ERESOLVE unable to resolve dependency tree when installing packages in Node.js and modern React projects."
category: "Web & Code"
tags: ["npm","Nodejs","JavaScript","React"]
readTime: "4 min"
date: "2026-10-13"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Strict peer dependency resolution checks enforced automatically since npm v7+** | Install using --legacy-peer-deps or reconcile mismatched packages via npm overrides |
| **Version divergence between React 18/19 and unmaintained third-party ecosystem packages** | Configure .npmrc with legacy-peer-deps=true or declare overrides in package.json |

When running `npm install` or pulling a new dependency into a Node.js project, the execution halts with: `npm ERR! code ERESOLVE` and `npm ERR! ERESOLVE unable to resolve dependency tree`. Starting with npm version 7, the package manager automatically attempts to install peer dependencies and enforces strict semantic version compatibility trees.

> **Quick Solution (1 Minute):**
> 1. Bypass strict peer dependency checking:
>    `npm install --legacy-peer-deps`
> 2. Persist this setting project-wide in .npmrc:
>    `echo "legacy-peer-deps=true" >> .npmrc`

## 🚀 Step-by-Step Solution

### Step 1: Analyze the Conflicting Dependency Tree Branch
Examine the error stack printed in your terminal. npm shows the precise mismatch causing the lockup:
```plaintext
Could not resolve dependency:
peer react@"^17.0.0" from legacy-ui-lib@1.2.0
node_modules/legacy-ui-lib
  legacy-ui-lib@"^1.2.0" from the root project
```
Here, the root project requires React 18+, but the legacy UI package specifies an incompatible peer dependency on React 17.

### Step 2: Bypass Peer Dependency Trees with --legacy-peer-deps
The `--legacy-peer-deps` flag tells npm to ignore conflicting peerDependencies, restoring the classic behavior of npm v6:
```bash
npm install --legacy-peer-deps
```
To persist this across CI/CD runners (GitHub Actions, Vercel, Netlify), declare it in your local `.npmrc`:
```ini
# .npmrc
legacy-peer-deps=true
```

### Step 3: Pin Uniform Versions via package.json overrides
For a clean, deterministic package resolution without bypassing validations, declare an `overrides` block in `package.json`:
```json
{
  "name": "my-app",
  "dependencies": {
    "react": "^18.3.1"
  },
  "overrides": {
    "legacy-ui-lib": {
      "react": "$react"
    }
  }
}
```
Delete your lockfile and reinstall:
```bash
rm -rf package-lock.json node_modules
npm install
```

## 🛡️ Prevention Tips
* Audit package maintenance status on npm before introducing dependencies with outdated peer requirements.
* Run `npm outdated` periodically to maintain modern dependency hygiene.

## Frequently Asked Questions

### What is the operational difference between --legacy-peer-deps and --force?
--legacy-peer-deps ignores peerDependency graph collisions entirely. --force aggressively overwrites conflicting modules in node_modules, frequently causing subtle runtime bugs.

### Is --legacy-peer-deps safe to deploy to production?
Yes, provided your application builds and passes automated unit tests, as most minor/major peer mismatches maintain backward-compatible core APIs.

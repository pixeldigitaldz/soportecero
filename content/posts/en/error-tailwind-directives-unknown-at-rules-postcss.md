---
title: 'Unknown at rule @tailwind & @apply Warning in VS Code & PostCSS'
description: >-
  Eliminate Unknown at rule @tailwind, @apply, and @layer CSS linter warnings in
  Visual Studio Code and Tailwind CSS projects.
category: Web & Code
tags:
  - TailwindCSS
  - CSS
  - Frontend
  - VSCode
readTime: 5 min
date: '2026-10-15'
---

Opening `globals.css` or `index.css` in a Tailwind CSS project inside Visual Studio Code often displays yellow squiggly diagnostics under `@tailwind base;`, `@apply`, `@layer`, or Tailwind v4's `@import "tailwindcss";` / `@theme`: `Unknown at rule @tailwind (unknownAtRules)`. Even though Vite, Next.js, or PostCSS compiles your stylesheet cleanly, VS Code's built-in CSS validator flags Tailwind's custom directives as invalid CSS.

## Quick Diagnostics

| Cause | Symptom | Solution |
|---|---|---|
| **VS Code built-in CSS linter** | `Unknown at rule @tailwind` / `@apply` in Problems tab | Install Tailwind CSS IntelliSense & map `*.css` to `tailwindcss` |
| **Missing `css.lint.unknownAtRules`** | Warnings persist in `.scss` or non-Tailwind CSS files | Set `"css.lint.unknownAtRules": "ignore"` in `settings.json` |
| **PostCSS pipeline missing Tailwind** | Actual build error: `SyntaxError: Unknown word` or uncompiled `@tailwind` | Register `@tailwindcss/postcss` or `tailwindcss` in `postcss.config.js` |
| **SCSS running after PostCSS** | `@apply` fails inside nested Sass selectors | Ensure `sass-loader` executes before `postcss-loader` |

## Root Cause & Technical Mechanics

Visual Studio Code ships with `vscode-css-languageservice`, a built-in language server that parses `.css` files strictly against the W3C CSS specification. Standard CSS only defines a fixed set of at-rules (`@media`, `@import`, `@keyframes`, `@layer`, `@supports`). Directives such as `@tailwind`, `@apply`, `@screen`, `@theme`, and `@utility` are **compile-time preprocessor directives** consumed by PostCSS (Tailwind v3) or Tailwind's Oxide engine / `@tailwindcss/postcss` (Tailwind v4) during bundling—not native browser CSS.

Because the default language server has no knowledge of your `postcss.config.js` or Tailwind plugin, it emits `unknownAtRules` warnings in the editor. Note that if you see `@tailwind` or `@apply` failing *during `npm run build`* rather than just in the editor, the root cause is a missing or misordered PostCSS configuration rather than a VS Code setting.

## Step-by-Step Solution

### Step 1: Install Tailwind CSS IntelliSense and Associate `.css` Files

Install the official **Tailwind CSS IntelliSense** extension (`bradlc.vscode-tailwindcss`) from the VS Code Marketplace. Then open `.vscode/settings.json` in your project root (or User Settings JSON via `Ctrl+Shift+P` -> `Preferences: Open User Settings (JSON)`) and associate `.css` files with the `tailwindcss` language mode:

```json
{
  "files.associations": {
    "*.css": "tailwindcss"
  }
}
```

This hands `.css` parsing directly to Tailwind's language server, removing false `unknownAtRules` warnings while enabling utility class autocomplete and hover previews.

### Step 2: Suppress Linter Warnings for SCSS / Legacy Stylesheets

If your project also uses `.scss` or `.less` files where `files.associations` cannot be switched to `tailwindcss`, silence the built-in validator's unknown at-rule check:

```json
{
  "css.lint.unknownAtRules": "ignore",
  "scss.lint.unknownAtRules": "ignore",
  "less.lint.unknownAtRules": "ignore"
}
```

### Step 3: Verify PostCSS Configuration (If Production Build Also Fails)

If your bundler outputs raw `@tailwind` or throws a PostCSS build error, confirm `postcss.config.mjs` (or `.js`) registers Tailwind properly:

```javascript
// Tailwind v3 (postcss.config.js)
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

// Tailwind v4 (postcss.config.mjs)
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

### Step 4: Verify Clean Build and Zero Editor Diagnostics

Restart the Tailwind CSS language server (`Ctrl+Shift+P` -> `Tailwind CSS: Restart Language Server`) and run your production build to verify zero PostCSS errors:

```bash
npm run build
```

## Frequently Asked Questions

### Does `Unknown at rule @tailwind` affect my production bundle?
When it appears only in the VS Code Problems panel, no—it is purely an IDE diagnostic. Your bundler's PostCSS pipeline still transforms `@tailwind` and `@apply` into standard CSS rules.

### Why did `@apply` break after upgrading to Tailwind CSS v4?
In Tailwind v4, `@tailwind base/components/utilities` is replaced by `@import "tailwindcss";`, and custom CSS files using `@apply` inside Vue/Svelte `<style>` blocks or CSS Modules may require `@reference "../app.css";` so Tailwind can resolve theme tokens.

### Why does `@apply` fail when used inside `.scss` files?
PostCSS must process CSS *after* Sass compiles nested selectors and variables. Verify your bundler runs `sass-loader` first and `postcss-loader` second.

## Prevention Advice

- Commit a shared `.vscode/settings.json` and `.vscode/extensions.json` (recommending `bradlc.vscode-tailwindcss`) so every contributor gets identical editor support.
- Use `files.associations: { "*.css": "tailwindcss" }` rather than disabling all CSS linting globally whenever possible, so genuine CSS syntax errors are still caught.
- Keep `postcss.config.mjs` in the project root and avoid duplicating conflicting PostCSS configs in subdirectories.
- Run `npm run build` in CI on every pull request to catch genuine PostCSS or `@apply` resolution errors early.

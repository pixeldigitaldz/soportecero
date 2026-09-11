---
title: "[SOLVED] Unknown at rule @tailwind & @apply Warning in VS Code & PostCSS"
description: "Eliminate Unknown at rule @tailwind, @apply, and @layer CSS linter warnings in Visual Studio Code and Tailwind CSS projects."
category: "Web & Code"
tags: ["TailwindCSS","CSS","Frontend","VSCode"]
readTime: "3 min"
date: "2026-10-15"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **VS Code built-in standard CSS language server does not recognize custom Tailwind @-rules** | Install the official Tailwind CSS IntelliSense extension and map file associations |
| **Default CSS linter settings flagging valid preprocessor at-rules as syntax errors** | Configure css.lint.unknownAtRules to "ignore" inside VS Code settings.json |

Upon opening `globals.css` or `style.css` in projects utilizing Tailwind CSS, Visual Studio Code paints squiggly warnings under `@tailwind base;`, `@apply`, and `@layer` stating: `Unknown at rule @tailwind(unknownAtRules)` or `Unknown at rule @apply`. While production builds compile cleanly, these false alarms clutter the editor and distract from actual CSS defects.

> **Quick Solution (1 Minute):**
> 1. Inside VS Code settings.json, suppress unknown at-rule warnings:
>    `"css.lint.unknownAtRules": "ignore"`
> 2. Install the official 'Tailwind CSS IntelliSense' extension.

## 🚀 Step-by-Step Solution

### Step 1: Suppress Unknown At-Rule Warnings in VS Code Settings
Instruct the built-in language server to disregard custom directives:
1. Press `Ctrl + Shift + P` (`Cmd + Shift + P` on macOS).
2. Select **Preferences: Open User Settings (JSON)**.
3. Append these properties to your `settings.json`:
```json
{
  "css.lint.unknownAtRules": "ignore",
  "scss.lint.unknownAtRules": "ignore",
  "less.lint.unknownAtRules": "ignore"
}
```

### Step 2: Install Tailwind CSS IntelliSense Extension
Install the verified **Tailwind CSS IntelliSense** extension from the Visual Studio Code marketplace.
This extension equips the editor with autocomplete tooltips, linting for utility classes, and native recognition of `@tailwind`, `@config`, and `@apply` syntax.

### Step 3: Map CSS File Associations to Tailwind Mode
Assign `.css` files to Tailwind's grammar parser rather than the generic browser CSS validator:
```json
{
  "files.associations": {
    "*.css": "tailwindcss"
  }
}
```
This replaces the legacy CSS scanner with full Tailwind-native AST understanding.

## 🛡️ Prevention Tips
* Commit a workspace `.vscode/settings.json` file to enforce uniform developer experience across team repositories.
* Verify `postcss.config.js` declares `tailwindcss` and `autoprefixer` in project root.

## Frequently Asked Questions

### Does this warning impact production build output?
No. The warning is strictly an IDE linting quirk. PostCSS evaluates and replaces `@tailwind` directives during compilation without issue.

### Why does @apply fail inside nested SCSS selectors?
PostCSS must run after Sass compilation. Ensure your bundler executes sass-loader before postcss-loader in your asset pipeline.

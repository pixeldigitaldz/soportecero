---
title: "[FIXED] Error 'fatal: refusing to merge unrelated histories' in Git"
description: "Git refusing to merge local repo with GitHub due to 'unrelated histories'? Step-by-step fix using --allow-unrelated-histories flag."
category: "Web & Code"
tags: ["Git", "GitHub", "DevOps"]
readTime: "3 min"
date: "2026-08-03"
---

The error **`fatal: refusing to merge unrelated histories`** occurs when attempting to execute `git pull` or `git merge` between two Git repositories that do not share a common commit history. This frequently happens when you run `git init` locally while simultaneously creating a new repository on GitHub initialized with a `README.md` or `.gitignore` file.

> **Quick Solution (1 Minute):**
> Execute the pull command with the allow flag:
> `git pull origin main --allow-unrelated-histories`

## 🚀 Step-by-Step Troubleshooting

### Step 1: Force Merge Unrelated Histories
Open your terminal in your local project folder and run:

```bash
git pull origin main --allow-unrelated-histories
```
*(Replace `main` with `master` if your default branch uses the old naming).*

This flag instructs Git to stitch together the history trees of both independent root commits.

### Step 2: Resolve Any Merge Conflicts
If both the local and remote repos contain identical filenames (like `README.md`), Git will mark a conflict.

1. Open the conflicted files in your code editor and select the content to keep.
2. Stage the resolved files:
```bash
git add .
```

### Step 3: Complete Merge Commit and Push
Finish the merge process and upload the unified history to GitHub:

```bash
git commit -m "Fix: Merge unrelated histories from remote and local"
git push origin main
```

## 🛡️ Best Practices & Prevention
* If you initialize a repo on GitHub with a `README.md`, always **clone** it to your machine (`git clone <url>`) rather than initializing locally with `git init`.
* If you start locally with `git init`, create an **empty repository** on GitHub (do not select README or License options).

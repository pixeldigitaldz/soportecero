---
title: "[FIXED] How to Abort a Git Rebase or Fix 'No rebase in progress'"
description: "Stuck in an interactive git rebase loop or receiving 'fatal: No rebase in progress'? Step-by-step guide to abort rebase and clean stale refs."
category: "Web & Code"
tags: ["Git", "GitHub", "DevOps"]
readTime: "3 min"
date: "2026-08-28"
---

The status **`interactive rebase in progress`** (or the contradictory error `fatal: No rebase in progress`) occurs when running `git rebase` if Git encounters conflicts mid-sequence and halts execution pending manual resolution. If terminal sessions disconnect or `.git/rebase-merge` locks become stale, your repository remains locked in rebase state.

> **Quick Solution (1 Minute):**
> 1. Abort rebase and restore pre-rebase branch state:
>    `git rebase --abort`
> 2. If git claims `No rebase in progress` but shell prompt is stuck, delete stale lock directories:
>    `rm -rf .git/rebase-apply .git/rebase-merge`

## 🚀 Step-by-Step Resolution

### Step 1: Cleanly Abort the Rebase
To cancel all intermediate commit rewrites and return your branch to its exact state prior to running rebase:

```bash
git rebase --abort
```

### Step 2: Force Clear Phantom Rebase State
If your shell prompt continues to display `(main|REBASE 1/5)` but running `git rebase --abort` responds with `fatal: No rebase in progress`:

Manually purge residual rebase tracking folders:

```bash
rm -rf .git/rebase-apply
rm -rf .git/rebase-merge

# Reset branch pointer to main
git checkout main
```

### Step 3: Complete Rebase After Conflict Resolution
If you prefer to **finish** the rebase sequence rather than aborting:

1. Resolve merge conflicts inside affected files.
2. Stage modified files:
   ```bash
   git add .
   ```
3. Continue the execution chain:
   ```bash
   git rebase --continue
   ```

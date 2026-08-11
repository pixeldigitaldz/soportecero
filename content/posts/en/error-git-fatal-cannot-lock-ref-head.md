---
title: "[FIXED] Error 'fatal: cannot lock ref' in Git"
description: "Git returning 'cannot lock ref' or 'unable to update local ref' during pull or fetch? Step-by-step resolution to clear stale locks."
category: "Web & Code"
tags: ["Git", "GitHub", "DevOps"]
readTime: "3 min"
date: "2026-08-20"
---

The error **`error: cannot lock ref 'refs/remotes/origin/main': is at ... but expected ...`** or `fatal: cannot lock ref` occurs during `git pull`, `git fetch`, or `git checkout` when local Git reference pointers become corrupted from abrupt process terminations or case-sensitivity branch conflicts.

> **Quick Solution (1 Minute):**
> 1. Prune outdated remote references:
>    `git remote prune origin`
> 2. Manually delete the stale lock file if needed:
>    `rm -f .git/refs/remotes/origin/main.lock`

## 🚀 Step-by-Step Fixes

### Step 1: Prune Stale Remote References
In most scenarios, this happens when branches deleted on GitHub/GitLab still exist in your local tracking cache:

```bash
git remote prune origin
```
Now retry your fetch command:
```bash
git fetch origin
```

### Step 2: Remove Stale Lock Files
If a git operation was abruptly killed (power loss or terminal kill), Git leaves behind temporary safety lock files:

```bash
# Remove specific lock file
rm -f .git/refs/remotes/origin/main.lock

# Purge any stale lock files in refs directory:
find .git/refs -name "*.lock" -type f -delete
```

### Step 3: Resolve Case-Sensitivity Branch Collisions
If two remote branches differ only by case (e.g., `Feature` and `feature`), case-insensitive filesystems (Windows/macOS) fail to create distinct reference files.

Repack reference files into a single packed-refs file:
```bash
git pack-refs --all --prune
```

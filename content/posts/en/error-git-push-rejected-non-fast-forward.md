---
title: "How to Fix 'git push rejected non-fast-forward' Error Safely"
description: "Learn how to resolve Git push rejection errors caused by divergent commit histories safely using git pull --rebase without breaking remote history."
category: "Web & Code"
tags: ["Git", "GitHub", "DevOps"]
readTime: "4 min"
date: "2026-07-27"
---

The error `[rejected - non-fast-forward]` or `updates were rejected because the remote contains work that you do not have locally` occurs when you attempt to push local commits to a remote branch in Git, but the remote repository contains newer commits that your local branch lacks.

## Quick Diagnostics

| Cause | Solution |
|---|---|
| **`error: failed to push some refs ... [rejected - non-fast-forward]`**: The remote repository branch has commits that have not been integrated into your local working copy | Run `git pull --rebase origin <branch>` to apply remote changes before running `git push` |

## 🚀 How to Fix the Error Step-by-Step

### Step 1: Fetch and Integrate Remote Updates with Rebase

Instead of executing a standard merge that creates an unnecessary merge commit, use `git pull --rebase` to replay your new local commits on top of the updated remote history:

```bash
# Replace 'main' with your branch name (e.g., dev or feature/auth)
git pull --rebase origin main
```

If you prefer inspecting remote changes before rebasing:

```bash
git fetch origin
git rebase origin/main
```

### Step 2: Resolve Merge Conflicts If Prompted

If files were modified concurrently in both local and remote commits, Git will pause the rebase process. Open the conflicting files, resolve the markers, and run:

```bash
# Stage resolved files
git add .

# Continue the rebase operation
git rebase --continue
```

### Step 3: Push Your Changes Safely

Once your local branch is synchronized and cleanly rebased on top of the remote tip, push your commits:

```bash
git push origin main
```

If you rebased existing local commits on a personal feature branch and need to update the remote, **avoid destructive `git push --force`** and use the safer option:

```bash
git push origin main --force-with-lease
```

## 🛡️ Prevention Advice

- **Branch Protection Rules**: Enable branch protection in GitHub, GitLab, or Bitbucket to prevent direct or forced pushes on default branches like `main` or `production`.
- **Pull Before Coding**: Get into the habit of running `git pull --rebase` at the start of your work session or prior to pushing new code.
- **Use `--force-with-lease` Instead of `--force`**: The `--force-with-lease` flag checks whether someone else has pushed updates to the remote branch before allowing an overwrite.

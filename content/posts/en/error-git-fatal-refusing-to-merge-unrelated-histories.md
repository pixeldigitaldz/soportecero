---
title: '[FIXED] Error ''fatal: refusing to merge unrelated histories'' in Git'
description: >-
  Git refusing to merge local repo with GitHub due to 'unrelated histories'?
  Step-by-step fix using --allow-unrelated-histories flag.
category: Web & Code
tags:
  - Git
  - GitHub
  - DevOps
readTime: 5 min
date: '2026-08-03'
---

The error `fatal: refusing to merge unrelated histories` occurs when you run `git pull` or `git merge` between two branches or repositories that do not share a common root commit. Most commonly, this happens right after initializing a local repository with `git init` and committing code, while simultaneously creating a GitHub/GitLab repository initialized with a `README.md`, `LICENSE`, or `.gitignore` file.

## Quick Diagnostics

| Symptom / Cause | Immediate Action |
|---|---|
| **Local `git init` + remote repo initialized with `README.md`** | Merge both roots: `git pull origin main --allow-unrelated-histories` |
| **Branch name mismatch (`master` locally vs `main` on remote)** | Verify branch names with `git branch -a` before pulling |
| **Detached or rewritten `.git` history after shallow clone** | Fetch full history (`git fetch --unshallow`) or use `--allow-unrelated-histories` |
| **Re-attaching a repository whose `.git` folder was recreated** | Stitch histories with `--allow-unrelated-histories` or rebase carefully |

## Root Cause & Technical Mechanics

Git models every repository as a Directed Acyclic Graph (DAG) of commits. Every commit—except the initial root commit—points to one or more parent commit SHA hashes. When you execute `git merge` or `git pull` (which runs `git fetch` followed by `git merge`), Git walks backward from both branch tips to locate their **merge base** (common ancestor commit) so it can compute a three-way diff.

Before Git 2.9, merging two branches with zero shared ancestors succeeded silently, which occasionally caused catastrophic accidental merges when a developer pulled the wrong remote repository into an existing project. Since Git 2.9, `git merge` aborts by default with `fatal: refusing to merge unrelated histories` whenever the two DAGs have no common ancestor.

When you run `git init` locally and make a commit (`Commit A`), and GitHub creates a `README.md` (`Commit B`), `Commit A` and `Commit B` are two independent root commits with completely separate parent chains.

## Step-by-Step Solution

### 1. Inspect Your Remotes and Branch Names
Before merging, confirm you are pointing to the intended remote repository and check whether the remote uses `main` or `master`:
```bash
git remote -v
git fetch origin
git branch -a
```
*(Make sure `origin/main` or `origin/master` actually belongs to the project you want to merge.)*

### 2. Pull with `--allow-unrelated-histories`
Instruct Git to bypass the common-ancestor check and create a merge commit that joins both root histories:
```bash
git pull origin main --allow-unrelated-histories
```
*(Replace `main` with `master` if your remote branch is named `master`.)*

If you prefer not to create a merge commit and want your local commits stacked cleanly on top of the remote's initial `README.md` commit, you can rebase instead:
```bash
git rebase origin/main
```

### 3. Resolve Any Overlapping File Conflicts
If both your local repository and the remote repository created files with the same path (typically `README.md` or `.gitignore`), Git will pause and mark `CONFLICT (add/add)`.

Inspect the conflicted files:
```bash
git status
```
Open each conflicted file, keep the desired lines (removing `<<<<<<<`, `=======`, and `>>>>>>>` conflict markers), then stage and complete the merge commit:
```bash
git add README.md .gitignore
git commit -m "chore: merge remote initial files with local repository"
```

### 4. Push the Unified History and Verify
Push your unified branch to the remote and verify the commit graph shows a clean merge:
```bash
git push -u origin main
git log --oneline --graph --decorate -n 5
```

## Frequently Asked Questions

**Should I use `--allow-unrelated-histories` or `git push --force`?**
Use `--allow-unrelated-histories` when you want to preserve files created on the remote (like a `LICENSE` or `README.md`). Only use `git push --force` if the remote only contains a throwaway initial commit you explicitly want to overwrite—and never force-push to a shared team branch.

**Why did `git pull` say `fatal: refusing to merge unrelated histories` on an existing project that used to work?**
This happens if someone ran `git filter-repo`, `BFG Repo-Cleaner`, or squashed the entire branch history on the remote (`git push --force`), rewriting every commit SHA so your local branch no longer shares a common ancestor with `origin/main`. In that case, back up local work and reset to `origin/main` rather than merging duplicate histories.

**What if my local branch is `master` and GitHub's branch is `main`?**
Rename your local branch first with `git branch -M main`, then run `git pull origin main --allow-unrelated-histories`.

## Prevention Advice

* When creating a new repository on GitHub or GitLab for an **existing local project**, leave "Add a README file", "Add .gitignore", and "Choose a license" unchecked so the remote starts empty.
* When starting a **brand-new project**, initialize it on GitHub first and run `git clone <url>` locally instead of `git init`.
* Never run `--allow-unrelated-histories` blindly without verifying `git remote -v` first, or you risk merging two completely different codebases together.

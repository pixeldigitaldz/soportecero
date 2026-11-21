---
title: How to Resolve Merge Conflicts in Git Without Losing Code
description: >-
  Learn how to safely identify, interpret, and resolve merge conflicts in Git
  branches using command-line commands.
category: Web & Code
tags:
  - Git
  - Web
  - Programming
readTime: 5 min
date: '2026-07-27'
---

A Git merge conflict occurs when `git merge`, `git pull`, or `git rebase` cannot automatically reconcile overlapping edits—such as two branches modifying the same line range, or one branch deleting a file that another branch modified. Rather than guessing and silently overwriting work, Git pauses the transaction in an `UNMERGED` state and writes conflict markers directly into the affected files so you can resolve them deterministically.

## Quick Diagnostics

| Cause | Symptom | Solution |
|---|---|---|
| **Overlapping line edits (`UU`)** | `CONFLICT (content): Merge conflict in <file>` | Edit markers (`<<<<<<<`, `=======`, `>>>>>>>`), `git add`, `git commit` |
| **Modify/delete conflict (`UD` / `DU`)** | One branch edited a file another branch deleted | Keep with `git add <file>` or remove with `git rm <file>` |
| **Dirty working tree abort** | `Your local changes would be overwritten by merge` | Run `git stash push` before merging, then `git stash pop` |
| **Botched resolution mid-merge** | Need to reset back to pre-merge branch state | Run `git merge --abort` (or `git rebase --abort`) |

## Root Cause & Technical Mechanics

Git's default `ort` (Ostensibly Recursive's Twin) merge strategy performs a **three-way merge**: it locates the common ancestor commit (the *merge base*), then compares the base against both `HEAD` (your current branch) and the incoming `MERGE_HEAD` branch.

When a hunk changed on only one side relative to the merge base, Git applies it automatically. When *both* sides altered the exact same lines differently—or altered adjacent lines within the same diff context—Git cannot prove which intent is canonical. It writes the conflict state into `.git/MERGE_HEAD` and the Git index (storing stages 1 = base, 2 = ours, 3 = theirs), injects `<<<<<<<` / `=======` / `>>>>>>>` delimiters into the working tree file, and exits with status `1`.

## Step-by-Step Solution

### Step 1: Identify All Unmerged Files

List every conflicted path and its conflict type (content vs. modify/delete) using `git status`:

```bash
git status --short
```

Look for `UU` (both modified), `AA` (both added), or `UD`/`DU` (modified vs. deleted).

### Step 2: Inspect Conflict Markers with `diff3` Context

If you want to see the original common ancestor alongside both branches, enable `diff3` style locally before inspecting the file:

```bash
git config merge.conflictstyle diff3
```

Inside the conflicted file, Git separates the competing versions:

```text
<<<<<<< HEAD
const API_URL = "https://staging-api.example.com";
||||||| merged common ancestors
const API_URL = "https://api.example.com";
=======
const API_URL = "https://prod-api.example.com";
>>>>>>> main
```

Edit the file to keep the correct logic (or combine both changes) and **delete every `<<<<<<<`, `|||||||`, `=======`, and `>>>>>>>` marker line**.

For one-sided bulk choices on a single file (such as lockfiles or generated assets), you can select one side cleanly via CLI:

```bash
# Keep your current branch version (--ours) or incoming branch (--theirs)
git checkout --ours path/to/file
git checkout --theirs path/to/file
```

### Step 3: Stage, Verify No Stray Markers, and Complete the Merge

Scan the repository for any leftover conflict markers before committing, then stage and commit:

```bash
git diff --check
git add path/to/resolved-file
git commit --no-edit
```

If you are resolving a **rebase** (`git rebase`) rather than a merge, stage the resolved files and run `git rebase --continue` instead of `git commit`.

### Step 4: Abort Safely if Needed

If a conflict turns out to be too tangled and you want to return to your exact pre-merge state:

```bash
git merge --abort
```

## Frequently Asked Questions

### What is the difference between `--ours` and `--theirs` during `git merge` vs `git rebase`?
During `git merge`, `--ours` is your current branch (`HEAD`) and `--theirs` is the branch being merged in. During `git rebase`, the roles invert: `--ours` is the upstream target branch you are rebasing onto, and `--theirs` is your own commit being replayed.

### Should I manually resolve conflicts in `package-lock.json` or `yarn.lock`?
No. Editing lockfiles by hand often breaks JSON syntax or integrity hashes. Accept either side (`git checkout --theirs package-lock.json`), run `npm install` to regenerate a valid lockfile, and `git add package-lock.json`.

### How do I verify I did not accidentally commit conflict markers?
Run `git diff --check` before committing—Git explicitly flags leftover `<<<<<<<`, `=======`, and `>>>>>>>` markers as whitespace/conflict errors.

## Prevention Advice

- Pull and integrate changes from `main` frequently (`git fetch origin && git merge origin/main`) so feature branches never drift for weeks.
- Keep pull requests small and focused on single modules to minimize overlapping edits across teammates.
- Enable `git config --global rerere.enabled true` (*reuse recorded resolution*) if you frequently rebase long-lived branches so Git remembers how you resolved recurring conflicts.
- Run your test suite and linter immediately after `git commit` on a merge resolution to catch semantic conflicts where both edits merged cleanly on different lines but broke shared behavior.

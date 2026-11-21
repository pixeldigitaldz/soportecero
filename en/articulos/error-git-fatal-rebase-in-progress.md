---
title: '[FIXED] How to Abort a Git Rebase or Fix ''No rebase in progress'''
description: >-
  Stuck in an interactive git rebase loop or receiving 'fatal: No rebase in
  progress'? Step-by-step guide to abort rebase and clean stale refs.
category: Web & Code
tags:
  - Git
  - GitHub
  - DevOps
readTime: 5 min
date: '2026-08-28'
---

Getting stuck in an `interactive rebase in progress` state—or hitting the contradictory `fatal: No rebase in progress?` error when trying to cancel it—happens when a `git rebase` halts mid-flight due to merge conflicts, an aborted editor session, or corrupted state metadata inside `.git/`.

## Quick Diagnostics

| Symptom | Root Condition | Immediate Command |
|---|---|---|
| **Prompt shows `(branch\|REBASE 2/5)`** | Active rebase paused on conflict | `git rebase --abort` |
| **`fatal: No rebase in progress?` despite rebase prompt** | Stale `.git/rebase-merge` or `.git/rebase-apply` folder | `rm -rf .git/rebase-merge .git/rebase-apply` |
| **Want to finish rebase after fixing conflicts** | Conflict markers resolved, ready to advance | `git add <files> && git rebase --continue` |
| **Rebase already finished or aborted but HEAD is detached** | `HEAD` points to a commit hash instead of branch | `git checkout <branch-name>` |

## Root Cause & Technical Mechanics

When you run `git rebase` (or `git rebase -i`), Git detaches `HEAD` from your branch and replays each commit sequentially onto the new base. To track progress across pauses, Git writes state files inside `.git/rebase-merge/` (for interactive and merge-backend rebases) or `.git/rebase-apply/` (for `git am` and legacy apply-backend rebases). These directories store `head-name`, `orig-head`, `onto`, and the `git-rebase-todo` script.

If a terminal crashes, a disk fills up, or an IDE plugin deletes half of those tracking files, Git enters a split-brain state: your shell prompt (such as `git-prompt.sh` or Oh My Zsh) detects the presence of `.git/rebase-merge` and displays `REBASE`, while `git rebase --abort` checks for specific files inside that directory (like `orig-head`), fails to find them, and throws `fatal: No rebase in progress?`.

## Step-by-Step Solution

### Step 1: Inspect the repository state and `.git` tracking folders

Before deleting anything, check what Git thinks is happening and whether `.git/rebase-merge` or `.git/rebase-apply` exists:

```bash
git status
ls -la .git/ | grep rebase
```

If `git status` clearly states `You are currently rebasing branch 'feature' on '...'`, a standard abort will work cleanly.

### Step 2: Try a clean abort first

Run the built-in abort command to restore `HEAD` and your branch pointer to `orig-head`:

```bash
git rebase --abort
```

Verify that your working tree is back on your original branch:

```bash
git status
git log -n 3 --oneline
```

### Step 3: Clear a phantom rebase (`fatal: No rebase in progress?`)

If `git rebase --abort` fails with `fatal: No rebase in progress?` while your prompt still shows `REBASE`, inspect the contents of `.git/rebase-merge` or `.git/rebase-apply` and remove the stale directory:

```bash
cat .git/rebase-merge/orig-head 2>/dev/null
rm -rf .git/rebase-merge .git/rebase-apply
```

If `HEAD` was left detached on an intermediate commit, use `git reflog` to locate the exact commit your branch pointed to before the rebase started, then reset back to it:

```bash
git reflog -n 10
git checkout main   # or your feature branch
git reset --hard <pre-rebase-commit-hash>
```

Confirm the repository is completely clean:

```bash
git status
```

### Step 4: Complete the rebase instead of aborting (optional)

If you actually want to finish the rebase after resolving conflicts in your editor:

```bash
git diff --name-only --diff-filter=U   # list remaining unmerged files
git add path/to/resolved-file
git rebase --continue
```

If a replayed commit becomes empty because its changes are already upstream, run `git rebase --skip`.

## Frequently Asked Questions

**Will `rm -rf .git/rebase-merge` delete my committed code?**
No. Removing `.git/rebase-merge` only deletes rebase progress metadata. Your commits remain safely stored in `.git/objects` and reachable via `git reflog` for at least 30–90 days by default.

**Why did `git rebase --abort` leave untracked files behind?**
`git rebase --abort` restores tracked files to `orig-head`, but any brand-new untracked files you created manually during conflict resolution stay in the working directory. Run `git clean -fd` only if you are sure you want to discard them.

**What is the difference between `.git/rebase-merge` and `.git/rebase-apply`?**
Modern Git uses the `ort` merge backend (`.git/rebase-merge`) by default for `git rebase`. Older versions or `git rebase --apply` / `git am` use `.git/rebase-apply`.

## Prevention Advice

- **Create a safety branch before complex rebases:** Run `git branch backup-before-rebase` so you have an instant pointer to return to if a 20-commit rebase goes sideways.
- **Avoid running two Git GUIs simultaneously:** Background IDE Git extensions can lock `.git/index.lock` or race with CLI rebases.
- **Enable `rerere` (Reuse Recorded Resolution):** Run `git config --global rerere.enabled true` so Git remembers how you resolved recurring conflicts during multi-step rebases.
- **Abort cleanly instead of closing the terminal:** Always run `git rebase --abort` before switching tasks or branches.

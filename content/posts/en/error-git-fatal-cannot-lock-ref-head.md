---
title: '[FIXED] Error ''fatal: cannot lock ref'' in Git'
description: >-
  Git returning 'cannot lock ref' or 'unable to update local ref' during pull or
  fetch? Step-by-step resolution to clear stale locks.
category: Web & Code
tags:
  - Git
  - GitHub
  - DevOps
readTime: 5 min
date: '2026-08-20'
---

Seeing `error: cannot lock ref 'refs/remotes/origin/main': is at <hash1> but expected <hash2>` or `fatal: cannot lock ref 'HEAD': unable to resolve reference` during `git pull`, `git fetch`, or `git commit` indicates that Git's atomic reference update failed. Either a stale `.lock` file was left behind by an interrupted process, a remote branch was force-pushed/deleted out of sync with your local tracking cache, or two branches collide on a case-insensitive filesystem.

## Quick Diagnostics

| Symptom / Cause | Immediate Action |
|---|---|
| **Stale remote-tracking refs after branch deletion** | Prune stale refs: `git remote prune origin` or `git fetch --prune` |
| **Leftover `.lock` file from crashed IDE or terminal** | Remove lock files under `.git/refs/` after ensuring Git isn't running |
| **Case-sensitivity collision (`Feature` vs `feature`)** | Pack refs with `git pack-refs --all --prune` on Windows/macOS |
| **Corrupted loose ref file (0-byte or bad SHA)** | Remove the broken loose ref and re-fetch from `origin` |

## Root Cause & Technical Mechanics

Git stores branch pointers as plain-text files containing a 40-character SHA-1 (or 64-character SHA-256) commit hash inside `.git/refs/heads/` (local branches) and `.git/refs/remotes/origin/` (remote-tracking branches), or consolidated inside `.git/packed-refs`. To guarantee atomic updates and prevent race conditions, Git creates a temporary `<refname>.lock` file via `O_CREAT | O_EXCL` before modifying any reference, compares the current SHA against the expected parent SHA, writes the new hash, and renames the lock file over the target.

That atomic transaction breaks under four specific conditions:
1. **Orphaned Lock Files:** If VS Code, JetBrains, or a terminal `git fetch` is killed mid-operation (SIGKILL, power loss, or OOM), `<ref>.lock` remains on disk and blocks all future updates to that branch.
2. **File-vs-Directory Namespace Conflicts:** Git cannot simultaneously store a ref named `refs/remotes/origin/feature` (a file) and `refs/remotes/origin/feature/login` (a directory) when using the traditional `files` ref backend. If a remote branch `feature` was deleted and replaced with `feature/login`, local `git fetch` fails to lock `refs/remotes/origin/feature/login`.
3. **Case-Insensitive Filesystems:** On Windows (NTFS) and macOS (APFS), `refs/remotes/origin/Main` and `refs/remotes/origin/main` map to the same file path, causing expected-hash mismatches.
4. **Corrupted Loose Ref or `HEAD`:** An unexpected shutdown during `git commit` can leave `.git/refs/heads/<branch>` empty (0 bytes) or malformed.

## Step-by-Step Solution

### 1. Prune Stale Remote-Tracking Branches
First, clean up deleted remote branches and namespace collisions (`feature` vs `feature/sub`) using `--prune`:
```bash
git remote prune origin
git fetch --prune origin
```

### 2. Remove Stale `.lock` Files Safely
Ensure no background Git process or IDE auto-fetch is actively running (`ps aux | grep git` on Linux/macOS), then remove leftover `.lock` files:
```bash
# Inspect existing lock files before deleting
find .git -name "*.lock" -type f

# Remove stale ref locks
find .git/refs -name "*.lock" -type f -delete
rm -f .git/HEAD.lock .git/packed-refs.lock
```

### 3. Resolve Case-Sensitivity or Corrupted Loose Refs
If `git fetch` still reports `is at <hashA> but expected <hashB>` due to case-insensitive branch names on Windows/macOS, pack all loose refs into `.git/packed-refs`:
```bash
git pack-refs --all --prune
git fetch --prune origin
```

If a specific remote-tracking ref file is corrupted (0 bytes or unreadable), delete only that remote-tracking pointer and re-fetch:
```bash
# Example for origin/main
git update-ref -d refs/remotes/origin/main
git fetch origin
```

### 4. Verify Repository Integrity
Run Git's built-in object and reference check to confirm everything resolves cleanly:
```bash
git fsck --full
git status
```

## Frequently Asked Questions

**Is it safe to delete `.git/index.lock` or `.git/refs/**/*.lock`?**
Yes, *only* after confirming no `git` process (including your IDE's built-in Git extension) is currently executing a commit, rebase, or fetch. Deleting a lock file while Git is actively writing can corrupt the index.

**Why does `cannot lock ref` keep coming back every few minutes in VS Code?**
VS Code's `git.autofetch` feature runs `git fetch` in the background. If you run `git pull` manually at the exact same moment, both processes race for `refs/remotes/origin/*`. Setting `"git.autofetch": "all"` with a longer interval or pausing background fetch during heavy rebases prevents this.

**Can Git's newer `reftable` format prevent case and directory-vs-file ref collisions?**
Yes. Repositories initialized or migrated to Git 2.45+ `--ref-format=reftable` store references in binary tables instead of filesystem paths, eliminating `feature` vs `feature/login` and case-sensitivity lock errors.

## Prevention Advice

* Always run `git fetch --prune` (or set `git config --global fetch.prune true`) so deleted remote branches never linger and collide with new nested branch names.
* Enforce consistent lowercase branch naming conventions (`feature/auth-fix` rather than `Feature/Auth-Fix`) across teams working on Windows/macOS and Linux.
* Avoid killing terminal `git` commands with `kill -9` or closing the laptop lid mid-fetch.

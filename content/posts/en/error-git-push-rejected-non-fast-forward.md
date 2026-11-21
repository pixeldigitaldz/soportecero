---
title: "How to Fix 'git push rejected non-fast-forward' Error Safely"
description: "Learn how to resolve Git push rejection errors caused by divergent commit histories safely using git pull --rebase without breaking remote history."
category: "Web & Code"
tags: ["Git", "GitHub", "DevOps"]
readTime: "5 min"
date: "2026-07-27"
---

The error `! [rejected] main -> main (non-fast-forward)` accompanied by `error: failed to push some refs` occurs when you attempt to push local commits to a remote branch, but the remote tracking ref points to a commit that is not an ancestor of your local `HEAD`. By default, Git refuses to overwrite remote history with a non-fast-forward update so that teammates' commits are not silently orphaned.

## Quick Diagnostics

| Symptom / Cause | Verification | Immediate Fix |
|---|---|---|
| Remote branch has new commits from teammates or CI bots | `git fetch origin && git log HEAD..origin/main --oneline` | Run `git pull --rebase origin main` |
| Local history was rewritten via `commit --amend` or `rebase -i` | `git log --graph --oneline --left-right HEAD...origin/main` | Use `git push --force-with-lease origin <branch>` on feature branches |
| Remote branch has force-push protection enabled | Check repository branch rules on GitHub/GitLab | Rebase onto `origin/main` and push fast-forward, or open a PR |

## Root Cause & Technical Mechanics

In Git's Directed Acyclic Graph (DAG), a **fast-forward** push is only possible when the current remote branch tip (`origin/main`) is a direct ancestor of your local `HEAD`. In that linear case, advancing the remote pointer simply moves the ref forward without discarding any reachable commits.

A **non-fast-forward** rejection happens when both branches have diverged from a common ancestor:

- **Concurrent pushes:** Another developer merged a pull request or pushed directly to the branch after your last pull.
- **Automated CI commits:** Release bots or formatting workflows committed directly to the remote branch.
- **Local history rewriting:** You ran `git commit --amend`, `git reset`, or `git rebase` on already-pushed commits, changing their SHA hashes while the remote still holds the originals.

When `receive.denyNonFastForwards` is active (or enforced by Git's default push rules), the remote `git-receive-pack` process aborts the ref update before linking any objects.

## Step-by-Step Solution

### Step 1: Inspect the Divergence Before Modifying History

First, update your remote-tracking references without touching your working tree, then inspect the commits that exist on each side of the merge base:

```bash
git fetch origin
git log --oneline --graph --left-right HEAD...origin/main
```

Commits prefixed with `<` exist only in your local branch, while commits prefixed with `>` exist only on `origin/main`. Verify your working tree is clean with `git status` (stash uncommitted work with `git stash push -m "wip"` if needed).

### Step 2: Replay Local Commits with Rebase

To keep a clean, linear history without extra merge commits, replay your local commits on top of the latest remote tip:

```bash
git pull --rebase origin main
```

If you already ran `git fetch origin`, you can run `git rebase origin/main` directly. Git temporarily lifts your local commits, fast-forwards your branch pointer to `origin/main`, and re-applies each local commit sequentially.

### Step 3: Resolve Any Rebase Conflicts

If both local and remote commits modified the same lines, Git pauses the rebase and marks the affected files. Resolve the conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`), then stage and continue:

```bash
git add path/to/resolved-file
git rebase --continue
```

If you need to cancel and return to the exact pre-rebase state, run `git rebase --abort`.

### Step 4: Push and Verify the Fast-Forward Update

Confirm your local branch is strictly ahead of `origin/main` and push:

```bash
git status -sb
git push origin main
```

`git status -sb` should report `[ahead N]` with no `behind` count. If you rewrote history on a **personal feature branch** (never `main`), update the remote safely with:

```bash
git push --force-with-lease origin feature/my-branch
```

## Frequently Asked Questions

### What is the difference between `git pull --rebase` and `git pull` (merge)?
A standard `git pull` performs a three-way merge and creates a new merge commit tying both divergent histories together. `git pull --rebase` re-creates your unpushed commits on top of the remote tip, producing a linear history that is easier to bisect and review.

### Why is `--force-with-lease` safer than `--force`?
`git push --force` unconditionally overwrites the remote ref regardless of what is currently there. `--force-with-lease` checks that the remote ref still matches your last fetched `origin/<branch>` hash; if someone else pushed new commits in the meantime, Git rejects the push instead of wiping their work.

### Can I recover if I accidentally ran `git push --force`?
If you still have the old commit hash in your local `git reflog` or your teammate's local clone, you can restore it. Otherwise, you must contact your Git host's support or check server-side activity logs/events to retrieve the dangling commit SHA.

## Prevention Advice

- **Enable `pull.rebase` globally:** Run `git config --global pull.rebase true` so routine pulls avoid unnecessary merge commits.
- **Protect shared branches:** Enable branch protection rules on `main`, `master`, and `release/*` in GitHub or GitLab to block force pushes and require pull requests.
- **Fetch before amending:** Always run `git status` or `git log @{u}..HEAD` to confirm a commit has not been pushed before running `git commit --amend`.
- **Keep feature branches short-lived:** Sync frequently with `origin/main` to minimize conflict surface area.

---
title: How to Fix 'Corrupt loose object' Error in Local Git Repositories
description: >-
  Resolve loose object corruption in your .git directory by recovering damaged
  files from the commit history of your remote repository.
category: Web & Code
tags:
  - Git
  - Web
  - Programming
readTime: 5 min
date: '2026-07-13'
---

The error `error: object file .git/objects/XX/YYYY... is empty` or `fatal: loose object ... is corrupt` occurs when Git's local content-addressable object database contains a truncated, zero-byte, or checksum-invalid file. Until that damaged object is purged and replaced, commands like `git status`, `git commit`, and `git pull` refuse to run.

## Quick Diagnostics

| Symptom / Cause | Verification | Immediate Fix |
|---|---|---|
| Zero-byte loose object after power loss or crash | `find .git/objects -type f -empty` | Delete empty objects and run `git fetch --all` |
| Corrupt non-empty object failing zlib/SHA check | `git fsck --full` | Remove reported object file and fetch from remote |
| Branch ref (`HEAD`) pointing to missing commit | `cat .git/HEAD` & `git show-ref` | Reset ref to `origin/<branch>` via `git update-ref` |
| Unpushed local commits exist in corrupt repo | `git reflog` / `ls -la .git/objects` | Back up `.git` first, then recover from working tree |

## Root Cause & Technical Mechanics

Git stores every blob (file content), tree (directory listing), commit, and annotated tag as a compressed **loose object** inside `.git/objects/XX/YYYY...` (where `XX` is the first two hex characters of the SHA-1/SHA-256 hash and `YYYY...` is the remaining 38/62 characters), or bundled inside `.git/objects/pack/*.pack`.

Normally, Git writes objects atomically using temporary files and `rename()`. However, if your machine loses power, runs out of disk space, or experiences a kernel panic/BSOD before the filesystem flushes dirty page cache blocks to disk, the file entry in `.git/objects/` can be created with **0 bytes** or truncated `zlib` deflate streams.

When any Git command traverses the DAG or index, it reads the object, inflates it with `zlib`, and verifies its SHA hash. A zero-byte or truncated stream fails `inflate()` immediately, causing Git to abort with `corrupt loose object` to prevent propagating repository corruption.

## Step-by-Step Solution

### Step 1: Back Up Your Repository Before Deleting Anything

Before modifying `.git/`, create a safety copy of the entire repository folder (including hidden `.git` files) so you never lose uncommitted working tree changes:

```bash
cp -a /path/to/my-repo /path/to/my-repo-backup
cd /path/to/my-repo
```

### Step 2: Locate All Empty or Corrupt Objects

First, scan `.git/objects/` for zero-byte files, and run `git fsck --full` to identify every damaged object hash:

```bash
find .git/objects -type f -empty
git fsck --full
```

Take note of every path printed (for example, `.git/objects/8f/c3a91e...`).

### Step 3: Remove the Damaged Loose Objects

Delete the empty or corrupt object files reported in Step 2 (never delete `.git/objects/pack/` files unless you have confirmed they are corrupt):

```bash
# Delete all 0-byte loose objects safely
find .git/objects -type f -empty -delete

# Or remove a specific corrupt object flagged by git fsck
rm -f .git/objects/8f/c3a91e...
```

### Step 4: Restore Missing Objects From the Remote Repository

Fetch all objects and refs from `origin` so Git re-downloads valid copies of the missing hashes (use `--force` if `origin` assumes you already have them):

```bash
git fetch --all --prune
```

### Step 5: Repair Broken Branch Pointers and Verify Integrity

Run `git fsck --full` again to confirm zero corrupt objects remain:

```bash
git fsck --full
```

If `HEAD` or your branch ref was truncated, reset it to the remote tracking commit without touching working files (`rm -f .git/index && git reset` also rebuilds a corrupt index):

```bash
git update-ref refs/heads/main origin/main
git status
```

## Frequently Asked Questions

### What if the corrupt object belonged to an unpushed local commit?
If the damaged object was never pushed to `origin`, `git fetch` cannot restore it. Your best option is to copy your current working tree files out of the repo, clone a fresh copy from `origin`, and copy your modified files back in to create a clean commit.

### Can `git gc` or `git prune` fix a corrupt loose object?
No. Both `git gc` and `git prune` abort when encountering corrupt objects to avoid deleting reachable data. You must manually remove the corrupt loose file and fetch from a healthy remote or backup first.

### Why did `git fsck` report "dangling blob" or "dangling commit" after recovery?
Dangling objects are normal—they are simply unreferenced snapshots left behind by past `git commit --amend`, `git rebase`, or `git stash` operations. They are not errors and are automatically cleaned up later by `git gc`.

## Prevention Advice

- **Push work-in-progress commits frequently:** Pushing to a personal feature branch on GitHub/GitLab ensures an off-machine copy of every object hash.
- **Avoid hard power-offs during Git I/O:** Never force-shutdown a VM or laptop while `git clone`, `git checkout`, or `git gc` is actively writing to `.git/objects`.
- **Monitor disk space and SMART health:** Running at 100% disk capacity is a leading cause of zero-byte loose objects and truncated `.git/index` files.
- **Use a UPS on local workstations/servers:** Uninterruptible power supplies prevent dirty filesystem buffers from leaving half-written `.git` metadata.

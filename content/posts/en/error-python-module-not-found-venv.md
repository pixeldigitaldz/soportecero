---
title: "How to Fix Python ModuleNotFoundError inside Virtualenv / Venv"
description: "Comprehensive guide to fixing ModuleNotFoundError in Python virtual environments (venv/virtualenv), IDE interpreter selection, and package isolation."
category: "Web & Code"
tags: ["Python", "Virtualenv", "Programming"]
readTime: "5 min"
date: "2026-07-27"
---

The exception `ModuleNotFoundError: No module named '...'` inside a Python `venv` or `virtualenv` project occurs when the Python interpreter executing your script differs from the interpreter where `pip` installed the package—leaving your target library absent from the active `sys.path`.

## Quick Diagnostics

| Symptom / Cause | Immediate Action |
|---|---|
| **`which python` points to `/usr/bin/python3` instead of `venv/bin/python`** | Activate the venv: `source .venv/bin/activate` |
| **`pip install` wrote to global site-packages instead of venv** | Install strictly via `python -m pip install <package>` |
| **Works in terminal, fails in VS Code / PyCharm "Run"** | Select the `.venv` interpreter in IDE settings |
| **Virtualenv copied/moved to another folder** | Recreate the venv; shebangs in `bin/pip` hardcode absolute paths |

## Root Cause & Technical Mechanics

A Python virtual environment (`python3 -m venv .venv`) works by creating an isolated directory tree containing a `pyvenv.cfg` file, a symlinked `python` binary, and its own `lib/python3.x/site-packages/` directory. When you invoke `.venv/bin/python`, Python detects `pyvenv.cfg` next to the binary and restricts `sys.path` to that environment's `site-packages` (excluding global system packages unless `--system-site-packages` was passed).

The trap happens when `PATH` resolution decouples `python` from `pip`. For example:
- You open a new terminal tab and run `python app.py` without re-activating `.venv`, hitting system Python.
- You run bare `pip install requests`, which resolves to `/usr/local/bin/pip` (Python 3.11) while `python3` resolves to Python 3.12.
- You run `sudo python app.py`, which resets `$PATH` and executes as system root Python.
- You renamed the project folder, breaking the hardcoded `#!` shebang on line 1 of `.venv/bin/pip`.

## Step-by-Step Solution

### Step 1: Verify which Python and pip binaries are actually executing

Inspect the exact executable paths and `sys.path` in your current shell:

```bash
which python python3 pip
python -c "import sys; print(sys.executable); print(sys.path)"
```

If `sys.executable` does not point inside your project's `.venv` or `venv` directory, activate it first:

```bash
# Linux / macOS
source .venv/bin/activate

# Windows PowerShell
.\.venv\Scripts\Activate.ps1
```

### Step 2: Install packages using `python -m pip`

Always invoke `pip` as a module of the active Python binary rather than calling a standalone `pip` executable:

```bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Verify the missing package is present in the exact interpreter's `site-packages`:

```bash
python -m pip show requests
python -c "import requests; print(requests.__file__)"
```

`requests.__file__` must print a path inside `.venv/lib/python.../site-packages/`.

### Step 3: Fix IDE interpreter mismatches (VS Code & PyCharm)

If your terminal works but pressing **Run** in your editor throws `ModuleNotFoundError`:
- **VS Code:** Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`), run **`Python: Select Interpreter`**, and pick `./.venv/bin/python` (or `.\.venv\Scripts\python.exe`). Also check that Code Runner extensions are not invoking global `python3 -u`.
- **PyCharm:** Open **Settings** → **Project** → **Python Interpreter** → **Add Interpreter** → **Existing**, and browse to `.venv/bin/python`.

### Step 4: Rebuild a broken or relocated virtual environment

If you moved or renamed your project directory, recreate `.venv` cleanly:

```bash
deactivate 2>/dev/null || true
rm -rf .venv
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

## Frequently Asked Questions

**Why did `ModuleNotFoundError` happen for one of my own local `.py` files?**
If you run `python subdir/script.py`, Python adds `subdir/`—not the project root—to `sys.path[0]`. Run your code as a module from the project root instead: `python -m subdir.script`, and ensure `__init__.py` exists in package folders.

**Why does `sudo python script.py` trigger `ModuleNotFoundError` even when the venv is active?**
`sudo` strips user environment variables including `$PATH` and `$VIRTUAL_ENV`, falling back to `/usr/bin/python3`. If root privileges are genuinely required, call the venv binary by full path: `sudo ./.venv/bin/python script.py`.

**Can I share one `venv` across multiple projects?**
Technically yes, but it causes dependency version conflicts quickly. Keep one `.venv` per project or use **uv** / **Poetry** for deterministic lockfiles.

## Prevention Advice

- **Always use `python -m pip`:** Never rely on bare `pip` or `pip3` commands when multiple Python versions exist on the machine.
- **Keep `requirements.txt` or `pyproject.toml` updated:** Run `python -m pip freeze > requirements.txt` (or use `uv`/`Poetry`) so environments can be rebuilt in seconds.
- **Add `.venv/` to `.gitignore`:** Never commit virtual environments to Git—recreate them per machine.
- **Avoid `sudo pip install`:** Installing packages globally with `sudo` pollutes OS Python dependencies managed by `apt`/`dnf`.

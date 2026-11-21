---
title: "How to Fix 'Permission Denied' on /var/run/docker.sock Without Sudo"
description: "Learn how to fix permission errors when running Docker commands without sudo by properly adding your user to the docker group in Linux."
category: "Systems & Servers"
tags: ["Docker", "Linux", "Permissions"]
readTime: "5 min"
date: "2026-07-26"
---

The error `permission denied while trying to connect to the Docker daemon socket at unix:///var/run/docker.sock` appears when you invoke the Docker CLI as an unprivileged user without `sudo`. Because the Docker daemon (`dockerd`) runs as `root` and exposes its REST API over a local UNIX domain socket, the Linux kernel blocks `connect()` syscalls from any user outside the `docker` group.

## Quick Diagnostics

| Symptom / Cause | Immediate Action |
|---|---|
| **User not in the `docker` UNIX group** | Add user with `sudo usermod -aG docker $USER` |
| **Group added, but current shell session is stale** | Refresh active groups with `newgrp docker` or re-login |
| **`~/.docker` config directory owned by `root`** | Fix ownership: `sudo chown -R "$USER":"$USER" ~/.docker` |
| **Rootless Docker socket mismatch (`DOCKER_HOST`)** | Check `echo $DOCKER_HOST` and `docker context ls` |

## Root Cause & Technical Mechanics

The Docker Engine uses a client-server architecture. The `docker` CLI binary does not start containers directly; instead, it serializes commands into HTTP requests sent over the UNIX socket `/var/run/docker.sock`. By default, `systemd` socket activation (`docker.socket`) creates `/var/run/docker.sock` with mode `0660` (`srw-rw----`) and ownership `root:docker`.

Under POSIX discretionary access control (DAC), read and write permissions on a UNIX domain socket are required to open a connection. While `root` always passes this check (which is why `sudo docker ps` succeeds), an ordinary user's process credentials only pass if their supplementary group list (`groups`) includes the GID of `docker`.

A second, frequently overlooked cause occurs when a developer previously ran `sudo docker login` or `sudo docker buildx`. That creates `~/.docker/` owned by `root:root`, causing subsequent non-root Docker commands to fail when reading `config.json` or Buildx state.

## Step-by-Step Solution

### 1. Verify Socket Ownership and Group Membership
Check the current permissions on the Docker socket and your user's active groups:
```bash
ls -l /var/run/docker.sock
id
```
The socket should display `srw-rw---- 1 root docker`. If `docker` is missing from your `id` output, proceed to Step 2.

### 2. Create the `docker` Group and Add Your User
Ensure the `docker` group exists and append your current username (`-aG` preserves existing groups):
```bash
sudo groupadd -f docker
sudo usermod -aG docker "$USER"
```

### 3. Refresh Your Session Credentials
Linux evaluates group memberships only at login time. Apply the new group immediately in your current terminal without rebooting:
```bash
newgrp docker
```
*(Note: `newgrp` spawns a subshell for the current terminal tab. For GUI IDEs like VS Code or desktop sessions, log out and log back in so every child process inherits the updated GID.)*

### 4. Repair `~/.docker` Ownership (If Needed)
If you previously ran Docker commands with `sudo` and still see permission errors on `~/.docker/config.json`:
```bash
sudo chown -R "$USER":"$USER" "$HOME/.docker"
sudo chmod -R g+rwx "$HOME/.docker"
```

### 5. Verify Unprivileged Execution
Run a non-root container check and inspect the active Docker context:
```bash
docker context ls
docker run --rm hello-world
```
If `hello-world` pulls and prints its confirmation banner without `sudo`, socket permissions are fixed.

## Frequently Asked Questions

**Why is `chmod 666 /var/run/docker.sock` or `chmod 777` dangerous?**
Any user who can write to `/var/run/docker.sock` can bind-mount `/` from the host into a privileged container (`docker run -v /:/host alpine`) and gain instant root access. Never make the Docker socket world-writable.

**I added my user to `docker` and ran `newgrp docker`, so why does VS Code still show `permission denied`?**
`newgrp` only updates the shell where you ran it. Background desktop processes and IDE terminals started before the change still hold the old group token until you fully log out of your desktop session or reboot.

**How do I check if I am accidentally pointing to Rootless Docker?**
Run `env | grep DOCKER_HOST`. If it points to `/run/user/1000/docker.sock` while you are trying to use the system daemon (or vice versa), unset `DOCKER_HOST` or switch with `docker context use default`.

## Prevention Advice

* Use **Rootless Docker** (`dockerd-rootless-setuptool.sh install`) on multi-tenant servers so containers run inside an unprivileged user namespace rather than granting `docker` group root-equivalent access.
* Never prefix `docker` commands with `sudo` once your user is in the `docker` group, as doing so can recreate root-owned files inside `$HOME/.docker`.
* In CI/CD environments (GitHub Actions, GitLab Runner), add the dedicated runner service account (`gitlab-runner`) to the `docker` group during provisioning.

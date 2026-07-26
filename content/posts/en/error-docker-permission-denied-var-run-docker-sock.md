---
title: "How to Fix 'Permission Denied' on /var/run/docker.sock Without Sudo"
description: "Learn how to fix permission errors when running Docker commands without sudo by properly adding your user to the docker group in Linux."
category: "Systems & Servers"
tags: ["Docker", "Linux", "Permissions"]
readTime: "3 min"
date: "2026-07-26"
---

The error `permission denied while trying to connect to the Docker daemon socket at unix:///var/run/docker.sock` occurs when you attempt to run Docker commands without `sudo` and your current Linux user account does not belong to the group authorized to access the Docker UNIX socket.

## 🔍 Quick Diagnostics

| Symptom | Root Cause | Solution |
| :--- | :--- | :--- |
| **Permission Denied** when connecting to socket (`unix:///var/run/docker.sock`) | Current Linux user is not a member of the `docker` system group | Add user to `docker` group with `usermod` and refresh session |

## 🚀 How to Fix the Error Step-by-Step

### Step 1: Create the Docker Group and Add Your User

Check if the `docker` group exists on your system and add your current user using `usermod`:

```bash
# Create docker group if it doesn't already exist
sudo groupadd docker

# Add your active user ($USER) to the docker group
sudo usermod -aG docker $USER
```

### Step 2: Apply Group Membership Changes to Current Session

For group changes to take effect immediately without rebooting or logging out entirely, execute:

```bash
newgrp docker
```

Alternatively, if connected via SSH or a desktop terminal, log out of your session and log back in.

### Step 3: Verify /var/run/docker.sock Ownership and Test

Ensure that `/var/run/docker.sock` is owned by the `docker` group:

```bash
ls -l /var/run/docker.sock
```

*(Output should indicate ownership such as `root:docker` with `srw-rw----` permissions).*

Test running a Docker container without `sudo`:

```bash
docker run hello-world
```

## 🛡️ Prevention Advice

- **Avoid using `chmod 777` on the socket file**: Never grant world-writable permissions to `/var/run/docker.sock`, as doing so gives unprivileged users full root access to the host system.
- **Consider Rootless Docker**: In high-security environments, evaluate setting up Rootless Docker mode to run the daemon and containers inside a non-root user namespace.
- **Configure CI/CD Runner Permissions**: Ensure automated build runners (such as GitHub Actions self-hosted runners or GitLab Runners) are assigned to the `docker` group on the host.

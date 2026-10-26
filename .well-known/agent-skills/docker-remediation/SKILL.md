# Docker Container Remediation

Resolve Docker daemon, networking, volume permissions, cache compute failures, and container exit codes (such as 137 OOMKiller).

## When to Use

Use this skill when Docker build or docker run fails, when port binding conflicts occur, or when containerized services cannot establish network communication.

## Requirements

- Check container exit code and inspect status with `docker ps -a` and `docker inspect <container>`.
- Check daemon logs using `journalctl -u docker.service`.
- Resolve file ownership on mounted volumes using `chown` or `chmod` permissions adjustments.
- Clean build caches or prune dangling volumes with `docker system prune`.

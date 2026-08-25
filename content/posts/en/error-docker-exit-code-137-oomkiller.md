---
title: "How to Fix Docker Exit Code 137 and OOMKilled Container Errors"
description: "Learn how to diagnose and resolve Docker exit code 137 caused by the Linux Out-Of-Memory (OOM) Killer and container memory limits."
category: "Systems & Servers"
tags: ["Docker", "Linux", "DevOps", "Docker Compose"]
readTime: "5 min"
date: "2026-09-02"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Container exceeded memory limit set in Docker** | Increase `mem_limit` in `docker-compose.yml` or add swap memory to host |
| **Process terminated by Linux kernel (OOM Killer SIGKILL 9)** | Optimize application garbage collector and inspect logs using `dmesg -T` |

Docker `Exit Code 137` indicates that a container was forcefully terminated by the system signal `SIGKILL` (signal 9, where 128 + 9 = 137). In 95% of production server environments, this occurs when a process inside the container consumes more RAM than allotted or exhausts system memory, forcing the Linux kernel **Out-Of-Memory (OOM) Killer** to terminate the container process.

## 🚀 Step-by-Step Solution

### Step 1: Verify if the container was terminated by OOMKilled
Before making configuration changes, inspect the container state metadata:
```bash
# Inspect container exit state and OOMKilled flag
docker inspect <container_name_or_id> --format="{{.State.ExitCode}} - OOMKilled: {{.State.OOMKilled}}"
```
If the output displays `137 - OOMKilled: true`, the failure is definitively caused by memory exhaustion. You can also inspect kernel message logs:
```bash
# Search host system logs for OOM Killer invocations
sudo dmesg -T | grep -i -E "oom[- ]killer|killed process"
```

### Step 2: Adjust memory limits in Docker Compose
If your container service is defined inside `docker-compose.yml`, adjust resource allocations by increasing memory limits or adding reservations:
```yaml
services:
  my-service:
    image: my-app:latest
    deploy:
      resources:
        limits:
          memory: 2048M
        reservations:
          memory: 512M
    # For standard Compose v2 syntax without swarm mode:
    mem_limit: 2g
    mem_reservation: 512m
```

### Step 3: Configure runtime memory limits (Node.js / Java / Python)
When running managed runtimes, ensure the process heap limits match the container cgroup memory limits:
```bash
# For Node.js: Define maximum heap size (e.g. 1536MB in a 2GB container)
NODE_OPTIONS="--max-old-space-size=1536"

# For Java / JVM: Enable automated cgroup container memory support
JAVA_TOOL_OPTIONS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"
```

### Step 4: Recreate and monitor live resource consumption
Apply the configuration and observe real-time container metrics:
```bash
# Recreate the container stack
docker compose up -d --force-recreate

# Stream live container resource stats
docker stats --no-stream
```

## 🛡️ Prevention Advice
- **Set proactive alerts:** Configure monitoring tools such as Prometheus + Grafana or cAdvisor to identify memory leaks before a container hits 100% capacity.
- **Enable host Swap:** On low-resource VPS nodes, ensure swap memory is enabled to cushion sudden traffic spikes without immediate SIGKILL events.

## ❓ Frequently Asked Questions (FAQ)

### Does Exit Code 137 always mean out of memory?
Not 100% of the time, but in the vast majority of cases. Exit code 137 means a process received `SIGKILL` (9). This can also happen if you manually issue `docker kill` or if an orchestrator like Kubernetes forcefully stops a pod that failed to shut down gracefully within its grace period.

### How can I protect critical containers from being killed first?
You can set `oom_score_adj: -500` in advanced container settings to lower its priority score, ensuring auxiliary services are sacrificed before critical databases or primary backends.

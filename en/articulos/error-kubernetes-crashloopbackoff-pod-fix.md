---
title: "How to Fix CrashLoopBackOff Pod Status in Kubernetes"
description: "Learn how to diagnose and resolve CrashLoopBackOff status in Kubernetes Pods by inspecting logs, fixing OOMKilled issues, and configuring health probes."
category: "Systems & Servers"
tags: ["Kubernetes", "DevOps", "Docker"]
readTime: "4 min"
date: "2026-07-31"
---

The **CrashLoopBackOff** status in Kubernetes indicates that a container inside a Pod fails to start, crashes immediately, and enters a continuous loop of automatic restarts where Kubernetes exponentially increases the back-off delay between restart attempts.

## Quick Diagnostics

| Cause | Solution |
|---|---|
| **Pod stuck in `CrashLoopBackOff` status with high `RESTARTS` counter**: Application crash, missing environment variables, Out of Memory (`OOMKilled`), or failing `livenessProbe` | Inspect previous container logs with `kubectl logs --previous` and check events with `kubectl describe pod` |

## 🚀 How to Fix the Error Step-by-Step

### Step 1: Inspect the failure reason with kubectl describe

The primary command for gathering lifecycle details about the failing Pod is `kubectl describe`:

```bash
# Fetch detailed status of the target Pod
kubectl describe pod <pod-name> -n <namespace>
```

In the **Containers > State** and **Last State** sections, pay close attention to the following indicators:
- **Exit Code 1 or 127**: Application failure (unhandled runtime exception, missing file, or broken `CMD` path).
- **Exit Code 137 (OOMKilled)**: The container exceeded its strict memory limit (`limits.memory`) configured in the YAML manifest.
- **Liveness probe failed**: The configured health check failed to respond within the specified timeout.

### Step 2: Extract logs from the crashed container

To inspect standard output (`stdout`/`stderr`) right before the container crashed on its previous attempt, add the `--previous` flag:

```bash
# View logs from the previous container instance
kubectl logs <pod-name> --previous -n <namespace>

# If the Pod has multiple containers, specify the container name:
kubectl logs <pod-name> -c <container-name> --previous -n <namespace>
```

### Step 3: Adjust container memory limits (OOMKilled)

If the container was killed due to memory exhaustion (exit code 137), update your deployment manifest to allocate additional memory resources:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-service
spec:
  template:
    spec:
      containers:
      - name: my-app
        image: my-image:latest
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi" # Increase limit if OOMKilled occurs
            cpu: "500m"
```

Apply the changes:
```bash
kubectl apply -f deployment.yaml
```

### Step 4: Adjust or delay Liveness and Readiness Probes

If your application takes a long time to boot (such as performing database migrations on startup), the `livenessProbe` might kill the Pod prematurely. Increase `initialDelaySeconds`:

```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 30 # Give the application time to complete initialization
  periodSeconds: 10
  failureThreshold: 3
```

## 🛡️ Prevention Advice

- **Test container images locally**: Run the container locally using `docker run -it --rm <image>` with identical environment variables to verify that the entrypoint script executes cleanly.
- **Set realistic startup delays**: Heavy frameworks or Java applications require higher `initialDelaySeconds` (30-60s) to prevent false-positive restarts.
- **Validate ConfigMaps and Secrets**: Ensure all required environment variables and configuration files exist prior to triggering deployments.

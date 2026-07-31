---
title: "Cómo solucionar el estado CrashLoopBackOff en Pods de Kubernetes"
description: "Aprende a diagnosticar y solucionar el error CrashLoopBackOff en Kubernetes analizando logs, memoria OOMKilled, fallos en liveness probes y variables de entorno."
category: "Sistemas y Servidores"
tags: ["Kubernetes", "DevOps", "Docker"]
readTime: "4 min"
date: "2026-07-31"
---

El estado **CrashLoopBackOff** en Kubernetes indica que un contenedor dentro de un Pod falla al iniciarse, se interrumpe inmediatamente y entra en un ciclo continuo de reinicios automáticos donde Kubernetes incrementa de forma exponencial el tiempo de espera entre intentos.

## 🔍 El Diagnóstico Rápido

| Síntoma | Causa Raíz | Solución |
|---|---|---|
| Pod en estado `CrashLoopBackOff` con incremento constante en la cuenta de `RESTARTS` | Error en la aplicación (código), falta de variables de entorno, falta de memoria (OOMKilled) o fallos en `livenessProbe` | Inspeccionar los logs con `kubectl logs --previous` y revisar eventos del sistema con `kubectl describe pod` |

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Inspeccionar la razón del fallo con kubectl describe

El primer comando para obtener contexto detallado sobre el ciclo de vida del Pod es `kubectl describe`:

```bash
# Obtener el estado detallado del Pod afectado
kubectl describe pod <nombre-del-pod> -n <namespace>
```

En la sección **Containers > State** y **Last State**, presta especial atención a los siguientes indicadores:
- **Exit Code 1 o 127**: Error de aplicación (código defectuoso, comando `CMD` no encontrado o archivo faltante).
- **Exit Code 137 (OOMKilled)**: El contenedor superó el límite estricto de memoria (`limits.memory`) asignado en el manifiesto YAML.
- **Liveness probe failed**: Las pruebas de salud configuradas no responden dentro del tiempo límite establecido.

### Paso 2: Extraer los registros del contenedor (Logs)

Para ver la salida estándar (`stdout`/`stderr`) del contenedor antes de que fallara en el intento anterior, añade la bandera `--previous`:

```bash
# Leer los registros de la instancia anterior del contenedor
kubectl logs <nombre-del-pod> --previous -n <namespace>

# Si el Pod contiene múltiples contenedores, especifica el nombre del contenedor:
kubectl logs <nombre-del-pod> -c <nombre-del-contenedor> --previous -n <namespace>
```

### Paso 3: Corregir límites de recursos de memoria (OOMKilled)

Si el contenedor fue terminado por consumir más memoria de la permitida (código 137), edita tu deployment para ajustar los recursos:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mi-servicio
spec:
  template:
    spec:
      containers:
      - name: mi-app
        image: mi-imagen:latest
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi" # Incrementar si se detecta OOMKilled
            cpu: "500m"
```

Aplica la actualización con:
```bash
kubectl apply -f deployment.yaml
```

### Paso 4: Ajustar o postergar los Liveness y Readiness Probes

Si el servicio tarda más tiempo en inicializarse (por ejemplo, al ejecutar migraciones de base de datos), el `livenessProbe` puede matar el Pod prematuramente. Aumenta el parámetro `initialDelaySeconds`:

```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 30 # Dar tiempo a que el servicio complete el arranque
  periodSeconds: 10
  failureThreshold: 3
```

## 🛡️ Consejos de Prevención

- **Probar contenedores localmente**: Ejecuta la imagen de Docker localmente con `docker run -it --rm <imagen>` pasando las mismas variables de entorno para confirmar que el comando de inicio (`entrypoint`) funciona sin problemas.
- **Configurar `initialDelaySeconds` con margen suficiente**: Servicios Java o aplicaciones con cargas pesadas de inicio requieren tiempos de espera iniciales superiores a 30-60 segundos.
- **Usar ConfigMaps y Secrets validados**: Verifica que todas las variables requeridas por el software estén declaradas adecuadamente antes de desplegar.

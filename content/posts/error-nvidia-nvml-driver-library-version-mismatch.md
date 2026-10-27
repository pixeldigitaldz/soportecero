---
title: 'Solución Error Nvidia NVML: Driver/library version mismatch en Linux'
description: >-
  Soluciona el error 'Failed to initialize NVML: Driver/library version mismatch' al ejecutar nvidia-smi en Linux sin necesidad de reiniciar el servidor.
category: Sistemas y Servidores
tags:
  - Nvidia
  - Linux
  - GPU
  - Drivers
  - Ubuntu
  - Servidores
readTime: 5 min
date: '2026-10-26'
---

El error `Failed to initialize NVML: Driver/library version mismatch` ocurre frecuentemente en servidores y estaciones de trabajo Linux (especialmente en distribuciones basadas en Ubuntu y Debian) al ejecutar `nvidia-smi` o iniciar contenedores con Docker GPU. Esta incidencia se produce cuando una actualización del sistema (como `unattended-upgrades` o `apt upgrade`) actualiza las librerías en espacio de usuario (`libnvidia-*.so`), pero el módulo del kernel de Nvidia (`nvidia.ko`) que continúa cargado en memoria RAM corresponde a la versión previa.

## Diagnóstico Rápido

| Causa | Solución |
|---|---|
| **Discrepancia entre la versión del módulo cargado en el kernel y las librerías NVML en disco** | Descargar y recargar los módulos del kernel de Nvidia sin necesidad de reiniciar el sistema completo |
| **Procesos en segundo plano reteniendo el driver de la GPU (Docker, Xorg, Ollama, PyTorch)** | Identificar los identificadores de proceso (PID) activos con fuser o lsof y detenerlos temporalmente |
| **Múltiples versiones de drivers Nvidia instaladas simultáneamente en el gestor de paquetes** | Purgar paquetes residuales y mantener únicamente la versión LTS recomendada |

## La Solución Paso a Paso

### Paso 1: Comprobar la discrepancia de versiones entre el Kernel y NVML
Verifica la versión del módulo cargado en el kernel frente a la versión de la librería en espacio de usuario:

```bash
# Versión del módulo actualmente cargado en el kernel
cat /proc/driver/nvidia/version

# Versión de los paquetes y librerías instaladas en el sistema
dpkg -l | grep -i nvidia-utils
```

Si observas números de versión distintos (por ejemplo, el kernel corriendo `535.183.01` y el sistema habiendo actualizado a `535.183.06`), el driver requiere recargarse.

### Paso 2: Identificar y detener los procesos que consumen la GPU
Para poder descargar los módulos del kernel, ningún proceso puede estar interactuando con `/dev/nvidia*`:

```bash
# Listar los procesos que bloquean la GPU
sudo fuser -v /dev/nvidia* 2>/dev/null
```

Detén temporalmente los servicios que típicamente hacen uso de la tarjeta gráfica (contenedores Docker, gestores de interfaz gráfica o servidores de inferencia):

```bash
# Detener Docker y Ollama (o tu servicio de IA)
sudo systemctl stop docker
sudo systemctl stop ollama 2>/dev/null || true

# En caso de entornos de escritorio, detener el gestor de pantalla
sudo systemctl stop gdm3 2>/dev/null || sudo systemctl stop lightdm 2>/dev/null || true
```

Si quedan procesos residuales bloqueando el descriptor de archivo, finalízalos de forma forzada:

```bash
sudo fuser -k -9 /dev/nvidia* 2>/dev/null
```

### Paso 3: Descargar los módulos de Nvidia de la memoria del Kernel
Descarga en orden de dependencia inversa todos los módulos relacionados con Nvidia:

```bash
sudo rmmod nvidia_uvm
sudo rmmod nvidia_drm
sudo rmmod nvidia_modeset
sudo rmmod nvidia
```

Si el comando devuelve `rmmod: ERROR: Module nvidia is in use`, vuelve a verificar con `sudo lsof /dev/nvidia*` para cerrar el proceso restante.

### Paso 4: Recargar el módulo Nvidia actualizado
Una vez descargados los módulos anteriores, carga nuevamente el driver para que el kernel sincronice con las nuevas librerías:

```bash
sudo modprobe nvidia
sudo modprobe nvidia_modeset
sudo modprobe nvidia_uvm
sudo modprobe nvidia_drm
```

### Paso 5: Validar con nvidia-smi y reanudar servicios
Ejecuta la herramienta de telemetría de Nvidia para confirmar que la comunicación con NVML se ha restablecido:

```bash
nvidia-smi
```

Deberías ver de inmediato la tabla de telemetría de la GPU con el consumo, temperatura y la versión del driver sincronizada. Luego, reanuda tus servicios habituales:

```bash
sudo systemctl start docker
sudo systemctl start ollama 2>/dev/null || true
```

## Preguntas Frecuentes

### ¿Por qué ocurre este error automáticamente en servidores Ubuntu y Debian?
El paquete `unattended-upgrades` aplica parches de seguridad automáticamente durante la madrugada. Cuando el repositorio de Canonical o Nvidia publica una actualización menor del driver, `apt` instala los nuevos archivos binarios y librerías, pero no puede reiniciar el módulo del kernel en caliente sin intervención, generando el desfase.

### ¿Qué ocurre si no puedo detener el servidor para reiniciar?
El procedimiento de descarga y carga con `rmmod` y `modprobe` está diseñado específicamente para entornos de producción y clústeres de cálculo donde un reinicio del host físico no es factible o interrumpiría cargas de trabajo no vinculadas a la GPU.

### ¿Cómo puedo evitar que el driver de Nvidia se actualice sin mi consentimiento?
Puedes congelar la versión actual del driver utilizando el gestor de paquetes de tu distribución:

```bash
sudo apt-mark hold nvidia-driver-* nvidia-utils-*
```

## Consejos de Prevención

* Bloquea la actualización automática de drivers de GPU en entornos de producción mediante `apt-mark hold` para programar los upgrades de forma manual y controlada.
* Excluye los paquetes de Nvidia del archivo `/etc/apt/apt.conf.d/50unattended-upgrades` en la sección `Unattended-Upgrade::Package-Blacklist`.
* Configura alertas de monitoreo con Prometheus y `node_exporter` o `dcgm-exporter` para detectar caídas en la inicialización de NVML antes de que afecten a usuarios finales.

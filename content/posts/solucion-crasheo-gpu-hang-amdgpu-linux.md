---
title: "Cómo solucionar el error [drm:amdgpu_job_timedout] y congelamientos de GPU en Linux"
description: "¿Tu juego se congela en Linux y el log dmesg muestra [drm:amdgpu_job_timedout] ring gfx_0.0.0 timeout? Aprende a estabilizar drivers AMDGPU, Mesa y parámetros de kernel."
category: "Gaming Tech"
tags: ["Linux Gaming", "AMDGPU", "Mesa", "Vulkan", "Steam"]
readTime: "5 min"
date: "2026-09-24"
---

Durante sesiones intensas de juego en Linux bajo Proton, Wine o títulos nativos con **Vulkan**, muchos usuarios de tarjetas gráficas AMD Radeon (series RX 5000, 6000, 7000 o Steam Deck) experimentan congelamientos repentinos de pantalla seguidos del cierre inesperado del juego (*crash to desktop*). Al inspeccionar los registros del kernel mediante `dmesg`, el fallo queda registrado con el mensaje **`[drm:amdgpu_job_timedout] ring gfx_0.0.0 timeout`** seguido de un intento fallido de reinicio de hardware (*GPU reset failed*).

Este error ocurre cuando un trabajo gráfico encolado en los anillos de ejecución de la GPU excede el tiempo límite de respuesta del programador DRM del kernel Linux. Las causas más comunes incluyen inestabilidad en los perfiles de energía dinámica DPM de AMDGPU, desajustes de sincronización entre el compositor Wayland y los controladores Mesa RADV, o micro-caídas de voltaje durante picos de carga en trazado de rayos o shaders pesados.

## Diagnóstico Rápido

| Causa | Solución |
|---|---|
| **Gestión agresiva de frecuencias dinámicas (DPM) provocando cuelgues del anillo gfx** | Establecer el perfil de energía de la GPU en modo de rendimiento estable (`amdgpu.ppfeaturemask=0xffffffff`) y desactivar estados de suspensión profunda |
| **Conflicto de compilación de shaders en el driver Vulkan RADV** | Forzar el uso del compilador ACO de Mesa mediante la variable de entorno `RADV_DEBUG=nofastclears` o actualizar a la versión más reciente de controladores Mesa |

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Confirmar el error exacto en los registros del Kernel

Para comprobar si el bloqueo de tu sistema corresponde a un fallo del programador de AMDGPU, abre una terminal inmediatamente después del crasheo y filtra los mensajes del kernel:

```bash
# Filtrar registros de dmesg relacionados con amdgpu
sudo dmesg -T | grep -E "amdgpu_job_timedout|GPU reset|ring gfx"
```

Si el registro muestra salidas como:
```text
[drm:amdgpu_job_timedout [amdgpu]] *ERROR* ring gfx_0.0.0 timeout, signaled seq=...
[drm:amdgpu_device_gpu_recover [amdgpu]] *ERROR* GPU reset failed
```
Has confirmado que el hardware gráfico sufrió un GPU Hang y el kernel no pudo reiniciar el chip sin interrumpir la sesión gráfica.

### Paso 2: Ajustar parámetros del Kernel para estabilizar AMDGPU

En distribuciones como Arch Linux, Fedora, Ubuntu o Bazzite, los estados de suspensión dinámica agresiva (*clock gating*) pueden desestabilizar la tarjeta gráfica durante cambios bruscos de carga:

1. Abre el archivo de configuración del gestor de arranque con privilegios de administrador:
   ```bash
   sudo nano /etc/default/grub
   ```

2. Localiza la directiva `GRUB_CMDLINE_LINUX_DEFAULT` y añade al final de las comillas los siguientes parámetros:
   ```text
   amdgpu.dpm=1 amdgpu.runpm=0
   ```
   - `amdgpu.dpm=1`: Fuerza una gestión de energía dinámica controlada.
   - `amdgpu.runpm=0`: Desactiva la administración de energía en tiempo de ejecución (Run-time Power Management) que causa desincronización de voltaje en tarjetas dedicadas de escritorio.

3. Actualiza el gestor de arranque según tu distribución:
   ```bash
   # En Debian, Ubuntu y derivados:
   sudo update-grub

   # En Arch Linux, EndeavourOS y CachyOS:
   sudo grub-mkconfig -o /boot/grub/grub.cfg

   # En Fedora (sistemas UEFI):
   sudo grub2-mkconfig -o /etc/grub2-efi.cfg
   ```

### Paso 3: Configurar variables de entorno para Steam y Vulkan (Mesa RADV)

El compilador de shaders por defecto de Mesa (ACO) es extremadamente rápido, pero en ciertos juegos exigentes bajo DirectX 12 (VKD3D-Proton) puede generar primitivas gráficas complejas que disparan el tiempo de espera del shader engine.

Añade los siguientes parámetros de lanzamiento en las propiedades del juego en **Steam** (`Propiedades` -> `Parámetros de lanzamiento`):

```bash
RADV_DEBUG=noaccel,llvm %command%
```
O si buscas máxima estabilidad de renderizado en títulos DirectX 12:

```bash
VKD3D_CONFIG=no_upload_hwwrite,dxr11 %command%
```

### Paso 4: Desactivar la suspensión de enlace PCIe ASPM

Active State Power Management (ASPM) es una función de ahorro de energía del bus PCIe que reduce el voltaje del puerto cuando la tarjeta gráfica disminuye su uso. En placas base con configuraciones PCIe agresivas, el tiempo que tarda la GPU en volver al estado de pleno rendimiento puede exceder el límite del scheduler de AMDGPU:

Añade también a los parámetros del kernel en `/etc/default/grub`:
```text
pcie_aspm=off
```
Regenera la configuración de GRUB y reinicia el ordenador. Esto mantendrá el canal de comunicación del bus PCI Express despierto y receptivo al 100%.

## Consejos de Prevención

Prácticas de seguridad recomendadas:
- Actualiza periódicamente los paquetes de `mesa` y `vulkan-radeon` desde los repositorios oficiales o repositorios optimizados (como Kisak PPA en Ubuntu o Mesa-git).
- Comprueba que la fuente de alimentación (PSU) suministre cables PCIe independientes (12V) para cada conector de 8 pines de la GPU, evitando cables en puente (*pigtail*).
- Si realizaste overclock o undervolt con utilidades como CoreCtrl o TuxClocker, restablece las curvas de voltaje a valores de fábrica para descartar inestabilidad eléctrica.

## Preguntas Frecuentes

### ¿Este error significa que mi tarjeta gráfica está físicamente dañada?
En la inmensa mayoría de casos (más del 95%), este problema es estrictamente de software: desincronización de controladores, límites de tiempo de espera del scheduler de Linux o parámetros de ahorro energético del PCIe.

### ¿Ocurre este problema tanto en Wayland como en X11?
Sí, aunque en entornos Wayland recientes el uso de *Explicit Sync* (sincronización explícita introducida en Linux 6.8+ y Wayland Protocols 1.34) ha reducido drásticamente los cuelgues causados por sincronización implícita en controladores Mesa.

---
title: "Solución al crasheo por carga de texturas en Diablo IV bajo Linux (Proton)"
description: "Aprende a solucionar el error Out of Memory y los cierres al cargar texturas en Diablo IV jugando en Linux con Steam Proton y Battle.net."
category: "Gaming Tech"
tags: ["Diablo 4", "Proton", "Linux", "Gaming", "Vulkan", "VKD3D"]
readTime: "5 min"
date: "2026-06-25"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Saturación y fragmentación de VRAM al cargar texturas en calidad Ultra con VKD3D** | Reducir la calidad de texturas a Alta/Media y configurar `VKD3D_CONFIG=no_upload_hvv` |
| **Falta de memoria de intercambio (Swap) o agotamiento del límite de descriptores de archivos** | Asignar al menos 8GB de swap y aumentar los límites `fs.file-max` y `vm.max_map_count` |

El cierre inesperado de Diablo IV en Linux (a menudo con el error `Fenris Error` o `Out of Memory - The application ran out of video memory`) ocurre debido a la alta demanda de memoria de video (VRAM) y memoria RAM física que requiere el motor de Blizzard al cargar paquetes de texturas de alta resolución mediante la capa de traducción Direct3D 12 a Vulkan (VKD3D-Proton).

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Reducir la resolución de texturas a Alta o Media
El paquete de texturas Ultra de Diablo IV consume más de 16GB de VRAM en DirectX 12 nativo, lo que bajo Vulkan satura el asignador de memoria de la GPU:
1. En el menú de Diablo IV, ve a **Opciones > Gráficos**.
2. Cambia **Calidad de las texturas** de *Ultra* a **Alta** (o *Media* en GPUs con 8GB de VRAM o menos).
3. Desactiva la distorsión cromática y reduce la calidad de las sombras de contacto.

### Paso 2: Configurar parámetros de lanzamiento en Steam / Lutris
Añade variables de optimización para VKD3D y DXVK en las opciones de lanzamiento del juego:
```bash
# Parámetros recomendados para Diablo IV en Steam
VKD3D_CONFIG=no_upload_hvv PROTON_ENABLE_NVAPI=1 %command%
```
- `no_upload_hvv`: Evita que VKD3D agote el heap de memoria visible del host (Host Visible Video Memory) en GPUs modernas.

### Paso 3: Incrementar el límite de mapeo de memoria en el Kernel (max_map_count)
Diablo IV crea cientos de miles de asignaciones de memoria simultáneas que pueden superar el límite por defecto de Linux:
```bash
# Comprobar el valor actual
cat /proc/sys/vm/max_map_count

# Aumentar a 1048576 de forma temporal
sudo sysctl -w vm.max_map_count=1048576

# Hacerlo permanente en /etc/sysctl.d/99-gaming.conf
echo "vm.max_map_count = 1048576" | sudo tee /etc/sysctl.d/99-gaming.conf
sudo sysctl --system
```

### Paso 4: Utilizar la versión Proton GE (GloriousEggroll) más reciente
Proton Experimental o Proton GE contienen parches específicos para corregir fugas de memoria en VKD3D:
1. Instala **ProtonUp-Qt** y descarga la versión más reciente de **GE-Proton**.
2. En las propiedades de Diablo IV en Steam, ve a *Compatibilidad* y fuerza el uso de GE-Proton.

## 🛡️ Consejos de Prevención
- **Asegura al menos 8GB-16GB de Swap:** Los picos de carga en transiciones de mazmorras pueden provocar cierres inmediatos del proceso por el OOM Killer si no existe memoria de intercambio suficiente.
- **Mantén actualizados los drivers Mesa:** Si juegas con tarjetas AMD Radeon, utiliza Mesa 24.0+ para beneficiarte del asignador de memoria mejorado de RADV.

## ❓ Preguntas Frecuentes (FAQ)

### ¿El juego funciona fluidamente en Steam Deck?
Sí, en Steam Deck se recomienda configurar texturas en calidad Media, resolución nativa con FSR en modo Calidad y limitar la tasa de cuadros a 45 FPS para mantener temperaturas estables.

### ¿Qué significa el error Fenris en Diablo IV?
Es el gestor interno de excepciones y depuración de Blizzard. Cuando se produce un desbordamiento de búfer en la GPU o falla la reserva de memoria, Fenris genera un volcado y cierra el juego.

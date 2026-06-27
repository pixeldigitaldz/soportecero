---
title: "Cómo solucionar micro-tirones en World of Warcraft usando Proton-GE en Linux"
description: "Aprende a optimizar el rendimiento y eliminar los micro-tirones de imagen en WoW configurando Proton-GE y activando la compilación asíncrona de shaders."
category: "Gaming Tech"
tags: ["Gaming", "Linux", "World of Warcraft", "Proton"]
readTime: "3 min"
date: "2026-06-27"
---

Los micro-tirones (*stuttering*) en World of Warcraft al recorrer zonas de expansiones recientes como *The War Within* o *Midnight* bajo Linux ocurren principalmente por la compilación tardía de sombreadores de texturas (Shaders). Cuando el cliente oficial de Steam o Lutris traduce las instrucciones de DirectX 12 a Vulkan en tiempo real, el rendimiento del procesador se satura momentáneamente, provocando caídas severas de FPS por milisegundos.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Instalar y seleccionar la versión más reciente de Proton-GE
Proton-GE (GloriousEggroll) incluye parches específicos y mejoras de rendimiento que la rama oficial de Valve tarda en implementar.
1. Abre tu gestor de Proton (como ProtonUp-Qt) e instala la última versión disponible de **Proton-GE**.
2. Abre Steam, ve a las propiedades de World of Warcraft, entra a **Compatibilidad** y fuerza el uso de la versión de Proton-GE instalada.

### Paso 2: Activar la variable de compilación asíncrona (DXVK_ASYNC)
Para evitar que el juego espere a que un shader esté compilado para renderizarlo (lo que genera el tirón visual), forzaremos la renderización asíncrona.
1. En las propiedades de lanzamiento del juego en Steam (o Lutris), añade la siguiente variable de entorno:
```bash
DXVK_ASYNC=1 %command%
```
*(Nota: Esto permite que DXVK cargue texturas y shaders de fondo de forma fluida, reduciendo los tirones a cero al entrar a capitales o combates concurridos).*

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
- Nunca mezcles diferentes versiones de Proton (por ejemplo, pasar de Proton Experimental a Proton-GE de golpe) sobre el mismo prefijo de simulación de Steam sin limpiar antes el caché gráfico temporal. Si dejas archivos residuales viejos en la carpeta de caché, el controlador gráfico intentará usarlos bajo el nuevo Proton, lo que corrompe la caché y produce bloqueos y crasheos inmediatos. Limpia siempre la carpeta `shadercache/` del identificador del juego antes de cambiar la versión del entorno.

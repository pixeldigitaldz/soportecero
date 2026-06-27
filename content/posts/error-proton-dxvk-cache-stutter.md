---
title: "Cómo eliminar los tirones al jugar títulos DirectX en Linux optimizando la caché de DXVK"
description: "Aprende a configurar las variables de entorno de traducción gráfica para compilar shaders en segundo plano y estabilizar tus fotogramas."
category: "Gaming Tech"
tags: ["Linux", "Gaming", "DXVK"]
readTime: "3 min"
date: "2026-06-27"
---

El tartamudeo de la imagen (*stuttering*) al iniciar un juego de Windows en Linux mediante Proton ocurre porque las llamadas de gráficos de DirectX deben traducirse a la API abierta **Vulkan** en tiempo real mediante una librería llamada DXVK. Cada vez que entras a una zona nueva o un enemigo lanza una habilidad, el juego se congela unos milisegundos mientras compila el sombreador por primera vez.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Habilitar la compilación de shaders en paralelo (GPL)
Si tienes controladores gráficos modernos (NVIDIA o AMD Mesa recientes), puedes activar la característica *Graphics Pipeline Library (GPL)*, que compila los shaders de forma invisible antes de que aparezcan en pantalla.
1. Abre las propiedades del juego en Steam.
2. En la barra de **Parámetros de lanzamiento**, añade la siguiente línea mágica de variables:
```bash
dxvk.enableGraphicsPipelineLibrary = True __GL_SHADER_DISK_CACHE_SKIP_CLEANUP=1 %command%
```

### Paso 2: Asignar un espacio ilimitado para la caché en el disco SSD

Por defecto, los controladores de video limitan el tamaño de la carpeta de caché a 1GB o 2GB. Cuando se llena, el sistema borra los shaders viejos y vuelve a generar tirones. Modifica los límites de tu sistema operativo añadiendo estas líneas en tu terminal para que la GPU retenga todo el aprendizaje de texturas:
```bash
echo "export EXTRA_LDFLAGS=\"-Wl,-O1 -Wl,--as-needed\"" >> ~/.bashrc
source ~/.bashrc
```

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
- Al usar distribuciones de rendimiento como CachyOS, evita limpiar los archivos temporales del sistema de forma masiva con herramientas automáticas antes de jugar. Borrar la carpeta `.nv` o `.cache` de tu directorio de usuario destruirá semanas de compilación previa de tus juegos favoritos, obligando a tu tarjeta de video a empezar el molesto proceso de tartamudeo desde cero en la siguiente partida.

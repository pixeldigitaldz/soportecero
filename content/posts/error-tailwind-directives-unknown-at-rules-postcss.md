---
title: Advertencia Unknown at rule @tailwind y @apply en VS Code y PostCSS
description: >-
  Elimina las advertencias Unknown at rule @tailwind, @apply y @layer en
  archivos CSS en Visual Studio Code, Tailwind CSS y PostCSS.
category: Web y Código
tags:
  - TailwindCSS
  - CSS
  - Frontend
  - VSCode
readTime: 7 min
date: '2026-10-15'
---
Al abrir tu archivo `globals.css` o `style.css` en proyectos configurados con Tailwind CSS, Visual Studio Code subraya en amarillo o rojo las directivas `@tailwind base;`, `@apply` y `@layer` con la advertencia: `Unknown at rule @tailwind(unknownAtRules)` o `Unknown at rule @apply`. Aunque el proyecto compila correctamente, estas advertencias ensucian el editor y ocultan errores CSS reales.

## Análisis de Arquitectura y Causa Raíz

En la arquitectura del sistema operativo **Linux**, las aplicaciones de usuario operan en espacio no privilegiado (*User Space*) y dependen de llamadas al sistema (*syscalls*) para interactuar con los recursos físicos de hardware a través del **Kernel de Linux**. El subsistema del kernel arbitra el acceso a la memoria virtual, los descriptores de archivos, la pila de protocolos de red TCP/IP y los dispositivos de almacenamiento en bloque a través de la capa de abstracción **VFS (Virtual File System)**.

La anomalía técnica identificada en esta incidencia proviene de una restricción o condición de fallo en los mecanismos de control del sistema:
1. **Límites de descriptores de archivos y cuotas de inodos:** Cada archivo, socket de red o tubería (*pipe*) abierto por un proceso consume un descriptor de archivo en la tabla del kernel. Si el proceso alcanza el límite de descriptores asignado por el subsistema `ulimit` o si el sistema de archivos agota su tabla de inodos libres (incluso cuando resta espacio en gigabytes en disco), el kernel rechaza cualquier operación de escritura con el código de error `ENOSPC (No space left on device)` o `EMFILE (Too many open files)`.
2. **Jerarquía de permisos POSIX y atributos inmutables del sistema:** Las llamadas al sistema como `open()`, `unlink()` o `chmod()` evalúan los bits de permiso estándar (Lectura `r`, Escritura `w`, Ejecución `x`) junto con el UID/GID del proceso ejecutor. Si el archivo posee atributos extendidos inmutables fijados a nivel del sistema de archivos mediante `chattr +i`, el kernel bloquea cualquier mutación incluso ante el usuario privilegiado `root`, retornando el error `EPERM (Operation not permitted)`.
3. **Administración de memoria virtual y Swapping:** Cuando el sistema experimenta presión de memoria y la memoria física disponible es insuficiente para satisfacer las solicitudes del gestor de páginas, el kernel recurre a la memoria swap. Si los umbrales de agresividad (`vm.swappiness`) están desajustados o el espacio de intercambio está fragmentado, el sistema entra en un estado de congestión (*thrashing*), degradando el rendimiento general hasta que el subsistema OOM Killer termina procesos para preservar la estabilidad del kernel.

## Entorno de Laboratorio y Diagnóstico

Antes de aplicar cualquier cambio destructivo o reiniciar servicios en un entorno de producción, es fundamental ejecutar una matriz de diagnóstico preliminar para identificar la capa exacta donde ocurre el fallo:

| Causa | Solución |
|---|---|
| **El validador de CSS nativo de VS Code no reconoce la sintaxis de directivas especiales de Tailwind** | Instalar el paquete oficial Tailwind CSS IntelliSense extension and map file associations |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Comprobar el estado del servicio en el gestor de inicialización systemd
sudo systemctl status --no-pager -l vite

# 2. Inspeccionar los registros del diario del sistema filtrando por unidad
sudo journalctl -u vite -n 50 --no-pager

# 3. Auditar el espacio y tabla de inodos en todos los sistemas de archivos montados
df -Th && df -ih
```

- El flag `--no-pager` en `systemctl` y `journalctl` evita invocar el paginador interactivo (`less`), permitiendo redirigir la salida o analizar los registros sin interrumpir flujos de automatización.
- El comando `df` con los modificadores `-T` (tipo de sistema de archivos ext4/xfs/btrfs) y `-h` (formato legible en gigabytes/megabytes), combinado con `-i` (tabla de inodos disponibles), permite descartar si el disco está lleno por bytes reales o saturado por millones de archivos pequeños huérfanos.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

La solución más rápida y limpia es desactivar el aviso del linter nativo de CSS para directivas personalizadas:
1. Pulsa `Ctrl + Shift + P` (o `Cmd + Shift + P` en macOS).
2. Escribe **Preferences: Open User Settings (JSON)**.
3. Añade las siguientes líneas a tu archivo `settings.json`:
```json
{
  "css.lint.unknownAtRules": "ignore",
  "scss.lint.unknownAtRules": "ignore",
  "less.lint.unknownAtRules": "ignore"
}
```

### Paso 2: Instalar la extensión oficial Tailwind CSS IntelliSense
Instala la extensión oficial **Tailwind CSS IntelliSense** desarrollada por Tailwind Labs desde el marketplace de VS Code.
Esta extensión enseña al editor cómo autocompletar clases, validar nombres de utilidad y reconocer las directivas `@tailwind`, `@apply` y `@config`.

### Paso 3: Asociar archivos CSS con el modo de lenguaje de Tailwind
Para que VS Code entienda las directivas sin apagar completamente el linter, puedes asociar la extensión `.css` con el modo de lenguaje de Tailwind CSS en tu configuración:
```json
{
  "files.associations": {
    "*.css": "tailwindcss"
  }
}
```
Esto sustituye el analizador CSS antiguo por el motor de análisis sintáctico de Tailwind.

## 🛡️ Consejos de Prevención

* Añade la carpeta `.vscode/settings.json` a tu repositorio para que todos los miembros del equipo disfruten de la corrección sin configurar su editor manualmente.
* Asegúrate de tener `postcss.config.js` con `tailwindcss` y `autoprefixer` presentes en la raíz de tu proyecto.

## Preguntas Frecuentes

### ¿Afecta esta advertencia a la compilación final de Tailwind en producción?
No. Es exclusivamente una advertencia visual de la interfaz de VS Code. El compilador de PostCSS/Tailwind procesa las directivas correctamente en producción.

### ¿Cómo hago para que funcione con archivos SCSS o SASS?
Configura `"scss.lint.unknownAtRules": "ignore"` en settings.json y asegúrate de cargar PostCSS después del preprocesador Sass en tu canalización de Vite o Webpack.

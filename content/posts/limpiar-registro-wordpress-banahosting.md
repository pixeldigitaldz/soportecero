---
title: "Cómo limpiar y optimizar la base de datos de WordPress saturada en BanaHosting"
description: "Aprende cómo limpiar wordpress y optimizar la base de datos de tu sitio web para acelerar la velocidad de carga y reducir el uso de CPU en BanaHosting."
category: "Web y Código"
tags: ["WordPress", "Base de Datos", "Mantenimiento"]
readTime: "3 min"
date: "2026-06-27"
---

Saber cómo **limpiar wordpress** y optimizar la base de datos de tu sitio web en servidores compartidos (como BanaHosting) es fundamental cuando la web se pone lenta o el panel de control arroja errores de límite de memoria. Esto sucede porque WordPress acumula por defecto miles de filas de "revisiones de entradas" (versiones guardadas viejas de tus posts) y basura de caché (*transients*) en la tabla `wp_options`, saturando las consultas SQL.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Limitar las revisiones de entradas en wp-config.php
Por defecto, WordPress guarda infinitas copias de cada cambio que haces. Vamos a caparlo a un máximo de 3 versiones para que deje de inflar la base de datos.
1. Entra al Administrador de Archivos de tu cPanel en BanaHosting.
2. Abre el archivo `wp-config.php` y añade la siguiente línea justo antes del texto que dice *That's all, stop editing!*:
  ```php
  define('WP_POST_REVISIONS', 3);
  ```

### Paso 2: Ejecutar una limpieza SQL directa (Vía phpMyAdmin)

Entra a phpMyAdmin desde tu cPanel, selecciona la base de datos de tu WordPress, ve a la pestaña SQL y ejecuta este comando para borrar de un solo golpe todas las revisiones antiguas almacenadas:
```sql
DELETE FROM wp_posts WHERE post_type = 'revision';
```

Verás cómo el peso de tu base de datos cae drásticamente, acelerando las búsquedas y el tiempo de respuesta del servidor.

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
- Haz un respaldo completo (Backup) de tu base de datos en formato `.sql` antes de ejecutar cualquier comando de eliminación directa. Si cometes un error en la sintaxis de la consulta SQL sin tener una copia de seguridad previa, podrías eliminar los artículos reales de tu blog o corromper las relaciones de los enlaces permanentes de forma irreversible.

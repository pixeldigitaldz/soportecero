---
title: "Cómo limpiar y optimizar la base de datos de WordPress saturada en BanaHosting"
description: "Guía práctica para eliminar transitorios, revisiones huérfanas y reducir el consumo de disco MySQL en cPanel BanaHosting."
category: "Sistemas y Servidores"
tags: ["WordPress", "BanaHosting", "MySQL", "cPanel", "Optimización"]
readTime: "5 min"
date: "2026-06-27"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Tabla wp_options sobrecargada por transitorios expirados y logs huérfanos** | Ejecutar consulta SQL de limpieza de transitorios expirados en phpMyAdmin |
| **Exceso de revisiones de entradas y auto-guardados acumulados en wp_posts** | Limitar revisiones en `wp-config.php` y optimizar tablas MySQL con comando OPTIMIZE TABLE |

El crecimiento descontrolado de la base de datos MySQL en alojamientos como BanaHosting o servidores cPanel provoca que tu sitio web supere los límites de inodes, alcance el tope de CPU/IOPS y experimente lentitud general o errores 500/503. Esto suele deberse a millones de transitorios no eliminados en `wp_options` y miles de revisiones antiguas en `wp_posts`.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Limitar las revisiones de entradas en wp-config.php
Evita que WordPress guarde copias ilimitadas de cada borrador añadiendo estas directivas en tu archivo `wp-config.php` (antes de la línea */* That's all, stop editing! */*):
```php
// Limitar revisiones a un máximo de 3 por entrada
define('WP_POST_REVISIONS', 3);

// Aumentar el intervalo de autoguardado a 120 segundos
define('AUTOSAVE_INTERVAL', 120);

// Forzar el vaciado de la papelera cada 7 días
define('EMPTY_TRASH_DAYS', 7);
```

### Paso 2: Limpiar transitorios huérfanos en wp_options (Vía phpMyAdmin)
Accede a **cPanel > phpMyAdmin**, selecciona tu base de datos de WordPress y ejecuta la siguiente consulta en la pestaña SQL:
```sql
-- Eliminar transitorios y transients expirados
DELETE FROM wp_options WHERE option_name LIKE ('_transient_%');
DELETE FROM wp_options WHERE option_name LIKE ('_site_transient_%');
```

### Paso 3: Eliminar revisiones antiguas y metadatos huérfanos
Limpia todas las revisiones anteriores acumuladas en la tabla de posts y sus metadatos asociados:
```sql
-- 1. Eliminar todas las revisiones de artículos
DELETE a,b,c
FROM wp_posts a
LEFT JOIN wp_term_relationships b ON (a.ID = b.object_id)
LEFT JOIN wp_postmeta c ON (a.ID = c.post_id)
WHERE a.post_type = 'revision';

-- 2. Eliminar metadatos huérfanos
DELETE pm FROM wp_postmeta pm LEFT JOIN wp_posts wp ON wp.ID = pm.post_id WHERE wp.ID IS NULL;
```

### Paso 4: Desfragmentar y optimizar las tablas MySQL
Tras eliminar miles de registros, desfragmenta el espacio en disco con el comando de optimización:
```sql
OPTIMIZE TABLE wp_options, wp_posts, wp_postmeta, wp_comments;
```

## 🛡️ Consejos de Prevención
- **Cuidado con plugins de analítica interna:** Evita plugins que guarden estadísticas de visitas o logs de seguridad dentro de las tablas de WordPress (como WP-Statistics o plugins de redirección pesados). Utiliza Cloudflare o Google Analytics para métricas.
- **Programa mantenimientos semanales:** Puedes utilizar herramientas como WP-Optimize o comandos WP-CLI en tareas cron para automatizar la desfragmentación.

## ❓ Preguntas Frecuentes (FAQ)

### ¿Es seguro borrar las filas _transient_ de wp_options?
Sí, totalmente seguro. Los transitorios son datos en caché temporal. Si un plugin necesita un transitorio activo, WordPress lo regenerará automáticamente en la próxima visita.

### ¿Afecta borrar revisiones a los artículos publicados?
No. Solo se eliminan los borradores históricos intermedios. El contenido público y activo de tus entradas permanece 100% intacto.

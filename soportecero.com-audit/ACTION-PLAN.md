# Plan de Acción Priorizado (SEO Técnico + GEO + Agentic) — soportecero.com

## Fase 1: Correcciones Críticas y de Alta Prioridad (Semana 1)

### 1.1 Pre-renderizar el Hub `/tools/index.html` (P0 — Renderizado JS y Rastreabilidad IA)
- **Archivo a modificar**: [scripts/prerender-tools.js](file:///d:/Proyectos%20Antigravity/SoporteCero/scripts/prerender-tools.js) y [tools/index.html](file:///d:/Proyectos%20Antigravity/SoporteCero/tools/index.html)
- **Problema**: `/tools/index.html` solo contiene `<div id="root"></div>` (0 palabras sin JS).
- **Acción**: Al igual que ya se hace con las 6 calculadoras individuales en `prerender-tools.js`, inyectar en `tools/index.html` un bloque estático `<main class="seo-static-content">` con el listado de las 6 herramientas, enlaces `<a href="/tools/...">` reales y un bloque JSON-LD `CollectionPage` + `ItemList`.

### 1.2 Corregir `hreflang` roto en `nosotros.html` y `en/nosotros.html` (Alta — Indexabilidad Internacional)
- **Archivo a modificar**: [scripts/build.js](file:///d:/Proyectos%20Antigravity/SoporteCero/scripts/build.js#L790-L803)
- **Problema**: Las líneas 790 y 803 compilan `nosotros.html` y `en/nosotros.html` pasando `'about.html'` como equivalente en inglés, dejando a `en/nosotros.html` sin `hreflang` autorreferenciado y en conflicto con `sitemap.xml`.
- **Acción**: Cambiar:
  ```javascript
  compileStaticPage(path.join(SRC_DIR, 'nosotros.html'), path.join(DIST_DIR, 'nosotros.html'), 'nosotros.html', 'nosotros.html', 'es');
  compileStaticPage(path.join(SRC_DIR, 'en', 'nosotros.html'), path.join(DIST_DIR, 'en', 'nosotros.html'), 'nosotros.html', 'nosotros.html', 'en');
  ```
  Y eliminar la compilación duplicada de `en/contacto.html` en la línea 801.

### 1.3 Resolver la contradicción `Disallow: /*?cat=*` en `robots.txt` y explicitar grupos de IA (P0 — Crawlability & GEO)
- **Archivo a modificar**: [src/robots.txt](file:///d:/Proyectos%20Antigravity/SoporteCero/src/robots.txt) y [src/llms.txt](file:///d:/Proyectos%20Antigravity/SoporteCero/src/llms.txt)
- **Problema**: `robots.txt` bloquea `/*?cat=*`, pero la navegación del sitio, `llms.txt` y WebMCP enlazan a `/?cat=sistemas`, `/?cat=gaming` y `/?cat=web`. Además, `Content-Signal: ai-train=no` está acompañado de `Allow: /` para `User-agent: *`, permitiendo de facto a `GPTBot`, `ClaudeBot` y `Google-Extended` rastrear para entrenamiento.
- **Acción**:
  - En `src/llms.txt`, enlazar también a `/tools/index.html` y a las 6 calculadoras, y evitar depender únicamente de parámetros bloqueados.
  - En `src/robots.txt`, separar los grupos por propósito (permitir explícitamente `OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`, `Googlebot` y decidir si bloquear `GPTBot`, `ClaudeBot`, `Google-Extended`, `CCBot`, `Applebot-Extended`).

### 1.4 Reparar o desactivar endpoints rotos en `/.well-known/` (`/mcp` 503 y `/a2a` 404) (P1 — Agentic Readiness)
- **Archivos involucrados**: [wrangler.toml](file:///d:/Proyectos%20Antigravity/SoporteCero/wrangler.toml), [scripts/cloudflare-agent-worker.js](file:///d:/Proyectos%20Antigravity/SoporteCero/scripts/cloudflare-agent-worker.js), [.well-known/ai-catalog.json](file:///d:/Proyectos%20Antigravity/SoporteCero/.well-known/ai-catalog.json)
- **Problema**: Los manifiestos en `/.well-known/` anuncian `/mcp` (responde `503`) y `/a2a` (responde `404`), y `/.well-known/api-catalog` se sirve como `application/octet-stream`.
- **Acción**:
  1. En `.well-known/ai-catalog.json`, corregir los valores de `type` para usar los media types oficiales de la especificación ARD 1.0 (`application/a2a-agent-card+json`, `application/mcp-server-card+json`, `text/markdown; profile="urn:air:agent-skills"`).
  2. Si el servidor MCP/A2A no está desplegado aún, retirar temporalmente esas entradas de `ai-catalog.json` o implementar sus respuestas JSON-RPC en el Worker de Cloudflare antes de anunciarlos.

---

## Fase 2: Mejoras de Alto Impacto (Semanas 2–3)

### 2.1 Inyectar Cabeceras HTTP de Seguridad y Negociación Markdown en Cloudflare
- **Archivos a modificar**: [scripts/cloudflare-agent-worker.js](file:///d:/Proyectos%20Antigravity/SoporteCero/scripts/cloudflare-agent-worker.js) y [wrangler.toml](file:///d:/Proyectos%20Antigravity/SoporteCero/wrangler.toml)
- **Acción**:
  - Añadir en el Worker (o en Cloudflare Transform Rules) las cabeceras:
    - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
    - `X-Content-Type-Options: nosniff`
    - `X-Frame-Options: SAMEORIGIN`
    - `Referrer-Policy: strict-origin-when-cross-origin`
    - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - En `scripts/cloudflare-agent-worker.js`, eliminar el bloque fallback de las líneas 84-95 (que devolvía HTML crudo con `Content-Type: text/markdown`) y servir `Content-Type: application/linkset+json` para `/.well-known/api-catalog`.
  - Añadir `<link rel="alternate" type="text/markdown" href="https://soportecero.com/index.md">` en `src/index-template.html` y `<link rel="alternate" type="text/markdown" href="https://soportecero.com/articulos/{{slug}}.md">` en `src/post-template.html`.

### 2.2 Modernizar Datos Estructurados (Schema.org) y Señales de Entidad E-E-A-T
- **Archivos a modificar**: [scripts/build.js](file:///d:/Proyectos%20Antigravity/SoporteCero/scripts/build.js), [src/index-template.html](file:///d:/Proyectos%20Antigravity/SoporteCero/src/index-template.html), [src/sobre-mi.html](file:///d:/Proyectos%20Antigravity/SoporteCero/src/sobre-mi.html)
- **Acción**:
  1. Retirar la generación de `HowTo` en `scripts/build.js` (deprecado por Google en sept. 2023).
  2. Actualizar `author.jobTitle` en `TechArticle` a `"Fundador, Desarrollador Full-Stack & Administrador de Sistemas"` y añadir perfiles adicionales en `sameAs`.
  3. Inyectar `Organization` + `WebSite` en `src/index-template.html` y `src/en/index-template.html`.
  4. Inyectar `ProfilePage` + `Person` en `src/sobre-mi.html` y `src/en/about.html`.

### 2.3 Corregir Paridad e Higiene en la Versión en Inglés (`/en/`)
- **Archivos a modificar**: [src/en/index-template.html](file:///d:/Proyectos%20Antigravity/SoporteCero/src/en/index-template.html), [scripts/build.js](file:///d:/Proyectos%20Antigravity/SoporteCero/scripts/build.js)
- **Acción**:
  1. En `src/en/index-template.html`, cambiar los enlaces de `FEATURED GUIDES` de `../articulos/...` a `articulos/...` e incorporar la sección de las 6 calculadoras interactivas.
  2. En `scripts/build.js` (líneas 826 y 857), actualizar la expresión regular a `/^\[(SOLUCIONADO|SOLVED|FIXED|Solucionado|Solved|Fixed)\]\s*/i` para limpiar `[FIXED]` de los títulos en inglés.
  3. Normalizar el mapeo de categorías en inglés (`CATEGORY_MAP_EN`) para que los artículos de desarrollo web no se clasifiquen bajo `Systems & Servers`.
  4. Traducir al inglés los 3 artículos pilares restantes (`arquitectura-homelab-docker-compose...`, `auditoria-rendimiento-react-vite...`, `optimizacion-avanzada-linux-gaming...`).

---

## Fase 3: Contenido, Autoridad e IndexNow (Mes 2)

1. **Integrar IndexNow en `scripts/build.js`**: Generar una clave `/{key}.txt` en la raíz y notificar a `https://api.indexnow.org/indexnow` al desplegar, alimentando de forma inmediata a Bing y **Microsoft Copilot**.
2. **Páginas Estáticas de Categoría (`/categorias/sistemas.html`, `/categorias/gaming.html`, `/categorias/web.html`)**: Crear hubs estáticos indexables por categoría en lugar de depender únicamente de filtros en cliente (`?cat=`).
3. **Imágenes / Diagramas Técnicos por Artículo**: Incorporar diagramas SVG o capturas de diagnóstico con metadatos y `alt` descriptivos en los artículos pilares.

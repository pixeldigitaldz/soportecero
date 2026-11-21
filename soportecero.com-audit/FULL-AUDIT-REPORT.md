# Reporte Completo de Auditoría SEO Técnica, GEO y Agentic — soportecero.com

- **Dominio Auditado**: `https://soportecero.com/`
- **Fecha de Auditoría**: 2026-11-15
- **Skills Ejecutadas**: `seo-audit`, `seo-technical`, `seo-geo`, `seo-agentic`, `seo-schema`, `seo-sitemap`, `seo-hreflang`
- **Tipo de Sitio Detectado**: Publicación Técnica / Base de Conocimiento (Publisher / Developer Docs) + Suite de Herramientas Financieras Interactivas (`/tools/`)

---

## 1. Resumen Ejecutivo

### Puntuación Global de Salud SEO (SEO Health Score): **81 / 100**

| Categoría | Peso (`seo-audit`) | Puntuación | Estado |
|---|---|---|---|
| **SEO Técnico (`seo-technical`)** | 22% | **78/100** | ⚠️ Requiere ajustes en cabeceras HTTP, `robots.txt` y `/tools/index.html` |
| **Calidad de Contenido y E-E-A-T (`seo-content`)** | 23% | **88/100** | ✅ Fuerte profundidad técnica, diagnóstico de causa raíz y bilingüismo |
| **SEO On-Page (`seo-page`)** | 20% | **84/100** | ✅ Títulos, descripciones y jerarquía H1–H3 bien estructurados |
| **Schema / Datos Estructurados (`seo-schema`)** | 10% | **72/100** | ⚠️ Uso de `HowTo` deprecado y ausencia de Schema en Home/Sobre Mí |
| **Rendimiento / Arquitectura CWV** | 10% | **78/100** | ⚠️ SSG veloz en artículos; HTML pesado en Home (237 KB) y CSR en `/tools/index.html` |
| **Preparación AI Search & Agentes (`seo-geo` + `seo-agentic`)** | 10% | **81/100** | ⚠️ Gran base (`llms.txt`, `.md`, WebMCP), pero Worker desactivado y endpoints `/mcp` `/a2a` caídos |
| **Imágenes (`seo-images`)** | 5% | **65/100** | ⚠️ Todos los artículos comparten un único `og-image.png` sin capturas/diagramas propios |

---

### Top 5 Problemas Críticos y de Alta Prioridad
1. **`/tools/index.html` se sirve como un shell CSR vacío (`<div id="root"></div>`)**: Mientras que las 6 calculadoras individuales están pre-renderizadas, el hub principal `/tools/index.html` (prioridad `1.0` en `sitemap.xml` y enlazado en el menú principal de todo el sitio) tiene **0 palabras y 0 enlaces sin JavaScript**, quedando invisible para rastreadores de IA que no ejecutan JS (`OAI-SearchBot`, `PerplexityBot`, `Claude-SearchBot`, `GPTBot`).
2. **Contradicción en `robots.txt` (`Disallow: /*?cat=*`) frente a Navegación, `llms.txt` y WebMCP**: El archivo [robots.txt](file:///d:/Proyectos%20Antigravity/SoporteCero/robots.txt#L6) bloquea `/*?cat=*`, pero el menú principal de todo el sitio, [llms.txt](file:///d:/Proyectos%20Antigravity/SoporteCero/llms.txt#L9-L11) y la herramienta WebMCP `list_categories` en [js/main.js](file:///d:/Proyectos%20Antigravity/SoporteCero/js/main.js#L425-L437) entregan `/?cat=sistemas`, `/?cat=gaming` y `/?cat=web` como URLs principales de categoría.
3. **Endpoints de Agentes en `/.well-known/` devuelven `503` y `404`, y Worker de Cloudflare desactivado**:
   - `/.well-known/mcp/server-card.json` apunta a `https://soportecero.com/mcp` -> devuelve **`503 Service Unavailable`**.
   - `/.well-known/agent-card.json` apunta a `https://soportecero.com/a2a` -> devuelve **`404 Not Found`**.
   - `/.well-known/api-catalog` se sirve como `application/octet-stream` en lugar de `application/linkset+json`.
   - En [wrangler.toml](file:///d:/Proyectos%20Antigravity/SoporteCero/wrangler.toml#L5-L8), las rutas del Worker están comentadas, por lo que `Accept: text/markdown` devuelve `text/html` en vez de Markdown y no se inyectan las cabeceras `Link` (RFC 8288).
4. **Ruptura de reciprocidad `hreflang` en `nosotros.html` y `en/nosotros.html` + enlaces cruzados de idioma en `en/index.html`**:
   - En [scripts/build.js](file:///d:/Proyectos%20Antigravity/SoporteCero/scripts/build.js#L790-L803), `nosotros.html` y `en/nosotros.html` inyectan `hreflang="en" href="https://soportecero.com/en/about.html"`, rompiendo la autorreferencia de `en/nosotros.html` y contradiciendo a `sitemap.xml`.
   - En [en/index.html](file:///d:/Proyectos%20Antigravity/SoporteCero/en/index.html#L174-L178), los 3 enlaces de `FEATURED GUIDES` apuntan a `../articulos/...` (español) en lugar de `articulos/...` (inglés).
5. **Ausencia total de cabeceras HTTP de seguridad (`HSTS`, `CSP`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`)**: GitHub Pages ignora el archivo [_headers](file:///d:/Proyectos%20Antigravity/SoporteCero/_headers) (propio de Cloudflare Pages/Netlify) y Cloudflare CDN no las está inyectando en el borde.

---

### Top 5 Quick Wins (Victorias Rápidas en < 30 minutos)
1. **Corregir `hreflang` de `nosotros.html` y `en/nosotros.html`** en [scripts/build.js](file:///d:/Proyectos%20Antigravity/SoporteCero/scripts/build.js#L790) y [L803](file:///d:/Proyectos%20Antigravity/SoporteCero/scripts/build.js#L803) cambiando `'about.html'` por `'nosotros.html'`.
2. **Corregir los 3 enlaces de `FEATURED GUIDES` en [src/en/index-template.html](file:///d:/Proyectos%20Antigravity/SoporteCero/src/en/index-template.html)** de `../articulos/...` a `articulos/...` y limpiar el prefijo `[FIXED]` en la regex de [scripts/build.js](file:///d:/Proyectos%20Antigravity/SoporteCero/scripts/build.js#L857).
3. **Eliminar el Schema `HowTo` deprecado** en [scripts/build.js](file:///d:/Proyectos%20Antigravity/SoporteCero/scripts/build.js#L976-L1007) y añadir `WebSite` + `Organization` JSON-LD en `index.html` / `en/index.html` y `ProfilePage` en `sobre-mi.html` / `en/about.html`.
4. **Añadir `<link rel="alternate" type="text/markdown">` en `src/index-template.html` y `src/post-template.html`** apuntando a `/index.md` y `/articulos/{{slug}}.md`, los cuales ya existen y se sirven con `Content-Type: text/markdown; charset=utf-8` desde GitHub Pages.
5. **Actualizar los tipos MIME en [.well-known/ai-catalog.json](file:///d:/Proyectos%20Antigravity/SoporteCero/.well-known/ai-catalog.json)** para cumplir al 100% con el validador `ard-schema` de Lighthouse 13.5 y corregir las URLs `?cat=*` en `llms.txt`.

---

## 2. Resumen por Especialidad (Archivos Detallados)

- **Auditoría de SEO Técnico (`seo-technical`)**: Ver [findings/technical.md](file:///d:/Proyectos%20Antigravity/SoporteCero/soportecero.com-audit/findings/technical.md)
- **Auditoría de GEO / AI Search (`seo-geo`)**: Ver [GEO-ANALYSIS.md](file:///d:/Proyectos%20Antigravity/SoporteCero/soportecero.com-audit/GEO-ANALYSIS.md) y [findings/geo.md](file:///d:/Proyectos%20Antigravity/SoporteCero/soportecero.com-audit/findings/geo.md)
- **Auditoría de Agentic Browsing (`seo-agentic`)**: Ver [findings/agentic.md](file:///d:/Proyectos%20Antigravity/SoporteCero/soportecero.com-audit/findings/agentic.md)
- **Plan de Acción Priorizado**: Ver [ACTION-PLAN.md](file:///d:/Proyectos%20Antigravity/SoporteCero/soportecero.com-audit/ACTION-PLAN.md)
- **Datos Estructurados de la Auditoría**: Ver [audit-data.json](file:///d:/Proyectos%20Antigravity/SoporteCero/soportecero.com-audit/audit-data.json)

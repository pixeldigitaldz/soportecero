# Auditoría de Preparación para Agentes (Agentic Browsing / `seo-agentic`) — soportecero.com

- **URL Auditada**: `https://soportecero.com/`
- **Fecha de Auditoría**: 2026-11-15
- **Hechos de Estándares Verificados al**: 2026-09-23 (`seo-agentic` v2.6.2, Lighthouse 13.5.0)

---

## 1. Resumen Ejecutivo (`seo-agentic`)

- **Fracción Lighthouse Agentic Browsing estimada en inspección estática/HTTP**: **4/6** en la portada (2 auditorías con fallo/advertencia en producción por configuración de endpoints y tipos MIME en ARD y formularios sin anotar en páginas secundarias; *nota: no se ejecutó la API remota de PSI v5 por falta de `python` en el entorno Windows local, por lo que se evaluaron directamente las 7 reglas de Lighthouse 13.5 sobre las respuestas HTTP reales de `https://soportecero.com/` y el DOM servido*).
- **Fallas P0 medidas**: **1 parcial** (`/tools/index.html` carece de contenido renderizado en servidor sin JS; la portada `/` sí pasa con >3,000 palabras visibles sin JS).
- **Principal limitante para agentes hoy**: El Worker de Cloudflare ([scripts/cloudflare-agent-worker.js](file:///d:/Proyectos%20Antigravity/SoporteCero/scripts/cloudflare-agent-worker.js)) tiene sus rutas comentadas en [wrangler.toml](file:///d:/Proyectos%20Antigravity/SoporteCero/wrangler.toml#L5-L8), por lo que la negociación `Accept: text/markdown` y las cabeceras HTTP `Link` (RFC 8288) no están activas en producción, y los endpoints interactivos anunciados en `/.well-known/` (`/mcp` y `/a2a`) responden `503 Service Unavailable` y `404 Not Found`.

---

## 2. Evaluación de las 7 Auditorías de Lighthouse Agentic Browsing (Lighthouse 13.5.0)

| ID de Auditoría Lighthouse | Grupo | Estado en `soportecero.com/` | Evidencia Técnica Medida |
|---|---|---|---|
| `agent-accessibility-tree` | `agent-accessibility` | **PASS** (Portada) | Botón de tema tiene `aria-label="Cambiar tema visual"`, buscador tiene `aria-label="Buscar tutoriales"`, íconos SVG decorativos tienen `aria-hidden="true"`, `<html lang="es">` válido, sin `duplicate-id-aria`. |
| `cumulative-layout-shift` | CLS | **PASS** | Layout estático con dimensiones explícitas en SVGs y tipografías con `swap`. |
| `llms-txt` | `agent-discoverability` | **PASS** | `GET /llms.txt` devuelve `200 OK` (`text/plain; charset=utf-8`, 2,161 bytes), inicia con `# SoporteCero`, incluye enlaces `[texto](url)` y supera los 50 caracteres. |
| `ard-schema` | `agent-discoverability` | **WARN** (0.9) | `GET /.well-known/ai-catalog.json` devuelve `200 OK` (`application/json`), tiene `specVersion: "1.0"`, 4 entradas con URNs válidas `urn:air:soportecero.com:...` y entre 2 y 4 `representativeQueries`. **Advertencia**: 3 de las 4 entradas usan valores `type` fuera del conjunto estándar ARD (`application/json` y `application/linkset+json`). |
| `webmcp-registered-tools` | `webmcp` | **Informativo** | [js/main.js](file:///d:/Proyectos%20Antigravity/SoporteCero/js/main.js#L356-L442) registra 2 herramientas imperativas (`search_troubleshooting_guides` y `list_categories`) usando `document.modelContext || navigator.modelContext`, más 1 herramienta declarativa en el `<form>` del buscador. |
| `webmcp-form-coverage` | `webmcp` | **PASS en `/`**, **Informativo en `/contacto.html`** | En `index.html` e `en/index.html` el único `<form>` tiene `toolname="search_troubleshooting_guides"` y `tooldescription="..."`. En `contacto.html`, el formulario `#contact-form` no tiene atributos declarativos WebMCP. |
| `webmcp-schema-validity` | `webmcp` | **PASS** | Tanto el `<input name="q" toolparamdescription="...">` declarativo como los `inputSchema` imperativos en `js/main.js` definen nombres y descripciones para todos los parámetros. |

---

## 3. Hallazgos por Prioridad (`P0` a `P3`)

### Prioridad P0 (Fundamentos Críticos)
1. **`server-rendered` — `[PASS en / | FAIL en /tools/index.html]`**:
   - **Evidencia**: `https://soportecero.com/` sirve 237 KB de HTML estático con todo el contenido primario visible sin ejecutar JavaScript. Sin embargo, `https://soportecero.com/tools/index.html` devuelve únicamente `<div id="root"></div>` (marcador `js_shell_marker = true`, 0 palabras visibles sin JS).
   - **Corrección**: Extender [scripts/prerender-tools.js](file:///d:/Proyectos%20Antigravity/SoporteCero/scripts/prerender-tools.js) para inyectar también en `tools/index.html` una sección estática indexable con enlaces `<a href>` a las 6 calculadoras y sus resúmenes.
2. **`robots-reachable` y `robots-ai-groups` — `[INFO / WARN]`**:
   - **Evidencia**: `https://soportecero.com/robots.txt` responde `200 OK` con 1 solo grupo (`User-agent: *`). Todos los agentes caen en el grupo comodín `*`, y la regla `Disallow: /*?cat=*` bloquea las URLs de categorías que el propio sitio entrega a los agentes en `llms.txt` y en la herramienta WebMCP `list_categories`.

### Prioridad P1 (Descubrimiento, Señales y Entrega Markdown)
3. **`markdown-delivery` (Entrega de Markdown y Negociación HTTP) — `[WARN]`**:
   - **Evidencia en vivo**:
     - `curl.exe -sI -H "Accept: text/markdown" https://soportecero.com/` devuelve `Content-Type: text/html; charset=utf-8` y `vary: Accept-Encoding` (sin `Vary: Accept`).
     - No obstante, el archivo hermano `https://soportecero.com/index.md` **sí existe** y responde `200 OK` con `Content-Type: text/markdown; charset=utf-8`, al igual que `/articulos/<slug>.md`.
     - Tampoco existe `<link rel="alternate" type="text/markdown" href="...">` en el `<head>` de `index.html` ni de las páginas de artículos (`post-template.html`).
   - **Causa raíz**: Las rutas del Worker en [wrangler.toml](file:///d:/Proyectos%20Antigravity/SoporteCero/wrangler.toml#L5-L8) están comentadas.
   - **Corrección**: Añadir `<link rel="alternate" type="text/markdown" href="https://soportecero.com/index.md">` en `src/index-template.html` y `<link rel="alternate" type="text/markdown" href="https://soportecero.com/articulos/{{slug}}.md">` en `src/post-template.html`, o reactivar el Worker de Cloudflare asegurándose de que en el bloque fallback ([scripts/cloudflare-agent-worker.js](file:///d:/Proyectos%20Antigravity/SoporteCero/scripts/cloudflare-agent-worker.js#L85-L95)) **no** etiquete HTML crudo como `text/markdown`.
4. **`llms-txt` (Higiene de formato según propuesta `llmstxt.org`) — `[PASS en Lighthouse | 2 notas de higiene]`**:
   - **Evidencia**: En [llms.txt](file:///d:/Proyectos%20Antigravity/SoporteCero/llms.txt#L5), el párrafo descriptivo debajo del blockquote `> Soluciones directas...` es válido, pero las URLs de categorías usan `?cat=*` (bloqueadas por `robots.txt`) y apuntan a endpoints de agentes (`/mcp`, `/a2a`) que no están operativos.
5. **`http-404` — `[PASS]`**:
   - **Evidencia**: `GET https://soportecero.com/pagina-inexistente-404-test` devuelve un `HTTP/1.1 404 Not Found` real (sin *soft-404* ni *catch-all 200*).

### Prioridad P2 y P3 (Catálogos `/.well-known/`, ARD y WebMCP)
6. **`well-known:api-catalog` (RFC 9727) — `[WARN]`**:
   - **Evidencia**: `GET https://soportecero.com/.well-known/api-catalog` responde `200 OK` con JSON válido, pero GitHub Pages lo sirve con `Content-Type: application/octet-stream` porque el archivo no tiene extensión `.json`, cuando RFC 9727 requiere `application/linkset+json`.
7. **Endpoints fantasma en `/.well-known/mcp/server-card.json`, `/.well-known/agent-card.json` y `auth.md` — `[FAIL Funcional]`**:
   - **Evidencia medida en vivo**:
     - `/.well-known/mcp/server-card.json` declara `"url": "https://soportecero.com/mcp"` -> En vivo, `https://soportecero.com/mcp` devuelve **`HTTP/1.1 503 Service Unavailable`**.
     - `/.well-known/agent-card.json` declara `"url": "https://soportecero.com/a2a"` -> En vivo, `https://soportecero.com/a2a` devuelve **`HTTP/1.1 404 Not Found`**.
     - `auth.md` documenta endpoints `POST /agent/register`, `/oauth/authorize`, `/oauth/token` y `/.well-known/oauth-protected-resource` que no existen en el hosting estático de GitHub Pages.
   - **Impacto**: Un cliente MCP o agente A2A que descubra estos manifiestos fallará al intentar conectarse.
8. **`ard-catalog` (`/.well-known/ai-catalog.json`) — `[WARN]`**:
   - **Evidencia**: En [.well-known/ai-catalog.json](file:///d:/Proyectos%20Antigravity/SoporteCero/.well-known/ai-catalog.json), las entradas 2, 3 y 4 usan `"type": "application/json"` y `"type": "application/linkset+json"`. El validador ARD de Lighthouse 13.5 espera tipos registrados en la especificación ARD 1.0 (`application/a2a-agent-card+json`, `application/mcp-server-card+json`, `text/markdown; profile="urn:air:agent-skills"`, `application/ai-catalog+json`).
9. **`webmcp-tools` y `webmcp-entry-point` — `[PASS]`**:
   - **Evidencia**: [js/main.js](file:///d:/Proyectos%20Antigravity/SoporteCero/js/main.js#L344-L345) detecta correctamente `document.modelContext || navigator.modelContext` (cumpliendo con el punto de entrada actual del borrador W3C CG).

---

## 4. Política de Acceso por Propósito y Estado de los Estándares

- **Acceso para Entrenamiento (`training`)**: Declarado como no deseado vía `Content-Signal: ai-train=no`, pero permitido técnicamente vía `Allow: /` bajo `User-agent: *`.
- **Acceso para Búsqueda y Citación (`search`)**: Permitido en `/` (`search=yes`, `Allow: /`), pero bloqueado accidentalmente en `/*?cat=*`.
- **Acceso para Agentes Iniciados por el Usuario (`user`)**: Permitido en `/` (`ai-input=yes`, `Allow: /`). *(Nota: Los fetchers iniciados por el usuario como `Google-Agent`, `Perplexity-User` y `ChatGPT-User` generalmente ignoran `robots.txt`)*.

### Estado de los Estándares Auditados (verificado 2026-09-23)
- **`Content-Signal`**: Política CC0 de Cloudflare; borrador IETF expirado (2026-04-04); Google no actúa sobre él.
- **`llms.txt`**: Propuesta comunitaria (`llmstxt.org`); verificada por Lighthouse 13.5 en laboratorio, ignorada por Google Search.
- **`ARD` (`ai-catalog.json`)**: Especificación comunitaria `1.0` (`agenticresourcediscovery.org`), validada por Lighthouse 13.5 (`ard-schema`).
- **`WebMCP`**: Borrador del W3C Community Group (en Origin Trial en Chrome M149–M156; WebKit se opone, Mozilla neutral).

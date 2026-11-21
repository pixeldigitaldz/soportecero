# Auditoría de SEO Técnico — soportecero.com

- **URL Auditada**: `https://soportecero.com/`
- **Fecha de Auditoría**: 2026-11-15
- **Infraestructura Detectada**: GitHub Pages (`x-github-request-id`, `via: 1.1 varnish`) detrás de Cloudflare CDN (`Server: cloudflare`, HTTP/3 habilitado) + Generador de Sitio Estático propio en Node.js ([build.js](file:///d:/Proyectos%20Antigravity/SoporteCero/scripts/build.js) y [prerender-tools.js](file:///d:/Proyectos%20Antigravity/SoporteCero/scripts/prerender-tools.js)).

---

## Puntuación Técnica Global: **78/100**

*(Nota metodológica según `seo-technical`: se puntúan únicamente las categorías medidas directamente sobre el sitio en vivo y el código compilado. Core Web Vitals de campo —CrUX— se reporta como no medido por ausencia de credenciales de API de Google/tráfico de campo CrUX público, evaluándose la arquitectura de renderizado estático y recursos en laboratorio).*

| Categoría | Estado | Puntuación | Resumen de Evidencia Medida |
|---|---|---|---|
| **1. Rastreabilidad (Crawlability)** | WARN | **82/100** | `robots.txt` HTTP 200 OK y `sitemap.xml` válido (308 URLs), pero `Disallow: /*?cat=*` entra en conflicto con enlaces internos en `header`, `nav` y `llms.txt`. |
| **2. Indexabilidad (Indexability)** | WARN | **76/100** | Canonicals autorreferenciados correctos en artículos, pero **conflicto de `hreflang` en `nosotros.html` y `en/nosotros.html`**, página huérfana duplicada `en/contacto.html`, y `/tools/index.html` servida como *shell* vacío CSR. |
| **3. Seguridad (Security)** | WARN | **62/100** | HTTPS activo + redirecciones 301 en 1 salto (`http://` -> `https://` y `www` -> `non-www`). **Faltan todas las cabeceras de seguridad HTTP** (`HSTS`, `CSP`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) en respuestas `200 OK` porque GitHub Pages ignora `_headers` y el Worker de Cloudflare tiene las rutas comentadas. |
| **4. Estructura de URLs (URL Structure)** | PASS | **88/100** | Slugs descriptivos con guiones, sin cadenas de redirección. Penalización menor por enlaces internos hacia `/index.html` en lugar de `/` y uso de parámetros `?cat=` para categorías en la navegación principal. |
| **5. Optimización Móvil y Experiencia** | PASS | **88/100** | Meta `viewport` correcto, paridad completa de contenido móvil/escritorio, sin intersticiales intrusivos. El directorio completo de 144 artículos usa `<details>` al pie de página. |
| **6. Core Web Vitals (Arquitectura/Lab)** | WARN | **78/100** | *(CrUX de campo: No medido — sin API key configurada).* En laboratorio/código: HTML estático puro muy rápido en blog, pero `index.html` pesa **237 KB** de HTML inicial (renderiza las 144 tarjetas en el DOM y las oculta con JS), carga AdSense y Google Fonts bloqueantes, y `/tools/index.html` depende 100% de JS CSR. |
| **7. Datos Estructurados (Schema.org)** | WARN | **72/100** | Artículos tienen `TechArticle` y `BreadcrumbList` bien formados, y las 6 calculadoras tienen `SoftwareApplication`. Sin embargo: **1)** `index.html`, `sobre-mi.html`, `nosotros.html`, `servicios.html` y `contacto.html` tienen **0 bloques JSON-LD** (`WebSite`/`Organization`/`ProfilePage` ausentes); **2)** Se inyecta **`HowTo` (deprecado por Google en sept. 2023)** en los 285 artículos; **3)** `FAQPage` (retirado para rich results el 7 de mayo de 2026) sigue inyectándose (nivel Info). |
| **8. Renderizado JavaScript (JS Rendering)** | WARN | **80/100** | El 98% del sitio (Home, 144 artículos ES, 141 artículos EN y las 6 herramientas individuales) está pre-renderizado (SSG). **Fallo puntual crítico**: `/tools/index.html` contiene únicamente `<div id="root"></div>` (0 palabras sin JS). |
| **9. Protocolo IndexNow** | INFO | **40/100** | No implementado. Recomendado para acelerar la indexación en Bing (que alimenta las citaciones de Microsoft Copilot), Yandex y Naver. |

---

## Hallazgos Detallados por Categoría

### 1. Rastreabilidad y Gestión de Crawlers (`robots.txt` y `sitemap.xml`)
- **Evidencia en [robots.txt](file:///d:/Proyectos%20Antigravity/SoporteCero/robots.txt#L1-L9)**:
  ```text
  User-agent: *
  Allow: /
  Disallow: /src/
  Disallow: /content/
  Disallow: /scripts/
  Disallow: /*?cat=*
  Content-Signal: ai-train=no, search=yes, ai-input=yes
  Sitemap: https://soportecero.com/sitemap.xml
  ```
- **Contradicción de rastreo en categorías (`Disallow: /*?cat=*`)**:
  - La barra de navegación superior en todas las páginas ([index.html](file:///d:/Proyectos%20Antigravity/SoporteCero/index.html#L99-L101)) enlaza a `index.html?cat=sistemas`, `index.html?cat=gaming` y `index.html?cat=web`.
  - Además, [llms.txt](file:///d:/Proyectos%20Antigravity/SoporteCero/llms.txt#L9-L11) y la herramienta WebMCP `list_categories` en [js/main.js](file:///d:/Proyectos%20Antigravity/SoporteCero/js/main.js#L425-L437) entregan esas mismas URLs `?cat=*` como puntos de entrada de categorías.
  - Cualquier crawler o agente que respete `robots.txt` tiene **prohibido** acceder a `/*?cat=*`.
- **Grupos de Crawlers de IA en `robots.txt`**:
  - Actualmente solo existe `User-agent: *` con `Allow: /` y `Content-Signal: ai-train=no, search=yes, ai-input=yes`.
  - Como `Content-Signal` es una preferencia declarativa (CC0 de Cloudflare; el borrador IETF expiró el 2026-04-04 y Google no lo procesa), **`GPTBot`, `ClaudeBot`, `CCBot`, `Bytespider` y `Google-Extended` tienen permitido el rastreo para entrenamiento** porque `Allow: /` aplica a `User-agent: *`. Si tu intención real es `ai-train=no` (bloquear entrenamiento manteniendo citabilidad en buscadores IA), debes declarar grupos explícitos `Disallow: /` para los bots de entrenamiento (`GPTBot`, `ClaudeBot`, `Google-Extended`, `CCBot`, `Applebot-Extended`) y `Allow: /` para los bots de búsqueda/citación (`OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`, `Googlebot`).
- **Límite de 2 MB de Googlebot y Peso del DOM**:
  - `index.html` pesa **237,219 bytes (~232 KB)** porque incluye las 144 tarjetas completas en el DOM inicial y además repite los 144 enlaces en `<section class="directory-index">`. Está dentro del límite de 2 MB de Googlebot, pero a medida que el blog escale a >500 artículos superará los 700 KB–1 MB si no se genera paginación estática.

### 2. Indexabilidad, Canonicalización e Internacionalización (`hreflang`)
- **[ALTO] Ruptura de reciprocidad `hreflang` en [nosotros.html](file:///d:/Proyectos%20Antigravity/SoporteCero/nosotros.html#L15-L17) y [en/nosotros.html](file:///d:/Proyectos%20Antigravity/SoporteCero/en/nosotros.html#L15-L17)**:
  - En [scripts/build.js](file:///d:/Proyectos%20Antigravity/SoporteCero/scripts/build.js#L790) y [L803](file:///d:/Proyectos%20Antigravity/SoporteCero/scripts/build.js#L803), `nosotros.html` y `en/nosotros.html` se compilan pasando `'about.html'` como ruta en inglés en lugar de `'nosotros.html'`.
  - Como resultado:
    1. `en/nosotros.html` tiene `<link rel="canonical" href="https://soportecero.com/en/nosotros.html">`, pero su etiqueta `hreflang="en"` apunta a `https://soportecero.com/en/about.html` (no se autorreferencia).
    2. Contradice al propio [sitemap.xml](file:///d:/Proyectos%20Antigravity/SoporteCero/sitemap.xml#L1495-L1511), donde `nosotros.html` sí se empareja con `en/nosotros.html`.
- **[MEDIO] Página duplicada/huérfana [en/contacto.html](file:///d:/Proyectos%20Antigravity/SoporteCero/en/contacto.html#L1-L28)**:
  - Se compila tanto `en/contact.html` como `en/contacto.html` (una página puente de 28 líneas con canonical hacia `en/contact.html`). Conviene eliminar o redirigir `en/contacto.html`.
- **[MEDIO] Enlaces destacados rotos de idioma en la portada en inglés ([en/index.html](file:///d:/Proyectos%20Antigravity/SoporteCero/en/index.html#L173-L179))**:
  - En `en/index.html`, la caja `FEATURED GUIDES` enlaza a `../articulos/stuttering-juegos-proton-dxvk-cache.html`, `../articulos/restaurar-contrasenia-root-linux.html` y `../articulos/activar-optiscaler-juegos-pc.html` (versiones en español) en vez de enlazar a `articulos/...` dentro de `/en/`.
- **[BAJO] 3 artículos pilares en español sin traducción al inglés (`144 ES vs 141 EN`)**:
  - `arquitectura-homelab-docker-compose-redes-aisladas-reverse-proxy`
  - `auditoria-rendimiento-react-vite-core-web-vitals-code-splitting`
  - `optimizacion-avanzada-linux-gaming-frametime-kernel-gamemode-zram`
- **[BAJO] Categoría mal mapeada y prefijo `[FIXED]` sin limpiar en artículos en inglés**:
  - En [scripts/build.js](file:///d:/Proyectos%20Antigravity/SoporteCero/scripts/build.js#L857), la expresión regular `replace(/^\[(SOLUCIONADO|SOLVED|Solucionado|Solved)\]\s*/i, '')` no incluye `FIXED`, dejando títulos como `[FIXED] Docker Error 'failed to solve...'` en [en/index.html](file:///d:/Proyectos%20Antigravity/SoporteCero/en/index.html#L270-L280).
  - Además, artículos de Web & Code en inglés (ej. `error-nextjs-referenceerror-document-is-not-defined.html`) aparecen bajo la categoría `Systems & Servers` (`data-category="sistemas"`) porque su frontmatter en inglés tiene `category: "Sistemas y Servidores"` o no coincide con `CATEGORY_MAP_EN`.

### 3. Seguridad y Transporte HTTP
- **Verificación en vivo (`curl.exe -sI https://soportecero.com/`)**:
  - `http://soportecero.com/` -> `301 Moved Permanently` hacia `https://soportecero.com/` (1 salto, óptimo).
  - `https://www.soportecero.com/` -> `301 Moved Permanently` hacia `https://soportecero.com/` (1 salto, óptimo).
  - **Ausencia de cabeceras de seguridad en respuestas `200 OK`**:
    - `Strict-Transport-Security` (HSTS): **Ausente**
    - `Content-Security-Policy` (CSP): **Ausente**
    - `X-Content-Type-Options: nosniff`: **Ausente**
    - `X-Frame-Options`: **Ausente**
    - `Referrer-Policy`: **Ausente**
    - `Permissions-Policy`: **Ausente**
  - **Causa raíz**: El archivo [_headers](file:///d:/Proyectos%20Antigravity/SoporteCero/_headers) solo es procesado por Cloudflare Pages o Netlify, no por GitHub Pages. Dado que el dominio pasa por Cloudflare CDN (`Server: cloudflare`), estas cabeceras deben inyectarse mediante el Worker ([scripts/cloudflare-agent-worker.js](file:///d:/Proyectos%20Antigravity/SoporteCero/scripts/cloudflare-agent-worker.js)) o mediante una *Cloudflare Response Header Transform Rule*.
- **Comprobación de Back-Button Hijacking (`history.pushState`)**:
  - En [js/main.js](file:///d:/Proyectos%20Antigravity/SoporteCero/js/main.js#L169), se usa `window.history.pushState({ cat: currentCategory }, '', newUrl)` al hacer clic en los filtros de categoría. Como está acompañado de un listener `window.addEventListener('popstate', ...)` funcional en las líneas 214-217 y solo ocurre tras interacción explícita del usuario, **no constituye secuestro del botón Atrás**, aunque se recomienda usar `replaceState` para filtros en la misma vista y evitar acumular entradas en el historial del navegador.

### 4. Renderizado JavaScript (`CSR` vs `SSG`)
- **[CRÍTICO PARA RASTREO DE `/tools/`] `/tools/index.html` es un shell CSR vacío**:
  - Mientras que las 6 calculadoras individuales (`comisiones-pasarelas-pago.html`, etc.) fueron pre-renderizadas con +800 palabras y JSON-LD mediante [scripts/prerender-tools.js](file:///d:/Proyectos%20Antigravity/SoporteCero/scripts/prerender-tools.js), el hub principal [tools/index.html](file:///d:/Proyectos%20Antigravity/SoporteCero/tools/index.html#L24-L26) que recibe todos los enlaces principales del header (`<a href="/tools/index.html">Calculadoras</a>`) y tiene prioridad `1.0` en `sitemap.xml` contiene únicamente:
    ```html
    <body class="bg-[#0B0C10] text-slate-100 antialiased selection:bg-cyan-500 selection:text-white">
      <div id="root"></div>
    </body>
    ```
  - **Impacto**: Tiene **0 palabras visibles sin JavaScript** y **0 enlaces `<a href>` en el HTML crudo** hacia las 6 calculadoras. Los bots de búsqueda IA que no ejecutan JS (`GPTBot`, `OAI-SearchBot`, `ClaudeBot`, `PerplexityBot`) ven una página completamente vacía en `/tools/index.html`.

### 5. Datos Estructurados (Schema.org JSON-LD)
- **Ausencia de Schema en Portada y Páginas Institucionales**:
  - `index.html` y `en/index.html` no incluyen `WebSite` (con `SearchAction`) ni `Organization`.
  - `sobre-mi.html` y `en/about.html` no incluyen `ProfilePage` + `Person` para Rodolfo Castro (clave para E-E-A-T y desambiguación de entidad).
  - `servicios.html` no incluye `Service` / `ProfessionalService`.
- **Uso de Schema `HowTo` Deprecado**:
  - [scripts/build.js](file:///d:/Proyectos%20Antigravity/SoporteCero/scripts/build.js#L976-L1007) genera un bloque `<script type="application/ld+json">` de tipo `HowTo` en todos los artículos. Google eliminó por completo los resultados enriquecidos de `HowTo` en septiembre de 2023. Según `seo-schema`, nunca debe recomendarse y conviene retirarlo para reducir el peso del HTML.
- **Estado de `FAQPage` (Mayo 2026)**:
  - Google retiró los resultados enriquecidos de `FAQPage` para todos los sitios el **7 de mayo de 2026**. Mantenerlo no penaliza (nivel `Info`), pero no generará desplegables en los SERPs de Google.

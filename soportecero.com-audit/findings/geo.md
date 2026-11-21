# Auditoría de GEO (Generative Engine Optimization / AI Search) — soportecero.com

- **URL Auditada**: `https://soportecero.com/`
- **Fecha de Auditoría**: 2026-11-15
- **Marco de Referencia**: Guía Oficial de Optimización para IA de Google Search Central (publicada 2026-05-15, actualizada 2026-07-10) y heurísticas de citabilidad de `seo-geo`.

> [!IMPORTANT]
> **Posición oficial de Google (Search Central)**: *"Desde la perspectiva de Google Search, optimizar para la búsqueda con IA generativa es optimizar para la experiencia de búsqueda y, por tanto, sigue siendo SEO"*. Las puntuaciones de esta sección son una lista de control heurística (25/20/15/20/20) para priorizar mejoras, no una tasa de citación predicha.

---

## Puntuación Heurística GEO: **81/100**

| Dimensión GEO | Peso | Puntuación | Estado |
|---|---|---|---|
| **1. Citabilidad de Pasajes (Citability)** | 25% | **86/100** | Excelente estructura en artículos: tabla/consola de Diagnóstico Técnico (Síntoma / Causa / Solución) en el primer 25% de cada guía y pasos numerados autocontenidos. |
| **2. Legibilidad Estructural (Structural Readability)** | 20% | **92/100** | Jerarquía `H1 -> H2 -> H3` limpia, Índice de Contenido (ToC) automático, bloques de código semánticos, tablas convertidas en tarjetas diagnósticas y sección FAQ al final. |
| **3. Contenido Multimodal (Multi-Modal Content)** | 15% | **58/100** | Uso intensivo de bloques de código y tablas técnicas, pero ausencia de diagramas de arquitectura propios, capturas reales de terminal/laboratorio con atributos `alt` descriptivos o videos embebidos (todos los artículos usan el mismo `og-image.png` genérico). |
| **4. Autoridad y Señales de Entidad/Marca (Authority & Brand)** | 20% | **76/100** | Autoría clara (**Rodolfo Castro**) con página dedicada ([sobre-mi.html](file:///d:/Proyectos%20Antigravity/SoporteCero/sobre-mi.html)) y metodología de laboratorio explícita (Who/How/Why), pero débil presencia de entidad externa (`sameAs` apunta únicamente a `pixeldigitaldz.online/links`, sin enlaces a GitHub, LinkedIn, YouTube, Reddit o Wikidata). |
| **5. Accesibilidad Técnica para IA (Technical Accessibility)** | 20% | **84/100** | Artículos 100% SSG en HTML estático + copias `.md` estáticas, pero `robots.txt` tiene contradicciones en `/*?cat=*` y `/tools/index.html` está vacío sin JS. |

---

## 1. Desglose por Plataforma de Búsqueda IA

*(Nota: Sin integración activa de DataForSEO/SE Ranking MCP en esta sesión, se reporta la preparación cualitativa medida directamente sobre el sitio, sin inventar métricas de cuota de voz).*

| Plataforma | Estado Cualitativo | Análisis Específico para SoporteCero |
|---|---|---|
| **Google AI Overviews** | **Alto (Listo)** | Se alimenta del índice de `Googlebot`. Los 285 artículos están pre-renderizados en HTML limpio, tienen `TechArticle` JSON-LD y responden directamente a códigos de error específicos en los primeros párrafos. |
| **Google AI Mode** | **Medio-Alto** | AI Mode cita un conjunto más amplio de dominios donde pesan la frescura y la autoridad de entidad. Las fechas (`datePublished`/`dateModified` de oct–nov 2026) son recientes, pero falta reforzar las señales de entidad externa (`sameAs` en Schema `Organization` y `Person`). |
| **ChatGPT Search** | **Alto (con matiz en `robots.txt`)** | Gobernado por `OAI-SearchBot` (actualmente permitido vía `User-agent: *`). Los artículos técnicos tienen bloques de solución directos ideales para RAG, aunque `/tools/index.html` es invisible sin JS. |
| **Perplexity AI** | **Alto** | Gobernado por `PerplexityBot` (permitido vía `User-agent: *`). La estructura de tabla de diagnóstico ("Síntoma / Causa Raíz / Solución") facilita la extracción directa de respuestas. |
| **Microsoft Copilot (Bing)** | **Medio** | Alimentado por el índice de Bing. El sitio no implementa **IndexNow**, lo que retrasa el descubrimiento inmediato de nuevos tutoriales y actualizaciones en Bing/Copilot. |

---

## 2. Estado de Acceso de Crawlers de IA (`robots.txt`)

Siguiendo la regla estricta de separación de capacidades de `seo-geo`, se evalúa cada bot según la función que gobierna en [robots.txt](file:///d:/Proyectos%20Antigravity/SoporteCero/robots.txt):

### A. Bots de Citabilidad en Buscadores IA (Search Citability)
| Bot | Proveedor | Capacidad que Gobierna | Regla Aplicada (`robots.txt`) | Estado en Raíz (`/`) | Observación Crítica |
|---|---|---|---|---|---|
| `Googlebot` | Google | Google Search, AI Overviews y AI Mode | `User-agent: *` (`Allow: /`) | **Permitido** | Bloqueado en `/*?cat=*` |
| `OAI-SearchBot` | OpenAI | Citabilidad en **ChatGPT Search** | `User-agent: *` (`Allow: /`) | **Permitido** | No tiene grupo nombrado propio; bloqueado en `/*?cat=*` |
| `Claude-SearchBot` | Anthropic | Citabilidad en **búsqueda de Claude** | `User-agent: *` (`Allow: /`) | **Permitido** | No tiene grupo nombrado propio; bloqueado en `/*?cat=*` |
| `PerplexityBot` | Perplexity | Índice de búsqueda y citas de **Perplexity** | `User-agent: *` (`Allow: /`) | **Permitido** | No tiene grupo nombrado propio; bloqueado en `/*?cat=*` |
| `Applebot` | Apple | Búsqueda en Siri, Spotlight y Safari | `User-agent: *` (`Allow: /`) | **Permitido** | Permitido |

### B. Bots de Entrenamiento de Modelos (Model Training & Grounding Control)
| Bot / Token | Proveedor | Capacidad que Gobierna | Regla Aplicada (`robots.txt`) | Estado Efectivo Actual | Discrepancia Detectada |
|---|---|---|---|---|---|
| `GPTBot` | OpenAI | Entrenamiento de modelos de OpenAI (NO afecta ChatGPT Search) | `User-agent: *` (`Allow: /`) | **Permitido para rastreo** | `robots.txt` declara `Content-Signal: ai-train=no`, pero `Allow: /` permite a `GPTBot` descargar todo el sitio. |
| `ClaudeBot` | Anthropic | Entrenamiento de modelos de Anthropic (NO afecta búsqueda de Claude) | `User-agent: *` (`Allow: /`) | **Permitido para rastreo** | Misma discrepancia entre `ai-train=no` y `Allow: /`. |
| `Google-Extended` | Google | Entrenamiento/grounding de Gemini y Vertex AI (NO afecta Google Search ni AI Overviews) | `User-agent: *` (`Allow: /`) | **Permitido** | Google **no** procesa `Content-Signal`; para excluir entrenamiento se requiere un grupo `User-agent: Google-Extended` con `Disallow: /`. |
| `CCBot` | Common Crawl | Dataset abierto de entrenamiento | `User-agent: *` (`Allow: /`) | **Permitido** | Sin bloqueo explícito. |
| `Applebot-Extended` | Apple | Exclusión de entrenamiento de Apple Intelligence (NO afecta Siri/Safari) | `User-agent: *` (`Allow: /`) | **Permitido** | Sin bloqueo explícito. |

---

## 3. Evaluación de `/llms.txt` y `/llms-full.txt`

> [!NOTE]
> **Evidencia primaria (Google Search Central, 2026-06-15 / 2026-07-10)**: Google declara explícitamente que Google Search ignora `llms.txt` y que no ayuda ni perjudica el posicionamiento en Google Search ni en AI Overviews. Su valor en **SoporteCero** (portal para desarrolladores y sysadmins) reside en **agentes de codificación** (Cursor, Claude Code, Cline, Continue) y en la auditoría de laboratorio de Lighthouse (`llms-txt`).

- **Estado en vivo**:
  - `https://soportecero.com/llms.txt`: `HTTP 200 OK` (`text/plain; charset=utf-8`, 2,161 bytes). Pasa las 3 reglas de Lighthouse 13.5 (`H1` presente, enlaces Markdown válidos, >50 caracteres).
  - `https://soportecero.com/llms-full.txt`: `HTTP 200 OK` (124,067 bytes) con el índice completo de los 144 artículos en español y 141 en inglés.
- **Problemas detectados en [llms.txt](file:///d:/Proyectos%20Antigravity/SoporteCero/llms.txt)**:
  1. **Enlaces a rutas bloqueadas por `robots.txt` (Líneas 9-11)**: Enlaza a `https://soportecero.com/?cat=sistemas`, `?cat=gaming` y `?cat=web`, las cuales están prohibidas por `Disallow: /*?cat=*` en `robots.txt`.
  2. **Omisión de la Suite de Calculadoras (`/tools/`)**: `llms.txt` no menciona ninguna de las 6 calculadoras financieras/técnicas (`/tools/comisiones-pasarelas-pago.html`, `/tools/tarifa-hora-freelance.html`, etc.).
  3. **Enlaces a endpoints rotos o inactivos**: Promociona `/.well-known/mcp/server-card.json` (cuyo servidor `/mcp` devuelve `503 Service Unavailable`) y `/.well-known/agent-card.json` (cuyo endpoint `/a2a` devuelve `404 Not Found`).

---

## 4. Citabilidad a Nivel de Pasaje y Prueba Who / How / Why (E-E-A-T)

- **Lo que funciona extraordinariamente bien**:
  - **Front-loading (Primer 30% de la página)**: Cada artículo abre con una introducción técnica concisa seguida inmediatamente por la consola **`Diagnóstico Técnico y Causa Raíz`** (transformada desde tabla Markdown por [scripts/build.js](file:///d:/Proyectos%20Antigravity/SoporteCero/scripts/build.js#L305-L377)), que resume *Síntoma*, *Causa Raíz* y *Solución* en bloques autocontenidos de 40 a 120 palabras.
  - **Prueba Who / How / Why de Google**:
    - **Who (Quién)**: Cada artículo muestra la tarjeta de autor de **Rodolfo Castro** y enlaza a [sobre-mi.html](file:///d:/Proyectos%20Antigravity/SoporteCero/sobre-mi.html) y [nosotros.html](file:///d:/Proyectos%20Antigravity/SoporteCero/nosotros.html).
    - **How (Cómo)**: Tanto `sobre-mi.html` como cada artículo documentan el entorno de laboratorio (KVM/Proxmox, contenedores aislados, Steam Deck) y las herramientas de diagnóstico (`strace`, `ss`, `journalctl`).
    - **Why (Por qué)**: Propósito claro orientado a resolver errores reales sin relleno.
- **Brechas de Autoridad y Citabilidad**:
  1. **Imagen única repetida en los 285 artículos (`og-image.png`)**: Todos los artículos declaran `"image": "https://soportecero.com/og-image.png"` en su `TechArticle` JSON-LD y carecen de imágenes o diagramas específicos dentro del cuerpo del artículo.
  2. **Grafo de Entidad (`sameAs`) incompleto**: En el JSON-LD de los artículos ([scripts/build.js](file:///d:/Proyectos%20Antigravity/SoporteCero/scripts/build.js#L936-L938)), `author.sameAs` solo incluye `https://www.pixeldigitaldz.online/links`, y `publisher` (`Organization`) no tiene ninguna propiedad `sameAs` (GitHub, LinkedIn, X/Twitter, YouTube) ni existe un `Organization` schema en la portada.
  3. **Inconsistencia en el cargo profesional del autor (`jobTitle`)**:
     - En [sobre-mi.html](file:///d:/Proyectos%20Antigravity/SoporteCero/sobre-mi.html#L111), Rodolfo Castro se presenta como *"Fundador • Desarrollador Full-Stack • Administrador de Sistemas"*.
     - En cambio, en el JSON-LD `TechArticle` de los 285 artículos ([scripts/build.js](file:///d:/Proyectos%20Antigravity/SoporteCero/scripts/build.js#L934)) aparece únicamente como `"jobTitle": "Diseñador Web & Creador de Apps"`, lo cual diluye la señal de experiencia técnica (E-E-A-T) para artículos de kernel Linux, SysAdmin y Docker frente a evaluadores de calidad y motores generativos.

---

## 5. Top 5 Cambios de Mayor Impacto para GEO

1. **Unificar credenciales de E-E-A-T y `sameAs` en `TechArticle`, `Organization` y `ProfilePage`**: Actualizar `jobTitle` en `scripts/build.js` a `"Fundador, Desarrollador Full-Stack & Administrador de Sistemas Linux"`, apuntar `author.url` a `https://soportecero.com/sobre-mi.html`, añadir `ProfilePage` JSON-LD en `sobre-mi.html` y `en/about.html`, e incorporar perfiles verificables (GitHub, LinkedIn, etc.) en `sameAs`.
2. **Pre-renderizar el hub `/tools/index.html`**: Inyectar en `/tools/index.html` contenido estático indexable con enlaces `<a href>` reales y descripciones de las 6 calculadoras para que `OAI-SearchBot`, `PerplexityBot` y `Claude-SearchBot` puedan descubrir y citar el hub de herramientas sin depender de JavaScript.
3. **Alinear `robots.txt` con la política declarada en `Content-Signal` y desbloquear o reemplazar enlaces `/*?cat=*`**: Eliminar la contradicción entre `Disallow: /*?cat=*` y los enlaces de navegación/`llms.txt`, y definir grupos explícitos en `robots.txt` si deseas bloquear bots de entrenamiento (`GPTBot`, `ClaudeBot`, `Google-Extended`) manteniendo permitidos los de búsqueda (`OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`).
4. **Activar el Worker de Cloudflare (`wrangler.toml`) y reparar los endpoints de agentes (`/mcp`, `/a2a`)**: Si se publican tarjetas de descubrimiento en `/.well-known/`, los endpoints declarados no deben devolver `503` ni `404`.
5. **Implementar IndexNow**: Enviar automáticamente las URLs nuevas o modificadas desde `scripts/build.js` a la API de IndexNow para indexación inmediata en Bing y citabilidad en **Microsoft Copilot**.

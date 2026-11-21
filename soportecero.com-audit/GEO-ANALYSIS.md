# Análisis GEO (Generative Engine Optimization) — soportecero.com

- **URL Auditada**: `https://soportecero.com/`
- **Fecha**: 2026-11-15
- **Puntuación Heurística de Preparación GEO**: **81 / 100** *(lista de control heurística 25/20/15/20/20 de `seo-geo`; no representa una predicción de tasa de citación).*

---

## 1. Desglose de Criterios GEO

| Criterio | Peso | Puntaje | Hallazgos Clave |
|---|---|---|---|
| **Citabilidad de Pasajes (Citability)** | 25% | **86/100** | Las 285 guías técnicas (144 ES + 141 EN) presentan una consola diagnóstica ("Síntoma / Causa / Solución") en el primer 25% del documento, con bloques autocontenidos de 40–120 palabras ideales para RAG y AI Overviews. |
| **Legibilidad Estructural** | 20% | **92/100** | Excelente jerarquía `H1 -> H2 -> H3`, tabla de contenidos (`ToC`) numerada, pasos estructurados en `<ol class="steps-list">` y preguntas frecuentes (`FAQ`) al cierre. |
| **Contenido Multimodal** | 15% | **58/100** | Fuerte presencia de bloques de código con resaltado sintáctico y tablas comparativas en `/tools/`, pero ausencia de diagramas de arquitectura propios o capturas reales de terminal (los 285 artículos reutilizan `/og-image.png`). |
| **Autoridad y Señales de Marca** | 20% | **76/100** | Cumple con la prueba **Who / How / Why** de Google (autoría de Rodolfo Castro, metodología en laboratorio KVM/Proxmox/Steam Deck), pero carece de `sameAs` hacia GitHub, LinkedIn, YouTube, Reddit o Wikidata, y el `jobTitle` en el JSON-LD (`"Diseñador Web & Creador de Apps"`) no refleja su rol de SysAdmin/Full-Stack descrito en `sobre-mi.html`. |
| **Accesibilidad Técnica para IA** | 20% | **84/100** | Artículos 100% pre-renderizados en HTML y `.md` estáticos disponibles en `/index.md` y `/articulos/*.md`. Penalizado porque `/tools/index.html` es un shell CSR vacío (`<div id="root"></div>`), `robots.txt` bloquea `/*?cat=*` (usado en `llms.txt`) y los endpoints `/mcp` y `/a2a` devuelven `503` y `404`. |

---

## 2. Estado de Acceso de Crawlers de IA (`robots.txt`)

> [!IMPORTANT]
> Según `seo-geo`, el acceso para **entrenamiento de modelos** y la **citabilidad en buscadores IA** son capacidades independientes gobernadas por bots distintos y nunca deben mezclarse.

| User-Agent | Proveedor | Capacidad que Gobierna | Estado en `/` | Estado en `/*?cat=*` | Diagnóstico |
|---|---|---|---|---|---|
| `Googlebot` | Google | Google Search, **AI Overviews** y **AI Mode** | Permitido | Bloqueado | Indexa todos los artículos y calculadoras pre-renderizadas. |
| `OAI-SearchBot` | OpenAI | Citabilidad en **ChatGPT Search** | Permitido (`*`) | Bloqueado | Permitido por comodín `*`, pero sin grupo explícito y sin poder seguir los enlaces `?cat=` de `llms.txt`. |
| `Claude-SearchBot` | Anthropic | Citabilidad en **búsqueda de Claude** | Permitido (`*`) | Bloqueado | Permitido por comodín `*`. |
| `PerplexityBot` | Perplexity | Índice de búsqueda de **Perplexity** | Permitido (`*`) | Bloqueado | Permitido por comodín `*`. |
| `GPTBot` | OpenAI | **Entrenamiento de modelos** de OpenAI (NO ChatGPT Search) | Permitido (`*`) | Bloqueado | Contradice la intención de `Content-Signal: ai-train=no`. |
| `ClaudeBot` | Anthropic | **Entrenamiento de modelos** de Anthropic (NO búsqueda Claude) | Permitido (`*`) | Bloqueado | Contradice la intención de `Content-Signal: ai-train=no`. |
| `Google-Extended` | Google | **Entrenamiento/grounding de Gemini y Vertex AI** (NO afecta Google Search ni AI Overviews) | Permitido (`*`) | Bloqueado | Google no lee `Content-Signal`; requiere `User-agent: Google-Extended` + `Disallow: /` si se desea excluir del entrenamiento. |
| `Applebot-Extended` | Apple | Exclusión de entrenamiento de **Apple Intelligence** | Permitido (`*`) | Bloqueado | Permitido por comodín `*`. |
| `CCBot` | Common Crawl | Dataset abierto de entrenamiento | Permitido (`*`) | Bloqueado | Permitido por comodín `*`. |

---

## 3. Evaluación de `/llms.txt` y `/llms-full.txt`

- **Posición de Google (Search Central, 2026-06-15 / 2026-07-10)**: Google Search ignora `/llms.txt` y no lo utiliza como señal de posicionamiento ni citación. Su utilidad en SoporteCero es para **agentes de desarrollo** (Cursor, Claude Code, Cline) y cumplimiento del check de laboratorio de Lighthouse 13.5 (`llms-txt`).
- **Archivos presentes**:
  - `/llms.txt` (`200 OK`, 2,161 bytes) — Pasa el check `llms-txt` de Lighthouse.
  - `/llms-full.txt` (`200 OK`, 124,067 bytes) — Lista las 285 guías bilingües.
- **Correcciones necesarias en `/llms.txt`**:
  1. Sustituir o complementar las URLs `https://soportecero.com/?cat=...` (bloqueadas por `Disallow: /*?cat=*` en `robots.txt`).
  2. Incluir la sección de las **6 Calculadoras Interactivas (`/tools/`)** que actualmente no aparecen en `llms.txt`.
  3. Retirar o reparar las referencias a `/mcp` (`503`) y `/a2a` (`404`) hasta que el Worker esté activo.

---

## 4. Recomendaciones de Schema.org para Descubribilidad en IA

1. **En `index.html` y `en/index.html`**: Añadir JSON-LD `@graph` con `Organization` (incluyendo `name`, `url`, `logo`, `founder` y `sameAs`) y `WebSite`.
2. **En `sobre-mi.html` y `en/about.html`**: Añadir JSON-LD `ProfilePage` con `mainEntity` de tipo `Person` para **Rodolfo Castro**, detallando `knowsAbout`: `["Linux Kernel", "Docker Compose", "System Administration", "Nginx", "Proton/Vulkan Gaming", "Full-Stack Web Development"]`.
3. **En `scripts/build.js` (`TechArticle`)**:
   - Cambiar `author.jobTitle` de `"Diseñador Web & Creador de Apps"` a `"Fundador, Desarrollador Full-Stack & Administrador de Sistemas"` para alinear la credencial técnica con la temática de SysAdmin/DevOps.
   - Eliminar la generación del bloque `HowTo` (deprecado por Google en septiembre de 2023).

---

## 5. Top 5 Cambios de Mayor Impacto (GEO + Agentic)

1. **Pre-renderizar `/tools/index.html` en `scripts/prerender-tools.js`** para que no sea un `<div id="root"></div>` vacío ante crawlers que no ejecutan JS.
2. **Alinear `robots.txt` con `llms.txt`** (separando grupos explícitos para bots de búsqueda `OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot` frente a bots de entrenamiento `GPTBot`, `ClaudeBot`, `Google-Extended`, y resolviendo el bloqueo de `/*?cat=*`).
3. **Enriquecer el grafo de entidades (`Organization`, `ProfilePage`, `Person`) y unificar `jobTitle` + `sameAs`**.
4. **Exponer `<link rel="alternate" type="text/markdown">` en el `<head>`** de la portada y de los 285 artículos apuntando a `/index.md` y `/articulos/<slug>.md`.
5. **Corregir los tipos MIME de `/.well-known/ai-catalog.json` y activar o limpiar los endpoints de agentes (`/mcp`, `/a2a`)**.

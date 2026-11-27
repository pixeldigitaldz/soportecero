import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { execSync } from 'child_process';
import matter from 'gray-matter';
import { marked } from 'marked';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(PROJECT_ROOT, 'src');
const CONTENT_DIR = path.join(PROJECT_ROOT, 'content', 'posts');
const DIST_DIR = PROJECT_ROOT;

// Category mapping helper for index card filtering
const CATEGORY_MAP_ES = {
  'Sistemas y Servidores': 'sistemas',
  'Gaming Tech': 'gaming',
  'Web y Código': 'web'
};

const CATEGORY_MAP_EN = {
  'Systems & Servers': 'sistemas',
  'Gaming Tech': 'gaming',
  'Web & Code': 'web'
};

const CATEGORY_HUBS = [
  {
    key: 'sistemas',
    es: {
      name: 'Sistemas y Servidores',
      slug: 'sistemas',
      path: '/categorias/sistemas.html',
      url: 'https://soportecero.com/categorias/sistemas.html',
      title: 'Sistemas y Servidores: Linux, Docker, Nginx, SSH y Cloudflare | SoporteCero',
      description: 'Archivo completo de guías técnicas verificadas para administradores de sistemas: errores en Linux, Docker, Proxmox, Nginx, SSH, systemd, bases de datos y Cloudflare.',
      intro: 'Soluciones prácticas y comandos listos para producción sobre administración Linux, contenedores Docker, servidores web Nginx/Apache, túneles Cloudflare, Proxmox, bases de datos y seguridad SSH.'
    },
    en: {
      name: 'Systems & Servers',
      slug: 'systems',
      path: '/en/categories/systems.html',
      url: 'https://soportecero.com/en/categories/systems.html',
      title: 'Systems & Servers: Linux, Docker, Nginx, SSH & Cloudflare | SoporteCero',
      description: 'Complete archive of verified troubleshooting guides for sysadmins and DevOps: Linux kernel, Docker containers, Nginx reverse proxies, SSH, systemd, and Cloudflare.',
      intro: 'Production-tested commands and root-cause fixes covering Linux server administration, Docker networking and storage, Nginx/Apache tuning, Cloudflare edge errors, Proxmox, and SSH.'
    }
  },
  {
    key: 'gaming',
    es: {
      name: 'Gaming Tech',
      slug: 'gaming',
      path: '/categorias/gaming.html',
      url: 'https://soportecero.com/categorias/gaming.html',
      title: 'Gaming Tech: Proton, Vulkan, Linux Gaming, Drivers GPU y FPS | SoporteCero',
      description: 'Guías técnicas para optimizar rendimiento en PC y Linux Gaming: eliminación de stuttering DXVK/VKD3D, Steam Deck, Gamescope, PipeWire, drivers NVIDIA/AMD y errores DirectX.',
      intro: 'Diagnósticos y optimizaciones de bajo nivel para gaming en Linux y Windows: compilación de shaders Vulkan/DXVK, VKD3D-Proton, latencia de audio PipeWire, controladores NVIDIA/AMD y Steam Deck.'
    },
    en: {
      name: 'Gaming Tech',
      slug: 'gaming',
      path: '/en/categories/gaming.html',
      url: 'https://soportecero.com/en/categories/gaming.html',
      title: 'Gaming Tech: Proton, Vulkan, Linux Gaming, GPU Drivers & FPS | SoporteCero',
      description: 'Technical guides to fix stuttering, shader compilation lag, DirectX/Vulkan crashes, Proton compatibility, Steam Deck Gamescope, and GPU driver issues.',
      intro: 'Low-level performance tuning and crash troubleshooting for Linux and PC gaming: DXVK/VKD3D-Proton shader pipelines, Wayland explicit sync, PipeWire audio, and NVIDIA/AMD driver fixes.'
    }
  },
  {
    key: 'web',
    es: {
      name: 'Web y Código',
      slug: 'web',
      path: '/categorias/web.html',
      url: 'https://soportecero.com/categorias/web.html',
      title: 'Web y Código: Node.js, Next.js, Vite, TypeScript, Git y CORS | SoporteCero',
      description: 'Soluciones de desarrollo web Full-Stack: errores de compilación en Node.js, Next.js SSR, Vite, TypeScript, dependencias npm, Git, Firebase y CORS.',
      intro: 'Resolución directa de fallos en desarrollo web moderno: Node.js V8 heap, Next.js App Router y SSR, Vite, conflictos de dependencias npm, TypeScript, Git, Firebase y cabeceras CORS.'
    },
    en: {
      name: 'Web & Code',
      slug: 'web',
      path: '/en/categories/web.html',
      url: 'https://soportecero.com/en/categories/web.html',
      title: 'Web & Code: Node.js, Next.js, Vite, TypeScript, Git & CORS | SoporteCero',
      description: 'Full-stack web development troubleshooting: Node.js build errors, Next.js SSR exceptions, Vite bundling, TypeScript, npm dependency trees, Git, and CORS.',
      intro: 'Actionable engineering fixes for web developers: Node.js memory and npm errors, Next.js SSR/hydration mismatches, Vite builds, TypeScript AST errors, Git recovery, and CORS.'
    }
  }
];

function getCategoryHubMeta(categoryName, lang = 'es') {
  const key = lang === 'en' ? (CATEGORY_MAP_EN[categoryName] || CATEGORY_MAP_ES[categoryName]) : (CATEGORY_MAP_ES[categoryName] || CATEGORY_MAP_EN[categoryName]);
  const hub = CATEGORY_HUBS.find(h => h.key === key);
  return hub ? hub[lang] : null;
}

// Helper function to copy directories recursively
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (let entry of entries) {
    if (entry.name.includes('sync-conflict')) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Slugify helper for anchor link IDs and category paths
function slugify(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// Circular + Tag-weighted related posts algorithm (6 internal links per article)
function getRelatedPosts(currentPost, allPosts, count = 6) {
  const categoryPosts = allPosts.filter(p => p.category === currentPost.category && p.filename !== currentPost.filename);
  const currentTags = new Set((currentPost.tags || []).map(t => String(t).toLowerCase()));

  const scored = categoryPosts.map((p, idx) => {
    const overlap = (p.tags || []).reduce((acc, t) => acc + (currentTags.has(String(t).toLowerCase()) ? 1 : 0), 0);
    return { post: p, overlap, idx };
  });

  const allInCategory = allPosts.filter(p => p.category === currentPost.category);
  const currentIdxInCat = Math.max(0, allInCategory.findIndex(p => p.filename === currentPost.filename));
  scored.sort((a, b) => {
    if (b.overlap !== a.overlap) return b.overlap - a.overlap;
    const distA = (a.idx - currentIdxInCat + categoryPosts.length) % Math.max(1, categoryPosts.length);
    const distB = (b.idx - currentIdxInCat + categoryPosts.length) % Math.max(1, categoryPosts.length);
    return distA - distB;
  });

  const selected = scored.slice(0, count).map(s => s.post);

  if (selected.length < count && allPosts.length > 1) {
    const globalIndex = allPosts.findIndex(p => p.filename === currentPost.filename);
    for (let i = 1; i < allPosts.length && selected.length < count; i++) {
      const candidateIdx = (globalIndex + i) % allPosts.length;
      const candidate = allPosts[candidateIdx];
      if (candidate.filename !== currentPost.filename && !selected.some(s => s.filename === candidate.filename)) {
        selected.push(candidate);
      }
    }
  }

  return selected;
}

// Generate Directory Index section for complete SEO discoverability
function generateDirectoryIndex(posts, lang = 'es') {
  const isEn = lang === 'en';
  const summaryTitle = isEn
    ? 'View Full Directory of Technical Guides // Archive'
    : 'Ver índice completo de guías técnicas // Archivo';

  const groups = {};
  for (let post of posts) {
    const cat = post.category || (isEn ? 'Other' : 'Otros');
    if (!groups[cat]) {
      groups[cat] = [];
    }
    groups[cat].push(post);
  }

  let categoriesHtml = '';
  for (const [catName, catPosts] of Object.entries(groups)) {
    const itemsHtml = catPosts.map(p => {
      const url = isEn ? `articulos/${p.filename}.html` : p.url;
      return `<li class="directory-item"><a href="${url}">${p.title}</a></li>`;
    }).join('\n            ');

    categoriesHtml += `
        <div class="directory-category-col">
          <h4 class="directory-cat-title">
            <span>${catName}</span>
            <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">(${catPosts.length})</span>
          </h4>
          <ul class="directory-links-list">
            ${itemsHtml}
          </ul>
        </div>`;
  }

  return `
  <!-- Directory Index for Search Engines & Full Site Crawling -->
  <section class="directory-index" aria-label="${isEn ? 'Technical Guides Directory' : 'Índice de Guías Técnicas'}">
    <div class="directory-container">
      <details class="directory-details">
        <summary class="directory-summary">
          <span>${summaryTitle}</span>
          <span class="directory-badge">${posts.length} ${isEn ? 'guides' : 'artículos'}</span>
        </summary>
        <div class="directory-grid">
          ${categoriesHtml}
        </div>
      </details>
    </div>
  </section>`;
}

// Helper to inject hreflang and lang_selector into static files
function compileStaticPage(srcPath, destPath, urlPathEs, urlPathEn, lang = 'es') {
  let content = fs.readFileSync(srcPath, 'utf-8');
  const hreflang = `
  <link rel="alternate" hreflang="es" href="https://soportecero.com/${urlPathEs}" />
  <link rel="alternate" hreflang="en" href="https://soportecero.com/en/${urlPathEn}" />
  <link rel="alternate" hreflang="x-default" href="https://soportecero.com/${urlPathEs}" />
  `;
  content = content.replace('{{hreflang}}', hreflang);

  if (urlPathEs.includes('legal/')) {
    content = content.replace(
      /<meta\s+name=["']robots["']\s+content=["'][^"']*["']\s*\/?>/i,
      '<meta name="robots" content="noindex, follow">'
    );
  }

  let langSelector = '';
  if (lang === 'es') {
    const prefix = urlPathEs.includes('legal/') ? '../en/' : 'en/';
    langSelector = `
    <div class="lang-selector">
      <span class="lang-active">ES</span>
      <span class="lang-separator">|</span>
      <a href="${prefix}${urlPathEn}" class="lang-inactive">EN</a>
    </div>
    `;
  } else {
    const prefix = urlPathEs.includes('legal/') ? '../../' : '../';
    langSelector = `
    <div class="lang-selector">
      <a href="${prefix}${urlPathEs}" class="lang-inactive">ES</a>
      <span class="lang-separator">|</span>
      <span class="lang-active">EN</span>
    </div>
    `;
  }
  content = content.replace('{{lang_selector}}', langSelector);

  fs.writeFileSync(destPath, content, 'utf-8');
}

// Lightweight syntax highlighter for developer documentation
function highlightCode(code, lang = '') {
  const l = (lang || '').toLowerCase().trim();
  const placeholders = [];
  const addPlaceholder = (html) => {
    const idx = placeholders.length;
    placeholders.push(html);
    return `___TOK_${idx}___`;
  };

  let str = code;

  // 1. Comments
  if (['bash', 'sh', 'shell', 'dockerfile', 'yaml', 'yml', 'ini', 'nginx', 'apache', 'conf'].includes(l)) {
    str = str.replace(/(^|[^\\])#.*$/gm, (match) => addPlaceholder(`<span class="tok-cmt">${match}</span>`));
  } else if (l === 'sql') {
    str = str.replace(/--.*$/gm, (match) => addPlaceholder(`<span class="tok-cmt">${match}</span>`));
    str = str.replace(/\/\*[\s\S]*?\*\//g, (match) => addPlaceholder(`<span class="tok-cmt">${match}</span>`));
  } else {
    str = str.replace(/\/\*[\s\S]*?\*\//g, (match) => addPlaceholder(`<span class="tok-cmt">${match}</span>`));
    str = str.replace(/(^|[^:])\/\/.*$/gm, (match) => addPlaceholder(`<span class="tok-cmt">${match}</span>`));
    if (l === 'python' || l === 'py') {
      str = str.replace(/(^|[^\\])#.*$/gm, (match) => addPlaceholder(`<span class="tok-cmt">${match}</span>`));
    }
  }

  // 2. Strings (handles standard quotes and HTML-escaped entities)
  str = str.replace(/(`[\s\S]*?`|&#39;[\s\S]*?&#39;|\x27[\s\S]*?\x27|&quot;[\s\S]*?&quot;|"[\s\S]*?")/g, (match) => {
    return addPlaceholder(`<span class="tok-str">${match}</span>`);
  });

  // 3. Keywords
  if (['bash', 'sh', 'shell', 'cmd', 'powershell'].includes(l)) {
    const bashKw = /\b(sudo|systemctl|journalctl|docker-compose|docker|npm|npx|yarn|pnpm|node|git|curl|wget|tar|chmod|chown|mkdir|rm|cp|mv|grep|cat|echo|nano|vim|sed|awk|pacman|apt-get|apt|yum|dnf|service|export|source|alias|set|cd|ls|df|free|top|htop|killall|kill|ss|netstat|ip|iptables|ufw|firewall-cmd|mount|umount|rsync|ssh|scp|ln|which|find|crontab|reboot|shutdown)\b/g;
    str = str.replace(bashKw, (match) => addPlaceholder(`<span class="tok-kw">${match}</span>`));
    str = str.replace(/(^|\s)(-[a-zA-Z0-9_-]+|--[a-zA-Z0-9_-]+)/g, (match, prefix, flag) => {
      return prefix + addPlaceholder(`<span class="tok-prop">${flag}</span>`);
    });
  } else if (['nginx', 'apache', 'conf'].includes(l)) {
    const nginxKw = /\b(server|location|listen|server_name|root|index|proxy_pass|proxy_set_header|try_files|return|rewrite|fastcgi_pass|fastcgi_param|include|access_log|error_log|ssl_certificate|ssl_certificate_key|client_max_body_size|add_header|upstream|worker_processes|events|http|sendfile|keepalive_timeout)\b/g;
    str = str.replace(nginxKw, (match) => addPlaceholder(`<span class="tok-kw">${match}</span>`));
  } else if (['dockerfile', 'yaml', 'yml'].includes(l)) {
    const dockerKw = /\b(FROM|RUN|CMD|LABEL|EXPOSE|ENV|ADD|COPY|ENTRYPOINT|VOLUME|USER|WORKDIR|ARG|ONBUILD|STOPSIGNAL|HEALTHCHECK|SHELL|version|services|image|ports|environment|volumes|restart|depends_on|networks)\b/g;
    str = str.replace(dockerKw, (match) => addPlaceholder(`<span class="tok-kw">${match}</span>`));
  } else if (l === 'sql') {
    const sqlKw = /\b(SELECT|FROM|WHERE|INSERT|INTO|UPDATE|SET|DELETE|CREATE|TABLE|ALTER|DROP|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|BY|ORDER|HAVING|LIMIT|OFFSET|AND|OR|NOT|IN|IS|NULL|PRIMARY|KEY|FOREIGN|REFERENCES)\b/gi;
    str = str.replace(sqlKw, (match) => addPlaceholder(`<span class="tok-kw">${match}</span>`));
  } else {
    // JavaScript, TypeScript, PHP, Python, default
    const jsKw = /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|default|try|catch|finally|throw|new|class|extends|super|this|import|export|from|as|await|async|yield|typeof|instanceof|void|delete|in|of|type|interface|enum|implements|public|private|protected|readonly|static|true|false|null|undefined|NaN|require)\b/g;
    str = str.replace(jsKw, (match) => addPlaceholder(`<span class="tok-kw">${match}</span>`));
  }

  // 4. Properties & Methods
  str = str.replace(/\.([a-zA-Z0-9_$]+)(?=\s*\()/g, (match, p1) => {
    return '.' + addPlaceholder(`<span class="tok-prop">${p1}</span>`);
  });
  str = str.replace(/\b(OPTIONS|GET|POST|PUT|DELETE|PATCH|HEAD|status|headers|json|method|url|origin)\b/g, (match) => {
    return addPlaceholder(`<span class="tok-prop">${match}</span>`);
  });

  // 5. Numbers (safe from character entities)
  str = str.replace(/(?<!&#)\b(\d+(?:\.\d+)?)\b/g, (match) => {
    return addPlaceholder(`<span class="tok-num">${match}</span>`);
  });

  // 6. Restore placeholders in reverse order
  for (let i = placeholders.length - 1; i >= 0; i--) {
    str = str.split(`___TOK_${i}___`).join(placeholders[i]);
  }

  return str;
}

// Helper to format clean heading titles for Table of Contents
function formatToCText(text) {
  let cleaned = (text || '').trim();
  if (cleaned.includes('//')) {
    cleaned = cleaned.split('//')[0].trim();
  }
  // Convert ALL-CAPS titles to clean Title Case
  if (cleaned.length > 3 && cleaned === cleaned.toUpperCase()) {
    cleaned = cleaned
      .toLowerCase()
      .split(' ')
      .map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : '')
      .join(' ');
  }
  return cleaned;
}

// Custom post-processor for HTML content to inject SoporteCero layouts
function postProcessHtml(rawHtml, lang = 'es') {
  let html = rawHtml;
  let parsedSteps = [];
  let parsedFaqs = [];
  const isEn = lang === 'en';

  // 1. Code blocks wrapping in custom containers with copy buttons and syntax highlighting
  html = html.replace(/<pre><code(?: class="language-([^"]*)")?>([\s\S]*?)<\/code><\/pre>/g, (match, langClass, code) => {
    const rawLang = langClass ? langClass.trim() : '';
    const displayLang = rawLang ? rawLang.toUpperCase() : (isEn ? 'CODE' : 'CÓDIGO');
    const copyLabel = isEn ? 'Copy' : 'Copiar';
    const copiedLabel = isEn ? 'Copied' : 'Copiado';
    const highlightedCode = highlightCode(code, rawLang);
    return `
    <div class="code-container">
      <div class="code-header">
        <div class="code-header-left">
          <div class="code-dots" aria-hidden="true">
            <span class="code-dot"></span>
            <span class="code-dot"></span>
            <span class="code-dot"></span>
          </div>
          <span class="code-lang">${displayLang}</span>
        </div>
        <button class="copy-btn" type="button" aria-label="${isEn ? 'Copy code to clipboard' : 'Copiar código al portapapeles'}" data-copy-label="${copyLabel}" data-copied-label="${copiedLabel}">
          <svg class="copy-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span class="copy-text">${copyLabel}</span>
        </button>
      </div>
      <pre class="formatted-pre"><code>${highlightedCode}</code></pre>
    </div>
    `;
  });

  // 2. Diagnostic Box / Telemetry Matrix layout wrapping
  const diagRegex = /<h2[^>]*>[^<]*(?:Entorno de Laboratorio y Diagnóstico|Entorno de Laboratorio y Diagnóstico Previo|Diagnóstico|Diagnostics|Diagnostic)[^<]*<\/h2>\s*(?:[\s\S]*?)(<table>[\s\S]*?<\/table>)/i;

  const transformTableToCards = (htmlStr) => {
    return htmlStr.replace(/<table>([\s\S]*?)<\/table>/gi, (match, tableInner) => {
      let cardsHtml = '<div class="diagnostic-cards">';
      const theadMatch = tableInner.match(/<thead>([\s\S]*?)<\/thead>/i);
      let headers = [];
      if (theadMatch) {
        headers = [...theadMatch[1].matchAll(/<th>([\s\S]*?)<\/th>/gi)].map(m => m[1].trim());
      }
      const tbodyMatch = tableInner.match(/<tbody>([\s\S]*?)<\/tbody>/i);
      const rowsContext = tbodyMatch ? tbodyMatch[1] : tableInner.replace(/<thead>[\s\S]*?<\/thead>/i, '');
      const rows = [...rowsContext.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)];
      
      for (const row of rows) {
        const cells = [...row[1].matchAll(/<td>([\s\S]*?)<\/td>/gi)].map(m => m[1].trim());
        cardsHtml += '<div class="diag-card">';
        for (let i = 0; i < cells.length; i++) {
          const rawLabel = (headers[i] || '').replace(/<[^>]+>/g, '').trim();
          let badgeClass = 'diag-badge-default';
          let badgeText = rawLabel.toUpperCase() || 'INFO';

          const labelLower = rawLabel.toLowerCase();
          if (labelLower.includes('causa') || labelLower.includes('cause')) {
            badgeClass = 'diag-badge-cause';
            badgeText = 'CAUSA';
          } else if (labelLower.includes('soluci') || labelLower.includes('solut') || labelLower.includes('fix')) {
            badgeClass = 'diag-badge-solution';
            badgeText = isEn ? 'SOLUTION' : 'SOLUCIÓN';
          } else if (labelLower.includes('sintoma') || labelLower.includes('síntoma') || labelLower.includes('symptom') || labelLower.includes('error')) {
            badgeClass = 'diag-badge-symptom';
            badgeText = isEn ? 'SYMPTOM' : 'SÍNTOMA';
          }

          cardsHtml += `
          <div class="diag-row">
            <div class="diag-label">
              <span class="diag-badge ${badgeClass}">${badgeText}</span>
            </div>
            <div class="diag-value">${cells[i]}</div>
          </div>`;
        }
        cardsHtml += '</div>';
      }
      cardsHtml += '</div>';
      return cardsHtml;
    });
  };

  const diagMatch = html.match(diagRegex);
  if (diagMatch) {
    const diagTableContent = diagMatch[1];
    let formattedDiag = transformTableToCards(diagTableContent);
    const labHeading = isEn ? 'Lab Environment &amp; Diagnostics' : 'Entorno de Laboratorio y Diagnóstico';
    const consoleTitle = isEn ? 'Technical Diagnostics &amp; Root Cause Analysis' : 'Diagnóstico Técnico y Causa Raíz';
    const diagBoxHtml = `
    <h2>${labHeading}</h2>
    <section class="diagnostic-console" aria-labelledby="diag-heading">
      <div class="diagnostic-console-header">
        <div class="diag-console-title-group">
          <span class="diag-pulse-dot" aria-hidden="true"></span>
          <h3 id="diag-heading" class="diag-console-title">${consoleTitle}</h3>
        </div>
        <span class="diag-console-badge">${isEn ? 'Lab Environment' : 'Laboratorio Técnico'}</span>
      </div>
      <div class="diagnostic-console-body">
        ${formattedDiag}
      </div>
    </section>
    `;
    html = html.replace(diagMatch[0], diagBoxHtml);
  }

  // 3. Extraction of Prevention Tips section to populate Callout
  let preventionListHtml = '';
  const prevRegex = isEn
    ? /<h2[^>]*>[^<]*(?:Prevention Advice|Prevention|Prevention Tips|Best Practices|Consejo de Prevención|Consejos de Prevención|Prevención)[^<]*<\/h2>([\s\S]*?)(?=<h2|$)/i
    : /<h2[^>]*>[^<]*(?:Consejo de Prevención|Consejos de Prevención|Prevención|Prevencion|Buenas Prácticas)[^<]*<\/h2>([\s\S]*?)(?=<h2|$)/i;

  const preventionMatch = html.match(prevRegex);
  if (preventionMatch) {
    const sectionContent = preventionMatch[1];
    const liMatches = sectionContent.match(/<li>([\s\S]*?)<\/li>/g);
    
    if (liMatches) {
      preventionListHtml = liMatches.join('\n');
    } else {
      preventionListHtml = sectionContent;
    }
    html = html.replace(prevRegex, '');
  }

  // 4. Solution Steps list formatting & extraction
  const solTitle = isEn ? 'Step-by-Step Technical Implementation' : 'Implementación Técnica Paso a Paso';
  const solRegex = isEn
    ? /<h2[^>]*>[^<]*(?:Step-by-Step Technical Implementation|Step-by-Step Implementation|Step-by-Step Solution|Step-by-step Solution|Solution|How to solve|How to fix|Implementación Técnica Paso a Paso|La Solución Paso a Paso|Solución Paso a Paso|Cómo solucionar|Como solucionar)[^<]*<\/h2>([\s\S]*?)(?=<h2|$)/i
    : /<h2[^>]*>[^<]*(?:Implementación Técnica Paso a Paso|Implementación Paso a Paso|La Solución Paso a Paso|Solución Paso a Paso|Solución|Cómo solucionar|Como solucionar)[^<]*<\/h2>([\s\S]*?)(?=<h2|$)/i;

  const solutionMatch = html.match(solRegex);
  if (solutionMatch) {
    let solutionContent = solutionMatch[1];
    const olMatch = solutionContent.match(/<ol[^>]*>([\s\S]*?)<\/ol>/i);
    const h3Matches = [...solutionContent.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3|$)/gi)];

    if (olMatch) {
      const olContent = olMatch[1];
      const rawLis = olContent.split(/<li[^>]*>/i).slice(1);
      
      let stepIndex = 1;
      const formattedLis = rawLis.map(rawLi => {
        const liContent = rawLi.replace(/<\/li>\s*$/i, '');
        const boldMatch = liContent.match(/^<strong>(.*?)<\/strong>/i);
        let stepTitle = '';
        let stepBody = liContent;
        
        if (boldMatch) {
          stepTitle = boldMatch[1];
          stepBody = liContent.substring(boldMatch[0].length);
        } else {
          stepTitle = isEn ? `Step ${stepIndex}` : `Paso ${stepIndex}`;
        }

        const cleanTitle = stepTitle.replace(/<[^>]*>/g, '').trim();
        const stepSlug = slugify(cleanTitle) || `step-${stepIndex}`;

        parsedSteps.push({
          title: cleanTitle,
          body: stepBody,
          slug: stepSlug
        });
        
        const formatted = `
        <li class="step-item" id="${stepSlug}">
          <div class="step-number">${stepIndex}</div>
          <div class="step-body">
            <h4 id="${stepSlug}-heading">${stepTitle}</h4>
            ${stepBody}
          </div>
        </li>
        `;
        stepIndex++;
        return formatted;
      });

      const newOl = `<ol class="steps-list">\n${formattedLis.join('\n')}\n</ol>`;
      const newSolutionContent = solutionContent.replace(/<ol[^>]*>[\s\S]*?<\/ol>/i, newOl);
      
      html = html.replace(solutionMatch[0], 
        `<h2 class="solution-heading" style="display: flex; align-items: center; gap: 0.65rem;">
          <svg class="step-solution-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#06B6D4" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
          ${solTitle}
        </h2>\n${newSolutionContent}`);
    } else if (h3Matches.length > 0) {
      let stepIndex = 1;
      const formattedSteps = h3Matches.map(m => {
        const rawTitle = m[1].replace(/<[^>]*>/g, '').trim();
        const stepBody = m[2].trim();
        const cleanTitle = rawTitle.replace(/^Paso\s+\d+:\s*|^Step\s+\d+:\s*/i, '').trim() || rawTitle;
        const stepSlug = slugify(cleanTitle) || `step-${stepIndex}`;

        parsedSteps.push({
          title: cleanTitle,
          body: stepBody,
          slug: stepSlug
        });

        const formatted = `
        <li class="step-item" id="${stepSlug}">
          <div class="step-number">${stepIndex}</div>
          <div class="step-body">
            <h4 id="${stepSlug}-heading">${rawTitle}</h4>
            ${stepBody}
          </div>
        </li>
        `;
        stepIndex++;
        return formatted;
      });

      const newOl = `<ol class="steps-list">\n${formattedSteps.join('\n')}\n</ol>`;
      html = html.replace(solutionMatch[0],
        `<h2 class="solution-heading" style="display: flex; align-items: center; gap: 0.65rem;">
          <svg class="step-solution-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#06B6D4" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
          ${solTitle}
        </h2>\n${newOl}\n`);
    }
  }

  // 5. FAQ Section Extraction (for FAQ Schema)
  const faqRegex = isEn
    ? /<h2[^>]*>[^<]*(?:Frequently Asked Questions|FAQ|Common Questions)[^<]*<\/h2>([\s\S]*?)(?=<h2|$)/i
    : /<h2[^>]*>[^<]*(?:Preguntas Frecuentes|FAQ|Dudas Frecuentes)[^<]*<\/h2>([\s\S]*?)(?=<h2|$)/i;

  const faqMatch = html.match(faqRegex);
  if (faqMatch) {
    const faqContent = faqMatch[1];
    const qMatches = [...faqContent.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3|$)/gi)];
    for (const qm of qMatches) {
      const qText = qm[1].replace(/<[^>]*>/g, '').trim();
      const aText = qm[2].replace(/<[^>]*>/g, '').trim();
      if (qText && aText) {
        parsedFaqs.push({
          question: qText,
          answer: aText
        });
      }
    }
  }

  // 6. Automated Table of Contents (ToC) heading parser & Injector
  let tocItems = [];
  let headingCount = 0;
  
  html = html.replace(/<(h[23])[^>]*>([\s\S]*?)<\/h[23]>/gi, (match, tag, titleText) => {
    const cleanText = titleText
      .replace(/<[^>]*>/g, '')
      .replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDFFF]/g, '')
      .trim();

    const id = slugify(cleanText) || `seccion-${headingCount++}`;
    tocItems.push({
      tag: tag.toLowerCase(),
      id,
      text: cleanText
    });

    return `<${tag} id="${id}">${titleText}</${tag}>`;
  });

  let tocHtml = '';
  if (tocItems.length > 0) {
    const tocTree = [];
    let currentH2 = null;

    tocItems.forEach(item => {
      const displayText = formatToCText(item.text);
      if (item.tag === 'h2') {
        currentH2 = {
          ...item,
          displayText,
          children: []
        };
        tocTree.push(currentH2);
      } else if (item.tag === 'h3') {
        if (currentH2) {
          currentH2.children.push({
            ...item,
            displayText
          });
        } else {
          currentH2 = {
            tag: 'h2',
            id: item.id,
            text: item.text,
            displayText,
            children: []
          };
          tocTree.push(currentH2);
        }
      }
    });

    let h2Index = 1;
    let itemsHtml = '';

    tocTree.forEach(h2Item => {
      const numStr = String(h2Index++).padStart(2, '0');
      let sublistHtml = '';
      if (h2Item.children && h2Item.children.length > 0) {
        const subItems = h2Item.children.map(ch => `
          <li class="toc-subitem">
            <a href="#${ch.id}" class="toc-sublink">
              <span class="toc-subicon" aria-hidden="true">↳</span>
              <span class="toc-subtext">${ch.displayText}</span>
            </a>
          </li>
        `).join('\n');
        sublistHtml = `\n        <ul class="toc-sublist">\n${subItems}\n        </ul>`;
      }

      itemsHtml += `
        <li class="toc-item">
          <a href="#${h2Item.id}" class="toc-link">
            <span class="toc-number">${numStr}</span>
            <span class="toc-text">${h2Item.displayText}</span>
          </a>${sublistHtml}
        </li>
      `;
    });

    const tocTitle = isEn ? 'TABLE OF CONTENTS' : 'ÍNDICE DE CONTENIDO';
    tocHtml = `
    <nav class="toc-container" aria-label="${isEn ? 'Table of contents' : 'Índice de contenido'}">
      <div class="toc-header">
        <div class="toc-header-left">
          <svg class="toc-header-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="8" y1="6" x2="21" y2="6"></line>
            <line x1="8" y1="12" x2="21" y2="12"></line>
            <line x1="8" y1="18" x2="21" y2="18"></line>
            <line x1="3" y1="6" x2="3.01" y2="6"></line>
            <line x1="3" y1="12" x2="3.01" y2="12"></line>
            <line x1="3" y1="18" x2="3.01" y2="18"></line>
          </svg>
          <span class="toc-header-title">${tocTitle}</span>
        </div>
        <span class="toc-header-badge">${isEn ? 'Technical Index' : 'Índice Técnico'}</span>
      </div>
      <div class="toc-body">
        <ul class="toc-list">
${itemsHtml}
        </ul>
      </div>
    </nav>
    `;
  }

  if (tocHtml) {
    const sectionIndex = html.indexOf('</section>');
    if (sectionIndex !== -1) {
      html = html.substring(0, sectionIndex + 10) + '\n' + tocHtml + html.substring(sectionIndex + 10);
    } else {
      html = tocHtml + html;
    }
  }

  // 7. Strategic In-Article AdSense Injection (SC-InArticle - slot 5381801020)
  // Placed cleanly before major H2 transitions (never above the fold or inside code blocks)
  const adLabel = isEn ? 'Advertisement' : 'Publicidad';
  const inArticleAdHtml = `
  <!-- SC-InArticle -->
  <aside class="ad-slot-wrapper ad-slot-wrapper--in-article" aria-label="${adLabel}">
    <span class="ad-slot-label">${adLabel}</span>
    <div class="ad-slot-inner">
      <ins class="adsbygoogle"
           style="display:block; text-align:center;"
           data-ad-layout="in-article"
           data-ad-format="fluid"
           data-ad-client="ca-pub-6956525438386645"
           data-ad-slot="5381801020"></ins>
      <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
    </div>
  </aside>
  `;

  const h2Matches = [...html.matchAll(/<h2\b[^>]*>/gi)];
  const countPlainWords = (str) => str.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  const totalWords = countPlainWords(html);
  const insertionOffsets = [];

  if (h2Matches.length >= 3) {
    // Primary slot: right before the 3rd H2 (Step-by-Step Implementation, after Diagnostics & ToC)
    insertionOffsets.push(h2Matches[2].index);
    // Optional second slot ONLY on long guides (>= 1200 words) with substantial content between H2 #3 and H2 #4
    if (h2Matches.length >= 4 && totalWords >= 1200) {
      const wordsBetween = countPlainWords(html.slice(h2Matches[2].index, h2Matches[3].index));
      if (wordsBetween >= 350) {
        insertionOffsets.push(h2Matches[3].index);
      }
    }
  } else if (h2Matches.length === 2) {
    // Shorter 2-section articles: place cleanly before the 2nd H2
    insertionOffsets.push(h2Matches[1].index);
  }

  // Insert from back to front so earlier indices stay valid
  for (let i = insertionOffsets.length - 1; i >= 0; i--) {
    const pos = insertionOffsets[i];
    html = html.slice(0, pos) + '\n' + inArticleAdHtml + '\n' + html.slice(pos);
  }

  return {
    contentHtml: html,
    preventionHtml: preventionListHtml,
    steps: parsedSteps,
    faqs: parsedFaqs
  };
}

function build() {
  console.log('--- Iniciando Compilación SoporteCero SSG ---');

  // 1. Clean and initialize build directories
  const articulosDir = path.join(DIST_DIR, 'articulos');
  if (fs.existsSync(articulosDir)) {
    fs.rmSync(articulosDir, { recursive: true, force: true });
  }
  fs.mkdirSync(articulosDir, { recursive: true });

  const enArticulosDir = path.join(DIST_DIR, 'en', 'articulos');
  if (fs.existsSync(path.dirname(enArticulosDir))) {
    fs.rmSync(path.dirname(enArticulosDir), { recursive: true, force: true });
  }
  fs.mkdirSync(enArticulosDir, { recursive: true });

  // 2. Copy asset folders directly
  copyDirSync(path.join(SRC_DIR, 'css'), path.join(DIST_DIR, 'css'));
  copyDirSync(path.join(SRC_DIR, 'js'), path.join(DIST_DIR, 'js'));

  // Ensure empty .nojekyll is always maintained in root for GitHub Pages
  if (!fs.existsSync(path.join(DIST_DIR, '.nojekyll'))) {
    fs.writeFileSync(path.join(DIST_DIR, '.nojekyll'), '', 'utf-8');
  }

  fs.copyFileSync(path.join(SRC_DIR, 'robots.txt'), path.join(DIST_DIR, 'robots.txt'));
  if (fs.existsSync(path.join(SRC_DIR, 'ads.txt'))) {
    fs.copyFileSync(path.join(SRC_DIR, 'ads.txt'), path.join(DIST_DIR, 'ads.txt'));
  }
  if (fs.existsSync(path.join(SRC_DIR, 'favicon.svg'))) {
    fs.copyFileSync(path.join(SRC_DIR, 'favicon.svg'), path.join(DIST_DIR, 'favicon.svg'));
  }
  for (const imgName of ['og-image.png', 'apple-touch-icon.png', 'favicon.png']) {
    if (fs.existsSync(path.join(SRC_DIR, imgName))) {
      fs.copyFileSync(path.join(SRC_DIR, imgName), path.join(DIST_DIR, imgName));
    }
  }
  if (fs.existsSync(path.join(SRC_DIR, 'auth.md'))) {
    fs.copyFileSync(path.join(SRC_DIR, 'auth.md'), path.join(DIST_DIR, 'auth.md'));
  }
  if (fs.existsSync(path.join(SRC_DIR, 'llms.txt'))) {
    fs.copyFileSync(path.join(SRC_DIR, 'llms.txt'), path.join(DIST_DIR, 'llms.txt'));
    fs.copyFileSync(path.join(SRC_DIR, 'llms.txt'), path.join(DIST_DIR, 'index.md'));
    fs.mkdirSync(path.join(DIST_DIR, 'en'), { recursive: true });
    fs.copyFileSync(path.join(SRC_DIR, 'llms.txt'), path.join(DIST_DIR, 'en', 'index.md'));
  }
  if (fs.existsSync(path.join(SRC_DIR, '_headers'))) {
    fs.copyFileSync(path.join(SRC_DIR, '_headers'), path.join(DIST_DIR, '_headers'));
  }
  if (fs.existsSync(path.join(SRC_DIR, '.well-known'))) {
    copyDirSync(path.join(SRC_DIR, '.well-known'), path.join(DIST_DIR, '.well-known'));
  }

  // 3. Compile static pages with Hreflang support
  compileStaticPage(path.join(SRC_DIR, 'sobre-mi.html'), path.join(DIST_DIR, 'sobre-mi.html'), 'sobre-mi.html', 'about.html', 'es');
  compileStaticPage(path.join(SRC_DIR, 'contacto.html'), path.join(DIST_DIR, 'contacto.html'), 'contacto.html', 'contact.html', 'es');
  compileStaticPage(path.join(SRC_DIR, 'servicios.html'), path.join(DIST_DIR, 'servicios.html'), 'servicios.html', 'servicios.html', 'es');
  compileStaticPage(path.join(SRC_DIR, 'nosotros.html'), path.join(DIST_DIR, 'nosotros.html'), 'nosotros.html', 'nosotros.html', 'es');
  
  fs.mkdirSync(path.join(DIST_DIR, 'legal'), { recursive: true });
  compileStaticPage(path.join(SRC_DIR, 'legal', 'cookies.html'), path.join(DIST_DIR, 'legal', 'cookies.html'), 'legal/cookies.html', 'legal/cookies.html', 'es');
  compileStaticPage(path.join(SRC_DIR, 'legal', 'privacidad.html'), path.join(DIST_DIR, 'legal', 'privacidad.html'), 'legal/privacidad.html', 'legal/privacidad.html', 'es');
  compileStaticPage(path.join(SRC_DIR, 'legal', 'terminos.html'), path.join(DIST_DIR, 'legal', 'terminos.html'), 'legal/terminos.html', 'legal/terminos.html', 'es');

  // English static pages
  fs.mkdirSync(path.join(DIST_DIR, 'en', 'legal'), { recursive: true });
  compileStaticPage(path.join(SRC_DIR, 'en', 'about.html'), path.join(DIST_DIR, 'en', 'about.html'), 'sobre-mi.html', 'about.html', 'en');
  compileStaticPage(path.join(SRC_DIR, 'en', 'contact.html'), path.join(DIST_DIR, 'en', 'contact.html'), 'contacto.html', 'contact.html', 'en');
  compileStaticPage(path.join(SRC_DIR, 'en', 'servicios.html'), path.join(DIST_DIR, 'en', 'servicios.html'), 'servicios.html', 'servicios.html', 'en');
  compileStaticPage(path.join(SRC_DIR, 'en', 'nosotros.html'), path.join(DIST_DIR, 'en', 'nosotros.html'), 'nosotros.html', 'nosotros.html', 'en');
  compileStaticPage(path.join(SRC_DIR, 'en', 'legal', 'cookies.html'), path.join(DIST_DIR, 'en', 'legal', 'cookies.html'), 'legal/cookies.html', 'legal/cookies.html', 'en');
  compileStaticPage(path.join(SRC_DIR, 'en', 'legal', 'privacidad.html'), path.join(DIST_DIR, 'en', 'legal', 'privacidad.html'), 'legal/privacidad.html', 'legal/privacidad.html', 'en');
  compileStaticPage(path.join(SRC_DIR, 'en', 'legal', 'terminos.html'), path.join(DIST_DIR, 'en', 'legal', 'terminos.html'), 'legal/terminos.html', 'legal/terminos.html', 'en');

  // 4. Read templates
  const postTemplateEs = fs.readFileSync(path.join(SRC_DIR, 'post-template.html'), 'utf-8');
  const postTemplateEn = fs.readFileSync(path.join(SRC_DIR, 'en', 'post-template.html'), 'utf-8');

  // 5. Parse Spanish articles
  const postsEs = [];
  const filesEs = fs.readdirSync(CONTENT_DIR);
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  for (let file of filesEs) {
    if (!file.endsWith('.md') || file.includes('sync-conflict')) continue;

    const filePath = path.join(CONTENT_DIR, file);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const filename = path.basename(file, '.md');
    const { data: frontMatter, content: markdownBody } = matter(fileContent);
    if (frontMatter.title) {
      frontMatter.title = frontMatter.title.replace(/^\[(SOLUCIONADO|SOLVED|FIXED|Solucionado|Solved|Fixed)\]\s*/i, '').trim();
    }

    const postDate = new Date(frontMatter.date + 'T00:00:00');
    if (postDate > today) {
      console.log(`[SKIPPED ES] ${filename} (Fecha de publicación programada: ${frontMatter.date})`);
      continue;
    }

    const rawHtml = marked.parse(markdownBody);
    postsEs.push({
      ...frontMatter,
      filename,
      url: `articulos/${filename}.html`,
      rawHtml
    });
  }

  // 6. Parse English articles
  const postsEn = [];
  const contentDirEn = path.join(CONTENT_DIR, 'en');
  if (fs.existsSync(contentDirEn)) {
    const filesEn = fs.readdirSync(contentDirEn);
    for (let file of filesEn) {
      if (!file.endsWith('.md') || file.includes('sync-conflict')) continue;

      const filePath = path.join(contentDirEn, file);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const filename = path.basename(file, '.md');
      const { data: frontMatter, content: markdownBody } = matter(fileContent);
      if (frontMatter.title) {
        frontMatter.title = frontMatter.title.replace(/^\[(SOLUCIONADO|SOLVED|FIXED|Solucionado|Solved|Fixed)\]\s*/i, '').trim();
      }

      const postDate = new Date(frontMatter.date + 'T00:00:00');
      if (postDate > today) {
        console.log(`[SKIPPED EN] ${filename} (Fecha de publicación programada: ${frontMatter.date})`);
        continue;
      }

      const rawHtml = marked.parse(markdownBody);
      postsEn.push({
        ...frontMatter,
        filename,
        url: `en/articulos/${filename}.html`,
        rawHtml
      });
    }
  }

  // Sort posts by date (newest first)
  postsEs.sort((a, b) => new Date(b.date) - new Date(a.date));
  postsEn.sort((a, b) => new Date(b.date) - new Date(a.date));

  // 7. Compile Spanish article pages (with Hreflang and Rich Schemas)
  for (let post of postsEs) {
    const { contentHtml, preventionHtml, steps, faqs } = postProcessHtml(post.rawHtml, 'es');
    
    // Check if English translation exists
    const hasEnTranslation = postsEn.some(p => p.filename === post.filename);
    const hreflang = hasEnTranslation ? `
  <link rel="alternate" hreflang="es" href="https://soportecero.com/articulos/${post.filename}.html" />
  <link rel="alternate" hreflang="en" href="https://soportecero.com/en/articulos/${post.filename}.html" />
  <link rel="alternate" hreflang="x-default" href="https://soportecero.com/articulos/${post.filename}.html" />
  ` : '';

    const relatedPosts = getRelatedPosts(post, postsEs);

    const relatedCardsHtml = relatedPosts.map(rp => {
      const firstTag = rp.tags && rp.tags.length > 0 ? `<span class="card-tag">${rp.tags[0]}</span>` : '';
      return `
      <!-- Related Card: ${rp.title} -->
      <article class="related-card">
        <div class="related-card-content">
          <div>
            <span class="card-category" style="font-size: 0.7rem; margin-bottom: 0.5rem;">${rp.category}</span>
            <h4 class="related-card-title" style="font-size: 1rem; margin-bottom: 0.5rem; line-height: 1.3;">
              <a href="../${rp.url}" style="color: var(--text-primary); transition: color var(--transition-speed); font-weight: 700;">${rp.title}</a>
            </h4>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); border-top: 1px solid var(--border-color); padding-top: 0.5rem; margin-top: 0.5rem;">
            ${firstTag}
            <span>Lectura: ${rp.readTime}</span>
          </div>
        </div>
      </article>
      `;
    }).join('\n');

    const pageUrl = `https://soportecero.com/articulos/${post.filename}.html`;

    // Rich JSON-LD TechArticle Schema
    const techArticleSchema = {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      "headline": post.title,
      "description": post.description,
      "image": "https://soportecero.com/og-image.png",
      "inLanguage": "es",
      "category": post.category,
      "articleSection": post.category,
      "keywords": post.tags ? post.tags.join(', ') : '',
      "proficiencyLevel": "Intermediate",
      "datePublished": post.date,
      "dateModified": post.dateModified || post.date,
      "author": {
        "@type": "Person",
        "@id": "https://soportecero.com/sobre-mi.html#rodolfo-castro",
        "name": "Rodolfo Castro",
        "jobTitle": "Fundador, Desarrollador Full-Stack & Administrador de Sistemas",
        "url": "https://soportecero.com/sobre-mi.html",
        "sameAs": [
          "https://soportecero.com/sobre-mi.html",
          "https://soportecero.com/nosotros.html#rodolfo-castro",
          "https://www.pixeldigitaldz.online/links"
        ]
      },
      "publisher": {
        "@type": "Organization",
        "@id": "https://soportecero.com/#organization",
        "name": "SoporteCero",
        "url": "https://soportecero.com/",
        "logo": {
          "@type": "ImageObject",
          "url": "https://soportecero.com/favicon.png"
        }
      },
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": pageUrl
      }
    };

    const catMetaEs = getCategoryHubMeta(post.category, 'es');
    const categoryLinkHtml = catMetaEs
      ? `<a href="${catMetaEs.path}">${post.category}</a>`
      : `<span>${post.category}</span>`;

    // BreadcrumbList Schema (3 levels: Home -> Category -> Current Article)
    const breadcrumbElementsEs = [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Inicio",
        "item": "https://soportecero.com/"
      }
    ];
    if (catMetaEs) {
      breadcrumbElementsEs.push({
        "@type": "ListItem",
        "position": 2,
        "name": post.category,
        "item": catMetaEs.url
      });
    }
    breadcrumbElementsEs.push({
      "@type": "ListItem",
      "position": breadcrumbElementsEs.length + 1,
      "name": post.title,
      "item": pageUrl
    });
    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": breadcrumbElementsEs
    };

    let faqSchemaScript = '';
    if (faqs && faqs.length > 0) {
      const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faqs.map(f => ({
          "@type": "Question",
          "name": f.question,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": f.answer
          }
        }))
      };
      faqSchemaScript = `\n  <script type="application/ld+json">\n  ${JSON.stringify(faqSchema, null, 2)}\n  </script>`;
    }

    const schemaScriptHtml = `
  <script type="application/ld+json">
  ${JSON.stringify(techArticleSchema, null, 2)}
  </script>
  <script type="application/ld+json">
  ${JSON.stringify(breadcrumbSchema, null, 2)}
  </script>${faqSchemaScript}
    `;

    const langSelectorLink = hasEnTranslation 
      ? `/en/articulos/${post.filename}.html`
      : `/en/`;
    const langSelector = `
    <div class="lang-selector">
      <span class="lang-active">ES</span>
      <span class="lang-separator">|</span>
      <a href="${langSelectorLink}" class="lang-inactive">EN</a>
    </div>
    `;

    const keywordsStr = post.tags ? post.tags.join(', ') : '';
    const articleTagsMeta = (post.tags || []).map(t => `<meta property="article:tag" content="${t}">`).join('\n  ');

    const postHtml = postTemplateEs
      .replace(/\{\{title\}\}/g, post.title)
      .replace(/\{\{description\}\}/g, post.description)
      .replace(/\{\{category_link\}\}/g, categoryLinkHtml)
      .replace(/\{\{category\}\}/g, post.category)
      .replace(/\{\{readTime\}\}/g, post.readTime)
      .replace(/\{\{date\}\}/g, post.date)
      .replace(/\{\{filename\}\}/g, post.filename)
      .replace(/\{\{slug\}\}/g, post.filename)
      .replace(/\{\{content\}\}/g, contentHtml)
      .replace(/\{\{prevention\}\}/g, preventionHtml)
      .replace(/\{\{related\}\}/g, relatedCardsHtml)
      .replace(/\{\{schema\}\}/g, schemaScriptHtml)
      .replace(/\{\{hreflang\}\}/g, hreflang)
      .replace(/\{\{lang_selector\}\}/g, langSelector)
      .replace(/\{\{keywords\}\}/g, keywordsStr)
      .replace(/\{\{article_tags\}\}/g, articleTagsMeta);

    fs.writeFileSync(path.join(DIST_DIR, 'articulos', `${post.filename}.html`), postHtml, 'utf-8');
    if (fs.existsSync(path.join(CONTENT_DIR, `${post.filename}.md`))) {
      fs.copyFileSync(path.join(CONTENT_DIR, `${post.filename}.md`), path.join(DIST_DIR, 'articulos', `${post.filename}.md`));
    }
    console.log(`[POST ES] Compilado: articulos/${post.filename}.html`);
  }

  // 8. Compile English article pages (with Hreflang and Rich Schemas)
  for (let post of postsEn) {
    const { contentHtml, preventionHtml, steps, faqs } = postProcessHtml(post.rawHtml, 'en');
    
    // Check if Spanish counterpart exists
    const hasEsCounterpart = postsEs.some(p => p.filename === post.filename);
    const hreflang = hasEsCounterpart ? `
  <link rel="alternate" hreflang="es" href="https://soportecero.com/articulos/${post.filename}.html" />
  <link rel="alternate" hreflang="en" href="https://soportecero.com/en/articulos/${post.filename}.html" />
  <link rel="alternate" hreflang="x-default" href="https://soportecero.com/articulos/${post.filename}.html" />
  ` : '';

    const relatedPosts = getRelatedPosts(post, postsEn);

    const relatedCardsHtml = relatedPosts.map(rp => {
      const firstTag = rp.tags && rp.tags.length > 0 ? `<span class="card-tag">${rp.tags[0]}</span>` : '';
      return `
      <!-- Related Card: ${rp.title} -->
      <article class="related-card">
        <div class="related-card-content">
          <div>
            <span class="card-category" style="font-size: 0.7rem; margin-bottom: 0.5rem;">${rp.category}</span>
            <h4 class="related-card-title" style="font-size: 1rem; margin-bottom: 0.5rem; line-height: 1.3;">
              <a href="../articulos/${rp.filename}.html" style="color: var(--text-primary); transition: color var(--transition-speed); font-weight: 700;">${rp.title}</a>
            </h4>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); border-top: 1px solid var(--border-color); padding-top: 0.5rem; margin-top: 0.5rem;">
            ${firstTag}
            <span>Read Time: ${rp.readTime}</span>
          </div>
        </div>
      </article>
      `;
    }).join('\n');

    const pageUrl = `https://soportecero.com/en/articulos/${post.filename}.html`;

    // Rich JSON-LD TechArticle Schema
    const techArticleSchema = {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      "headline": post.title,
      "description": post.description,
      "image": "https://soportecero.com/og-image.png",
      "inLanguage": "en",
      "category": post.category,
      "articleSection": post.category,
      "keywords": post.tags ? post.tags.join(', ') : '',
      "proficiencyLevel": "Intermediate",
      "datePublished": post.date,
      "dateModified": post.dateModified || post.date,
      "author": {
        "@type": "Person",
        "@id": "https://soportecero.com/en/about.html#rodolfo-castro",
        "name": "Rodolfo Castro",
        "jobTitle": "Founder, Full-Stack Developer & Systems Administrator",
        "url": "https://soportecero.com/en/about.html",
        "sameAs": [
          "https://soportecero.com/en/about.html",
          "https://soportecero.com/en/nosotros.html#rodolfo-castro",
          "https://www.pixeldigitaldz.online/links"
        ]
      },
      "publisher": {
        "@type": "Organization",
        "@id": "https://soportecero.com/#organization",
        "name": "SoporteCero",
        "url": "https://soportecero.com/",
        "logo": {
          "@type": "ImageObject",
          "url": "https://soportecero.com/favicon.png"
        }
      },
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": pageUrl
      }
    };

    const catMetaEn = getCategoryHubMeta(post.category, 'en');
    const categoryLinkHtml = catMetaEn
      ? `<a href="${catMetaEn.path}">${post.category}</a>`
      : `<span>${post.category}</span>`;

    // BreadcrumbList Schema (3 levels: Home -> Category -> Current Article)
    const breadcrumbElementsEn = [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://soportecero.com/en/"
      }
    ];
    if (catMetaEn) {
      breadcrumbElementsEn.push({
        "@type": "ListItem",
        "position": 2,
        "name": post.category,
        "item": catMetaEn.url
      });
    }
    breadcrumbElementsEn.push({
      "@type": "ListItem",
      "position": breadcrumbElementsEn.length + 1,
      "name": post.title,
      "item": pageUrl
    });
    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": breadcrumbElementsEn
    };

    let faqSchemaScript = '';
    if (faqs && faqs.length > 0) {
      const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faqs.map(f => ({
          "@type": "Question",
          "name": f.question,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": f.answer
          }
        }))
      };
      faqSchemaScript = `\n  <script type="application/ld+json">\n  ${JSON.stringify(faqSchema, null, 2)}\n  </script>`;
    }

    const schemaScriptHtml = `
  <script type="application/ld+json">
  ${JSON.stringify(techArticleSchema, null, 2)}
  </script>
  <script type="application/ld+json">
  ${JSON.stringify(breadcrumbSchema, null, 2)}
  </script>${faqSchemaScript}
    `;

    const langSelectorLink = hasEsCounterpart
      ? `/articulos/${post.filename}.html`
      : `/`;
    const langSelector = `
    <div class="lang-selector">
      <a href="${langSelectorLink}" class="lang-inactive">ES</a>
      <span class="lang-separator">|</span>
      <span class="lang-active">EN</span>
    </div>
    `;

    const keywordsStr = post.tags ? post.tags.join(', ') : '';
    const articleTagsMeta = (post.tags || []).map(t => `<meta property="article:tag" content="${t}">`).join('\n  ');

    const postHtml = postTemplateEn
      .replace(/\{\{title\}\}/g, post.title)
      .replace(/\{\{description\}\}/g, post.description)
      .replace(/\{\{category_link\}\}/g, categoryLinkHtml)
      .replace(/\{\{category\}\}/g, post.category)
      .replace(/\{\{readTime\}\}/g, post.readTime)
      .replace(/\{\{date\}\}/g, post.date)
      .replace(/\{\{filename\}\}/g, post.filename)
      .replace(/\{\{slug\}\}/g, post.filename)
      .replace(/\{\{content\}\}/g, contentHtml)
      .replace(/\{\{prevention\}\}/g, preventionHtml)
      .replace(/\{\{related\}\}/g, relatedCardsHtml)
      .replace(/\{\{schema\}\}/g, schemaScriptHtml)
      .replace(/\{\{hreflang\}\}/g, hreflang)
      .replace(/\{\{lang_selector\}\}/g, langSelector)
      .replace(/\{\{keywords\}\}/g, keywordsStr)
      .replace(/\{\{article_tags\}\}/g, articleTagsMeta);

    fs.writeFileSync(path.join(DIST_DIR, 'en', 'articulos', `${post.filename}.html`), postHtml, 'utf-8');
    if (fs.existsSync(path.join(contentDirEn, `${post.filename}.md`))) {
      fs.copyFileSync(path.join(contentDirEn, `${post.filename}.md`), path.join(DIST_DIR, 'en', 'articulos', `${post.filename}.md`));
    }
    console.log(`[POST EN] Compilado: en/articulos/${post.filename}.html`);
  }

  // 9. Generate Spanish Home Page
  const cardsHtmlEs = postsEs.map(post => {
    const categorySlug = CATEGORY_MAP_ES[post.category] || 'all';
    const tagsList = post.tags || [];
    const firstThreeTags = tagsList.slice(0, 3).map(tag => `<span class="card-tag">${tag}</span>`).join('\n');
    const excerpt = post.description.length > 150 ? post.description.substring(0, 147) + '...' : post.description;

    return `
    <!-- Card: ${post.title} -->
    <article class="article-card" 
             data-category="${categorySlug}" 
             data-title="${post.title.replace(/"/g, '&quot;')}" 
             data-tags="${tagsList.join(', ').toLowerCase()}" 
             data-summary="${post.description.replace(/"/g, '&quot;')}">
      <div class="card-content">
        <span class="card-category">${post.category}</span>
        <h3 class="card-title">
          <a href="${post.url}">${post.title}</a>
        </h3>
        <p class="card-excerpt">
          ${excerpt}
        </p>
        <div class="card-footer">
          <div class="card-tags">
            ${firstThreeTags}
          </div>
          <span>Lectura: ${post.readTime}</span>
        </div>
      </div>
    </article>
    `;
  }).join('\n');

  const indexTemplateEs = fs.readFileSync(path.join(SRC_DIR, 'index-template.html'), 'utf-8');
  const indexHreflangEs = `
  <link rel="alternate" hreflang="es" href="https://soportecero.com/" />
  <link rel="alternate" hreflang="en" href="https://soportecero.com/en/" />
  <link rel="alternate" hreflang="x-default" href="https://soportecero.com/" />
  `;
  const indexLangSelectorEs = `
  <div class="lang-selector">
    <span class="lang-active">ES</span>
    <span class="lang-separator">|</span>
    <a href="/en/" class="lang-inactive">EN</a>
  </div>
  `;
  const directoryIndexEs = generateDirectoryIndex(postsEs, 'es');
  let indexHtmlEs = indexTemplateEs
    .replace('<!-- ARTICLE_GRID_PLACEHOLDER -->', cardsHtmlEs)
    .replace('{{hreflang}}', indexHreflangEs)
    .replace('{{lang_selector}}', indexLangSelectorEs);

  indexHtmlEs = indexHtmlEs.replace('<footer>', `${directoryIndexEs}\n    <footer>`);

  fs.writeFileSync(path.join(DIST_DIR, 'index.html'), indexHtmlEs, 'utf-8');
  console.log('[INDEX ES] Compilado: index.html');

  // 10. Generate English Home Page
  const cardsHtmlEn = postsEn.map(post => {
    const categorySlug = CATEGORY_MAP_EN[post.category] || 'all';
    const tagsList = post.tags || [];
    const firstThreeTags = tagsList.slice(0, 3).map(tag => `<span class="card-tag">${tag}</span>`).join('\n');
    const excerpt = post.description.length > 150 ? post.description.substring(0, 147) + '...' : post.description;

    return `
    <!-- Card: ${post.title} -->
    <article class="article-card" 
             data-category="${categorySlug}" 
             data-title="${post.title.replace(/"/g, '&quot;')}" 
             data-tags="${tagsList.join(', ').toLowerCase()}" 
             data-summary="${post.description.replace(/"/g, '&quot;')}">
      <div class="card-content">
        <span class="card-category">${post.category}</span>
        <h3 class="card-title">
          <a href="/en/articulos/${post.filename}.html">${post.title}</a>
        </h3>
        <p class="card-excerpt">
          ${excerpt}
        </p>
        <div class="card-footer">
          <div class="card-tags">
            ${firstThreeTags}
          </div>
          <span>Read Time: ${post.readTime}</span>
        </div>
      </div>
    </article>
    `;
  }).join('\n');

  const indexTemplateEn = fs.readFileSync(path.join(SRC_DIR, 'en', 'index-template.html'), 'utf-8');
  const indexLangSelectorEn = `
  <div class="lang-selector">
    <a href="/" class="lang-inactive">ES</a>
    <span class="lang-separator">|</span>
    <span class="lang-active">EN</span>
  </div>
  `;
  const directoryIndexEn = generateDirectoryIndex(postsEn, 'en');
  let indexHtmlEn = indexTemplateEn
    .replace('<!-- ARTICLE_GRID_PLACEHOLDER -->', cardsHtmlEn)
    .replace('{{hreflang}}', indexHreflangEs)
    .replace('{{lang_selector}}', indexLangSelectorEn);

  indexHtmlEn = indexHtmlEn.replace('<footer>', `${directoryIndexEn}\n    <footer>`);

  fs.writeFileSync(path.join(DIST_DIR, 'en', 'index.html'), indexHtmlEn, 'utf-8');
  console.log('[INDEX EN] Compilado: en/index.html');

  // 10B. Generate 6 Static Indexable Category Hub Pages (3 ES + 3 EN)
  const categoriasDirEs = path.join(DIST_DIR, 'categorias');
  if (fs.existsSync(categoriasDirEs)) fs.rmSync(categoriasDirEs, { recursive: true, force: true });
  fs.mkdirSync(categoriasDirEs, { recursive: true });

  const categoriesDirEn = path.join(DIST_DIR, 'en', 'categories');
  if (fs.existsSync(categoriesDirEn)) fs.rmSync(categoriesDirEn, { recursive: true, force: true });
  fs.mkdirSync(categoriesDirEn, { recursive: true });

  const categoryLastmods = {};
  for (const hub of CATEGORY_HUBS) {
    for (const lang of ['es', 'en']) {
      const isEn = lang === 'en';
      const meta = hub[lang];
      const otherMeta = hub[isEn ? 'es' : 'en'];
      const allLangPosts = isEn ? postsEn : postsEs;
      const catMap = isEn ? CATEGORY_MAP_EN : CATEGORY_MAP_ES;
      const catPosts = allLangPosts.filter(p => (catMap[p.category] || CATEGORY_MAP_ES[p.category]) === hub.key);

      categoryLastmods[`${hub.key}_${lang}`] = (catPosts.length > 0 && (catPosts[0].dateModified || catPosts[0].date))
        ? (catPosts[0].dateModified || catPosts[0].date)
        : '2026-11-26';

      const cardsHtml = catPosts.map(post => {
        const tagsList = post.tags || [];
        const firstThreeTags = tagsList.slice(0, 3).map(tag => `<span class="card-tag">${tag}</span>`).join('\n');
        const excerpt = post.description.length > 150 ? post.description.substring(0, 147) + '...' : post.description;
        const postHref = isEn ? `/en/articulos/${post.filename}.html` : `/articulos/${post.filename}.html`;
        return `
        <article class="article-card">
          <div class="card-content">
            <span class="card-category">${post.category}</span>
            <h2 class="card-title" style="font-size: 1.05rem;">
              <a href="${postHref}">${post.title}</a>
            </h2>
            <p class="card-excerpt">${excerpt}</p>
            <div class="card-footer">
              <div class="card-tags">${firstThreeTags}</div>
              <span>${isEn ? 'Read Time' : 'Lectura'}: ${post.readTime}</span>
            </div>
          </div>
        </article>`;
      }).join('\n');

      const siblingLinks = CATEGORY_HUBS
        .filter(h => h.key !== hub.key)
        .map(h => `<a href="${h[lang].path}" class="quick-access-link">${h[lang].name}</a>`)
        .join(' <span class="quick-access-sep" aria-hidden="true">/</span> ');

      const collectionSchema = {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "CollectionPage",
            "@id": `${meta.url}#collection`,
            "url": meta.url,
            "name": meta.title,
            "description": meta.description,
            "inLanguage": lang,
            "isPartOf": {
              "@type": "WebSite",
              "@id": isEn ? "https://soportecero.com/en/#website" : "https://soportecero.com/#website"
            },
            "mainEntity": {
              "@type": "ItemList",
              "numberOfItems": catPosts.length,
              "itemListElement": catPosts.map((p, idx) => ({
                "@type": "ListItem",
                "position": idx + 1,
                "url": isEn ? `https://soportecero.com/en/articulos/${p.filename}.html` : `https://soportecero.com/articulos/${p.filename}.html`,
                "name": p.title
              }))
            }
          },
          {
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": isEn ? "Home" : "Inicio", "item": isEn ? "https://soportecero.com/en/" : "https://soportecero.com/" },
              { "@type": "ListItem", "position": 2, "name": meta.name, "item": meta.url }
            ]
          }
        ]
      };

      const adLabel = isEn ? 'Advertisement' : 'Publicidad';
      const cssPath = isEn ? '../../css/style.css' : '../css/style.css';
      const jsPath = isEn ? '../../js/main.js' : '../js/main.js';
      const homePath = isEn ? '/en/' : '/';

      const categoryHtml = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <title>${meta.title}</title>
  <meta name="description" content="${meta.description}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${meta.url}">
  <link rel="alternate" hreflang="${lang}" href="${meta.url}" />
  <link rel="alternate" hreflang="${isEn ? 'es' : 'en'}" href="${otherMeta.url}" />
  <link rel="alternate" hreflang="x-default" href="${hub.es.url}" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${cssPath}">
  <script>
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else if (savedTheme === 'dark' || window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  </script>
  <script type="application/ld+json">
  ${JSON.stringify(collectionSchema, null, 2)}
  </script>
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6956525438386645" crossorigin="anonymous"></script>
</head>
<body>
  <div class="header-wrapper">
    <header>
      <a href="${homePath}" class="logo group flex items-center gap-3 focus:outline-none" id="header-logo">
        <div class="logo-box relative flex h-9 w-9 items-center justify-center rounded-lg bg-[#10131C] border border-white/10 group-hover:border-cyan-500/50 transition-colors shadow-inner">
          <svg class="logo-svg w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="6.5" y="4.5" width="11" height="15" rx="3.5"></rect>
            <line x1="8.5" y1="16" x2="15.5" y2="8" stroke-width="1.5"></line>
          </svg>
          <span class="logo-telemetry-dot absolute -top-0.5 -right-0.5 flex h-2 w-2" aria-hidden="true">
            <span class="logo-telemetry-dot-inner relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
          </span>
        </div>
        <div class="logo-text-group flex items-baseline tracking-tight">
          <span class="logo-text font-sans text-lg font-bold text-slate-100 group-hover:text-white transition-colors">Soporte</span>
          <span class="logo-cero font-mono text-lg font-medium text-cyan-400 ml-0.5">Cero</span>
          <span class="logo-badge ml-2 hidden sm:inline-block font-mono text-[10px] font-medium uppercase tracking-widest text-zinc-500 bg-white/[0.03] border border-white/10 px-1.5 py-0.5 rounded">${isEn ? 'ENGINEERING' : 'INGENIERÍA'}</span>
        </div>
      </a>
      <nav aria-label="${isEn ? 'Main navigation' : 'Navegación principal'}">
        <ul>
          <li><a href="/tools/"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="18"/><path d="M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01"/></svg><span>${isEn ? 'Calculators' : 'Calculadoras'}</span></a></li>
          <li><a href="${CATEGORY_HUBS[0][lang].path}"${hub.key === 'sistemas' ? ' class="active"' : ''}>${CATEGORY_HUBS[0][lang].name}</a></li>
          <li><a href="${CATEGORY_HUBS[1][lang].path}"${hub.key === 'gaming' ? ' class="active"' : ''}>${CATEGORY_HUBS[1][lang].name}</a></li>
          <li><a href="${CATEGORY_HUBS[2][lang].path}"${hub.key === 'web' ? ' class="active"' : ''}>${CATEGORY_HUBS[2][lang].name}</a></li>
          <li><a href="${isEn ? '/en/about.html' : '/sobre-mi.html'}">${isEn ? 'About' : 'Sobre Mí'}</a></li>
          <li><a href="${isEn ? '/en/contact.html' : '/contacto.html'}">${isEn ? 'Contact' : 'Contacto'}</a></li>
        </ul>
      </nav>
      <div class="lang-selector">
        ${isEn ? `<a href="${otherMeta.path}" class="lang-inactive">ES</a><span class="lang-separator">|</span><span class="lang-active">EN</span>` : `<span class="lang-active">ES</span><span class="lang-separator">|</span><a href="${otherMeta.path}" class="lang-inactive">EN</a>`}
      </div>
      <button id="theme-toggle" class="theme-toggle-btn" aria-label="${isEn ? 'Toggle theme' : 'Cambiar tema visual'}" title="${isEn ? 'Toggle theme' : 'Cambiar tema visual'}">
        <svg class="moon-icon" width="18" height="18" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12.3 22h-.1c-5.5 0-10-4.5-10-10 0-4.8 3.5-8.9 8.2-9.8.5-.1 1 .2 1.1.7.1.5-.2 1-.7 1.1-3.6.7-6.2 3.9-6.2 7.7 0 4.4 3.6 8 8 8 3.8 0 7-2.6 7.7-6.2.1-.5.6-.8 1.1-.7.5.1.8.6.7 1.1-.9 4.7-5 8.2-9.8 8.2z"/></svg>
        <svg class="sun-icon" width="18" height="18" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41l-1.06-1.06zm1.06-12.37c-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06c.39-.39.39-1.03 0-1.41zm-12.37 12.37c-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06c.39-.39.39-1.03 0-1.41z"/></svg>
      </button>
    </header>
  </div>

  <main class="main-content" style="padding-top: 2rem;">
    <nav class="post-breadcrumbs" aria-label="${isEn ? 'Breadcrumb navigation' : 'Ruta de navegación'}">
      <a href="${homePath}">${isEn ? 'HOME' : 'INICIO'}</a>
      <span class="breadcrumb-sep" aria-hidden="true">/</span>
      <span style="color: var(--text-secondary);">${meta.name}</span>
    </nav>

    <section class="hero" style="padding: 1.5rem 0 2rem; text-align: left;" aria-label="${meta.name}">
      <span class="card-category" style="margin-bottom: 0.75rem; display: inline-block;">${catPosts.length} ${isEn ? 'VERIFIED GUIDES' : 'GUÍAS VERIFICADAS'}</span>
      <h1 style="text-align: left; margin-bottom: 0.75rem;">${meta.name}</h1>
      <p style="margin: 0; max-width: 780px;">${meta.intro}</p>
    </section>

    <div class="quick-access-box" aria-label="${isEn ? 'Other Categories and Tools' : 'Otras Categorías y Herramientas'}">
      <div class="quick-access-header">
        <span class="led-dot" aria-hidden="true"></span>
        <span class="quick-access-badge">${isEn ? 'EXPLORE:' : 'EXPLORAR:'}</span>
      </div>
      <div class="quick-access-links">
        ${siblingLinks}
        <span class="quick-access-sep" aria-hidden="true">/</span>
        <a href="/tools/" class="quick-access-link">${isEn ? 'Interactive Calculators (/tools/)' : 'Calculadoras Interactivas (/tools/)'}</a>
      </div>
    </div>

    <section aria-labelledby="cat-grid-title">
      <h2 class="section-title" id="cat-grid-title">${isEn ? `All ${meta.name} Guides (${catPosts.length})` : `Todas las guías de ${meta.name} (${catPosts.length})`}</h2>
      <div class="articles-grid">
        ${cardsHtml}
      </div>
    </section>

    <aside class="ad-slot-wrapper ad-slot-wrapper--home" style="margin-top: 2.5rem;" aria-label="${adLabel}">
      <span class="ad-slot-label">${adLabel}</span>
      <div class="ad-slot-inner">
        <ins class="adsbygoogle"
             style="display:block"
             data-ad-client="ca-pub-6956525438386645"
             data-ad-slot="6471521412"
             data-ad-format="auto"
             data-full-width-responsive="false"></ins>
        <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
      </div>
    </aside>
  </main>

  <div class="footer-wrapper">
    <footer>
      <ul class="footer-nav">
        <li><a href="${homePath}">${isEn ? 'Home' : 'Inicio'}</a></li>
        <li><a href="${isEn ? '/en/about.html' : '/sobre-mi.html'}">${isEn ? 'About' : 'Sobre Mí'}</a></li>
        <li><a href="${isEn ? '/en/nosotros.html' : '/nosotros.html'}">${isEn ? 'Editorial Methodology' : 'Sobre Nosotros'}</a></li>
        <li><a href="${isEn ? '/en/contact.html' : '/contacto.html'}">${isEn ? 'Contact' : 'Contacto'}</a></li>
        <li><a href="${isEn ? '/en/servicios.html' : '/servicios.html'}">${isEn ? 'Services' : 'Servicios'}</a></li>
        <li><a href="/tools/">${isEn ? 'Tools' : 'Calculadoras'}</a></li>
      </ul>
      <p class="footer-disclaimer">
        ${isEn
          ? 'SoporteCero is an independent technical portal delivering practical solutions, commands, and verified troubleshooting guides for developers, sysadmins, and gamers.'
          : 'SoporteCero es un portal técnico independiente dedicado a documentar soluciones prácticas, comandos y guías de soporte para desarrolladores, administradores de sistemas y gamers.'}
      </p>
      <p class="footer-copyright">&copy; 2026 SoporteCero. ${isEn ? 'All rights reserved.' : 'Todos los derechos reservados.'}</p>
    </footer>
  </div>
  <script src="${jsPath}"></script>
</body>
</html>`;

      const destFile = isEn
        ? path.join(categoriesDirEn, `${meta.slug}.html`)
        : path.join(categoriasDirEs, `${meta.slug}.html`);
      fs.writeFileSync(destFile, categoryHtml, 'utf-8');
      console.log(`[CATEGORY ${lang.toUpperCase()}] Compilado: ${meta.path} (${catPosts.length} artículos)`);
    }
  }

  // 11. Generate Multilingual sitemap.xml
  const staticLastmod = '2026-11-26';
  const toolsLastmod = '2026-11-26';
  const homeLastmodEs = (postsEs.length > 0 && postsEs[0].date) ? postsEs[0].date : staticLastmod;
  const homeLastmodEn = (postsEn.length > 0 && postsEn[0].date) ? postsEn[0].date : homeLastmodEs;

  let sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://soportecero.com/</loc>
    <xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/" />
    <xhtml:link rel="alternate" hreflang="en" href="https://soportecero.com/en/" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/" />
    <lastmod>${homeLastmodEs}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://soportecero.com/en/</loc>
    <xhtml:link rel="alternate" hreflang="en" href="https://soportecero.com/en/" />
    <xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/" />
    <lastmod>${homeLastmodEn}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`;

  for (const hub of CATEGORY_HUBS) {
    sitemapXml += `
  <url>
    <loc>${hub.es.url}</loc>
    <xhtml:link rel="alternate" hreflang="es" href="${hub.es.url}" />
    <xhtml:link rel="alternate" hreflang="en" href="${hub.en.url}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${hub.es.url}" />
    <lastmod>${categoryLastmods[`${hub.key}_es`]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${hub.en.url}</loc>
    <xhtml:link rel="alternate" hreflang="en" href="${hub.en.url}" />
    <xhtml:link rel="alternate" hreflang="es" href="${hub.es.url}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${hub.es.url}" />
    <lastmod>${categoryLastmods[`${hub.key}_en`]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`;
  }

  sitemapXml += `
  <url>
    <loc>https://soportecero.com/tools/</loc>
    <xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/tools/" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/tools/" />
    <lastmod>${toolsLastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <!-- 6 Prerendered Interactive Tools (Priority 1.0) -->
  <url>
    <loc>https://soportecero.com/tools/comisiones-pasarelas-pago.html</loc>
    <xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/tools/comisiones-pasarelas-pago.html" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/tools/comisiones-pasarelas-pago.html" />
    <lastmod>${toolsLastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://soportecero.com/tools/tarifa-hora-freelance.html</loc>
    <xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/tools/tarifa-hora-freelance.html" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/tools/tarifa-hora-freelance.html" />
    <lastmod>${toolsLastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://soportecero.com/tools/calculadora-roas-ecommerce.html</loc>
    <xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/tools/calculadora-roas-ecommerce.html" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/tools/calculadora-roas-ecommerce.html" />
    <lastmod>${toolsLastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://soportecero.com/tools/margen-descuentos-ecommerce.html</loc>
    <xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/tools/margen-descuentos-ecommerce.html" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/tools/margen-descuentos-ecommerce.html" />
    <lastmod>${toolsLastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://soportecero.com/tools/amortizacion-hipotecas-prestamos.html</loc>
    <xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/tools/amortizacion-hipotecas-prestamos.html" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/tools/amortizacion-hipotecas-prestamos.html" />
    <lastmod>${toolsLastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://soportecero.com/tools/interes-compuesto-ahorro.html</loc>
    <xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/tools/interes-compuesto-ahorro.html" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/tools/interes-compuesto-ahorro.html" />
    <lastmod>${toolsLastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://soportecero.com/sobre-mi.html</loc>
    <xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/sobre-mi.html" />
    <xhtml:link rel="alternate" hreflang="en" href="https://soportecero.com/en/about.html" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/sobre-mi.html" />
    <lastmod>${staticLastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://soportecero.com/contacto.html</loc>
    <xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/contacto.html" />
    <xhtml:link rel="alternate" hreflang="en" href="https://soportecero.com/en/contact.html" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/contacto.html" />
    <lastmod>${staticLastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://soportecero.com/en/about.html</loc>
    <xhtml:link rel="alternate" hreflang="en" href="https://soportecero.com/en/about.html" />
    <xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/sobre-mi.html" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/sobre-mi.html" />
    <lastmod>${staticLastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://soportecero.com/en/contact.html</loc>
    <xhtml:link rel="alternate" hreflang="en" href="https://soportecero.com/en/contact.html" />
    <xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/contacto.html" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/contacto.html" />
    <lastmod>${staticLastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://soportecero.com/nosotros.html</loc>
    <xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/nosotros.html" />
    <xhtml:link rel="alternate" hreflang="en" href="https://soportecero.com/en/nosotros.html" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/nosotros.html" />
    <lastmod>${staticLastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://soportecero.com/en/nosotros.html</loc>
    <xhtml:link rel="alternate" hreflang="en" href="https://soportecero.com/en/nosotros.html" />
    <xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/nosotros.html" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/nosotros.html" />
    <lastmod>${staticLastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://soportecero.com/servicios.html</loc>
    <xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/servicios.html" />
    <xhtml:link rel="alternate" hreflang="en" href="https://soportecero.com/en/servicios.html" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/servicios.html" />
    <lastmod>${staticLastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://soportecero.com/en/servicios.html</loc>
    <xhtml:link rel="alternate" hreflang="en" href="https://soportecero.com/en/servicios.html" />
    <xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/servicios.html" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/servicios.html" />
    <lastmod>${staticLastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
`;

  // Add Spanish posts to sitemap (with bidirectional hreflang)
  for (let post of postsEs) {
    const postDate = post.dateModified || post.date || staticLastmod;
    const hasEn = postsEn.some(p => p.filename === post.filename);
    const hreflangLines = hasEn ? `
    <xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/articulos/${post.filename}.html" />
    <xhtml:link rel="alternate" hreflang="en" href="https://soportecero.com/en/articulos/${post.filename}.html" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/articulos/${post.filename}.html" />` : `
    <xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/articulos/${post.filename}.html" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/articulos/${post.filename}.html" />`;

    sitemapXml += `  <url>
    <loc>https://soportecero.com/articulos/${post.filename}.html</loc>${hreflangLines}
    <lastmod>${postDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
`;
  }

  // Add English posts to sitemap (with bidirectional hreflang)
  for (let post of postsEn) {
    const postDate = post.dateModified || post.date || staticLastmod;
    const hasEs = postsEs.some(p => p.filename === post.filename);
    const hreflangLines = hasEs ? `
    <xhtml:link rel="alternate" hreflang="en" href="https://soportecero.com/en/articulos/${post.filename}.html" />
    <xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/articulos/${post.filename}.html" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/articulos/${post.filename}.html" />` : `
    <xhtml:link rel="alternate" hreflang="en" href="https://soportecero.com/en/articulos/${post.filename}.html" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/en/articulos/${post.filename}.html" />`;

    sitemapXml += `  <url>
    <loc>https://soportecero.com/en/articulos/${post.filename}.html</loc>${hreflangLines}
    <lastmod>${postDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
`;
  }

  sitemapXml += `</urlset>`;

  fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), sitemapXml, 'utf-8');
  console.log('[SITEMAP] Compilado: sitemap.xml');

  // 12. Generate llms-full.txt for comprehensive LLM & agent context
  let llmsFullContent = `# SoporteCero - Directorio Extendido de Soluciones Técnicas y Herramientas\n\n`;
  llmsFullContent += `> Base de conocimiento completa con tutoriales, soluciones paso a paso, comandos listos para copiar y suite de calculadoras financieras interactivas.\n\n`;
  llmsFullContent += `## Calculadoras Interactivas y Simuladores (/tools/)\n\n`;
  llmsFullContent += `- [Finanzas Pro Hub — Suite de Calculadoras](https://soportecero.com/tools/): Portal central de herramientas financieras y cotizadores interactivos para desarrolladores, freelancers y e-commerce.\n`;
  llmsFullContent += `- [Calculadora de Comisiones PayPal, Stripe, Wise y Binance](https://soportecero.com/tools/comisiones-pasarelas-pago.html): Cálculo directo e inverso de retenciones y spread cambiario en pasarelas de pago internacionales.\n`;
  llmsFullContent += `- [Calculadora de Tarifa por Hora Freelance y Cotizador PDF](https://soportecero.com/tools/tarifa-hora-freelance.html): Cálculo de tarifa horaria mínima rentable y generación de propuestas formales en PDF en 1 clic.\n`;
  llmsFullContent += `- [Calculadora de ROAS de Punto de Equilibrio y Max CPA](https://soportecero.com/tools/calculadora-roas-ecommerce.html): Simulador de rentabilidad publicitaria para Meta Ads, Google Ads y TikTok Ads descontando COGS y logística.\n`;
  llmsFullContent += `- [Calculadora de Margen vs. Markup y Descuentos E-commerce](https://soportecero.com/tools/margen-descuentos-ecommerce.html): Conversor de margen bruto sobre ventas vs. recargo sobre costo e impacto de promociones.\n`;
  llmsFullContent += `- [Simulador de Amortización de Hipotecas y Abonos a Capital](https://soportecero.com/tools/amortizacion-hipotecas-prestamos.html): Proyección bajo sistema francés con ahorro de intereses y reducción de plazo por prepagos.\n`;
  llmsFullContent += `- [Calculadora de Interés Compuesto, Inflación y Regla 4% FIRE](https://soportecero.com/tools/interes-compuesto-ahorro.html): Proyección patrimonial a largo plazo deflactada por inflación real y meta de retiro FIRE.\n\n`;
  llmsFullContent += `## Artículos y Guías en Español\n\n`;
  for (let post of postsEs) {
    llmsFullContent += `### [${post.title}](https://soportecero.com/articulos/${post.filename}.html)\n`;
    llmsFullContent += `- Categoría: ${post.category}\n`;
    if (post.description) llmsFullContent += `- Resumen: ${post.description}\n`;
    llmsFullContent += `- URL: https://soportecero.com/articulos/${post.filename}.html\n\n`;
  }
  if (postsEn.length > 0) {
    llmsFullContent += `## English Technical Articles\n\n`;
    for (let post of postsEn) {
      llmsFullContent += `### [${post.title}](https://soportecero.com/en/articulos/${post.filename}.html)\n`;
      llmsFullContent += `- Category: ${post.category}\n`;
      if (post.description) llmsFullContent += `- Summary: ${post.description}\n`;
      llmsFullContent += `- URL: https://soportecero.com/en/articulos/${post.filename}.html\n\n`;
    }
  }
  fs.writeFileSync(path.join(DIST_DIR, 'llms-full.txt'), llmsFullContent, 'utf-8');
  fs.writeFileSync(path.join(SRC_DIR, 'llms-full.txt'), llmsFullContent, 'utf-8');
  console.log('[LLMS-FULL] Generado: llms-full.txt');

  // 13. Synchronize Agent Skills digests in index.json
  const skillsDir = path.join(DIST_DIR, '.well-known', 'agent-skills');
  if (fs.existsSync(skillsDir)) {
    const indexPath = path.join(skillsDir, 'index.json');
    if (fs.existsSync(indexPath)) {
      try {
        const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
        let updated = false;
        if (Array.isArray(indexData.skills)) {
          for (let skill of indexData.skills) {
            const relPath = skill.url.replace('/.well-known/agent-skills/', '');
            const skillFilePath = path.join(skillsDir, relPath);
            if (fs.existsSync(skillFilePath)) {
              const fileContent = fs.readFileSync(skillFilePath);
              const hash = crypto.createHash('sha256').update(fileContent).digest('hex');
              const newDigest = `sha256:${hash}`;
              if (skill.digest !== newDigest) {
                skill.digest = newDigest;
                updated = true;
              }
            }
          }
        }
        if (updated) {
          const serialized = JSON.stringify(indexData, null, 2);
          fs.writeFileSync(indexPath, serialized, 'utf-8');
          fs.writeFileSync(path.join(SRC_DIR, '.well-known', 'agent-skills', 'index.json'), serialized, 'utf-8');
          if (fs.existsSync(path.join(DIST_DIR, '.well-known', 'skills'))) {
            fs.writeFileSync(path.join(DIST_DIR, '.well-known', 'skills', 'index.json'), serialized, 'utf-8');
            fs.writeFileSync(path.join(SRC_DIR, '.well-known', 'skills', 'index.json'), serialized, 'utf-8');
          }
        }
      } catch (err) {
        console.warn('[AGENT-SKILLS] Advertencia al sincronizar digests:', err.message);
      }
    }
  }

  // 13. Prerender the 6 interactive tools
  try {
    const prerenderScriptPath = path.join(__dirname, 'prerender-tools.js');
    if (fs.existsSync(prerenderScriptPath)) {
      console.log('[TOOLS] Ejecutando prerender de calculadoras...');
      execSync(`node "${prerenderScriptPath}"`, { stdio: 'inherit' });
    }
  } catch (err) {
    console.warn('[TOOLS] Advertencia al prerenderizar herramientas:', err.message);
  }

  console.log('--- Compilación Completada con Éxito ---');
}

// Execute compile task
build();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
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

// Helper function to copy directories recursively
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (let entry of entries) {
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

// Circular Round-Robin related posts algorithm
function getRelatedPosts(currentPost, allPosts) {
  const categoryPosts = allPosts.filter(p => p.category === currentPost.category);
  const currentIndex = categoryPosts.findIndex(p => p.filename === currentPost.filename);
  const selected = [];

  if (categoryPosts.length > 1 && currentIndex !== -1) {
    const countToTake = Math.min(3, categoryPosts.length - 1);
    for (let i = 1; i <= countToTake; i++) {
      const nextIdx = (currentIndex + i) % categoryPosts.length;
      selected.push(categoryPosts[nextIdx]);
    }
  }

  // Si una categoría tiene menos de 4 artículos, completar con los siguientes del array general
  if (selected.length < 3 && allPosts.length > 1) {
    const globalIndex = allPosts.findIndex(p => p.filename === currentPost.filename);
    for (let i = 1; i < allPosts.length && selected.length < 3; i++) {
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
  const diagRegex = /<h2[^>]*>[^<]*(?:Diagnóstico|Diagnostics|Diagnostic)[^<]*<\/h2>\s*(?:[\s\S]*?)(<table>[\s\S]*?<\/table>)/i;

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
    const consoleTitle = isEn ? 'QUICK DIAGNOSTICS // RESOLUTION MATRIX' : 'DIAGNÓSTICO RÁPIDO // MATRIZ DE RESOLUCIÓN';
    const diagBoxHtml = `
    <section class="diagnostic-console" aria-labelledby="diag-heading">
      <div class="diagnostic-console-header">
        <div class="diag-console-title-group">
          <span class="diag-pulse-dot" aria-hidden="true"></span>
          <h3 id="diag-heading" class="diag-console-title">${consoleTitle}</h3>
        </div>
        <span class="diag-console-badge">[TELEMETRY]</span>
      </div>
      <div class="diagnostic-console-body">
        ${formattedDiag}
      </div>
    </section>
    `;
    html = html.replace(diagRegex, diagBoxHtml);
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
  const solTitle = isEn ? 'Step-by-Step Solution' : 'La Solución Paso a Paso';
  const solRegex = isEn
    ? /<h2[^>]*>[^<]*(?:Step-by-Step Solution|Step-by-step Solution|Solution|How to solve|How to fix|La Solución Paso a Paso|Solución Paso a Paso|Cómo solucionar|Como solucionar)[^<]*<\/h2>([\s\S]*?)(?=<h2|$)/i
    : /<h2[^>]*>[^<]*(?:La Solución Paso a Paso|Solución Paso a Paso|Solución|Cómo solucionar|Como solucionar)[^<]*<\/h2>([\s\S]*?)(?=<h2|$)/i;

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
        <span class="toc-header-badge">NAV // SEC</span>
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
  fs.writeFileSync(path.join(DIST_DIR, '.nojekyll'), '', 'utf-8');

  fs.copyFileSync(path.join(SRC_DIR, 'robots.txt'), path.join(DIST_DIR, 'robots.txt'));
  if (fs.existsSync(path.join(SRC_DIR, 'ads.txt'))) {
    fs.copyFileSync(path.join(SRC_DIR, 'ads.txt'), path.join(DIST_DIR, 'ads.txt'));
  }
  if (fs.existsSync(path.join(SRC_DIR, 'favicon.svg'))) {
    fs.copyFileSync(path.join(SRC_DIR, 'favicon.svg'), path.join(DIST_DIR, 'favicon.svg'));
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
  compileStaticPage(path.join(SRC_DIR, 'contacto.html'), path.join(DIST_DIR, 'contacto.html'), 'contacto.html', 'contacto.html', 'es');
  compileStaticPage(path.join(SRC_DIR, 'servicios.html'), path.join(DIST_DIR, 'servicios.html'), 'servicios.html', 'servicios.html', 'es');
  compileStaticPage(path.join(SRC_DIR, 'nosotros.html'), path.join(DIST_DIR, 'nosotros.html'), 'nosotros.html', 'nosotros.html', 'es');
  
  fs.mkdirSync(path.join(DIST_DIR, 'legal'), { recursive: true });
  compileStaticPage(path.join(SRC_DIR, 'legal', 'cookies.html'), path.join(DIST_DIR, 'legal', 'cookies.html'), 'legal/cookies.html', 'legal/cookies.html', 'es');
  compileStaticPage(path.join(SRC_DIR, 'legal', 'privacidad.html'), path.join(DIST_DIR, 'legal', 'privacidad.html'), 'legal/privacidad.html', 'legal/privacidad.html', 'es');
  compileStaticPage(path.join(SRC_DIR, 'legal', 'terminos.html'), path.join(DIST_DIR, 'legal', 'terminos.html'), 'legal/terminos.html', 'legal/terminos.html', 'es');

  // English static pages
  fs.mkdirSync(path.join(DIST_DIR, 'en', 'legal'), { recursive: true });
  compileStaticPage(path.join(SRC_DIR, 'en', 'contacto.html'), path.join(DIST_DIR, 'en', 'contacto.html'), 'contacto.html', 'contacto.html', 'en');
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
    if (!file.endsWith('.md')) continue;

    const filePath = path.join(CONTENT_DIR, file);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const filename = path.basename(file, '.md');
    const { data: frontMatter, content: markdownBody } = matter(fileContent);

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
      if (!file.endsWith('.md')) continue;

      const filePath = path.join(contentDirEn, file);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const filename = path.basename(file, '.md');
      const { data: frontMatter, content: markdownBody } = matter(fileContent);

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
      "image": "https://soportecero.com/favicon.svg",
      "inLanguage": "es",
      "category": post.category,
      "articleSection": post.category,
      "keywords": post.tags ? post.tags.join(', ') : '',
      "proficiencyLevel": "Intermediate",
      "datePublished": post.date,
      "dateModified": post.dateModified || post.date,
      "author": {
        "@type": "Person",
        "name": "Rodolfo Castro",
        "jobTitle": "Diseñador Web & Creador de Apps",
        "url": "https://soportecero.com/nosotros.html#rodolfo-castro",
        "sameAs": [
          "https://www.pixeldigitaldz.online/links"
        ]
      },
      "publisher": {
        "@type": "Organization",
        "name": "SoporteCero",
        "url": "https://soportecero.com/",
        "logo": {
          "@type": "ImageObject",
          "url": "https://soportecero.com/favicon.svg"
        }
      },
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": pageUrl
      }
    };

    // BreadcrumbList Schema (2 levels: Home and Current Article)
    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Inicio",
          "item": "https://soportecero.com/"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": post.title,
          "item": pageUrl
        }
      ]
    };

    let howToSchemaScript = '';
    if (steps && steps.length > 0) {
      const howToSchema = {
        "@context": "https://schema.org",
        "@type": "HowTo",
        "name": post.title,
        "description": post.description,
        "step": steps.map((s, idx) => {
          let cleanText = s.body
            .replace(/<div class="code-container"[\s\S]*?<\/pre>\s*<\/div>/gi, '')
            .replace(/<div class="code-header"[\s\S]*?<\/div>/gi, '')
            .replace(/<pre[\s\S]*?<\/pre>/gi, '')
            .replace(/<button[\s\S]*?<\/button>/gi, '')
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          if (!cleanText || cleanText.length < 5) {
            cleanText = s.title;
          }
          return {
            "@type": "HowToStep",
            "position": idx + 1,
            "url": `${pageUrl}#${s.slug || slugify(s.title)}`,
            "name": s.title,
            "itemListElement": [{
              "@type": "HowToDirection",
              "text": cleanText
            }]
          };
        })
      };
      howToSchemaScript = `\n  <script type="application/ld+json">\n  ${JSON.stringify(howToSchema, null, 2)}\n  </script>`;
    }

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
  </script>${howToSchemaScript}${faqSchemaScript}
    `;

    const langSelectorLink = hasEnTranslation 
      ? `../en/articulos/${post.filename}.html`
      : `../en/`;
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
      "image": "https://soportecero.com/favicon.svg",
      "inLanguage": "en",
      "category": post.category,
      "articleSection": post.category,
      "keywords": post.tags ? post.tags.join(', ') : '',
      "proficiencyLevel": "Intermediate",
      "datePublished": post.date,
      "dateModified": post.dateModified || post.date,
      "author": {
        "@type": "Person",
        "name": "Rodolfo Castro",
        "jobTitle": "Web Designer & App Creator",
        "url": "https://soportecero.com/en/nosotros.html#rodolfo-castro",
        "sameAs": [
          "https://www.pixeldigitaldz.online/links"
        ]
      },
      "publisher": {
        "@type": "Organization",
        "name": "SoporteCero",
        "url": "https://soportecero.com/",
        "logo": {
          "@type": "ImageObject",
          "url": "https://soportecero.com/favicon.svg"
        }
      },
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": pageUrl
      }
    };

    // BreadcrumbList Schema (2 levels: Home and Current Article)
    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://soportecero.com/en/"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": post.title,
          "item": pageUrl
        }
      ]
    };

    let howToSchemaScript = '';
    if (steps && steps.length > 0) {
      const howToSchema = {
        "@context": "https://schema.org",
        "@type": "HowTo",
        "name": post.title,
        "description": post.description,
        "step": steps.map((s, idx) => {
          let cleanText = s.body
            .replace(/<div class="code-container"[\s\S]*?<\/pre>\s*<\/div>/gi, '')
            .replace(/<div class="code-header"[\s\S]*?<\/div>/gi, '')
            .replace(/<pre[\s\S]*?<\/pre>/gi, '')
            .replace(/<button[\s\S]*?<\/button>/gi, '')
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          if (!cleanText || cleanText.length < 5) {
            cleanText = s.title;
          }
          return {
            "@type": "HowToStep",
            "position": idx + 1,
            "url": `${pageUrl}#${s.slug || slugify(s.title)}`,
            "name": s.title,
            "itemListElement": [{
              "@type": "HowToDirection",
              "text": cleanText
            }]
          };
        })
      };
      howToSchemaScript = `\n  <script type="application/ld+json">\n  ${JSON.stringify(howToSchema, null, 2)}\n  </script>`;
    }

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
  </script>${howToSchemaScript}${faqSchemaScript}
    `;

    const langSelectorLink = hasEsCounterpart
      ? `../../articulos/${post.filename}.html`
      : `../../`;
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
    <a href="en/" class="lang-inactive">EN</a>
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
          <a href="articulos/${post.filename}.html">${post.title}</a>
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
    <a href="../" class="lang-inactive">ES</a>
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

  // 11. Generate Multilingual sitemap.xml
  const staticLastmod = '2026-07-15';
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
    <xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/" />
    <xhtml:link rel="alternate" hreflang="en" href="https://soportecero.com/en/" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/" />
    <lastmod>${homeLastmodEn}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://soportecero.com/contacto.html</loc>
    <xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/contacto.html" />
    <xhtml:link rel="alternate" hreflang="en" href="https://soportecero.com/en/contacto.html" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/contacto.html" />
    <lastmod>${staticLastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>https://soportecero.com/en/contacto.html</loc>
    <xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/contacto.html" />
    <xhtml:link rel="alternate" hreflang="en" href="https://soportecero.com/en/contacto.html" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/contacto.html" />
    <lastmod>${staticLastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
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
    <xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/nosotros.html" />
    <xhtml:link rel="alternate" hreflang="en" href="https://soportecero.com/en/nosotros.html" />
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
    <xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/servicios.html" />
    <xhtml:link rel="alternate" hreflang="en" href="https://soportecero.com/en/servicios.html" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/servicios.html" />
    <lastmod>${staticLastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://soportecero.com/legal/privacidad.html</loc>
    <xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/legal/privacidad.html" />
    <xhtml:link rel="alternate" hreflang="en" href="https://soportecero.com/en/legal/privacidad.html" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/legal/privacidad.html" />
    <lastmod>${staticLastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>https://soportecero.com/en/legal/privacidad.html</loc>
    <xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/legal/privacidad.html" />
    <xhtml:link rel="alternate" hreflang="en" href="https://soportecero.com/en/legal/privacidad.html" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/legal/privacidad.html" />
    <lastmod>${staticLastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>https://soportecero.com/legal/terminos.html</loc>
    <xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/legal/terminos.html" />
    <xhtml:link rel="alternate" hreflang="en" href="https://soportecero.com/en/legal/terminos.html" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/legal/terminos.html" />
    <lastmod>${staticLastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>https://soportecero.com/en/legal/terminos.html</loc>
    <xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/legal/terminos.html" />
    <xhtml:link rel="alternate" hreflang="en" href="https://soportecero.com/en/legal/terminos.html" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/legal/terminos.html" />
    <lastmod>${staticLastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>https://soportecero.com/legal/cookies.html</loc>
    <xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/legal/cookies.html" />
    <xhtml:link rel="alternate" hreflang="en" href="https://soportecero.com/en/legal/cookies.html" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/legal/cookies.html" />
    <lastmod>${staticLastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>https://soportecero.com/en/legal/cookies.html</loc>
    <xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/legal/cookies.html" />
    <xhtml:link rel="alternate" hreflang="en" href="https://soportecero.com/en/legal/cookies.html" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/legal/cookies.html" />
    <lastmod>${staticLastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
`;

  // Add Spanish posts to sitemap
  for (let post of postsEs) {
    const postDate = post.dateModified || post.date || staticLastmod;
    const hasEn = postsEn.some(p => p.filename === post.filename);
    sitemapXml += `  <url>
    <loc>https://soportecero.com/articulos/${post.filename}.html</loc>
    ${hasEn ? `<xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/articulos/${post.filename}.html" />
    <xhtml:link rel="alternate" hreflang="en" href="https://soportecero.com/en/articulos/${post.filename}.html" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/articulos/${post.filename}.html" />` : ''}
    <lastmod>${postDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
`;
  }

  // Add English posts to sitemap
  for (let post of postsEn) {
    const postDate = post.dateModified || post.date || staticLastmod;
    const hasEs = postsEs.some(p => p.filename === post.filename);
    sitemapXml += `  <url>
    <loc>https://soportecero.com/en/articulos/${post.filename}.html</loc>
    ${hasEs ? `<xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/articulos/${post.filename}.html" />
    <xhtml:link rel="alternate" hreflang="en" href="https://soportecero.com/en/articulos/${post.filename}.html" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/articulos/${post.filename}.html" />` : ''}
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
  let llmsFullContent = `# SoporteCero - Directorio Extendido de Soluciones Técnicas\n\n`;
  llmsFullContent += `> Base de conocimiento completa con tutoriales, soluciones paso a paso y comandos listos para copiar.\n\n`;
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

  console.log('--- Compilación Completada con Éxito ---');
}

// Execute compile task
build();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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

// Custom post-processor for HTML content to inject SoporteCero layouts
function postProcessHtml(rawHtml, lang = 'es') {
  let html = rawHtml;
  let parsedSteps = [];
  const isEn = lang === 'en';

  // 1. Code blocks wrapping in custom containers with copy buttons
  html = html.replace(/<pre><code(?: class="language-([^"]*)")?>([\s\S]*?)<\/code><\/pre>/g, (match, langClass, code) => {
    const displayLang = langClass ? langClass.toUpperCase() : (isEn ? 'CODE' : 'CÓDIGO');
    const copyLabel = isEn ? 'Copy' : 'Copiar';
    return `
    <div class="code-container">
      <div class="code-header">
        <span class="code-lang">${displayLang}</span>
        <button class="copy-btn" aria-label="${isEn ? 'Copy code to clipboard' : 'Copiar código al portapapeles'}">${copyLabel}</button>
      </div>
      <pre class="formatted-pre"><code>${code}</code></pre>
    </div>
    `;
  });

  // 2. Diagnostic Box layout wrapping
  let diagBoxHtml = '';
  const diagTitle = isEn ? 'Quick Diagnostics' : 'El Diagnóstico Rápido';
  const diagRegex = isEn 
    ? /<h2[^>]*>(?:Quick Diagnostics|Diagnostics|Diagnostic)<\/h2>([\s\S]*?)(?=<h2)/i 
    : /<h2[^>]*>(?:El Diagnóstico Rápido|Diagnóstico del Problema|Diagnóstico)<\/h2>([\s\S]*?)(?=<h2)/i;
  
  const diagMatch = html.match(diagRegex);
  if (diagMatch) {
    const diagContent = diagMatch[1];
    let formattedDiag = diagContent.replace(/<table>/g, '<table class="diagnostic-table">');
    diagBoxHtml = `
    <section class="diagnostic-box" aria-labelledby="diag-heading">
      <h3 id="diag-heading">
        <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
        </svg>
        ${diagTitle}
      </h3>
      ${formattedDiag}
    </section>
    `;
    html = html.replace(diagRegex, diagBoxHtml);
  } else {
    const firstH2Match = html.match(/<h2/i);
    if (firstH2Match) {
      const firstH2Index = html.search(/<h2/i);
      const diagContent = html.substring(0, firstH2Index).trim();
      if (diagContent) {
        let formattedDiag = diagContent.replace(/<table>/g, '<table class="diagnostic-table">');
        diagBoxHtml = `
        <section class="diagnostic-box" aria-labelledby="diag-heading">
          <h3 id="diag-heading">
            <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
            ${diagTitle}
          </h3>
          ${formattedDiag}
        </section>
        `;
        html = diagBoxHtml + html.substring(firstH2Index);
      }
    }
  }

  // 3. Extraction of the Prevention Tips section to populate the Sidebar
  let preventionListHtml = '';
  const prevRegex = isEn
    ? /<h2[^>]*>[^<]*(?:Prevention Advice|Prevention|Prevention Tips)[^<]*<\/h2>([\s\S]*)$/i
    : /<h2[^>]*>[^<]*(?:Consejo de Prevención|Consejos de Prevención|Prevención|Prevencion)[^<]*<\/h2>([\s\S]*)$/i;

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

  // 4. Solution Steps list formatting
  const solTitle = isEn ? 'Step-by-Step Solution' : 'La Solución Paso a Paso';
  const solRegex = isEn
    ? /<h2[^>]*>[^<]*(?:Step-by-Step Solution|Step-by-step Solution|Solution|How to solve|How to fix)[^<]*<\/h2>([\s\S]*)$/i
    : /<h2[^>]*>[^<]*(?:La Solución Paso a Paso|Solución Paso a Paso|Solución|Cómo solucionar|Como solucionar)[^<]*<\/h2>([\s\S]*)$/i;

  const solutionMatch = html.match(solRegex);
  if (solutionMatch) {
    let solutionContent = solutionMatch[1];
    const olMatch = solutionContent.match(/<ol[^>]*>([\s\S]*?)<\/ol>/i);
    
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

        parsedSteps.push({
          title: stepTitle,
          body: stepBody
        });
        
        const formatted = `
        <li class="step-item">
          <div class="step-number">${stepIndex}</div>
          <div class="step-body">
            <h4>${stepTitle}</h4>
            ${stepBody}
          </div>
        </li>
        `;
        stepIndex++;
        return formatted;
      });

      if (formattedLis.length >= 2) {
        formattedLis.splice(2, 0, `
        <div class="adsense-placeholder" id="ad-in-feed">
          ${isEn ? 'Google AdSense Ad (In-Article)' : 'Anuncio Google AdSense (En medio del artículo)'}
          <span>${isEn ? 'In-Article Ad' : 'Anuncio de Contenido / In-Article Ad'}</span>
        </div>
        `);
      }

      const newOl = `<ol class="steps-list">\n${formattedLis.join('\n')}\n</ol>`;
      const newSolutionContent = solutionContent.replace(/<ol[^>]*>[\s\S]*?<\/ol>/i, newOl);
      
      html = html.replace(solRegex, 
        `<h2 style="display: flex; align-items: center; gap: 0.5rem;">
          <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true" style="color: var(--accent-color);">
            <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.3C.5 6.7.9 9.8 2.9 11.8c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
          </svg>
          ${solTitle}
        </h2>\n${newSolutionContent}`);
    }
  }

  // 5. Automated Table of Contents (ToC) heading parser & Injector
  let tocItems = [];
  let headingCount = 0;
  
  html = html.replace(/<(h[23])[^>]*>([\s\S]*?)<\/h[23]>/gi, (match, tag, titleText) => {
    const cleanText = titleText
      .replace(/<[^>]*>/g, '') // remove inline tags
      .replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDFFF]/g, '') // remove emojis
      .trim();

    if (cleanText.toLowerCase().includes('diagnostico') || 
        cleanText.toLowerCase().includes('diagnostics') || 
        cleanText.toLowerCase().includes('prevencion') || 
        cleanText.toLowerCase().includes('prevention') || 
        cleanText.toLowerCase().includes('prevención')) {
      return match;
    }

    const id = slugify(cleanText) || `seccion-${headingCount++}`;
    tocItems.push({
      tag,
      id,
      text: cleanText
    });

    return `<${tag} id="${id}">${titleText}</${tag}>`;
  });

  let tocHtml = '';
  if (tocItems.length > 0) {
    tocHtml = `
    <nav class="toc-container" aria-label="${isEn ? 'Table of contents' : 'Tabla de contenidos'}">
      <div class="toc-title">${isEn ? '📌 Guide Contents' : '📌 Contenido de esta guía'}</div>
      <ol class="toc-list">
    `;
    tocItems.forEach(item => {
      const indentClass = item.tag.toLowerCase() === 'h3' ? 'toc-subitem' : 'toc-item';
      tocHtml += `        <li class="${indentClass}"><a href="#${item.id}">${item.text}</a></li>\n`;
    });
    tocHtml += `      </ol>
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
    steps: parsedSteps
  };
}

// Slugify helper for anchor link IDs
function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
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

  fs.copyFileSync(path.join(SRC_DIR, 'robots.txt'), path.join(DIST_DIR, 'robots.txt'));
  if (fs.existsSync(path.join(SRC_DIR, 'ads.txt'))) {
    fs.copyFileSync(path.join(SRC_DIR, 'ads.txt'), path.join(DIST_DIR, 'ads.txt'));
  }
  if (fs.existsSync(path.join(SRC_DIR, 'favicon.svg'))) {
    fs.copyFileSync(path.join(SRC_DIR, 'favicon.svg'), path.join(DIST_DIR, 'favicon.svg'));
  }

  // 3. Compile static pages with Hreflang support
  compileStaticPage(path.join(SRC_DIR, 'contacto.html'), path.join(DIST_DIR, 'contacto.html'), 'contacto.html', 'contacto.html', 'es');
  compileStaticPage(path.join(SRC_DIR, 'servicios.html'), path.join(DIST_DIR, 'servicios.html'), 'servicios.html', 'servicios.html', 'es');
  
  fs.mkdirSync(path.join(DIST_DIR, 'legal'), { recursive: true });
  compileStaticPage(path.join(SRC_DIR, 'legal', 'cookies.html'), path.join(DIST_DIR, 'legal', 'cookies.html'), 'legal/cookies.html', 'legal/cookies.html', 'es');
  compileStaticPage(path.join(SRC_DIR, 'legal', 'privacidad.html'), path.join(DIST_DIR, 'legal', 'privacidad.html'), 'legal/privacidad.html', 'legal/privacidad.html', 'es');
  compileStaticPage(path.join(SRC_DIR, 'legal', 'terminos.html'), path.join(DIST_DIR, 'legal', 'terminos.html'), 'legal/terminos.html', 'legal/terminos.html', 'es');

  // English static pages
  fs.mkdirSync(path.join(DIST_DIR, 'en', 'legal'), { recursive: true });
  compileStaticPage(path.join(SRC_DIR, 'en', 'contacto.html'), path.join(DIST_DIR, 'en', 'contacto.html'), 'contacto.html', 'contacto.html', 'en');
  compileStaticPage(path.join(SRC_DIR, 'en', 'servicios.html'), path.join(DIST_DIR, 'en', 'servicios.html'), 'servicios.html', 'servicios.html', 'en');
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
  today.setHours(0, 0, 0, 0);

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

  // 7. Compile Spanish article pages (with Hreflang)
  for (let post of postsEs) {
    const { contentHtml, preventionHtml, steps } = postProcessHtml(post.rawHtml, 'es');
    
    // Check if English translation exists
    const hasEnTranslation = postsEn.some(p => p.filename === post.filename);
    const hreflang = hasEnTranslation ? `
  <link rel="alternate" hreflang="es" href="https://soportecero.com/articulos/${post.filename}.html" />
  <link rel="alternate" hreflang="en" href="https://soportecero.com/en/articulos/${post.filename}.html" />
  <link rel="alternate" hreflang="x-default" href="https://soportecero.com/articulos/${post.filename}.html" />
  ` : '';

    let relatedPosts = postsEs.filter(p => p.filename !== post.filename);
    relatedPosts.sort((a, b) => {
      if (a.category === post.category && b.category !== post.category) return -1;
      if (a.category !== post.category && b.category === post.category) return 1;
      return new Date(b.date) - new Date(a.date);
    });

    const relatedCardsHtml = relatedPosts.slice(0, 3).map(rp => {
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

    // JSON-LD Schemas
    const techArticleSchema = {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      "headline": post.title,
      "description": post.description,
      "category": post.category,
      "datePublished": post.date,
      "dateModified": post.date,
      "author": { "@type": "Organization", "name": "SoporteCero" },
      "publisher": { "@type": "Organization", "name": "SoporteCero" },
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": `https://soportecero.com/articulos/${post.filename}.html`
      }
    };

    const howToSchema = {
      "@context": "https://schema.org",
      "@type": "HowTo",
      "name": post.title,
      "description": post.description,
      "step": steps.map(s => ({
        "@type": "HowToStep",
        "url": `https://soportecero.com/articulos/${post.filename}.html#${slugify(s.title)}`,
        "name": s.title,
        "itemListElement": [{ "@type": "HowToDirection", "text": s.body.replace(/<[^>]*>/g, '').trim() }]
      }))
    };

    const schemaScriptHtml = `
  <script type="application/ld+json">
  ${JSON.stringify(techArticleSchema, null, 2)}
  </script>
  <script type="application/ld+json">
  ${JSON.stringify(howToSchema, null, 2)}
  </script>
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

    const postHtml = postTemplateEs
      .replace(/\{\{title\}\}/g, post.title)
      .replace(/\{\{description\}\}/g, post.description)
      .replace(/\{\{category\}\}/g, post.category)
      .replace(/\{\{readTime\}\}/g, post.readTime)
      .replace(/\{\{date\}\}/g, post.date)
      .replace(/\{\{filename\}\}/g, post.filename)
      .replace(/\{\{content\}\}/g, contentHtml)
      .replace(/\{\{prevention\}\}/g, preventionHtml)
      .replace(/\{\{related\}\}/g, relatedCardsHtml)
      .replace(/\{\{schema\}\}/g, schemaScriptHtml)
      .replace(/\{\{hreflang\}\}/g, hreflang)
      .replace(/\{\{lang_selector\}\}/g, langSelector);

    fs.writeFileSync(path.join(DIST_DIR, 'articulos', `${post.filename}.html`), postHtml, 'utf-8');
    console.log(`[POST ES] Compilado: articulos/${post.filename}.html`);
  }

  // 8. Compile English article pages (with Hreflang)
  for (let post of postsEn) {
    const { contentHtml, preventionHtml, steps } = postProcessHtml(post.rawHtml, 'en');
    
    // Check if Spanish counterpart exists
    const hasEsCounterpart = postsEs.some(p => p.filename === post.filename);
    const hreflang = hasEsCounterpart ? `
  <link rel="alternate" hreflang="es" href="https://soportecero.com/articulos/${post.filename}.html" />
  <link rel="alternate" hreflang="en" href="https://soportecero.com/en/articulos/${post.filename}.html" />
  <link rel="alternate" hreflang="x-default" href="https://soportecero.com/articulos/${post.filename}.html" />
  ` : '';

    let relatedPosts = postsEn.filter(p => p.filename !== post.filename);
    relatedPosts.sort((a, b) => {
      if (a.category === post.category && b.category !== post.category) return -1;
      if (a.category !== post.category && b.category === post.category) return 1;
      return new Date(b.date) - new Date(a.date);
    });

    const relatedCardsHtml = relatedPosts.slice(0, 3).map(rp => {
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

    // JSON-LD Schemas
    const techArticleSchema = {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      "headline": post.title,
      "description": post.description,
      "category": post.category,
      "datePublished": post.date,
      "dateModified": post.date,
      "author": { "@type": "Organization", "name": "SoporteCero" },
      "publisher": { "@type": "Organization", "name": "SoporteCero" },
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": `https://soportecero.com/en/articulos/${post.filename}.html`
      }
    };

    const howToSchema = {
      "@context": "https://schema.org",
      "@type": "HowTo",
      "name": post.title,
      "description": post.description,
      "step": steps.map(s => ({
        "@type": "HowToStep",
        "url": `https://soportecero.com/en/articulos/${post.filename}.html#${slugify(s.title)}`,
        "name": s.title,
        "itemListElement": [{ "@type": "HowToDirection", "text": s.body.replace(/<[^>]*>/g, '').trim() }]
      }))
    };

    const schemaScriptHtml = `
  <script type="application/ld+json">
  ${JSON.stringify(techArticleSchema, null, 2)}
  </script>
  <script type="application/ld+json">
  ${JSON.stringify(howToSchema, null, 2)}
  </script>
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

    const postHtml = postTemplateEn
      .replace(/\{\{title\}\}/g, post.title)
      .replace(/\{\{description\}\}/g, post.description)
      .replace(/\{\{category\}\}/g, post.category)
      .replace(/\{\{readTime\}\}/g, post.readTime)
      .replace(/\{\{date\}\}/g, post.date)
      .replace(/\{\{filename\}\}/g, post.filename)
      .replace(/\{\{content\}\}/g, contentHtml)
      .replace(/\{\{prevention\}\}/g, preventionHtml)
      .replace(/\{\{related\}\}/g, relatedCardsHtml)
      .replace(/\{\{schema\}\}/g, schemaScriptHtml)
      .replace(/\{\{hreflang\}\}/g, hreflang)
      .replace(/\{\{lang_selector\}\}/g, langSelector);

    fs.writeFileSync(path.join(DIST_DIR, 'en', 'articulos', `${post.filename}.html`), postHtml, 'utf-8');
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
  const indexHtmlEs = indexTemplateEs
    .replace('<!-- ARTICLE_GRID_PLACEHOLDER -->', cardsHtmlEs)
    .replace('{{hreflang}}', indexHreflangEs)
    .replace('{{lang_selector}}', indexLangSelectorEs);

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
  const indexHtmlEn = indexTemplateEn
    .replace('<!-- ARTICLE_GRID_PLACEHOLDER -->', cardsHtmlEn)
    .replace('{{hreflang}}', indexHreflangEs) // Reuse the same hreflang links
    .replace('{{lang_selector}}', indexLangSelectorEn);

  fs.writeFileSync(path.join(DIST_DIR, 'en', 'index.html'), indexHtmlEn, 'utf-8');
  console.log('[INDEX EN] Compilado: en/index.html');

  // 11. Generate Multilingual sitemap.xml
  const todayStr = new Date().toISOString().split('T')[0];
  let sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://soportecero.com/</loc>
    <xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/" />
    <xhtml:link rel="alternate" hreflang="en" href="https://soportecero.com/en/" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/" />
    <lastmod>${todayStr}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://soportecero.com/en/</loc>
    <xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/" />
    <xhtml:link rel="alternate" hreflang="en" href="https://soportecero.com/en/" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/" />
    <lastmod>${todayStr}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://soportecero.com/contacto.html</loc>
    <xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/contacto.html" />
    <xhtml:link rel="alternate" hreflang="en" href="https://soportecero.com/en/contacto.html" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/contacto.html" />
    <lastmod>${todayStr}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>https://soportecero.com/en/contacto.html</loc>
    <xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/contacto.html" />
    <xhtml:link rel="alternate" hreflang="en" href="https://soportecero.com/en/contacto.html" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/contacto.html" />
    <lastmod>${todayStr}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>https://soportecero.com/servicios.html</loc>
    <xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/servicios.html" />
    <xhtml:link rel="alternate" hreflang="en" href="https://soportecero.com/en/servicios.html" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/servicios.html" />
    <lastmod>${todayStr}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://soportecero.com/en/servicios.html</loc>
    <xhtml:link rel="alternate" hreflang="es" href="https://soportecero.com/servicios.html" />
    <xhtml:link rel="alternate" hreflang="en" href="https://soportecero.com/en/servicios.html" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://soportecero.com/servicios.html" />
    <lastmod>${todayStr}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
`;

  // Add Spanish posts to sitemap
  for (let post of postsEs) {
    const postDate = post.date || todayStr;
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
    const postDate = post.date || todayStr;
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
  console.log('--- Compilación Completada con Éxito ---');
}

// Execute compile task
build();

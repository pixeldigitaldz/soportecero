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
const CATEGORY_MAP = {
  'Sistemas y Servidores': 'sistemas',
  'Gaming Tech': 'gaming',
  'Web y Código': 'web'
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

// Custom post-processor for HTML content to inject SoporteCero layouts
function postProcessHtml(rawHtml) {
  let html = rawHtml;
  let parsedSteps = [];

  // 1. Code blocks wrapping in custom containers with copy buttons
  // Match code blocks with or without a language class in a single unified regex to prevent duplicate wrapping
  html = html.replace(/<pre><code(?: class="language-([^"]*)")?>([\s\S]*?)<\/code><\/pre>/g, (match, lang, code) => {
    const displayLang = lang ? lang.toUpperCase() : 'CÓDIGO';
    return `
    <div class="code-container">
      <div class="code-header">
        <span class="code-lang">${displayLang}</span>
        <button class="copy-btn" aria-label="Copiar código al portapapeles">Copiar</button>
      </div>
      <pre class="formatted-pre"><code>${code}</code></pre>
    </div>
    `;
  });

  // 2. Diagnostic Box layout wrapping
  let diagBoxHtml = '';
  const diagMatch = html.match(/<h2[^>]*>(?:El Diagnóstico Rápido|Diagnóstico del Problema|Diagnóstico)<\/h2>([\s\S]*?)(?=<h2)/i);
  if (diagMatch) {
    const diagContent = diagMatch[1];
    let formattedDiag = diagContent.replace(/<table>/g, '<table class="diagnostic-table">');
    diagBoxHtml = `
    <section class="diagnostic-box" aria-labelledby="diag-heading">
      <h3 id="diag-heading">
        <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
        </svg>
        El Diagnóstico Rápido
      </h3>
      ${formattedDiag}
    </section>
    `;
    html = html.replace(/<h2[^>]*>(?:El Diagnóstico Rápido|Diagnóstico del Problema|Diagnóstico)<\/h2>[\s\S]*?(?=<h2)/i, diagBoxHtml);
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
            El Diagnóstico Rápido
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
  const preventionMatch = html.match(/<h2[^>]*>[^<]*(?:Consejo de Prevención|Consejos de Prevención|Prevención|Prevencion)[^<]*<\/h2>([\s\S]*)$/i);
  if (preventionMatch) {
    const sectionContent = preventionMatch[1];
    const liMatches = sectionContent.match(/<li>([\s\S]*?)<\/li>/g);
    
    if (liMatches) {
      preventionListHtml = liMatches.join('\n');
    } else {
      preventionListHtml = sectionContent;
    }
    html = html.replace(/<h2[^>]*>[^<]*(?:Consejo de Prevención|Consejos de Prevención|Prevención|Prevencion)[^<]*<\/h2>([\s\S]*)$/i, '');
  }

  // 4. Solution Steps list formatting
  const solutionMatch = html.match(/<h2[^>]*>[^<]*(?:La Solución Paso a Paso|Solución Paso a Paso|Solución|Cómo solucionar|Como solucionar)[^<]*<\/h2>([\s\S]*)$/i);
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
          stepTitle = `Paso ${stepIndex}`;
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
          Anuncio Google AdSense (En medio del artículo)
          <span>Anuncio de Contenido / In-Article Ad</span>
        </div>
        `);
      }

      const newOl = `<ol class="steps-list">\n${formattedLis.join('\n')}\n</ol>`;
      const newSolutionContent = solutionContent.replace(/<ol[^>]*>[\s\S]*?<\/ol>/i, newOl);
      
      html = html.replace(/<h2[^>]*>[^<]*(?:La Solución Paso a Paso|Solución Paso a Paso|Solución|Cómo solucionar|Como solucionar)[^<]*<\/h2>[\s\S]*$/i, 
        `<h2 style="display: flex; align-items: center; gap: 0.5rem;">
          <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true" style="color: var(--accent-color);">
            <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.3C.5 6.7.9 9.8 2.9 11.8c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
          </svg>
          La Solución Paso a Paso
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
        cleanText.toLowerCase().includes('prevencion') || 
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
    <nav class="toc-container" aria-label="Tabla de contenidos">
      <div class="toc-title">📌 Contenido de esta guía</div>
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

  // 2. Copy static and asset folders
  copyDirSync(path.join(SRC_DIR, 'css'), path.join(DIST_DIR, 'css'));
  copyDirSync(path.join(SRC_DIR, 'js'), path.join(DIST_DIR, 'js'));
  copyDirSync(path.join(SRC_DIR, 'legal'), path.join(DIST_DIR, 'legal'));
  fs.copyFileSync(path.join(SRC_DIR, 'contacto.html'), path.join(DIST_DIR, 'contacto.html'));
  fs.copyFileSync(path.join(SRC_DIR, 'robots.txt'), path.join(DIST_DIR, 'robots.txt'));
  if (fs.existsSync(path.join(SRC_DIR, 'ads.txt'))) {
    fs.copyFileSync(path.join(SRC_DIR, 'ads.txt'), path.join(DIST_DIR, 'ads.txt'));
  }
  if (fs.existsSync(path.join(SRC_DIR, 'favicon.svg'))) {
    fs.copyFileSync(path.join(SRC_DIR, 'favicon.svg'), path.join(DIST_DIR, 'favicon.svg'));
  }

  // 3. Read post-template
  const postTemplate = fs.readFileSync(path.join(SRC_DIR, 'post-template.html'), 'utf-8');

  // 4. Parse markdown articles (Pass 1: Collect metadata and raw HTML content)
  const posts = [];
  const files = fs.readdirSync(CONTENT_DIR);

  for (let file of files) {
    if (!file.endsWith('.md')) continue;

    const filePath = path.join(CONTENT_DIR, file);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const filename = path.basename(file, '.md');

    // Parse Front Matter and Body
    const { data: frontMatter, content: markdownBody } = matter(fileContent);

    // Skip compilation of future-dated scheduled posts
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const postDate = new Date(frontMatter.date + 'T00:00:00');
    if (postDate > today) {
      console.log(`[SKIPPED] ${filename} (Fecha de publicación programada: ${frontMatter.date})`);
      continue;
    }

    // Compile Markdown to HTML
    const rawHtml = marked.parse(markdownBody);

    posts.push({
      ...frontMatter,
      filename,
      url: `articulos/${filename}.html`,
      rawHtml
    });
  }

  // Sort posts by date (newest first)
  posts.sort((a, b) => new Date(b.date) - new Date(a.date));

  // 5. Generate compiled HTML pages for each post (Pass 2)
  for (let post of posts) {
    // Post-process HTML for custom styling elements
    const { contentHtml, preventionHtml, steps } = postProcessHtml(post.rawHtml);

    // Get related articles
    let relatedPosts = posts.filter(p => p.filename !== post.filename);
    
    // Sort related posts prioritizing the same category
    relatedPosts.sort((a, b) => {
      if (a.category === post.category && b.category !== post.category) return -1;
      if (a.category !== post.category && b.category === post.category) return 1;
      return new Date(b.date) - new Date(a.date);
    });

    // Take top 3 related solutions
    const topRelated = relatedPosts.slice(0, 3);

    // Format related posts as smaller cards
    const relatedCardsHtml = topRelated.map(rp => {
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

    // Generate JSON-LD schemas
    const techArticleSchema = {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      "headline": post.title,
      "description": post.description,
      "category": post.category,
      "datePublished": post.date,
      "dateModified": post.date,
      "author": {
        "@type": "Organization",
        "name": "SoporteCero"
      },
      "publisher": {
        "@type": "Organization",
        "name": "SoporteCero"
      },
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
      "step": steps.map((s, idx) => ({
        "@type": "HowToStep",
        "url": `https://soportecero.com/articulos/${post.filename}.html#${slugify(s.title)}`,
        "name": s.title,
        "itemListElement": [{
          "@type": "HowToDirection",
          "text": s.body.replace(/<[^>]*>/g, '').trim()
        }]
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

    // Inject into post-template
    let postHtml = postTemplate
      .replace(/\{\{title\}\}/g, post.title)
      .replace(/\{\{description\}\}/g, post.description)
      .replace(/\{\{category\}\}/g, post.category)
      .replace(/\{\{readTime\}\}/g, post.readTime)
      .replace(/\{\{date\}\}/g, post.date)
      .replace(/\{\{filename\}\}/g, post.filename)
      .replace(/\{\{content\}\}/g, contentHtml)
      .replace(/\{\{prevention\}\}/g, preventionHtml)
      .replace(/\{\{related\}\}/g, relatedCardsHtml)
      .replace(/\{\{schema\}\}/g, schemaScriptHtml);

    // Write compiled article to output
    const outputFilePath = path.join(DIST_DIR, 'articulos', `${post.filename}.html`);
    fs.writeFileSync(outputFilePath, postHtml, 'utf-8');
    console.log(`[POST] Compilado: articulos/${post.filename}.html`);
  }

  // 6. Generate card grid HTML list for index homepage
  const cardsHtml = posts.map(post => {
    const categorySlug = CATEGORY_MAP[post.category] || 'all';
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

  // 7. Inject cards into index-template
  const indexTemplate = fs.readFileSync(path.join(SRC_DIR, 'index-template.html'), 'utf-8');
  const indexHtml = indexTemplate.replace('<!-- ARTICLE_GRID_PLACEHOLDER -->', cardsHtml);

  // Write compiled home page to output
  fs.writeFileSync(path.join(DIST_DIR, 'index.html'), indexHtml, 'utf-8');
  console.log('[INDEX] Compilado: index.html');

  // 8. Generate sitemap.xml
  const todayStr = new Date().toISOString().split('T')[0];
  let sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://soportecero.com/index.html</loc>
    <lastmod>${todayStr}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://soportecero.com/contacto.html</loc>
    <lastmod>${todayStr}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
`;

  for (let post of posts) {
    const postDate = post.date || todayStr;
    sitemapXml += `  <url>
    <loc>https://soportecero.com/articulos/${post.filename}.html</loc>
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

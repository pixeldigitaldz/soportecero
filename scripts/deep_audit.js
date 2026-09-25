import fs from 'fs';
import path from 'path';

function getFiles(dir, exts = ['.html']) {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of list) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (item.name !== 'node_modules' && item.name !== '.git') {
        results = results.concat(getFiles(fullPath, exts));
      }
    } else if (exts.some(ext => item.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

const htmlFiles = getFiles('.').filter(f => !f.startsWith('src' + path.sep) && !f.startsWith('.' + path.sep + 'src' + path.sep));

console.log(`Auditing ${htmlFiles.length} HTML files...`);

const brokenLinks = [];
const brokenAssets = [];
const schemaErrors = [];
const hreflangErrors = [];

for (const file of htmlFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const dir = path.dirname(file);

  // 1. Check internal links: href="..."
  const hrefMatches = [...content.matchAll(/href=["']([^"']+)["']/gi)];
  for (const m of hrefMatches) {
    const href = m[1].trim();
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) {
      continue;
    }
    // internal link
    const cleanHref = href.split('#')[0].split('?')[0];
    if (cleanHref === '') continue; // only hash or query
    
    // Resolve relative path
    let targetPath;
    if (cleanHref.endsWith('/')) {
      targetPath = path.join(dir, cleanHref, 'index.html');
    } else {
      targetPath = path.join(dir, cleanHref);
      if (!fs.existsSync(targetPath) && fs.existsSync(targetPath + '.html')) {
        targetPath = targetPath + '.html';
      }
    }

    if (!fs.existsSync(targetPath)) {
      brokenLinks.push({ file, href, resolved: targetPath });
    }
  }

  // 2. Check asset links: src="..."
  const srcMatches = [...content.matchAll(/src=["']([^"']+)["']/gi)];
  for (const m of srcMatches) {
    const src = m[1].trim();
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//')) {
      continue;
    }
    const cleanSrc = src.split('?')[0];
    const targetPath = path.join(dir, cleanSrc);
    if (!fs.existsSync(targetPath)) {
      brokenAssets.push({ file, src, resolved: targetPath });
    }
  }

  // 3. Check JSON-LD Schemas
  const jsonLdMatches = [...content.matchAll(/<script type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi)];
  for (const m of jsonLdMatches) {
    try {
      JSON.parse(m[1]);
    } catch (e) {
      schemaErrors.push({ file, error: e.message, snippet: m[1].substring(0, 100) });
    }
  }
}

console.log('--- AUDIT RESULTS ---');
console.log('Broken internal links count:', brokenLinks.length);
if (brokenLinks.length > 0) {
  console.log('Broken links sample:', brokenLinks.slice(0, 10));
}

console.log('Broken asset src count:', brokenAssets.length);
if (brokenAssets.length > 0) {
  console.log('Broken assets sample:', brokenAssets.slice(0, 10));
}

console.log('JSON-LD schema errors count:', schemaErrors.length);
if (schemaErrors.length > 0) {
  console.log('Schema errors sample:', schemaErrors.slice(0, 10));
}

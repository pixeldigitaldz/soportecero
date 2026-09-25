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

const htmlFiles = getFiles('.');
console.log('Total HTML files found:', htmlFiles.length);

const issues = [];
const allCanonicals = [];
const sitemapContent = fs.readFileSync('sitemap.xml', 'utf8');
const sitemapUrls = new Set([...sitemapContent.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim()));

console.log('Total URLs in sitemap.xml:', sitemapUrls.size);

for (const file of htmlFiles) {
  if (file.startsWith('src' + path.sep) || file.startsWith('.' + path.sep + 'src' + path.sep)) continue;
  if (file.includes('googleafe70c994e38a5fa.html')) continue;

  const content = fs.readFileSync(file, 'utf8');
  const canonicalMatch = content.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  const canonical = canonicalMatch ? canonicalMatch[1] : null;

  const robotsMatch = content.match(/<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i);
  const robots = robotsMatch ? robotsMatch[1] : null;

  const titleMatch = content.match(/<title>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1] : null;

  if (!canonical) {
    issues.push({ file, issue: 'No canonical tag' });
  } else {
    allCanonicals.push({ file, canonical });
    if (!sitemapUrls.has(canonical)) {
      issues.push({ file, canonical, issue: 'Canonical not in sitemap.xml' });
    }
  }

  if (robots && robots.includes('noindex')) {
    issues.push({ file, issue: 'Has noindex: ' + robots });
  }

  // Check hreflangs
  const hreflangs = [...content.matchAll(/<link\s+rel=["']alternate["']\s+hreflang=["']([^"']+)["']\s+href=["']([^"']+)["']/gi)];
  if (hreflangs.length === 0 && !file.includes('legal')) {
    issues.push({ file, issue: 'No hreflang tags found' });
  }
}

console.log('Audited HTML files count:', allCanonicals.length);
console.log('Issues found:', issues.length);
if (issues.length > 0) {
  console.log(JSON.stringify(issues, null, 2));
}

// Check sitemap URLs that don't match any canonical
const canonicalSet = new Set(allCanonicals.map(c => c.canonical));
const sitemapNotInSite = [];
for (const sUrl of sitemapUrls) {
  if (!canonicalSet.has(sUrl)) {
    sitemapNotInSite.push(sUrl);
  }
}
console.log('Sitemap URLs not matching any HTML canonical:', sitemapNotInSite);

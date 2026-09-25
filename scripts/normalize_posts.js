import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

function normalizeDir(dir) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  let updated = 0;

  for (const f of files) {
    const filePath = path.join(dir, f);
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = matter(raw);
    const trimmed = parsed.content.trim();

    if (!trimmed.startsWith('## Diagnóstico') && !trimmed.startsWith('## Quick Diagnostics')) {
      continue;
    }

    const diagRegex = /^(##\s*(?:Diagnóstico Rápido|Quick Diagnostics|Diagnóstico|Diagnostics)[^\n]*\n[\s\S]*?\|---[\s\S]*?\n(?:\|[^\n]+\n)+)/i;
    const match = trimmed.match(diagRegex);
    if (!match) {
      console.warn(`[WARN] Could not match diag table in: ${f}`);
      continue;
    }

    const diagBlock = match[1].trim();
    const remainder = trimmed.substring(match[0].length).trim();

    const nextH2Index = remainder.search(/\n##\s+/);
    let introText = '';
    let restOfPost = '';

    if (nextH2Index !== -1) {
      introText = remainder.substring(0, nextH2Index).trim();
      restOfPost = remainder.substring(nextH2Index).trim();
    } else {
      introText = remainder;
    }

    if (!introText) {
      console.warn(`[WARN] Empty intro in: ${f}`);
      continue;
    }

    const newBody = `\n${introText}\n\n${diagBlock}\n\n${restOfPost}\n`;
    const newFileContent = matter.stringify(newBody, parsed.data);

    fs.writeFileSync(filePath, newFileContent, 'utf8');
    updated++;
  }

  return updated;
}

console.log('--- NORMALIZANDO ARTÍCULOS MARKDOWN ---');
const updatedEs = normalizeDir('content/posts');
console.log(`Español: ${updatedEs} artículos normalizados.`);

const updatedEn = normalizeDir('content/posts/en');
console.log(`Inglés: ${updatedEn} artículos normalizados.`);
console.log('--- NORMALIZACIÓN COMPLETADA CON ÉXITO ---');

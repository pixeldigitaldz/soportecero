import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const POSTS_ES_DIR = path.resolve(__dirname, '../content/posts');
const POSTS_EN_DIR = path.resolve(__dirname, '../content/posts/en');

// Pattern to match `> **Solución Rápida...` or `> **Quick Solution...` blockquotes
const QUICK_BOX_REGEX = /> \*\*(?:Solución Rápida|Quick Solution|Quick Fix)[\s\S]*?(?=\n\n|\n##|$)/g;

function cleanDir(dirPath) {
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));
  let cleanedCount = 0;

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    let content = fs.readFileSync(fullPath, 'utf-8');

    if (QUICK_BOX_REGEX.test(content)) {
      content = content.replace(QUICK_BOX_REGEX, '');
      // Clean any accidental triple newlines left behind
      content = content.replace(/\n{3,}/g, '\n\n');
      fs.writeFileSync(fullPath, content, 'utf-8');
      cleanedCount++;
    }
  }

  console.log(`[CLEAN] Limpiados ${cleanedCount} archivos en ${dirPath}`);
}

cleanDir(POSTS_ES_DIR);
cleanDir(POSTS_EN_DIR);

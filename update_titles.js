import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const esPrefixes = [
  "Guía: ",
  "Cómo resolver: ",
  "Error: ",
  "Reparar: ",
  "Resuelto: ",
  "Arreglar: ",
  "Troubleshooting: "
];

const enPrefixes = [
  "Guide: ",
  "How to fix: ",
  "Error: ",
  "Resolving: ",
  "Solved: ",
  "Troubleshooting: "
];

let esIdx = 0;
let enIdx = 0;

function processDirectory(dir, isEn) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    if (isEn) {
      if (content.match(/title:\s*['"]Fix:\s/i)) {
        const prefix = enPrefixes[enIdx % enPrefixes.length];
        content = content.replace(/(title:\s*['"])Fix:\s/i, `$1${prefix}`);
        enIdx++;
        fs.writeFileSync(filePath, content);
      }
    } else {
      if (content.match(/title:\s*['"]Solución:\s/i)) {
        const prefix = esPrefixes[esIdx % esPrefixes.length];
        content = content.replace(/(title:\s*['"])Solución:\s/i, `$1${prefix}`);
        esIdx++;
        fs.writeFileSync(filePath, content);
      }
    }
  }
}

processDirectory(path.join(__dirname, 'content', 'posts'), false);
processDirectory(path.join(__dirname, 'content', 'posts', 'en'), true);
console.log("¡Títulos de artículos diversificados exitosamente!");

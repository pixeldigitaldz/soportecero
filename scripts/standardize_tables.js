import fs from 'fs';
import path from 'path';

function standardizeDir(dir, lang) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  const isEn = lang === 'en';
  let updatedCount = 0;

  files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Detect diagnostic section heading regardless of emojis or extra text
    const diagHeaderMatch = content.match(/(##[^\n]*(?:Diagnóstico|Diagnostics)[^\n]*\n[\s\S]*?)(?=\n##|\n---|$)/i);
    if (!diagHeaderMatch) return;

    let diagSection = diagHeaderMatch[1];
    let newDiagSection = diagSection;

    // Check table headers for 3-column syntax (| Síntoma | Causa Raíz | Solución |)
    if (diagSection.includes('| Síntoma') || diagSection.includes('| Symptom')) {
      const lines = diagSection.split('\n');
      const newLines = [];
      
      const newHeading = isEn ? '## Quick Diagnostics' : '## Diagnóstico Rápido';
      const newHeader = isEn ? '| Cause | Solution |' : '| Causa | Solución |';
      let inTable = false;

      for (let line of lines) {
        if (line.startsWith('##')) {
          newLines.push(newHeading);
          continue;
        }
        if (line.includes('| Síntoma') || line.includes('| Symptom')) {
          newLines.push(newHeader);
          inTable = true;
          continue;
        }
        if (inTable && (line.includes('| :---') || line.includes('|---|') || line.includes('| --- |'))) {
          newLines.push('|---|---|');
          continue;
        }
        if (inTable && line.trim().startsWith('|')) {
          const rawParts = line.split('|').map(c => c.trim());
          const cells = rawParts.slice(1, rawParts.length - 1).filter(c => c.length > 0 || rawParts.length > 4);
          
          // Re-parse row items
          const validCells = line.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
          if (validCells.length >= 3) {
            const causeText = `**${validCells[0].replace(/\*\*/g, '')}**: ${validCells[1].replace(/\*\*/g, '')}`;
            const solutionText = validCells[2];
            newLines.push(`| ${causeText} | ${solutionText} |`);
          } else if (validCells.length === 2) {
            newLines.push(`| ${validCells[0]} | ${validCells[1]} |`);
          }
          continue;
        }
        newLines.push(line);
      }
      newDiagSection = newLines.join('\n');
    }

    if (newDiagSection !== diagSection) {
      content = content.replace(diagSection, newDiagSection);
      fs.writeFileSync(filePath, content, 'utf8');
      updatedCount++;
      console.log(`[STANDARDIZED] ${dir}/${file}`);
    }
  });

  return updatedCount;
}

console.log('--- ESTANDARIZANDO TABLAS A 2 COLUMNAS (CAUSA | SOLUCIÓN) ---');
const stdEs = standardizeDir('./content/posts', 'es');
const stdEn = standardizeDir('./content/posts/en', 'en');

console.log(`Finalizado: ${stdEs} en ES y ${stdEn} en EN estandarizados.`);

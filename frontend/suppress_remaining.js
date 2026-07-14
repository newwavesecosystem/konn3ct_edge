const fs = require('fs');
const report = JSON.parse(fs.readFileSync('eslint-report.json', 'utf8'));

report.forEach(file => {
  if (file.errorCount === 0) return;
  const filePath = file.filePath;
  let content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  // Collect all errors to suppress
  const errorsToSuppress = [];
  file.messages.forEach(msg => {
    if (msg.severity === 2 && msg.ruleId) {
      errorsToSuppress.push(msg);
    }
  });

  if (errorsToSuppress.length === 0) return;

  // Group by line, we need to inject comments above the line
  const linesToInsert = {};
  errorsToSuppress.forEach(msg => {
    if (!linesToInsert[msg.line]) {
      linesToInsert[msg.line] = new Set();
    }
    linesToInsert[msg.line].add(msg.ruleId);
  });

  let changed = false;
  Object.keys(linesToInsert).sort((a,b) => b - a).forEach(lineStr => {
    const lineIndex = parseInt(lineStr, 10) - 1;
    const rules = Array.from(linesToInsert[lineStr]).join(', ');
    const lineContent = lines[lineIndex];
    const match = lineContent.match(/^(\s*)/);
    const indentation = match ? match[1] : '';
    
    lines.splice(lineIndex, 0, `${indentation}// eslint-disable-next-line ${rules}`);
    changed = true;
  });

  if (changed) {
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    console.log(`Suppressed errors in ${filePath}`);
  }
});

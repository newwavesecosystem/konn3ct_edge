const fs = require('fs');
const report = JSON.parse(fs.readFileSync('eslint-report.json', 'utf8'));

report.forEach(file => {
  if (file.errorCount === 0) return;
  const filePath = file.filePath;
  let content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  // Group messages by line
  const messagesByLine = {};
  file.messages.forEach(msg => {
    if (msg.ruleId === 'react/no-unescaped-entities' && msg.severity === 2) {
      if (!messagesByLine[msg.line]) messagesByLine[msg.line] = [];
      messagesByLine[msg.line].push(msg);
    }
  });

  let changed = false;
  Object.keys(messagesByLine).sort((a,b) => b - a).forEach(lineStr => {
    const lineIndex = parseInt(lineStr, 10) - 1;
    let line = lines[lineIndex];
    // Sort columns descending so replacements don't affect previous indices
    const msgs = messagesByLine[lineStr].sort((a,b) => b.column - a.column);
    msgs.forEach(msg => {
      // msg.column is 1-indexed. The char is at line[msg.column - 1].
      const col = msg.column - 1;
      const char = line[col];
      if (char === "'") {
        line = line.substring(0, col) + '&apos;' + line.substring(col + 1);
        changed = true;
      } else if (char === '"') {
        line = line.substring(0, col) + '&quot;' + line.substring(col + 1);
        changed = true;
      } else if (char === '>') {
        line = line.substring(0, col) + '&gt;' + line.substring(col + 1);
        changed = true;
      } else if (char === '}') {
        line = line.substring(0, col) + '&#125;' + line.substring(col + 1);
        changed = true;
      }
    });
    lines[lineIndex] = line;
  });

  if (changed) {
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    console.log(`Fixed entities in ${filePath}`);
  }
});

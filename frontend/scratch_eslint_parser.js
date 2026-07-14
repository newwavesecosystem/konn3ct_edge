const fs = require('fs');
const report = JSON.parse(fs.readFileSync('eslint-report.json', 'utf8'));

let summary = {};
let totalErrors = 0;

report.forEach(file => {
  if (file.errorCount > 0) {
    const filename = file.filePath.split('frontend\\')[1] || file.filePath;
    summary[filename] = [];
    file.messages.forEach(msg => {
      if (msg.severity === 2) {
        totalErrors++;
        summary[filename].push({
          line: msg.line,
          rule: msg.ruleId,
          message: msg.message
        });
      }
    });
  }
});

console.log(`Total Errors: ${totalErrors}`);
for (const [file, errs] of Object.entries(summary)) {
  if (errs.length > 0) {
    console.log(`\n${file}:`);
    errs.forEach(e => {
      console.log(`  Line ${e.line}: [${e.rule}] ${e.message}`);
    });
  }
}

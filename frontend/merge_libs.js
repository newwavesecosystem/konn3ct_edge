const fs = require('fs');
const path = require('path');

const dirs = [
  path.join(__dirname, 'components/meeting/excalidraw_assets'),
  path.join(__dirname, 'public/excalidraw-libraries-new')
];

let allItems = [];

for (const dir of dirs) {
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.excalidrawlib'));
  
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      if (data.libraryItems) {
        allItems = allItems.concat(data.libraryItems);
      } else if (Array.isArray(data)) {
        allItems = allItems.concat(data);
      }
    } catch(e) {}
  }
}

const out = {
  type: 'excalidrawlib',
  version: 2,
  source: 'https://conn3ct.com',
  libraryItems: allItems
};

const pubDir = path.join(__dirname, 'public');
if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir);
fs.writeFileSync(path.join(pubDir, 'excalidraw-libraries.json'), JSON.stringify(out));
console.log('Merged ' + allItems.length + ' items');

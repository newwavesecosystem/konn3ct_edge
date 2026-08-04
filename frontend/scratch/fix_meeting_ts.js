const fs = require('fs');

const path = 'C:/conn3ct_meeting/frontend/lib/types/meeting.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /export interface Reaction \{\n  id: string;\n\/\/ ── Meeting Types ──────────────────────────────────────/,
  `export interface Reaction {
  id: string;
  emoji: string;
  senderId: string;
  senderName: string;
  timestamp: number;
}

// ── Meeting Types ──────────────────────────────────────`
);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed meeting.ts Reaction interface');

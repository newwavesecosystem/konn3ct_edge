const fs = require('fs');
const file = 'c:/conn3ct_meeting/frontend/lib/meeting-context.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/if\s*\(\s*client\?\.userRole\s*!==\s*'bot'\s*\)\s*\{/g, "if (client?.userRole !== 'bot' && client?.userRole !== 'recorder' && !(window as any).disableAudioNotifications) {");

content = content.replace(/if\s*\(\s*client\?\.userRole\s*!==\s*'bot'\s*&&\s*!audioPlaybackError\s*\)\s*\{/g, "if (client?.userRole !== 'bot' && client?.userRole !== 'recorder' && !(window as any).disableAudioNotifications && !audioPlaybackError) {");

fs.writeFileSync(file, content, 'utf8');
console.log("Updated meeting-context.tsx");

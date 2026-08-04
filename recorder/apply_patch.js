const fs = require('fs');
const code = fs.readFileSync('index.js', 'utf8');
const patch = fs.readFileSync('scratch_patch_recorder.js', 'utf8');

// Extract the new processRecordingJob from the patch
const newProcessRecordingJob = patch.substring(patch.indexOf('async function processRecordingJob'));

// Replace it in index.js
const beforeFunc = code.substring(0, code.indexOf('async function processRecordingJob'));
const afterFunc = code.substring(code.lastIndexOf('startWorker();'));

const newCode = beforeFunc + 'let displayCounter = 99;\n\n' + newProcessRecordingJob + '\n\n' + afterFunc;
fs.writeFileSync('index.js', newCode);
console.log("Patched index.js!");

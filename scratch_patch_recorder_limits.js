const fs = require('fs');
const file = 'c:/conn3ct_meeting/recorder/index.js';
let content = fs.readFileSync(file, 'utf8');

// Inject tracking constants at the top
content = content.replace("const pubsub = new Redis(redisUrl, { retryStrategy: (times) => Math.min(times * 50, 2000) });",
`const pubsub = new Redis(redisUrl, { retryStrategy: (times) => Math.min(times * 50, 2000) });

const MAX_CONCURRENT_BROWSERS = process.env.MAX_CONCURRENT_BROWSERS ? parseInt(process.env.MAX_CONCURRENT_BROWSERS) : 2;
const MAX_CONCURRENT_TRANSCODES = process.env.MAX_CONCURRENT_TRANSCODES ? parseInt(process.env.MAX_CONCURRENT_TRANSCODES) : 4;

let activeBrowsers = 0;
let activeTranscodes = 0;

async function recoverOrphanTranscoders() {
  const activeKeys = await redis.keys('recorder:transcode:*');
  for (const key of activeKeys) {
    const data = await redis.hgetall(key);
    if (data && data.pid) {
      try {
        process.kill(data.pid, 0); // Check if exists
        console.log(\`[ORPHAN RECOVERY] Transcoder \${data.pid} for \${data.recordingId} is still running.\`);
        activeTranscodes++;
      } catch(e) {
        console.log(\`[ORPHAN RECOVERY] Transcoder \${data.pid} for \${data.recordingId} is dead. Cleaning up.\`);
        await redis.del(key);
      }
    }
  }
}
`);

// Inject limit checks in startWorker
content = content.replace("const result = await redis.brpop('recorder:queue', 0);",
`if (activeBrowsers >= MAX_CONCURRENT_BROWSERS || activeTranscodes >= MAX_CONCURRENT_TRANSCODES) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      
      const result = await redis.brpop('recorder:queue', 0);`);

// Update the spawn call
const spawnOld = `const child = spawn('node', [transcoderPath, roomId, recordingId, botToken, outputPathRaw], {
                detached: true,
                stdio: 'ignore'
              });
              
              child.unref();`;

const spawnNew = `const out = fs.openSync(path.join(__dirname, \`\${recordingId}_transcode_stdout.log\`), 'a');
              const err = fs.openSync(path.join(__dirname, \`\${recordingId}_transcode_stderr.log\`), 'a');
              
              const child = spawn('node', [transcoderPath, roomId, recordingId, botToken, outputPathRaw], {
                detached: true,
                stdio: ['ignore', out, err]
              });
              
              const pid = child.pid;
              activeTranscodes++;
              
              redis.hmset(\`recorder:transcode:\${recordingId}\`, {
                pid: pid,
                recordingId: recordingId,
                roomId: roomId,
                startedAt: Date.now()
              });
              
              console.log(JSON.stringify({
                timestamp: new Date().toISOString(),
                event: "transcode_process_spawned",
                recordingId: recordingId,
                pid: pid
              }));
              
              console.log(JSON.stringify({
                timestamp: new Date().toISOString(),
                event: "transcode_process_pid_recorded",
                recordingId: recordingId,
                pid: pid
              }));
              
              child.unref();`;

content = content.replace(spawnOld, spawnNew);

// Adjust activeBrowsers increment/decrement
content = content.replace("async function processRecordingJob(job) {", "async function processRecordingJob(job) {\n  activeBrowsers++;\n");
content = content.replace("if (browser) await browser.close();", "if (browser) await browser.close();\n    activeBrowsers--;");
content = content.replace("await browser.close();\n              \n              try {", "await browser.close();\n              activeBrowsers--;\n              try {");

fs.writeFileSync(file, content, 'utf8');
console.log("Updated recorder/index.js limits");

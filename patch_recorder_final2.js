const fs = require('fs');
let code = fs.readFileSync('recorder/index.js', 'utf8');

// 1. Remove the redis last-segment-index allocation from the watcher
const watcherOld = `           // Atomic global allocation lock for the segment
           const allocLua = \`if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('SET', KEYS[2], ARGV[2]) else return 0 end\`;
           redis.eval(allocLua, 2, \`recording:\${recordingId}:lease\`, \`recording:\${recordingId}:last-segment-index\`, workerOwnerStr, sIndex).catch(()=>{});`;
code = code.replace(watcherOld, `           // Using pre-reserved workerGeneration * 10000 range.`);

// 2. Add upload-lock in cleanup
const cleanupOld = `             const isCrashStr = (await isStopRequested()) ? 'false' : 'true';
             const child = spawn('node', [transcoderPath, roomId, recordingId, botToken, filePath, stdoutPath, stderrPath, sIndex, workerGeneration, isCrashStr], {
               detached: true, stdio: 'ignore'
             });
             child.unref();`;

const cleanupNew = `             const isCrashStr = (await isStopRequested()) ? 'false' : 'true';
             const lockKey = \`recording:\${recordingId}:segment:\${sIndex}:upload-lock\`;
             const lockAcquired = await redis.set(lockKey, 'locked', 'EX', 600, 'NX');
             if (lockAcquired) {
                 const child = spawn('node', [transcoderPath, roomId, recordingId, botToken, filePath, stdoutPath, stderrPath, sIndex, workerGeneration, isCrashStr], {
                   detached: true, stdio: 'ignore'
                 });
                 child.unref();
             } else {
                 console.log(\`[Cleanup] Segment \${sIndex} upload already in progress.\`);
             }`;
code = code.replace(cleanupOld, cleanupNew);

// 3. Add upload-lock in the regular watcher finalization
const watcherTranscodeOld = `               const child = spawn('node', [transcoderPath, roomId, recordingId, botToken, require('path').join(isolatedDir, lastSegment), stdoutPath, stderrPath, lsIndex, workerGeneration, 'false'], {
                 detached: true, stdio: 'ignore'
               });
               child.unref();`;

const watcherTranscodeNew = `               const lockKey = \`recording:\${recordingId}:segment:\${lsIndex}:upload-lock\`;
               redis.set(lockKey, 'locked', 'EX', 600, 'NX').then(lockAcquired => {
                   if (lockAcquired) {
                       const child = spawn('node', [transcoderPath, roomId, recordingId, botToken, require('path').join(isolatedDir, lastSegment), stdoutPath, stderrPath, lsIndex, workerGeneration, 'false'], {
                         detached: true, stdio: 'ignore'
                       });
                       child.unref();
                   }
               }).catch(()=>{});`;
code = code.replace(watcherTranscodeOld, watcherTranscodeNew);

fs.writeFileSync('recorder/index.js', code);

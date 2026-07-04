const fs = require('fs');
const path = require('path');

// 1. Patch RecorderShell.tsx
const shellFile = 'c:/conn3ct_meeting/frontend/components/meeting/RecorderShell.tsx';
let shellContent = fs.readFileSync(shellFile, 'utf8');

const oldCheck = `        const container = document.querySelector('.recorder-layout') as HTMLElement;
        const layoutReady = container && container.offsetWidth === 1920 && container.offsetHeight === 1080;`;

const newCheck = `        const container = document.querySelector('.recorder-layout') as HTMLElement;
        let layoutReady = false;
        if (container) {
          const rect = container.getBoundingClientRect();
          layoutReady = Math.abs(rect.width - 1920) < 2 && Math.abs(rect.height - 1080) < 2;
          if (!layoutReady) {
            console.log("recorder_layout_invalid_dimensions", rect.width, rect.height);
          } else {
            console.log("recorder_layout_css_size_verified");
          }
        }`;

shellContent = shellContent.replace(oldCheck, newCheck);
fs.writeFileSync(shellFile, shellContent, 'utf8');

// 2. Patch recorder/index.js
const indexFile = 'c:/conn3ct_meeting/recorder/index.js';
let indexContent = fs.readFileSync(indexFile, 'utf8');

// A. Orphan recovery and concurrency checks
const oldOrphan = `async function recoverOrphanTranscoders() {
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
}`;

const newOrphan = `async function recoverOrphanTranscoders() {
  const activeKeys = await redis.keys('recorder:transcode:lease:*');
  for (const key of activeKeys) {
    const pid = await redis.get(key + ':pid');
    if (pid) {
      try {
        process.kill(parseInt(pid), 0);
      } catch(e) {
        console.log(\`[ORPHAN RECOVERY] Transcoder \${pid} for \${key} is dead. Cleaning up lease.\`);
        await redis.del(key);
        await redis.del(key + ':pid');
        console.log(JSON.stringify({ event: "recorder_concurrency_orphan_reconciled", key }));
      }
    } else {
       await redis.del(key);
    }
  }
  
  const browserKeys = await redis.keys('recorder:browser:lease:*');
  // Normally we would check heartbeat, for now just log
  for (const key of browserKeys) {
    console.log(\`[ORPHAN RECOVERY] Browser lease \${key} found on startup.\`);
  }
}`;

indexContent = indexContent.replace(oldOrphan, newOrphan);

const oldConcurrency = `      // Pop a job from the queue. Blocks until a job arrives.
      if (activeBrowsers >= MAX_CONCURRENT_BROWSERS || activeTranscodes >= MAX_CONCURRENT_TRANSCODES) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }`;

const newConcurrency = `      const browserKeys = await redis.keys('recorder:browser:lease:*');
      const transcodeKeys = await redis.keys('recorder:transcode:lease:*');
      if (browserKeys.length >= MAX_CONCURRENT_BROWSERS || transcodeKeys.length >= MAX_CONCURRENT_TRANSCODES) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }`;

indexContent = indexContent.replace(oldConcurrency, newConcurrency);

// B. Browser Lease Management
const oldStartJob = `async function processRecordingJob(job) {
  activeBrowsers++;
  const { roomId, url, recordingId, botToken } = job;`;

const newStartJob = `async function processRecordingJob(job) {
  const { roomId, url, recordingId, botToken } = job;
  console.log(JSON.stringify({ event: "recorder_browser_slot_acquire_attempt", recordingId }));
  const browserKeys = await redis.keys('recorder:browser:lease:*');
  if (browserKeys.length >= MAX_CONCURRENT_BROWSERS) {
     console.log(JSON.stringify({ event: "recorder_browser_slot_acquire_denied", recordingId }));
     // Requeue job
     await redis.lpush('recorder:queue', JSON.stringify(job));
     return;
  }
  await redis.set(\`recorder:browser:lease:\${recordingId}\`, Date.now(), 'EX', 4 * 60 * 60);
  console.log(JSON.stringify({ event: "recorder_browser_slot_acquired", recordingId }));
  
  const manifestData = {
     recordingId, roomId, startedAt: Date.now(), endedAt: null, chunks: [],
     totalChunks: 0, totalBytes: 0, emptyChunkCount: 0, sequenceGapDetected: false,
     validationStatus: 'pending', failureReason: null
  };
`;

indexContent = indexContent.replace(oldStartJob, newStartJob);

// Cleanup browser lease
indexContent = indexContent.replace(/activeBrowsers--;/g, `await redis.del(\`recorder:browser:lease:\${recordingId}\`);
    console.log(JSON.stringify({ event: "recorder_browser_slot_released", recordingId }));`);

// C. Readiness Propagation
const oldWait = `    try {
      await page.waitForFunction(
        () => (window).__KONN3CT_RECORDER_READY__?.joined === true,
        { timeout: 60000 }
      );
    } catch (e) {
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        event: "recording_failed",
        roomId: roomId,
        recordingId: recordingId || 'unknown',
        stage: "readiness_timeout",
        reason: "RECORDER_JOIN_TIMEOUT"
      }));
      if (botToken) {
        await notifyBackendWithRetry(backendUrl, \`/api/recordings/\${recordingId}/callback/finalized\`, recordingId, null, botToken, 'failed', { status: 'failed' });
      }
      throw new Error("Timeout waiting for readiness marker");
    }`;

const newWait = `    try {
      await page.waitForFunction(
        () => {
           const state = (window).__KONN3CT_RECORDER_READY__;
           return state?.joined === true || state?.failed === true;
        },
        { timeout: 60000 }
      );
      const readyState = await page.evaluate(() => (window).__KONN3CT_RECORDER_READY__);
      if (readyState?.failed) {
         throw new Error(readyState.reason || 'ready_failed');
      }
    } catch (e) {
      const failureReason = e.message || 'ready_timeout';
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        event: "recording_failed",
        roomId: roomId,
        recordingId: recordingId || 'unknown',
        stage: "readiness_timeout",
        reason: failureReason
      }));
      if (botToken) {
        await notifyBackendWithRetry(backendUrl, \`/api/recordings/\${recordingId}/callback/finalized\`, recordingId, null, botToken, 'failed', { status: 'failed', failureReason });
      }
      throw new Error(\`Failed readiness gate: \${failureReason}\`);
    }`;

indexContent = indexContent.replace(oldWait, newWait);

// D. Chunk Tracking
const oldChunkRcv = `        req.on('end', () => {
          const timestamp = Date.now();
          console.log(JSON.stringify({
            timestamp: new Date(timestamp).toISOString(),
            event: "recorder_chunk_received",
            recordingId: recordingId,
            chunkIndex,
            sizeBytes: chunkSize
          }));
          
          if (chunkSize === 0) {
            console.log(JSON.stringify({
              timestamp: new Date(timestamp).toISOString(),
              event: "recorder_chunk_empty",
              recordingId: recordingId,
              chunkIndex
            }));
          }`;

const newChunkRcv = `        req.on('end', () => {
          const timestamp = Date.now();
          manifestData.chunks.push({ chunkIndex, sizeBytes: chunkSize, receivedAt: timestamp, chunkStart });
          manifestData.totalChunks++;
          manifestData.totalBytes += chunkSize;
          
          console.log(JSON.stringify({
            timestamp: new Date(timestamp).toISOString(),
            event: "recorder_chunk_received",
            recordingId: recordingId,
            chunkIndex,
            sizeBytes: chunkSize
          }));
          
          if (chunkSize === 0) {
            manifestData.emptyChunkCount++;
            console.log(JSON.stringify({
              timestamp: new Date(timestamp).toISOString(),
              event: "recorder_chunk_empty",
              recordingId: recordingId,
              chunkIndex
            }));
          }`;

indexContent = indexContent.replace(oldChunkRcv, newChunkRcv);

// E. Transcoder Lease & Manifest Persistence
const oldTranscode = `              // Spawn background transcoder
              const { spawn } = require('child_process');
              const transcoderPath = path.join(__dirname, 'transcoder.js');
              
              const out = fs.openSync(path.join(__dirname, \`\${recordingId}_transcode_stdout.log\`), 'a');
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
              });`;

const newTranscode = `              // Finalize Manifest
              manifestData.endedAt = Date.now();
              manifestData.chunks.sort((a,b) => a.chunkIndex - b.chunkIndex);
              for (let i = 1; i < manifestData.chunks.length; i++) {
                if (manifestData.chunks[i].chunkIndex !== manifestData.chunks[i-1].chunkIndex + 1) {
                  manifestData.sequenceGapDetected = true;
                }
              }
              
              if (manifestData.totalBytes < 1000) {
                manifestData.validationStatus = 'failed';
                manifestData.failureReason = 'total_bytes_too_low';
              } else if (manifestData.emptyChunkCount > manifestData.totalChunks / 2) {
                manifestData.validationStatus = 'failed';
                manifestData.failureReason = 'too_many_empty_chunks';
              } else if (manifestData.sequenceGapDetected) {
                manifestData.validationStatus = 'failed';
                manifestData.failureReason = 'sequence_gap';
              } else {
                manifestData.validationStatus = 'valid';
              }
              
              fs.writeFileSync(path.join(__dirname, \`\${recordingId}_manifest.json\`), JSON.stringify(manifestData, null, 2));
              
              if (manifestData.validationStatus === 'failed') {
                 throw new Error(\`Manifest validation failed: \${manifestData.failureReason}\`);
              }

              // Spawn background transcoder
              const { spawn } = require('child_process');
              const transcoderPath = path.join(__dirname, 'transcoder.js');
              
              const out = fs.openSync(path.join(__dirname, \`\${recordingId}_transcode_stdout.log\`), 'a');
              const err = fs.openSync(path.join(__dirname, \`\${recordingId}_transcode_stderr.log\`), 'a');
              
              const child = spawn('node', [transcoderPath, roomId, recordingId, botToken, outputPathRaw], {
                detached: true,
                stdio: ['ignore', out, err]
              });
              
              const pid = child.pid;
              await redis.set(\`recorder:transcode:lease:\${recordingId}\`, Date.now(), 'EX', 1 * 60 * 60);
              await redis.set(\`recorder:transcode:lease:\${recordingId}:pid\`, pid, 'EX', 1 * 60 * 60);
              console.log(JSON.stringify({ event: "recorder_transcode_slot_acquired", recordingId }));
              `;

indexContent = indexContent.replace(oldTranscode, newTranscode);

// Write manifest on failure too
const oldCatch = `  } catch (err) {
    console.error('Error in processRecordingJob:', err);
    if (browser) await browser.close();`;

const newCatch = `  } catch (err) {
    console.error('Error in processRecordingJob:', err);
    if (typeof manifestData !== 'undefined' && manifestData) {
       manifestData.endedAt = Date.now();
       manifestData.validationStatus = 'failed';
       manifestData.failureReason = err.message || err.toString();
       fs.writeFileSync(path.join(__dirname, \`\${recordingId}_manifest.json\`), JSON.stringify(manifestData, null, 2));
    }
    if (browser) await browser.close();`;

indexContent = indexContent.replace(oldCatch, newCatch);

fs.writeFileSync(indexFile, indexContent, 'utf8');
console.log("Updated recorder/index.js");

// 3. Patch transcoder.js to release lease
const tcFile = 'c:/conn3ct_meeting/recorder/transcoder.js';
let tcContent = fs.readFileSync(tcFile, 'utf8');

const oldExitSuccess = `    // Cleanup
    fs.unlinkSync(outputPathRaw);
    fs.unlinkSync(outputPathMp4);
    
    process.exit(0);`;
    
const newExitSuccess = `    // Cleanup
    fs.unlinkSync(outputPathRaw);
    fs.unlinkSync(outputPathMp4);
    
    const Redis = require('ioredis');
    const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
    await redis.del(\`recorder:transcode:lease:\${recordingId}\`);
    await redis.del(\`recorder:transcode:lease:\${recordingId}:pid\`);
    console.log(JSON.stringify({ event: "recorder_transcode_slot_released", recordingId }));
    await redis.quit();
    
    process.exit(0);`;
    
tcContent = tcContent.replace(oldExitSuccess, newExitSuccess);

const oldExitFail = `      );
    } catch (e) {}
    process.exit(1);`;
    
const newExitFail = `      );
    } catch (e) {}
    
    try {
      const Redis = require('ioredis');
      const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
      await redis.del(\`recorder:transcode:lease:\${recordingId}\`);
      await redis.del(\`recorder:transcode:lease:\${recordingId}:pid\`);
      console.log(JSON.stringify({ event: "recorder_transcode_slot_released", recordingId }));
      await redis.quit();
    } catch(e) {}
    
    process.exit(1);`;

tcContent = tcContent.replace(oldExitFail, newExitFail);

fs.writeFileSync(tcFile, tcContent, 'utf8');
console.log("Updated transcoder.js");

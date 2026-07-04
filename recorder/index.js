const { launch, getStream } = require('puppeteer-stream');
const fs = require('fs');
const path = require('path');
const Redis = require('ioredis');
const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const ffmpeg = require('fluent-ffmpeg');
const http = require('http');

require('dotenv').config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl, { retryStrategy: (times) => Math.min(times * 50, 2000) });
const pubsub = new Redis(redisUrl, { retryStrategy: (times) => Math.min(times * 50, 2000) });

const MAX_CONCURRENT_BROWSERS = process.env.MAX_CONCURRENT_BROWSERS ? parseInt(process.env.MAX_CONCURRENT_BROWSERS) : 2;
const MAX_CONCURRENT_TRANSCODES = process.env.MAX_CONCURRENT_TRANSCODES ? parseInt(process.env.MAX_CONCURRENT_TRANSCODES) : 4;

let activeBrowsers = 0;
let activeTranscodes = 0;

const recordingManifests = new Map();

async function recoverOrphanTranscoders() {
  const activeKeys = await redis.keys('recorder:transcode:lease:*');
  for (const key of activeKeys) {
    const pid = await redis.get(key + ':pid');
    if (pid) {
      try {
        process.kill(parseInt(pid), 0);
      } catch(e) {
        console.log(`[ORPHAN RECOVERY] Transcoder ${pid} for ${key} is dead. Cleaning up lease.`);
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
    console.log(`[ORPHAN RECOVERY] Browser lease ${key} found on startup.`);
  }
}


redis.on("error", () => {}); // Suppress harmless reconnection errors
pubsub.on("error", () => {});

// Configure DO Spaces (S3 compatible)
const rawEndpoint = process.env.DO_SPACES_ENDPOINT || 'sfo3.digitaloceanspaces.com';
const endpoint = rawEndpoint.startsWith('http') ? rawEndpoint : `https://${rawEndpoint}`;

const s3Client = new S3Client({
  endpoint,
  region: process.env.DO_SPACES_REGION || 'sfo3',
  forcePathStyle: false, // DigitalOcean Spaces usually supports virtual-hosted style, but we let SDK handle it cleanly now
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY || '',
    secretAccessKey: process.env.DO_SPACES_SECRET || '',
  },
});

const BUCKET_NAME = process.env.DO_SPACES_BUCKET || 'konn3ct-assets';

// 5. Add startup validation
if (process.env.KUBERNETES_SERVICE_HOST) {
  const backend = process.env.BACKEND_URL || '';
  if (!backend || backend.includes('localhost') || backend.includes('127.0.0.1')) {
    console.error('[FATAL] BACKEND_URL must be set to internal service DNS when running in Kubernetes, e.g. http://conn3ct-backend-service:80');
    process.exit(1);
  }
}

async function notifyBackendWithRetry(backendUrl, endpoint, recordingId, jobId, botToken, stage, payload = null) {
  let retries = 3;
  let success = false;
  const url = `${backendUrl}${endpoint}`;
  
  while (retries > 0 && !success) {
    try {
      console.log(JSON.stringify({
        event: "recording_worker_connection_attempt",
        recordingId,
        jobId: jobId || "unknown",
        targetService: "backend-api",
        targetUrlMasked: url,
        stage
      }));
      
      const options = {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${botToken}` }
      };
      if (payload) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(payload);
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      options.signal = controller.signal;
      
      const response = await fetch(url, options);
      clearTimeout(timeoutId);
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      success = true;
    } catch (err) {
      let errorCode = "ECONNREFUSED";
      if (err.message && err.message.startsWith("HTTP ")) errorCode = err.message;
      else if (err.cause && err.cause.code) errorCode = err.cause.code;
      else if (err.code) errorCode = err.code;

      let host = "unknown", port = "unknown";
      try {
        const parsed = new URL(url);
        host = parsed.hostname;
        port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
      } catch (e) {}

      console.log(JSON.stringify({
        event: "recording_worker_connection_failed",
        errorCode,
        targetService: "backend-api",
        targetHost: host,
        targetPort: port,
        stage,
        retryable: retries > 1
      }));
      
      retries--;
      if (retries > 0) {
        await new Promise(r => setTimeout(r, 2000));
      } else {
        throw new Error(`Recording backend notification failed for stage: ${stage}`);
      }
    }
  }
}

async function startWorker() {
  await recoverOrphanTranscoders();
  console.log('Recorder Worker started, waiting for jobs...');
  
  while (true) {
    try {
      const browserKeys = await redis.keys('recorder:browser:lease:*');
      const transcodeKeys = await redis.keys('recorder:transcode:lease:*');
      if (browserKeys.length >= MAX_CONCURRENT_BROWSERS || transcodeKeys.length >= MAX_CONCURRENT_TRANSCODES) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      
      const result = await redis.brpop('recorder:queue', 0);
      if (!result) continue;
      
      const [queueName, jobStr] = result;
      const job = JSON.parse(jobStr);
      
      if (!job.recordingId || job.recordingId === 'unknown') {
        console.error(JSON.stringify({
          timestamp: new Date().toISOString(),
          event: "invalid_recording_job_payload",
          roomId: job.roomId,
          reason: "missing_recordingId"
        }));
        continue;
      }

      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        event: "recording_job_received",
        roomId: job.roomId,
        recordingId: job.recordingId,
        stage: "received_job"
      }));

      await processRecordingJob(job);
    } catch (err) {
      console.error('Error processing job:', err);
      // Wait a bit before retrying to avoid tight loop on failure
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

async function processRecordingJob(job) {
  activeBrowsers++;

  const { roomId, url, recordingId, botToken } = job;
  let browser = null;
  let stream = null;
  
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
  
  const recordingsDir = process.env.RECORDINGS_DIR || path.join(__dirname, 'recordings');
  require('fs').mkdirSync(recordingsDir, { recursive: true });
  
  const outputPathRaw = path.join(recordingsDir, `${roomId}_raw.webm`);
  const outputPathMp4 = path.join(recordingsDir, `${roomId}.mp4`);
  
  if (!url.includes('/recording/')) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      event: "recorder_invalid_route_detected",
      roomId,
      recordingId,
      url
    }));
    return; // hard fail
  }

  recordingManifests.set(recordingId, {
    recordingId,
    roomId,
    startedAt: new Date().toISOString(),
    chunks: [],
    totalChunks: 0,
    totalBytes: 0,
    emptyChunkCount: 0,
    sequenceGapDetected: false,
    validationStatus: 'pending'
  });
  
  try {
    const puppeteer = require('puppeteer');
    let chromePath = '/usr/bin/google-chrome';
    try {
      chromePath = puppeteer.executablePath();
    } catch (e) {
      console.log('Puppeteer bundled Chrome not found, falling back to system Chrome.');
    }
    
    browser = await launch({
      executablePath: chromePath,
      headless: false, // Required by getDisplayMedia
      defaultViewport: null,
      ignoreDefaultArgs: ['--mute-audio', '--enable-automation'],
      args: [
        '--window-size=1920,1080',
        '--kiosk',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--autoplay-policy=no-user-gesture-required',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--auto-select-desktop-capture-source=BotRecord',
        '--auto-select-tab-capture-source-by-title=BotRecord',
        '--enable-usermedia-screen-capturing',
        '--use-fake-ui-for-media-stream',
        `--use-file-for-fake-audio-capture=${require('path').join(__dirname, 'silent.wav')}`,
        '--disable-web-security',
        '--hide-scrollbars'
      ],
    });

    const pages = await browser.pages();
    const page = pages[0];
    await page.bringToFront();

    const maskedUrl = url.replace(/botToken=[^&]*/, 'botToken=***MASKED***').replace(/botSecret=[^&]*/, 'botSecret=***MASKED***');
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      event: "recording_navigation_started",
      roomId: roomId,
      recordingId: recordingId || 'unknown',
      stage: "navigating",
      url: maskedUrl
    }));
    
    // Auto-grant permissions for capturing (display-capture is handled by CLI flags)
    const context = browser.defaultBrowserContext();
    await context.overridePermissions(new URL(url).origin, ['camera', 'microphone']);

    await page.setBypassCSP(true);
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

    page.on('response', async (response) => {
      const status = response.status();
      if (status >= 400) {
        const request = response.request();
        console.log(JSON.stringify({
          event: 'recording_page_http_error',
          recordingId,
          roomId,
          status,
          method: request.method(),
          resourceType: request.resourceType(),
          url: response.url().replace(/botToken=[^&]*/, 'botToken=***MASKED***').replace(/botSecret=[^&]*/, 'botSecret=***MASKED***'),
          stage: 'navigation_or_join'
        }));
      }
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      event: "recording_page_loaded",
      roomId: roomId,
      recordingId: recordingId || 'unknown',
      stage: "waiting_for_readiness"
    }));

    await page.setViewport({ width: 1920, height: 1080 });

    try {
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
        await notifyBackendWithRetry(backendUrl, `/api/recordings/${recordingId}/callback/status`, recordingId, null, botToken, 'failed', { status: 'failed', failureReason });
      }
      throw new Error(`Failed readiness gate: ${failureReason}`);
    }

    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      event: "recording_meeting_ready",
      roomId: roomId,
      recordingId: recordingId || 'unknown',
      stage: "meeting_ready"
    }));

    // Diagnostic screenshot
    try {
      await page.screenshot({ path: path.join(recordingsDir, `${roomId}_diagnostic.png`) });
    } catch (e) {
      console.warn("Failed to take diagnostic screenshot", e);
    }

    // Create WriteStream
    const fileStream = fs.createWriteStream(outputPathRaw);

    // Spin up an ephemeral HTTP server to receive binary video chunks directly
    // This bypasses Puppeteer's slow IPC channel which drops large base64 strings!
    const server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', '*');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.setHeader('Access-Control-Allow-Private-Network', 'true');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      if (req.method === 'POST' && req.url === '/chunk') {
        try {
          const chunkIndex = parseInt(req.headers['x-chunk-index'] || '0');
          const chunkStart = req.headers['x-chunk-start'];
          
          let chunkSize = 0;
          req.on('data', chunk => {
            chunkSize += chunk.length;
            fileStream.write(chunk);
          });
          
          req.on('end', () => {
            try {
              const manifestData = recordingManifests.get(recordingId);
              if (!manifestData) {
                console.error(JSON.stringify({
                  event: "recorder_manifest_missing",
                  recordingId
                }));
                res.writeHead(500);
                return res.end('missing_manifest');
              }
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
              }
              
              res.writeHead(200);
              res.end('ok');
            } catch (err) {
              console.error(JSON.stringify({
                event: "recorder_chunk_processing_failed",
                recordingId,
                error: err.message
              }));
              res.writeHead(500);
              res.end('chunk_error');
            }
          });
        } catch (outerErr) {
           console.error(JSON.stringify({
             event: "recorder_chunk_processing_failed",
             recordingId,
             error: outerErr.message
           }));
           res.writeHead(500);
           res.end('chunk_error');
        }
      } else {
        res.writeHead(404);
        res.end('invalid');
      }
    });

    const port = await new Promise((resolve) => {
      server.listen(3300, '127.0.0.1', () => {
        resolve(server.address().port);
      });
    });

    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      event: "recording_server_started",
      roomId: roomId,
      recordingId: recordingId || 'unknown',
      stage: "media_recorder_starting"
    }));

    // Inject recording logic directly into the browser context
    await page.evaluate((serverPort) => {
      return new Promise(async (resolve, reject) => {
        try {
          // Spoof title right before capture so auto-select-tab-capture-source-by-title finds it instantly
          document.title = 'BotRecord';
          await new Promise(r => setTimeout(r, 500));

          let stream;
          try {
            stream = await navigator.mediaDevices.getDisplayMedia({
              video: { displaySurface: "browser", width: 1920, height: 1080 },
              audio: true
            });
          } catch (err) {
            console.warn("getDisplayMedia with audio failed, falling back to video only:", err.toString());
            stream = await navigator.mediaDevices.getDisplayMedia({
              video: { displaySurface: "browser", width: 1920, height: 1080 }
            });
          }
          const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
          window.uploadQueue = Promise.resolve();
          recorder.ondataavailable = (e) => {
            const currentChunkIndex = window.chunkIndex || 0;
            window.chunkIndex = currentChunkIndex + 1;
            const chunkStart = Date.now();
            
            // Chain the uploads to guarantee sequential arrival at the server
            window.uploadQueue = window.uploadQueue.then(() => 
              fetch(`http://127.0.0.1:${serverPort}/chunk`, {
                method: 'POST',
                headers: {
                  'x-chunk-index': currentChunkIndex.toString(),
                  'x-chunk-start': chunkStart.toString()
                },
                body: e.data
              }).catch(err => console.error("Chunk upload failed", err))
            );
          };
          recorder.start(10000); // 10 seconds per chunk
          window.recorder = recorder;
          resolve();
        } catch (e) {
          reject(e.toString());
        }
      });
    }, port);

    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      event: "recording_started",
      roomId: roomId,
      recordingId: recordingId || 'unknown',
      stage: "media_recorder_started"
    }));
    
    // Notify Backend that recording has started
    try {
      await notifyBackendWithRetry(
        backendUrl, 
        `/api/recordings/${recordingId}/callback/started`,
        recordingId, job.jobId, botToken, "callback_started"
      );
    } catch (err) {
      console.error('Failed to notify backend of start after retries:', err);
      // Stop recording and throw error to mark job failed
      fileStream.end();
      server.close();
      try { await browser.close(); } catch(e){}
      throw new Error('Recording start callback failed');
    }

    // Subscribe to stop event
    return new Promise((resolve, reject) => {
      let isStopping = false;
      
      const stopHandler = async (channel, message) => {
        if (channel === `recorder:stop:${roomId}` && !isStopping) {
          isStopping = true;
          let reason = 'unknown';
          try {
            const parsed = JSON.parse(message);
            if (parsed.reason) reason = parsed.reason;
          } catch(e) {
            if (message === 'stop') reason = 'manual_stop';
          }
          
          console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            event: "recording_stop_received",
            roomId: roomId,
            recordingId: recordingId || 'unknown',
            stage: "stop_command_received",
            reason: reason
          }));
          
          pubsub.removeListener('message', stopHandler);

          try {
            // Signal the browser stream to stop and wait for final upload
            await page.evaluate(() => {
              return new Promise((resolve) => {
                if (window.recorder && window.recorder.state !== 'inactive') {
                  window.recorder.onstop = () => {
                    // Wait for the final chunk in the queue to finish uploading
                    window.uploadQueue.then(resolve);
                  };
                  window.recorder.stop();
                } else {
                  resolve();
                }
              });
            });
            
            // Wait a tiny bit extra just for the Node HTTP server to flush the file pipe
            await new Promise(r => setTimeout(r, 500));
            
            fileStream.end();
            server.close();
            
            fileStream.on('close', async () => {
              try {
                console.log(JSON.stringify({
                  timestamp: new Date().toISOString(),
                  event: "recording_file_stream_closed",
                  roomId: roomId,
                  recordingId: recordingId || 'unknown',
                  stage: "file_stream_closed"
                }));
                
                try {
                const stats = fs.statSync(outputPathRaw);
                console.log(JSON.stringify({
                  timestamp: new Date().toISOString(),
                  event: "recording_raw_file_checked",
                  roomId: roomId,
                  recordingId: recordingId || 'unknown',
                  stage: "raw_file_checked",
                  size: stats.size
                }));
                
                if (stats.size < 10) {
                  console.error('Recording file is too small (less than 10KB). The recording was likely stopped too quickly or failed to capture frames.');
                  fs.unlinkSync(outputPathRaw);
                  await browser.close();
                  return resolve();
                }
              } catch (statErr) {
                console.error('Could not stat raw file:', statErr);
                await browser.close();
                return resolve();
              }

              console.log(JSON.stringify({
                timestamp: new Date().toISOString(),
                event: "recording_conversion_started",
                roomId: roomId,
                recordingId: recordingId || 'unknown',
                stage: "conversion_started"
              }));
              await browser.close();
              await redis.del(`recorder:browser:lease:${recordingId}`);
    console.log(JSON.stringify({ event: "recorder_browser_slot_released", recordingId }));
              // Removed premature finalizing callback
              
              // Finalize Manifest
              const manifestData = recordingManifests.get(recordingId);
              if (manifestData) {
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
                
                fs.writeFileSync(path.join(recordingsDir, `${recordingId}_manifest.json`), JSON.stringify(manifestData, null, 2));
                
                if (manifestData.validationStatus === 'failed') {
                   throw new Error(`Manifest validation failed: ${manifestData.failureReason}`);
                }
              }

              // Spawn background transcoder
              const { spawn } = require('child_process');
              const transcoderPath = path.join(__dirname, 'transcoder.js');
              const stdoutPath = path.join(recordingsDir, `${recordingId}_transcode_stdout.log`);
              const stderrPath = path.join(recordingsDir, `${recordingId}_transcode_stderr.log`);
              const child = spawn('node', [transcoderPath, roomId, recordingId, botToken, outputPathRaw, stdoutPath, stderrPath], {
                detached: true,
                stdio: ['ignore', 1, 2] // Inherit container stdout/stderr so K8s captures logs
              });
              
              const pid = child.pid;
              await redis.set(`recorder:transcode:lease:${recordingId}`, Date.now(), 'EX', 1 * 60 * 60);
              await redis.set(`recorder:transcode:lease:${recordingId}:pid`, pid, 'EX', 1 * 60 * 60);
              console.log(JSON.stringify({ event: "recorder_transcode_slot_acquired", recordingId }));
              
              
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
              
              
              child.unref(); // Allow the main worker to exit/take next job independently
              
              return resolve();
            } catch (postprocessErr) {
              console.error(JSON.stringify({
                timestamp: new Date().toISOString(),
                event: "recording_postprocess_failed",
                recordingId: recordingId,
                failureReason: postprocessErr.toString()
              }));
              
              try {
                const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
                await notifyBackendWithRetry(backendUrl, `/api/recordings/${recordingId}/callback/status`, recordingId, null, botToken, 'failed', { status: 'failed', failureReason: postprocessErr.toString() });
              } catch (e) {}
              
              try { await browser.close(); } catch (e) {}
              try { await redis.del(`recorder:browser:lease:${recordingId}`); } catch (e) {}
              
              return resolve(); // Resolve instead of reject so the worker doesn't crash
            }
          });
              
          } catch (e) {
            console.error('Error during teardown:', e);
            resolve();
          }
        }
      };

      pubsub.subscribe(`recorder:stop:${roomId}`);
      pubsub.on('message', stopHandler);
      
      // Auto-stop after 4 hours max to prevent infinite zombie recordings
      setTimeout(() => {
        if (!isStopping) {
          stopHandler(`recorder:stop:${roomId}`, '');
        }
      }, 4 * 60 * 60 * 1000);
    });

  } catch (err) {
    console.error('Error in processRecordingJob:', err);
    const manifestData = recordingManifests.get(recordingId);
    if (manifestData) {
       manifestData.endedAt = Date.now();
       manifestData.validationStatus = 'failed';
       manifestData.failureReason = err.message || err.toString();
       fs.writeFileSync(path.join(recordingsDir, `${recordingId}_manifest.json`), JSON.stringify(manifestData, null, 2));
    }
    if (browser) await browser.close();
    await redis.del(`recorder:browser:lease:${recordingId}`);
    console.log(JSON.stringify({ event: "recorder_browser_slot_released", recordingId }));
    
    // Notify backend of failure
    if (job.recordingId && job.botToken) {
      try {
        const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
        await notifyBackendWithRetry(
          backendUrl, 
          `/api/recordings/${job.recordingId}/callback/status`,
          job.recordingId, job.jobId, job.botToken, "callback_failed",
          {
            status: 'failed',
            failureReason: err.toString()
          }
        );
      } catch (e) {
        console.error('Failed to notify backend of failure:', e);
      }
    }
  }
}

startWorker();

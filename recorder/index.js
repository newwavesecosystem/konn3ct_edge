const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const Redis = require('ioredis');
const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const ffmpeg = require('fluent-ffmpeg');
const http = require('http');
const { spawn, execSync } = require('child_process');

require('dotenv').config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl, { retryStrategy: (times) => Math.min(times * 50, 2000) });
const pubsub = new Redis(redisUrl, { retryStrategy: (times) => Math.min(times * 50, 2000) });

const MAX_CONCURRENT_BROWSERS = process.env.MAX_CONCURRENT_BROWSERS ? parseInt(process.env.MAX_CONCURRENT_BROWSERS) : 1;
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
const endpoint = rawEndpoint.startsWith('http') ? rawEndpoint : (rawEndpoint.includes(':') || rawEndpoint.includes('minio') ? `http://${rawEndpoint}` : `https://${rawEndpoint}`);

const s3Client = new S3Client({
  endpoint,
  region: process.env.DO_SPACES_REGION || 'sfo3',
  forcePathStyle: String(process.env.S3_FORCE_PATH_STYLE).trim().toLowerCase() === 'true', // Respect MinIO env var
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
      if (activeBrowsers >= MAX_CONCURRENT_BROWSERS) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      
      const result = await redis.brpop('recorder:queue', 2);
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

      const workerId = require('os').hostname() + '-' + process.pid;

      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        event: "recording_job_received",
        roomId: job.roomId,
        recordingId: job.recordingId,
        stage: "received_job"
      }));

      // Fire and forget with bounded concurrency
      processRecordingJob(job, workerId).catch(err => {
         console.error(`Unhandled error in processRecordingJob for ${job.recordingId}:`, err);
         redis.del(`recording:${job.recordingId}:lease`);
      });

    } catch (err) {
      console.error('Error processing job:', err);
      // Wait a bit before retrying to avoid tight loop on failure
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

let displayCounter = 99;

async function processRecordingJob(job, workerId) {
  activeBrowsers++;
  const displayId = `:${displayCounter++}`;
  
  const { roomId, url, recordingId, botToken, workerGeneration = 1, nextSegmentIndex = 0 } = job;
  const workerOwnerStr = `${workerId}:${workerGeneration}`;
  
  let browser = null;
  let xvfbProc = null;
  let ffmpegProc = null;
  
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
  const recordingsDir = process.env.RECORDINGS_DIR || require('path').join(__dirname, 'recordings');
  
  const generationId = `${recordingId}_gen${workerGeneration}`;
  const isolatedDir = require('path').join(recordingsDir, recordingId, `gen-${workerGeneration}`);
  fs.mkdirSync(isolatedDir, { recursive: true });
  
  const outputPathRawTpl = require('path').join(isolatedDir, `${roomId}_%03d.mp4`);
  
  if (!url || !url.includes('/recording/')) {
    console.error(JSON.stringify({ timestamp: new Date().toISOString(), event: "recorder_invalid_route_detected", roomId, recordingId }));
    activeBrowsers--;
    return;
  }

  recordingManifests.set(recordingId, { recordingId, roomId, startedAt: new Date().toISOString(), validationStatus: 'pending' });
  
  // ATOMIC INITIAL LEASE ACQUISITION
  const leaseAcquired = await redis.set(`recording:${recordingId}:lease`, workerOwnerStr, 'EX', 30, 'NX');
  if (!leaseAcquired) {
    console.error(`Failed to acquire lease for ${recordingId}`);
    activeBrowsers--;
    return;
  }
  
  let isFenced = false;
  const heartbeatInterval = setInterval(async () => {
    if (isFenced) return;
    try {
      const lua = `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('EXPIRE', KEYS[1], 30) else return 0 end`;
      const res = await redis.eval(lua, 1, `recording:${recordingId}:lease`, workerOwnerStr);
      if (res === 0) {
        console.warn(`[${workerOwnerStr}] FENCED! Lost lease ownership. Shutting down.`);
        isFenced = true;
        await cleanup();
      }
    } catch(e) {}
  }, 10000);

  let cleanupStarted = false;
  let emptyRoomWatchdog = null;

  const cleanup = async () => {
    if (cleanupStarted) return;
    cleanupStarted = true;
    
    if (emptyRoomWatchdog) clearInterval(emptyRoomWatchdog);
    clearInterval(heartbeatInterval);
    activeBrowsers--;
    
    if (ffmpegProc && !ffmpegProc.killed) {
      try {
        if (ffmpegProc.stdin && ffmpegProc.stdin.writable) {
           ffmpegProc.stdin.write('q\n');
           await new Promise(r => setTimeout(r, 5000));
        }
        ffmpegProc.kill('SIGTERM');
        await new Promise(r => setTimeout(r, 2000));
        ffmpegProc.kill('SIGKILL');
      } catch(e){}
    }
    if (browser) { try { await browser.close(); } catch(e){} }
    try { execSync(`pactl unload-module module-null-sink`); } catch(e){}
    if (xvfbProc) { try { xvfbProc.kill('SIGKILL'); } catch(e){} }
    
    // Check local disk for any segments that haven't been successfully unlinked by the transcoder yet
    try {
      const files = fs.readdirSync(isolatedDir).filter(f => f.endsWith('.mp4'));
      for (const file of files) {
         const filePath = require('path').join(isolatedDir, file);
         const stat = fs.statSync(filePath);
         if (stat.size > 1000) { // Don't transcode empty shells
             const transcoderPath = require('path').join(__dirname, 'transcoder.js');
             const stdoutPath = require('path').join(isolatedDir, `${file}_stdout.log`);
             const stderrPath = require('path').join(isolatedDir, `${file}_stderr.log`);
             
             const match = file.match(/_(\d+)\.mp4$/);
             const sIndex = match ? parseInt(match[1], 10) : 0;
             
             // All files processed during cleanup are treated as crash candidates if stop was not cleanly requested
             const isCrashStr = (await isStopRequested()) ? 'false' : 'true';
             const lockKey = `recording:${recordingId}:segment:${sIndex}:upload-lock`;
             const lockAcquired = await redis.set(lockKey, 'locked', 'EX', 600, 'NX');
             if (lockAcquired) {
                 console.log(JSON.stringify({ event: "recorder_cleanup_upload_queued", recordingId, segmentIndex: sIndex, file }));
                 const child = spawn('node', [transcoderPath, roomId, recordingId, botToken, filePath, stdoutPath, stderrPath, sIndex, workerGeneration, isCrashStr], {
                   detached: true, stdio: ['ignore', 'inherit', 'inherit']
                 });
                 child.unref();
             } else {
                 console.log(`[Cleanup] Segment ${sIndex} upload already in progress.`);
             }
         }
      }
    } catch(e) {}
    
    const luaDel = `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end`;
    redis.eval(luaDel, 1, `recording:${recordingId}:lease`, workerOwnerStr).catch(()=>{});
  };
  
  async function isStopRequested() {
    try {
      const val = await redis.get(`recording:${recordingId}:control`);
      return val === 'STOP_REQUESTED' || val === 'STOPPING' || val === 'STOPPED';
    } catch (e) { return false; }
  }

  try {
    console.log(JSON.stringify({ event: "recorder_job_display_allocated", recordingId, workerGeneration, displayId }));

    if (await isStopRequested()) return cleanup();

    // Strict CAS
    const casRes = await redis.eval(`
      local current = redis.call('GET', KEYS[1])
      if current == 'STARTING' or current == 'RECOVERING' or current == 'RECORDING' then
        redis.call('SET', KEYS[1], 'RECORDING', 'EX', 86400)
        return {1, 'RECORDING'}
      end
      return {0, current}
    `, 1, `recording:${recordingId}:control`);
    
    if (casRes && casRes[0] === 0) return cleanup();

    xvfbProc = spawn('Xvfb', [displayId, '-screen', '0', '1920x1080x24', '-ac', '-nolisten', 'tcp']);
    xvfbProc.stderr.on('data', d => console.error(`[XVFB_STDERR] [${displayId}]:`, d.toString()));
    xvfbProc.on('error', err => console.error(`[XVFB_ERROR] [${displayId}]:`, err));
    await new Promise(r => setTimeout(r, 1000));
    
    // Load null sink for this job using the system PulseAudio daemon
    const sinkName = `RecorderSink_${generationId}`;
    try {
      execSync(`pactl load-module module-null-sink sink_name=${sinkName} sink_properties=device.description=RecorderSink_${recordingId}`);
      execSync(`pactl set-default-sink ${sinkName}`);
    } catch(e) {
      console.warn("Failed to set pulseaudio sink", e.toString());
    }
    console.log(JSON.stringify({ event: "recorder_audio_sink_created", recordingId, sinkName }));


    const browserArgs = [
      '--window-size=1920,1080',
      '--window-position=0,0',
      '--start-maximized',
      '--kiosk',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--autoplay-policy=no-user-gesture-required',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling',
      '--use-gl=swiftshader',
      '--enable-webgl',
      '--disable-web-security',
      '--hide-scrollbars',
      `--user-data-dir=/tmp/chrome_profile_${generationId}`
    ];
    
    const silentWavPath = require('path').join(__dirname, 'silent.wav');
    if (fs.existsSync(silentWavPath)) browserArgs.push(`--use-file-for-fake-audio-capture=${silentWavPath}`);

    browser = await puppeteer.launch({
      executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome',
      headless: false, defaultViewport: null, ignoreDefaultArgs: ['--mute-audio', '--enable-automation'],
      env: { ...process.env, DISPLAY: displayId, PULSE_SINK: sinkName }, args: browserArgs
    });

    const pages = await browser.pages();
    const page = pages[0];
    page.on('console', msg => console.log(`[PAGE_LOG] [${recordingId}] ${msg.text()}`));
    page.on('pageerror', err => console.error(`[PAGE_ERROR] [${recordingId}] ${err.toString()}`));
    await page.setViewport({ width: 1920, height: 1080 });
    await browser.defaultBrowserContext().overridePermissions(new URL(url).origin, ['camera', 'microphone']);
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.bringToFront();
    await page.waitForNetworkIdle({ timeout: 60000 }).catch(() => {});
    
    // START CHOKIDAR FIRST
    const chokidar = require('chokidar');
    const watcher = chokidar.watch(isolatedDir, { ignored: /(^|[\\/\\])\../, persistent: true, ignoreInitial: true });
    
    let lastSegment = null;
    let watcherReady = false;
    watcher.on('ready', () => { watcherReady = true; });
    
    watcher.on('add', (filePath) => {
        if (filePath.endsWith('.mp4')) {
           const fileName = require('path').basename(filePath);
           
           const match = fileName.match(/_(\d+)\.mp4$/);
           if (match) {
               const sIndex = parseInt(match[1], 10);
               if (isFenced) return;
               const reserveLua = `
                 if redis.call('GET', KEYS[1]) == ARGV[1] then
                   return redis.call('SET', KEYS[2], ARGV[1], 'NX')
                 else return 0 end
               `;
               redis.eval(reserveLua, 2, `recording:${recordingId}:lease`, `recording:${recordingId}:segment:${sIndex}:owner`, workerOwnerStr).then(res => {
                 if (res === 0) {
                   console.log(`[Watcher] Failed to reserve segment ${sIndex} because lease is lost or already reserved.`);
                 }
               }).catch(()=>{});
               
           }
           
           if (lastSegment) {
               const segmentToUpload = lastSegment; // capture immediately for closure
               console.log(`[Segment Finalized] ${segmentToUpload}. Queuing for upload.`);
               const transcoderPath = require('path').join(__dirname, 'transcoder.js');
               const stdoutPath = require('path').join(isolatedDir, `${segmentToUpload}_stdout.log`);
               const stderrPath = require('path').join(isolatedDir, `${segmentToUpload}_stderr.log`);
               
               const lsMatch = segmentToUpload.match(/_(\d+)\.mp4$/);
               const lsIndex = lsMatch ? parseInt(lsMatch[1], 10) : 0;
               
               const lockKey = `recording:${recordingId}:segment:${lsIndex}:upload-lock`;
               redis.set(lockKey, 'locked', 'EX', 600, 'NX').then(lockAcquired => {
                   if (lockAcquired) {
                       const child = spawn('node', [transcoderPath, roomId, recordingId, botToken, require('path').join(isolatedDir, segmentToUpload), stdoutPath, stderrPath, lsIndex, workerGeneration, 'false'], {
                         detached: true, stdio: ['ignore', 'inherit', 'inherit']
                       });
                       child.unref();
                   }
               }).catch(()=>{});
           }
           lastSegment = fileName;
        }
    });

    // Wait until chokidar is ready
    while(!watcherReady) {
       await new Promise(r => setTimeout(r, 100));
    }
    
    const ffmpegArgs = [
      '-y', '-thread_queue_size', '1024', '-f', 'x11grab', '-draw_mouse', '0', '-video_size', '1920x1080', '-framerate', '30',
      '-i', `${displayId}.0`, '-thread_queue_size', '1024', '-f', 'pulse', '-i', `${sinkName}.monitor`,
      '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k',
      '-f', 'segment', '-segment_time', '60', '-segment_start_number', nextSegmentIndex.toString(), '-reset_timestamps', '1',
      '-segment_format', 'mp4', outputPathRawTpl
    ];
    
    console.log(JSON.stringify({ event: "recorder_ffmpeg_capture_started", recordingId, workerGeneration, nextSegmentIndex }));
    ffmpegProc = spawn('ffmpeg', ffmpegArgs, { env: { ...process.env, DISPLAY: displayId }});
    ffmpegProc.stderr.on('data', d => console.error('FFMPEG_STDERR:', d.toString()));
    
    await notifyBackendWithRetry(backendUrl, `/api/recordings/${recordingId}/callback/started`, recordingId, job.jobId, botToken, "callback_started");

    // Safety Watchdog: Auto-detect if all human participants left or meeting ended
    let emptyRoomTicks = 0;
    emptyRoomWatchdog = setInterval(async () => {
      try {
        if (!page || page.isClosed()) {
          if (emptyRoomWatchdog) clearInterval(emptyRoomWatchdog);
          return cleanup();
        }

        // 1. Check if page navigated away from /recording/
        const currentUrl = page.url();
        if (!currentUrl.includes('/recording/')) {
          console.log(JSON.stringify({ event: "recorder_page_navigated_away", recordingId, currentUrl }));
          if (emptyRoomWatchdog) clearInterval(emptyRoomWatchdog);
          return cleanup();
        }

        // 2. Check if global human participants are empty in Redis
        const participants = await redis.hgetall(`room:${roomId}:participants`);
        const participantCount = Object.keys(participants || {}).length;
        if (participantCount === 0) {
          emptyRoomTicks++;
          if (emptyRoomTicks >= 3) { // 30s of continuous empty room
            console.log(JSON.stringify({ event: "recorder_empty_room_detected", recordingId, roomId }));
            if (emptyRoomWatchdog) clearInterval(emptyRoomWatchdog);
            return cleanup();
          }
        } else {
          emptyRoomTicks = 0;
        }
      } catch (e) {}
    }, 10000);

    const stopHandler = async (channel, message) => {
      if (channel === `recorder:stop:${recordingId}`) {
         console.log(JSON.stringify({ event: "recorder_stop_signal_received", recordingId }));
         pubsub.removeListener('message', stopHandler);
         watcher.close();
         await cleanup();
      }
    };
    pubsub.on('message', stopHandler);
    pubsub.subscribe(`recorder:stop:${recordingId}`);

    ffmpegProc.on('exit', async (code) => {
       console.log(JSON.stringify({ event: "recorder_ffmpeg_exit_code", recordingId, workerGeneration, code }));
       pubsub.removeListener('message', stopHandler);
       watcher.close();
       await cleanup();
    });

    browser.on('disconnected', async () => {
       pubsub.removeListener('message', stopHandler);
       watcher.close();
       await cleanup();
    });

  } catch (err) {
    console.error('Error during recording execution:', err);
    await cleanup();
  }
}

startWorker();

const { launch, getStream } = require('puppeteer-stream');
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

let displayCounter = 99;

async function processRecordingJob(job) {
  activeBrowsers++;
  const displayId = `:${displayCounter++}`;
  
  const { roomId, url, recordingId, botToken } = job;
  let browser = null;
  let xvfbProc = null;
  let pulseProc = null;
  let ffmpegProc = null;
  
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
  const recordingsDir = process.env.RECORDINGS_DIR || path.join(__dirname, 'recordings');
  require('fs').mkdirSync(recordingsDir, { recursive: true });
  
  // We output directly to MP4 (raw), and transcoder.js will fast-copy it to the final mp4
  const outputPathRaw = path.join(recordingsDir, `${roomId}_raw.mp4`);
  
  if (!url.includes('/recording/')) {
    console.error(JSON.stringify({ timestamp: new Date().toISOString(), event: "recorder_invalid_route_detected", roomId, recordingId, url }));
    return;
  }

  recordingManifests.set(recordingId, {
    recordingId, roomId, startedAt: new Date().toISOString(), validationStatus: 'pending'
  });
  
  try {
    console.log(JSON.stringify({ event: "recorder_job_display_allocated", recordingId, displayId }));

    // 1. Start Xvfb
    xvfbProc = spawn('Xvfb', [displayId, '-screen', '0', '1920x1080x24', '-ac']);
    await new Promise(r => setTimeout(r, 1000)); // wait for Xvfb to start
    console.log(JSON.stringify({ event: "recorder_xvfb_started", recordingId, displayId }));

    // 2. Start PulseAudio
    // Usually it runs as a daemon, but we can start it per container if needed.
    // In Docker, pulseaudio --start might fail if it's already running, but we can just use pactl if running system-wide.
    // We'll spawn it or just use pactl directly if it's already running.
    try { execSync('pulseaudio --start --exit-idle-time=-1'); } catch(e) {}
    console.log(JSON.stringify({ event: "recorder_pulseaudio_started", recordingId }));

    // 3. Load null sink for this job
    const sinkName = `recorder_sink_${recordingId}`;
    try {
      execSync(`pactl load-module module-null-sink sink_name=${sinkName} sink_properties=device.description=RecorderSink_${recordingId}`);
      execSync(`pactl set-default-sink ${sinkName}`);
    } catch(e) {
      console.warn("Failed to set pulseaudio sink", e.toString());
    }
    console.log(JSON.stringify({ event: "recorder_audio_sink_created", recordingId, sinkName }));
    console.log(JSON.stringify({ event: "recorder_audio_default_sink_set", recordingId, sinkName }));
    
    // Verify monitor exists
    const sources = execSync('pactl list short sources').toString();
    if (!sources.includes(`${sinkName}.monitor`)) {
      throw new Error(`PulseAudio monitor ${sinkName}.monitor not found`);
    }
    console.log(JSON.stringify({ event: "recorder_audio_monitor_detected", recordingId, monitor: `${sinkName}.monitor` }));

    // 4. Launch Chrome with Puppeteer
    const puppeteer = require('puppeteer');
    browser = await puppeteer.launch({
      executablePath: "/usr/bin/google-chrome",
      headless: false,
      defaultViewport: null,
      ignoreDefaultArgs: ["--enable-automation"],
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-infobars",
        "--autoplay-policy=no-user-gesture-required",
        "--window-size=1920,1080",
        "--window-position=0,0",
        "--start-fullscreen",
        "--kiosk",
        `--app=${url}`,
      ],
      env: {
        ...process.env,
        DISPLAY: displayId,
        PULSE_SINK: sinkName,
      },
    });
    console.log(JSON.stringify({ event: "recorder_chrome_launched_app_mode", recordingId }));
    
    // Check innerHeight to ensure no UI toolbars
    const checkViewport = await browser.pages();
    const viewportPage = checkViewport[0];
    const innerHeight = await viewportPage.evaluate(() => window.innerHeight);
    // Use 1050 instead of 1080 to allow for tiny 1px borders in Xvfb, while still catching 30px+ banners
    if (innerHeight < 1050) {
      console.log(JSON.stringify({ event: "recorder_pre_capture_chrome_ui_detected", recordingId, innerHeight }));
      throw new Error(`Chrome UI elements detected. Viewport height is ${innerHeight}, expected near 1080.`);
    }

    const pages = await browser.pages();
    const page = pages[0];

    // Wait for route to load
    await page.waitForNetworkIdle({ timeout: 60000 }).catch(() => {});
    console.log(JSON.stringify({ event: "recorder_route_loaded", recordingId }));

    // Readiness checks
    try {
      await page.waitForFunction(
        () => {
           const state = (window).__KONN3CT_RECORDER_READY__;
           return state?.joined === true || state?.failed === true;
        },
        { timeout: 60000 }
      );
      const readyState = await page.evaluate(() => (window).__KONN3CT_RECORDER_READY__);
      if (readyState?.failed) throw new Error(readyState.reason || 'ready_failed');
    } catch (e) {
      console.log(JSON.stringify({ event: "recorder_pre_capture_route_not_ready", recordingId }));
      throw e;
    }
    console.log(JSON.stringify({ event: "recorder_joined_room", recordingId }));

    // Video/Audio render readiness
    await page.evaluate(() => {
      return new Promise(async (resolve, reject) => {
        try {
          console.log("PAGE LOG: recorder_video_elements_detected");
          await new Promise((resolveVideo) => {
            let attempt = 0;
            const checkVideo = () => {
              const videos = document.querySelectorAll('video');
              for (let i = 0; i < videos.length; i++) {
                const v = videos[i];
                if (v.readyState >= 2 && v.videoWidth > 0 && v.videoHeight > 0) {
                  if (typeof v.requestVideoFrameCallback === 'function') {
                    v.requestVideoFrameCallback(() => {
                      console.log("PAGE LOG: recorder_first_video_frame_received");
                      console.log("PAGE LOG: recorder_video_render_ready");
                      resolveVideo();
                    });
                    return;
                  } else {
                    console.log("PAGE LOG: recorder_first_video_frame_received");
                    console.log("PAGE LOG: recorder_video_render_ready");
                    resolveVideo();
                    return;
                  }
                }
              }
              attempt++;
              if (attempt > 60) return resolveVideo();
              setTimeout(checkVideo, 500);
            };
            checkVideo();
          });

          console.log("PAGE LOG: recorder_audio_context_running");
          await new Promise((resolveAudio) => {
            try {
              const AudioContext = window.AudioContext || window.webkitAudioContext;
              const ctx = new AudioContext();
              const analyser = ctx.createAnalyser();
              analyser.fftSize = 256;
              const dataArray = new Uint8Array(analyser.frequencyBinCount);
              const audios = document.querySelectorAll('audio, video');
              for (let i = 0; i < audios.length; i++) {
                try {
                  const source = ctx.createMediaElementSource(audios[i]);
                  source.connect(analyser);
                  analyser.connect(ctx.destination);
                } catch(e) {}
              }
              let attempt = 0;
              const checkAudio = () => {
                analyser.getByteFrequencyData(dataArray);
                const sum = dataArray.reduce((a, b) => a + b, 0);
                if (sum > 0) {
                  console.log("PAGE LOG: recorder_audio_level_detected", sum);
                  console.log("PAGE LOG: recorder_audio_capture_ready");
                  resolveAudio();
                  return;
                }
                attempt++;
                if (attempt > 60) return resolveAudio();
                setTimeout(checkAudio, 500);
              };
              checkAudio();
            } catch (e) {
              resolveAudio();
            }
          });
          resolve();
        } catch (e) {
          reject(e.toString());
        }
      });
    });

    // Take diagnostic screenshot
    const screenshotPath = path.join(recordingsDir, `${roomId}_diagnostic.png`);
    await page.screenshot({ path: screenshotPath });
    console.log(JSON.stringify({ event: "recorder_diagnostic_screenshot_saved", recordingId, path: screenshotPath }));

    // Use Jimp to do a proper pixel analysis
    const Jimp = require('jimp');
    const image = await Jimp.read(screenshotPath);
    let blackPixels = 0;
    const totalPixels = image.bitmap.width * image.bitmap.height;
    
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
      const r = this.bitmap.data[idx + 0];
      const g = this.bitmap.data[idx + 1];
      const b = this.bitmap.data[idx + 2];
      // luminance
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (lum < 10) blackPixels++; // near black
    });
    
    const blackPercent = (blackPixels / totalPixels) * 100;
    if (blackPercent > 95) {
      console.log(JSON.stringify({ event: "recorder_pre_capture_black_frame_detected", recordingId, blackPercent }));
      throw new Error("Diagnostic screenshot indicates mostly black frame.");
    }

    // 5. Spawn FFmpeg
    const ffmpegArgs = [
      '-y',
      '-thread_queue_size', '1024',
      '-f', 'x11grab',
      '-draw_mouse', '0',
      '-video_size', '1920x1080',
      '-framerate', '30',
      '-i', `${displayId}.0`,
      '-thread_queue_size', '1024',
      '-f', 'pulse',
      '-i', `${sinkName}.monitor`,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      outputPathRaw
    ];
    
    console.log(JSON.stringify({ event: "recorder_ffmpeg_capture_started", recordingId, args: ffmpegArgs.join(' ') }));
    ffmpegProc = spawn('ffmpeg', ffmpegArgs);
    
    // Notify Backend that recording has started
    await notifyBackendWithRetry(backendUrl, `/api/recordings/${recordingId}/callback/started`, recordingId, job.jobId, botToken, "callback_started");

    // Subscribe to stop event
    await new Promise((resolve, reject) => {
      let isStopping = false;
      const stopHandler = async (channel, message) => {
        if (channel === `recorder:stop:${roomId}` && !isStopping) {
          isStopping = true;
          pubsub.removeListener('message', stopHandler);
          
          console.log(JSON.stringify({ event: "recorder_ffmpeg_sigint_sent", recordingId }));
          ffmpegProc.kill('SIGINT');
          
          // Timeout for SIGINT
          const killTimeout = setTimeout(() => {
            console.log(JSON.stringify({ event: "recorder_ffmpeg_sigkill_sent", recordingId }));
            ffmpegProc.kill('SIGKILL');
          }, 15000);

          ffmpegProc.on('exit', async (code) => {
            clearTimeout(killTimeout);
            console.log(JSON.stringify({ event: "recorder_ffmpeg_capture_stopped", recordingId }));
            console.log(JSON.stringify({ event: "recorder_ffmpeg_exit_code", recordingId, code }));

            try {
              const fileStats = fs.statSync(outputPathRaw);
              if (fileStats.size < 10000) throw new Error("File too small");

              // Spawn background transcoder ONLY for validation & upload
              const transcoderPath = path.join(__dirname, 'transcoder.js');
              const stdoutPath = path.join(recordingsDir, `${recordingId}_transcode_stdout.log`);
              const stderrPath = path.join(recordingsDir, `${recordingId}_transcode_stderr.log`);
              const child = spawn('node', [transcoderPath, roomId, recordingId, botToken, outputPathRaw, stdoutPath, stderrPath], {
                detached: true,
                stdio: ['ignore', 1, 2]
              });
              
              await redis.set(`recorder:transcode:lease:${recordingId}`, Date.now(), 'EX', 1 * 60 * 60);
              await redis.set(`recorder:transcode:lease:${recordingId}:pid`, child.pid, 'EX', 1 * 60 * 60);
              child.unref();
              resolve();
            } catch (err) {
              reject(err);
            }
          });
        }
      };

      pubsub.subscribe(`recorder:stop:${roomId}`);
      pubsub.on('message', stopHandler);
      
      setTimeout(() => {
        if (!isStopping) stopHandler(`recorder:stop:${roomId}`, '');
      }, 4 * 60 * 60 * 1000);
    });

  } catch (err) {
    console.error('Error in processRecordingJob:', err);
    if (job.recordingId && job.botToken) {
      try {
        await notifyBackendWithRetry(backendUrl, `/api/recordings/${job.recordingId}/callback/status`, job.recordingId, job.jobId, job.botToken, "callback_failed", { status: 'failed', failureReason: err.toString() });
      } catch (e) {}
    }
  } finally {
    // CLEANUP
    if (ffmpegProc && !ffmpegProc.killed) {
      try { ffmpegProc.kill('SIGKILL'); } catch(e){}
    }
    if (browser) {
      try { await browser.close(); } catch(e){}
    }
    if (xvfbProc) {
      try { xvfbProc.kill('SIGKILL'); } catch(e){}
    }
    try {
      execSync(`pactl unload-module module-null-sink`); // Unload the specific sink might be tricky if we don't have module ID, so we unload all null sinks or just let it be destroyed with container
    } catch(e){}
    
    await redis.del(`recorder:browser:lease:${recordingId}`);
    console.log(JSON.stringify({ event: "recorder_process_cleanup_completed", recordingId }));
  }
}


startWorker();

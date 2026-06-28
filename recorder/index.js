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
      
      const response = await fetch(url, options);
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
  console.log('Recorder Worker started, waiting for jobs...');
  
  while (true) {
    try {
      // Pop a job from the queue. Blocks until a job arrives.
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
  const { roomId, url, recordingId, botToken } = job;
  let browser = null;
  let stream = null;
  
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
  
  const outputPathRaw = path.join(__dirname, `${roomId}_raw.webm`);
  const outputPathMp4 = path.join(__dirname, `${roomId}.mp4`);
  
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

    try {
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
        await notifyBackendWithRetry(backendUrl, `/api/recordings/${recordingId}/callback/finalized`, recordingId, null, botToken, 'failed', { status: 'failed' });
      }
      throw new Error("Timeout waiting for readiness marker");
    }

    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      event: "recording_meeting_ready",
      roomId: roomId,
      recordingId: recordingId || 'unknown',
      stage: "meeting_ready"
    }));

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
        req.pipe(fileStream, { end: false });
        req.on('end', () => {
          res.writeHead(200);
          res.end('ok');
        });
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
            if (e.data.size > 0) {
              // Chain the uploads to guarantee sequential arrival at the server
              window.uploadQueue = window.uploadQueue.then(() => 
                fetch(`http://127.0.0.1:${serverPort}/chunk`, {
                  method: 'POST',
                  body: e.data
                }).catch(err => console.error("Chunk upload failed", err))
              );
            }
          };
          recorder.start(1000); // 1 chunk per second
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
              
              try {
                await notifyBackendWithRetry(
                  backendUrl, 
                  `/api/recordings/${recordingId}/callback/finalized`,
                  recordingId, job.jobId, botToken, "callback_processing",
                  { status: 'processing' }
                );
              } catch (err) {
                console.error('Failed to notify backend of processing state:', err);
              }
              
              // Convert WebM to MP4 using fluent-ffmpeg
              ffmpeg(outputPathRaw)
                .outputOptions([
                  '-y', // Force overwrite to prevent hanging on prompt
                  '-preset veryfast',
                  '-c:v libx264',
                  '-c:a aac',
                  '-max_muxing_queue_size 9999',
                  '-vsync 2'
                ])
              .on('progress', (progress) => {
                console.log(`Processing: ${progress.percent}% done (Time: ${progress.timemark})`);
              })
              .save(outputPathMp4)
              .on('error', (err, stdout, stderr) => {
                console.error('FFmpeg stderr:', stderr);
                console.error('FFmpeg error:', err);
                reject(err);
              })
              .on('end', async () => {
                console.log(JSON.stringify({
                  timestamp: new Date().toISOString(),
                  event: "recording_conversion_finished",
                  roomId: roomId,
                  recordingId: recordingId || 'unknown',
                  stage: "conversion_finished"
                }));
                try {
                  const fileStreamForUpload = fs.createReadStream(outputPathMp4);
                  const uploadParams = {
                    client: s3Client,
                    params: {
                      Bucket: BUCKET_NAME,
                      Key: `recordings/${roomId}/${Date.now()}.mp4`,
                      Body: fileStreamForUpload,
                      ContentType: 'video/mp4',
                    },
                  };
                  
                  const uploader = new Upload(uploadParams);
                  const data = await uploader.done();
                  console.log(JSON.stringify({
                    timestamp: new Date().toISOString(),
                    event: "recording_upload_completed",
                    roomId: roomId,
                    recordingId: recordingId || 'unknown',
                    stage: "upload_completed",
                    location: data.Location
                  }));
                  
                  // Publish completion back to signaling server via secure callback
                  try {
                    await notifyBackendWithRetry(
                      backendUrl, 
                      `/api/recordings/${recordingId}/callback/finalized`,
                      recordingId, job.jobId, botToken, "callback_completed",
                      {
                        status: 'completed',
                        url: data.Location,
                        storageKey: uploadParams.params.Key,
                        storageBucket: uploadParams.params.Bucket,
                        contentType: uploadParams.params.ContentType,
                        duration: 0
                      }
                    );
                  } catch (err) {
                    console.error('Failed to notify backend of completion:', err);
                  }

                  // Cleanup
                  fs.unlinkSync(outputPathRaw);
                  fs.unlinkSync(outputPathMp4);
                  resolve();
                } catch (uploadErr) {
                  console.error('Upload failed:', uploadErr);
                  resolve(); // Still resolve so worker can take next job
                }
              })
              .on('error', (ffmpegErr) => {
                console.error('FFmpeg conversion error:', ffmpegErr);
                resolve();
              });
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
    if (browser) await browser.close();
    
    // Notify backend of failure
    if (job.recordingId && job.botToken) {
      try {
        const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
        await notifyBackendWithRetry(
          backendUrl, 
          `/api/recordings/${job.recordingId}/callback/finalized`,
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

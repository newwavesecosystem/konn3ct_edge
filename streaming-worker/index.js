const puppeteer = require('puppeteer');
const { Redis } = require('ioredis');
const { spawn } = require('child_process');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl, {
  retryStrategy: (times) => {
    if (process.env.NODE_ENV !== 'production') return null;
    return Math.min(times * 50, 2000);
  },
  maxRetriesPerRequest: 1,
});

redis.on('error', (e) => console.error('Streaming Bot Redis error', e));

// Function to publish status updates back to the main server
async function updateStreamStatus(streamId, status) {
  try {
    await redis.publish('streamer:status', JSON.stringify({ streamId, status }));
  } catch (e) {
    console.error(`Failed to publish status update for stream ${streamId}`, e);
  }
}

async function startStreaming({
  streamId,
  roomId,
  roomSlug,
  rtmpUrls,
  url: frontendUrl,
}) {
  if (!rtmpUrls || rtmpUrls.length === 0) {
    throw new Error(`[FATAL] No RTMP URLs provided for stream ${streamId}`);
  }

  // Generate a short-lived bot JWT so the meeting page / WS can authenticate the bot
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('[FATAL] JWT_SECRET must be set');
  const botToken = jwt.sign(
    { userId: `streamer_${streamId}`, email: 'streamer@conn3ct.internal', name: 'Live Stream', role: 'bot' },
    jwtSecret,
    { expiresIn: '4h' }
  );

  const meetingUrl = `${frontendUrl}?t=${botToken}&name=Live%20Stream&role=bot`;

  // Update DB status to 'live' via Redis
  await updateStreamStatus(streamId, 'live');

  let browser = null;
  let ffmpegProcess = null;

  try {
    let chromePath = '/usr/bin/google-chrome';
    try {
      chromePath = puppeteer.executablePath();
    } catch (e) {
      console.log('Puppeteer bundled Chrome not found, falling back to system Chrome.');
    }

    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: false, // Required by puppeteer-stream
      defaultViewport: { width: 1280, height: 720 },
      ignoreDefaultArgs: ['--mute-audio', '--enable-automation'],
      args: [
        '--window-size=1280,720',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--autoplay-policy=no-user-gesture-required',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-notifications',
        '--auto-select-tab-capture-source-by-title=BotStream',
        '--enable-usermedia-screen-capturing'
      ],
    });

    const pages = await browser.pages();
    const page = pages[0];
    await page.bringToFront();

    // Auto-grant permissions for capturing
    const context = browser.defaultBrowserContext();
    await context.overridePermissions(new URL(meetingUrl).origin, ['camera', 'microphone', 'display-capture']);

    // Set a dummy title before navigation so auto-select knows what to look for
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(document, 'title', {
        get: () => 'BotStream',
        set: () => {}
      });
    });

    await page.goto(meetingUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait for meeting to load
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Get the stream
    const { getStream } = require('puppeteer-stream');
    const stream = await getStream(page, { audio: true, video: true, frameSize: 20 });

    console.log(`Browser capture started for stream ${streamId}`);

    // Build FFmpeg command
    const teeOutputs = rtmpUrls.map(u => `[f=flv]${u}`).join('|');

    const ffmpegArgs = [
      '-y',
      '-i', '-', // Read from stdin
      // Video encoding settings
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-b:v', '3000k',
      '-maxrate', '3000k',
      '-bufsize', '6000k',
      '-pix_fmt', 'yuv420p',
      '-g', '60',
      // Audio encoding settings
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '44100',
      '-ac', '2',
      // Output
      '-f', 'tee',
      `-map`, `0:v`,
      `-map`, `0:a`,
      teeOutputs
    ];

    console.log(`Starting FFmpeg for stream ${streamId}...`);
    ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

    ffmpegProcess.on('close', (code) => {
      console.log(`FFmpeg process closed for stream ${streamId} with code ${code}`);
    });

    // Pipe the browser stream directly into FFmpeg
    stream.pipe(ffmpegProcess.stdin);

    // Wait for stop signal or crash
    await new Promise((resolve, reject) => {
      const stopSubscriber = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
      stopSubscriber.on('error', (e) => console.error('Stop subscriber error', e));
      
      stopSubscriber.subscribe(`streamer:stop:${streamId}`, (err) => {
        if (err) console.error(`Failed to subscribe to stop channel for stream ${streamId}`, err);
      });
      
      stopSubscriber.on('message', (channel) => {
        if (channel === `streamer:stop:${streamId}`) {
          console.log(`Stop signal received for stream ${streamId}`);
          stopSubscriber.disconnect();
          resolve();
        }
      });

      ffmpegProcess.on('error', (err) => {
        reject(new Error(`FFmpeg crashed: ${err.message}`));
      });

      // Auto-stop after 8 hours to prevent zombie streams
      setTimeout(() => {
        console.log(`Auto-stopping stream ${streamId} after 8 hours`);
        stopSubscriber.disconnect();
        resolve();
      }, 8 * 60 * 60 * 1000);
    });

    // Cleanup stream
    stream.destroy();
    
    // Update DB via Redis
    await updateStreamStatus(streamId, 'stopped');

  } catch (error) {
    console.error(`Streaming failed for ${streamId}:`, error);
    await updateStreamStatus(streamId, 'failed');
  } finally {
    if (ffmpegProcess && !ffmpegProcess.killed) {
      try {
        ffmpegProcess.stdin.end();
        ffmpegProcess.kill('SIGINT');
      } catch (e) {
        console.warn('Failed to kill ffmpeg process', e);
      }
    }
    if (browser) {
      await browser.close().catch(e => console.warn('Failed to close browser', e));
    }
  }
}

async function runWorker() {
  console.log('Streaming worker started, listening on streamer:queue');
  while (true) {
    try {
      const result = await redis.brpop('streamer:queue', 0);
      if (!result) continue;
      const job = JSON.parse(result[1]);
      console.log(`Processing streaming job for room ${job.roomSlug}`);
      // Fire and forget (allows multiple concurrent streams on powerful instances)
      startStreaming(job).catch(e => console.error('Stream crashed abruptly:', e));
    } catch (e) {
      console.error('Streaming worker loop error:', e);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

runWorker().catch((e) => {
  console.error('Streaming worker crashed permanently:', e);
  process.exit(1);
});

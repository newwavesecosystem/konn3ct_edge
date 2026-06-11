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

async function startWorker() {
  console.log('Recorder Worker started, waiting for jobs...');
  
  while (true) {
    try {
      // Pop a job from the queue. Blocks until a job arrives.
      const result = await redis.brpop('recorder:queue', 0);
      if (!result) continue;
      
      const [queueName, jobStr] = result;
      const job = JSON.parse(jobStr);
      console.log(`Processing recording job for room: ${job.roomId}`);

      await processRecordingJob(job);
    } catch (err) {
      console.error('Error processing job:', err);
      // Wait a bit before retrying to avoid tight loop on failure
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

async function processRecordingJob(job) {
  const { roomId, url, recordingId } = job;
  let browser = null;
  let stream = null;
  
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
      defaultViewport: { width: 1920, height: 1080 },
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
        '--disable-web-security',
        '--hide-scrollbars'
      ],
    });

    const pages = await browser.pages();
    const page = pages[0];
    await page.bringToFront();

    // Navigate to the meeting URL with bot flag
    console.log(`Navigating to ${url}`);
    
    // Auto-grant permissions for capturing (display-capture is handled by CLI flags)
    const context = browser.defaultBrowserContext();
    await context.overridePermissions(new URL(url).origin, ['camera', 'microphone']);

    await page.setBypassCSP(true);
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait a bit for React to render and WebRTC to connect
    await new Promise(resolve => setTimeout(resolve, 5000));

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
      server.listen(0, '127.0.0.1', () => {
        resolve(server.address().port);
      });
    });

    console.log(`Ephemeral HTTP server listening on port ${port} for chunks...`);
    console.log('Starting native MediaRecorder...');

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

    console.log(`Recording started for ${roomId}`);

    // Subscribe to stop event
    return new Promise((resolve, reject) => {
      let isStopping = false;
      
      const stopHandler = async (channel, message) => {
        if (channel === `recorder:stop:${roomId}` && !isStopping) {
          isStopping = true;
          console.log(`Received stop command for ${roomId}`);
          
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
              console.log('File stream closed. Checking raw file size...');
              
              try {
                const stats = fs.statSync(outputPathRaw);
                console.log(`Raw WebM size: ${stats.size} bytes`);
                
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

              console.log('Closing browser and converting to MP4...');
              await browser.close();
              
              // Convert WebM to MP4 using fluent-ffmpeg
              ffmpeg(outputPathRaw)
                .outputOptions([
                  '-preset veryfast',
                  '-threads 1',
                  '-c:v libx264',
                  '-c:a aac',
                  '-max_muxing_queue_size 9999'
                ])
              .save(outputPathMp4)
              .on('error', (err, stdout, stderr) => {
                console.error('FFmpeg stderr:', stderr);
                console.error('FFmpeg error:', err);
                reject(err);
              })
              .on('end', async () => {
                console.log('Conversion finished. Uploading to Spaces...');
                try {
                  const fileStreamForUpload = fs.createReadStream(outputPathMp4);
                  const uploadParams = {
                    client: s3Client,
                    params: {
                      Bucket: BUCKET_NAME,
                      Key: `recordings/${roomId}/${Date.now()}.mp4`,
                      Body: fileStreamForUpload,
                      ACL: 'public-read',
                      ContentType: 'video/mp4',
                    },
                  };
                  
                  const uploader = new Upload(uploadParams);
                  const data = await uploader.done();
                  console.log(`Upload successful: ${data.Location}`);
                  
                  // Publish completion back to signaling server so it can update DB
                  await redis.publish('recorder:completed', JSON.stringify({
                    roomId,
                    recordingId,
                    recordingUrl: data.Location
                  }));

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
  }
}

startWorker();

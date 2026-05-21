const { launch, getStream } = require('puppeteer-stream');
const fs = require('fs');
const path = require('path');
const Redis = require('ioredis');
const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const ffmpeg = require('fluent-ffmpeg');

require('dotenv').config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl, { retryStrategy: (times) => Math.min(times * 50, 2000) });
const pubsub = new Redis(redisUrl, { retryStrategy: (times) => Math.min(times * 50, 2000) });

redis.on("error", () => {}); // Suppress harmless reconnection errors
pubsub.on("error", () => {});

// Configure DO Spaces (S3 compatible)
const s3Client = new S3Client({
  endpoint: `https://${process.env.DO_SPACES_ENDPOINT || 'sfo3.digitaloceanspaces.com'}`,
  region: process.env.DO_SPACES_REGION || 'sfo3',
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
  const { roomId, url } = job;
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
      headless: false, // Required by puppeteer-stream and extension APIs
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
        '--auto-select-tab-capture-source-by-title=BotRecord',
        '--enable-usermedia-screen-capturing'
      ],
    });

    const pages = await browser.pages();
    const page = pages[0];
    await page.bringToFront();

    // Navigate to the meeting URL with bot flag
    console.log(`Navigating to ${url}`);
    
    // Auto-grant permissions for capturing
    const context = browser.defaultBrowserContext();
    await context.overridePermissions(new URL(url).origin, ['camera', 'microphone', 'display-capture']);

    // Set a dummy title before navigation so auto-select knows what to look for
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(document, 'title', {
        get: () => 'BotRecord',
        set: () => {}
      });
    });
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait a bit for React to render and WebRTC to connect
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Create WriteStream
    const fileStream = fs.createWriteStream(outputPathRaw);

    // Get the stream from the page
    console.log('Starting native MediaRecorder...');

    // Expose a function to write chunks from browser to the Node.js file stream
    await page.exposeFunction('writeChunk', (chunkStr) => {
      const buffer = Buffer.from(chunkStr, 'base64');
      fileStream.write(buffer);
    });

    // Inject recording logic directly into the browser context
    await page.evaluate(() => {
      return new Promise(async (resolve, reject) => {
        try {
          const stream = await navigator.mediaDevices.getDisplayMedia({
            video: { displaySurface: "browser" },
            audio: true
          });
          const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
          recorder.ondataavailable = async (e) => {
            if (e.data.size > 0) {
              const reader = new FileReader();
              reader.onloadend = async () => {
                const base64 = reader.result.split(',')[1];
                await window.writeChunk(base64);
              };
              reader.readAsDataURL(e.data);
            }
          };
          recorder.start(1000); // 1 chunk per second
          window.recorder = recorder;
          resolve();
        } catch (e) {
          reject(e.toString());
        }
      });
    });

    console.log(`Recording started for ${roomId}`);

    // Subscribe to stop event
    return new Promise((resolve, reject) => {
      let isStopping = false;
      
      const stopHandler = async (channel, message) => {
        if (channel === `recorder:stop:${roomId}` && !isStopping) {
          isStopping = true;
          console.log(`Received stop command for ${roomId}`);
          
          pubsub.unsubscribe(`recorder:stop:${roomId}`);
          pubsub.removeListener('message', stopHandler);

          try {
            // Signal the browser stream to stop
            await page.evaluate(() => {
              if (window.recorder) {
                window.recorder.stop();
              }
            });

            // Allow chunks to finish writing
            await new Promise(r => setTimeout(r, 1500));
            
            fileStream.end();
            
            fileStream.on('close', async () => {
              console.log('File stream closed. Checking raw file size...');
              
              try {
                const stats = fs.statSync(outputPathRaw);
                console.log(`Raw WebM size: ${stats.size} bytes`);
                
                if (stats.size < 10000) {
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
                  '-c:v libx264',
                  '-c:a aac'
                ])
              .save(outputPathMp4)
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

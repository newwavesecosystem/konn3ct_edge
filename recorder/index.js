const { launch, getStream } = require('puppeteer-stream');
const fs = require('fs');
const path = require('path');
const Redis = require('ioredis');
const AWS = require('aws-sdk');
const ffmpeg = require('fluent-ffmpeg');

require('dotenv').config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl, { retryStrategy: (times) => Math.min(times * 50, 2000) });
const pubsub = new Redis(redisUrl, { retryStrategy: (times) => Math.min(times * 50, 2000) });

redis.on("error", () => {}); // Suppress harmless reconnection errors
pubsub.on("error", () => {});

// Configure DO Spaces (S3 compatible)
const s3 = new AWS.S3({
  endpoint: new AWS.Endpoint(process.env.DO_SPACES_ENDPOINT || 'sfo3.digitaloceanspaces.com'),
  region: process.env.DO_SPACES_REGION || 'sfo3',
  credentials: new AWS.Credentials({
    accessKeyId: process.env.DO_SPACES_KEY || '',
    secretAccessKey: process.env.DO_SPACES_SECRET || '',
  }),
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
    browser = await launch({
      headless: false, // Required by puppeteer-stream and extension APIs
      defaultViewport: {
        width: 1280,
        height: 720,
      },
      args: [
        '--window-size=1280,720',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--autoplay-policy=no-user-gesture-required',
        '--disable-dev-shm-usage',
      ],
    });

    const pages = await browser.pages();
    const page = pages[0];

    // Navigate to the meeting URL with bot flag
    console.log(`Navigating to ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait a bit for React to render and WebRTC to connect
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Create WriteStream
    const fileStream = fs.createWriteStream(outputPathRaw);

    // Get the stream from the page
    console.log('Starting puppeteer-stream...');
    stream = await getStream(page, { audio: true, video: true, frameSize: 1000 });
    stream.pipe(fileStream);

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
            // Signal the stream to stop
            stream.destroy();
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
                  const fileContent = fs.readFileSync(outputPathMp4);
                  const uploadParams = {
                    Bucket: BUCKET_NAME,
                    Key: `recordings/${roomId}/${Date.now()}.mp4`,
                    Body: fileContent,
                    ACL: 'public-read',
                    ContentType: 'video/mp4',
                  };
                  
                  const data = await s3.upload(uploadParams).promise();
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

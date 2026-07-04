const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');

require('dotenv').config();

const rawEndpoint = process.env.DO_SPACES_ENDPOINT || 'sfo3.digitaloceanspaces.com';
const endpoint = rawEndpoint.startsWith('http') ? rawEndpoint : `https://${rawEndpoint}`;

const s3Client = new S3Client({
  endpoint,
  region: process.env.DO_SPACES_REGION || 'sfo3',
  forcePathStyle: false,
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY || '',
    secretAccessKey: process.env.DO_SPACES_SECRET || '',
  },
});

const BUCKET_NAME = process.env.DO_SPACES_BUCKET || 'konn3ct-assets';

async function notifyBackendWithRetry(backendUrl, endpoint, recordingId, botToken, payload) {
  let retries = 3;
  let success = false;
  const url = `${backendUrl}${endpoint}`;
  
  while (retries > 0 && !success) {
    try {
      const options = {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${botToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      };
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      success = true;
    } catch (err) {
      retries--;
      if (retries > 0) await new Promise(r => setTimeout(r, 2000));
      else throw err;
    }
  }
}

async function run() {
  const args = process.argv.slice(2);
  const roomId = args[0];
  const recordingId = args[1];
  const botToken = args[2];
  const outputPathRaw = args[3];

  if (!roomId || !recordingId || !botToken || !outputPathRaw) {
    console.error("Missing arguments");
    process.exit(1);
  }

  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
  const outputPathMp4 = path.join(path.dirname(outputPathRaw), `${roomId}.mp4`);

  try {
    // Notify transcoding
    await notifyBackendWithRetry(
      backendUrl, 
      `/api/recordings/${recordingId}/callback/finalized`,
      recordingId, botToken,
      { status: 'transcoding' }
    );
    console.log(`[${recordingId}] ffmpeg_transcode_started`);

    await new Promise((resolve, reject) => {
      ffmpeg(outputPathRaw)
        .outputOptions([
          '-y',
          '-preset veryfast',
          '-c:v libx264',
          '-c:a aac',
          '-max_muxing_queue_size 9999',
          '-vsync 2'
        ])
        .on('progress', (progress) => {
          console.log(`[${recordingId}] ffmpeg_progress: ${progress.percent}% done`);
        })
        .save(outputPathMp4)
        .on('error', (err, stdout, stderr) => {
          console.error(`[${recordingId}] ffmpeg_transcode_failed`, err);
          reject(err);
        })
        .on('end', () => {
          console.log(`[${recordingId}] ffmpeg_transcode_completed`);
          resolve();
        });
    });

    // Notify uploading
    await notifyBackendWithRetry(
      backendUrl, 
      `/api/recordings/${recordingId}/callback/finalized`,
      recordingId, botToken,
      { status: 'uploading' }
    );
    console.log(`[${recordingId}] spaces_upload_started`);

    const fileStreamForUpload = fs.createReadStream(outputPathMp4);
    const uploadParams = {
      client: s3Client,
      params: {
        Bucket: BUCKET_NAME,
        Key: `recordings/${roomId}/${Date.now()}.mp4`,
        Body: fileStreamForUpload,
        ContentType: 'video/mp4',
      },
      queueSize: 4, // Concurrent parts
      partSize: 5 * 1024 * 1024 // 5 MB part size
    };
    
    const uploader = new Upload(uploadParams);
    
    uploader.on("httpUploadProgress", (progress) => {
      console.log(`[${recordingId}] spaces_upload_progress: ${progress.loaded} / ${progress.total}`);
    });

    const data = await uploader.done();
    console.log(`[${recordingId}] spaces_upload_completed`);

    // Notify completed
    await notifyBackendWithRetry(
      backendUrl, 
      `/api/recordings/${recordingId}/callback/finalized`,
      recordingId, botToken,
      {
        status: 'completed',
        url: data.Location,
        storageKey: uploadParams.params.Key,
        storageBucket: uploadParams.params.Bucket,
        contentType: uploadParams.params.ContentType,
        duration: 0
      }
    );

    // Cleanup
    fs.unlinkSync(outputPathRaw);
    fs.unlinkSync(outputPathMp4);
    
    const Redis = require('ioredis');
    const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
    await redis.del(`recorder:transcode:lease:${recordingId}`);
    await redis.del(`recorder:transcode:lease:${recordingId}:pid`);
    console.log(JSON.stringify({ event: "recorder_transcode_slot_released", recordingId }));
    await redis.quit();
    
    process.exit(0);
  } catch (err) {
    console.error(`[${recordingId}] spaces_upload_failed or transcode_failed`, err);
    try {
      await notifyBackendWithRetry(
        backendUrl, 
        `/api/recordings/${recordingId}/callback/finalized`,
        recordingId, botToken,
        {
          status: 'failed',
          failureReason: err.toString()
        }
      );
    } catch (e) {}
    
    try {
      const Redis = require('ioredis');
      const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
      await redis.del(`recorder:transcode:lease:${recordingId}`);
      await redis.del(`recorder:transcode:lease:${recordingId}:pid`);
      console.log(JSON.stringify({ event: "recorder_transcode_slot_released", recordingId }));
      await redis.quit();
    } catch(e) {}
    
    process.exit(1);
  }
}

run();

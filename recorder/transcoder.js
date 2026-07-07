const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { exec } = require('child_process');
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

async function checkFfprobe(filePath, recordingId) {
  return new Promise((resolve, reject) => {
    exec(`ffprobe -hide_banner -show_streams -show_format -of json "${filePath}"`, (err, stdout, stderr) => {
      if (err) {
        console.error(`[${recordingId}] ffprobe failed:`, err);
        return reject(err);
      }
      try {
        const data = JSON.parse(stdout);
        console.log(`[${recordingId}] ffprobe_raw_result: ${JSON.stringify(data)}`);
        const streams = data.streams || [];
        const hasVideo = streams.some(s => s.codec_type === 'video');
        const hasAudio = streams.some(s => s.codec_type === 'audio');
        if (hasVideo) console.log(`[${recordingId}] recording_video_stream_detected`);
        if (hasAudio) console.log(`[${recordingId}] recording_audio_stream_detected`);
        if (!hasVideo && !hasAudio) {
          throw new Error("No video or audio stream detected in file");
        }
        resolve(data);
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function validateMp4(filePath, recordingId) {
  return new Promise((resolve, reject) => {
    // Run blackdetect and silencedetect on the mp4
    console.log(`[${recordingId}] starting deep mp4 validation...`);
    exec(`ffmpeg -v info -i "${filePath}" -vf "blackdetect=d=2:pix_th=0.10" -af "silencedetect=noise=-50dB:d=2" -f null - 2>&1`, (err, stdout, stderr) => {
      const output = stderr.toString();
      
      const blackDetected = output.includes('blackdetect');
      const silenceDetected = output.includes('silence_start');
      const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
      let durationSec = 0;
      if (durationMatch) {
        durationSec = parseInt(durationMatch[1]) * 3600 + parseInt(durationMatch[2]) * 60 + parseFloat(durationMatch[3]);
        console.log(`[${recordingId}] recording_duration_verified: ${durationSec}s`);
      }
      
      const resMatch = output.match(/Video: .*, (\d{3,4}x\d{3,4})/);
      if (resMatch) {
        console.log(`[${recordingId}] recording_video_resolution_verified: ${resMatch[1]}`);
      }

      if (blackDetected && durationSec > 0) {
         const blackLines = output.split('\n').filter(l => l.includes('blackdetect'));
         // If there's a black frame that spans the whole duration, fail
         const blackDurationMatch = output.match(/black_duration: ([0-9.]+)/g);
         let totalBlack = 0;
         if (blackDurationMatch) {
           totalBlack = blackDurationMatch.reduce((acc, match) => acc + parseFloat(match.split(':')[1]), 0);
         }
         if (totalBlack > durationSec * 0.9) {
           console.log(`[${recordingId}] recording_black_video_detected`);
           return reject(new Error("Video is completely black. Validation failed."));
         }
      }

      if (silenceDetected && durationSec > 0) {
         const silenceDurationMatch = output.match(/silence_duration: ([0-9.]+)/g);
         let totalSilence = 0;
         if (silenceDurationMatch) {
           totalSilence = silenceDurationMatch.reduce((acc, match) => acc + parseFloat(match.split(':')[1]), 0);
         }
         if (totalSilence > durationSec * 0.9) {
           console.log(`[${recordingId}] recording_silent_audio_detected`);
           return reject(new Error("Audio is completely silent. Validation failed."));
         }
      }

      console.log(`[${recordingId}] ffprobe_mp4_result: PASSED`);
      resolve(durationSec);
    });
  });
}

async function run() {
  const args = process.argv.slice(2);
  const roomId = args[0];
  const recordingId = args[1];
  const botToken = args[2];
  const outputPathRaw = args[3];
  const stdoutPath = args[4];
  const stderrPath = args[5];

  if (!roomId || !recordingId || !botToken || !outputPathRaw) {
    console.error("Missing arguments");
    process.exit(1);
  }

  // Setup teeing of console to file
  const originalLog = console.log;
  const originalError = console.error;
  let stdoutStream, stderrStream;
  if (stdoutPath) stdoutStream = fs.createWriteStream(stdoutPath, { flags: 'a' });
  if (stderrPath) stderrStream = fs.createWriteStream(stderrPath, { flags: 'a' });

  console.log = (...args) => {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ') + '\\n';
    if (stdoutStream) stdoutStream.write(msg);
    originalLog.apply(console, args);
  };
  
  console.error = (...args) => {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ') + '\\n';
    if (stderrStream) stderrStream.write(msg);
    originalError.apply(console, args);
  };

  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
  const outputPathMp4 = path.join(path.dirname(outputPathRaw), `${roomId}.mp4`);

  try {
    console.log(`[${recordingId}] transcoder process started for ${outputPathRaw}`);
    
    // FFprobe on raw file
    await checkFfprobe(outputPathRaw, recordingId);

    // Notify transcoding
    await notifyBackendWithRetry(
      backendUrl, 
      `/api/recordings/${recordingId}/callback/status`,
      recordingId, botToken,
      { status: 'transcoding' }
    );
    console.log(`[${recordingId}] ffmpeg_transcode_started`);

    await new Promise((resolve, reject) => {
      ffmpeg(outputPathRaw)
        .outputOptions([
          '-y',
          '-c copy',
          '-max_muxing_queue_size 9999'
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

    let finalDuration = 0;
    try {
      finalDuration = await validateMp4(outputPathMp4, recordingId);
    } catch (e) {
      console.error(`[${recordingId}] Validation failed:`, e);
      await notifyBackendWithRetry(
        backendUrl, 
        `/api/recordings/${recordingId}/callback/status`,
        recordingId, botToken,
        { status: 'failed', error: e.message }
      );
      process.exit(1);
    }

    // Notify uploading
    await notifyBackendWithRetry(
      backendUrl, 
      `/api/recordings/${recordingId}/callback/status`,
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
        ACL: 'private', // Security fix: no longer public-read
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
      `/api/recordings/${recordingId}/callback/status`,
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
    try { fs.unlinkSync(outputPathRaw); } catch(e) {}
    try { fs.unlinkSync(outputPathMp4); } catch(e) {}
    
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
        `/api/recordings/${recordingId}/callback/status`,
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

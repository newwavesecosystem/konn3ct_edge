const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { exec } = require('child_process');
const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');

require('dotenv').config();

const rawEndpoint = process.env.DO_SPACES_ENDPOINT || 'sfo3.digitaloceanspaces.com';
const endpoint = rawEndpoint.startsWith('http') ? rawEndpoint : (rawEndpoint.includes(':') || rawEndpoint.includes('minio') ? `http://${rawEndpoint}` : `https://${rawEndpoint}`);

const s3Client = new S3Client({
  endpoint,
  region: process.env.DO_SPACES_REGION || 'sfo3',
  forcePathStyle: String(process.env.S3_FORCE_PATH_STYLE).trim().toLowerCase() === 'true',
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
      success = true; console.log(`[${recordingId}] spaces_upload_db_synced: ${JSON.stringify(payload)}`);
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
  const segmentIndexStr = args[6];
  const segmentIndex = segmentIndexStr !== undefined ? parseInt(segmentIndexStr) : undefined;
  const workerGenerationStr = args[7];
  const workerGeneration = workerGenerationStr ? parseInt(workerGenerationStr) : 1;
  const isCrash = args[8] === 'true';

  if (!roomId || !recordingId || !botToken || !outputPathRaw) {
    console.error("Missing arguments");
    process.exit(1);
  }

  const originalLog = console.log;
  const originalError = console.error;
  let stdoutStream, stderrStream;
  if (stdoutPath) stdoutStream = fs.createWriteStream(stdoutPath, { flags: 'a' });
  if (stderrPath) stderrStream = fs.createWriteStream(stderrPath, { flags: 'a' });

  console.log = (...args) => {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ') + '\n';
    if (stdoutStream) stdoutStream.write(msg);
    originalLog.apply(console, args);
  };
  
  console.error = (...args) => {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ') + '\n';
    if (stderrStream) stderrStream.write(msg);
    originalError.apply(console, args);
  };

  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
  try {
    console.log(`[${recordingId}] transcoder process started for ${outputPathRaw} (Gen: ${workerGeneration})`);
    
    // FFprobe on raw file
    let ffprobeResult;
    try {
        ffprobeResult = await checkFfprobe(outputPathRaw, recordingId);
    } catch(err) {
        if (isCrash) {
           console.error(`[${recordingId}] Crash segment is completely invalid or empty.`, err);
           await notifyBackendWithRetry(backendUrl, `/api/recordings/${recordingId}/segments`, recordingId, botToken, {
             segmentIndex: segmentIndex,
             url: null,
             durationMs: 0,
             fileSize: fs.existsSync(outputPathRaw) ? fs.statSync(outputPathRaw).size : 0,
             status: 'CORRUPT',
             workerGeneration
           });
           process.exit(0); // Exit successfully since we reported the corruption
        } else {
           throw err;
        }
    }

    const outputPathMp4 = outputPathRaw;

    let finalDuration = 0;
    let finalStatus = 'uploaded';
    try {
      finalDuration = await validateMp4(outputPathMp4, recordingId);
    } catch (e) {
      if (isCrash) {
          console.log(`[${recordingId}] Crash segment has defects but we will upload as PARTIAL.`, e.message);
          finalStatus = 'PARTIAL';
          // Estimate duration from ffprobe if validateMp4 failed but it's a crash
          if (ffprobeResult && ffprobeResult.format && ffprobeResult.format.duration) {
              finalDuration = parseFloat(ffprobeResult.format.duration);
          }
      } else {
          console.error(`[${recordingId}] Validation failed:`, e);
          process.exit(1);
      }
    }

    // Upload
    console.log(`[${recordingId}] spaces_upload_started`);
    const fileStreamForUpload = fs.createReadStream(outputPathMp4);
    const uploadParams = {
      client: s3Client,
      params: {
        Bucket: BUCKET_NAME,
        Key: `recordings/${roomId}/${Date.now()}.mp4`,
        Body: fileStreamForUpload,
        ContentType: 'video/mp4',
        ACL: 'private',
      },
      queueSize: 4,
      partSize: 5 * 1024 * 1024
    };
    
    const uploader = new Upload(uploadParams);
    uploader.on("httpUploadProgress", (progress) => {
      console.log(`[${recordingId}] spaces_upload_progress: ${progress.loaded} / ${progress.total}`);
    });

    const data = await uploader.done();
    console.log(`[${recordingId}] spaces_upload_completed`);

    let finalUrl = data.Location;
    const publicStorageUrl = process.env.PUBLIC_STORAGE_URL || (process.env.STORAGE_PUBLIC_DOMAIN ? `https://${process.env.STORAGE_PUBLIC_DOMAIN}` : null);
    if (publicStorageUrl && finalUrl) {
      const publicBase = publicStorageUrl.replace(/\/+$/, '');
      finalUrl = finalUrl.replace(/^https?:\/\/[^\/]+/, publicBase);
    }

    if (segmentIndex !== undefined && !isNaN(segmentIndex)) {
        await notifyBackendWithRetry(
          backendUrl, 
          `/api/recordings/${recordingId}/segments`,
          recordingId, botToken,
          {
            segmentIndex: segmentIndex,
            url: finalUrl,
            durationMs: finalDuration * 1000,
            fileSize: fs.statSync(outputPathMp4).size,
            status: finalStatus,
            workerGeneration
          }
        );
    } else {
        await notifyBackendWithRetry(
          backendUrl, 
          `/api/recordings/${recordingId}/callback/status`,
          recordingId, botToken,
          {
            status: 'completed',
            url: finalUrl,
            duration: finalDuration
          }
        );
    }

    try { fs.unlinkSync(outputPathMp4); } catch(e) {}
    process.exit(0);
  } catch (err) {
    console.error(`[${recordingId}] spaces_upload_failed or transcode_failed`, err);
    process.exit(1);
  }
}

run();

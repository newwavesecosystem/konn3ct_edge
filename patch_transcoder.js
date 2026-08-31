const fs = require('fs');
let code = fs.readFileSync('recorder/transcoder.js', 'utf8');

// The transcoder arguments are processed around line 131. Let's find how to update it.
// Wait, I can just replace the 'run' function.
const runPrefix = code.split('async function run() {')[0];

const newRunFunction = `
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
  try {
    console.log(\`[\${recordingId}] transcoder process started for \${outputPathRaw} (Gen: \${workerGeneration})\`);
    
    // FFprobe on raw file
    let ffprobeResult;
    try {
        ffprobeResult = await checkFfprobe(outputPathRaw, recordingId);
    } catch(err) {
        if (isCrash) {
           console.error(\`[\${recordingId}] Crash segment is completely invalid or empty.\`, err);
           await notifyBackendWithRetry(backendUrl, \`/api/recordings/\${recordingId}/segments\`, recordingId, botToken, {
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
          console.log(\`[\${recordingId}] Crash segment has defects but we will upload as PARTIAL.\`, e.message);
          finalStatus = 'PARTIAL';
          // Estimate duration from ffprobe if validateMp4 failed but it's a crash
          if (ffprobeResult && ffprobeResult.format && ffprobeResult.format.duration) {
              finalDuration = parseFloat(ffprobeResult.format.duration);
          }
      } else {
          console.error(\`[\${recordingId}] Validation failed:\`, e);
          process.exit(1);
      }
    }

    // Upload
    console.log(\`[\${recordingId}] spaces_upload_started\`);
    const fileStreamForUpload = fs.createReadStream(outputPathMp4);
    const uploadParams = {
      client: s3Client,
      params: {
        Bucket: BUCKET_NAME,
        Key: \`recordings/\${roomId}/\${Date.now()}.mp4\`,
        Body: fileStreamForUpload,
        ContentType: 'video/mp4',
        ACL: 'private',
      },
      queueSize: 4,
      partSize: 5 * 1024 * 1024
    };
    
    const uploader = new Upload(uploadParams);
    uploader.on("httpUploadProgress", (progress) => {
      console.log(\`[\${recordingId}] spaces_upload_progress: \${progress.loaded} / \${progress.total}\`);
    });

    const data = await uploader.done();
    console.log(\`[\${recordingId}] spaces_upload_completed\`);

    if (segmentIndex !== undefined && !isNaN(segmentIndex)) {
        await notifyBackendWithRetry(
          backendUrl, 
          \`/api/recordings/\${recordingId}/segments\`,
          recordingId, botToken,
          {
            segmentIndex: segmentIndex,
            url: data.Location,
            durationMs: finalDuration * 1000,
            fileSize: fs.statSync(outputPathMp4).size,
            status: finalStatus,
            workerGeneration
          }
        );
    } else {
        await notifyBackendWithRetry(
          backendUrl, 
          \`/api/recordings/\${recordingId}/callback/status\`,
          recordingId, botToken,
          {
            status: 'completed',
            url: data.Location,
            duration: finalDuration
          }
        );
    }

    try { fs.unlinkSync(outputPathMp4); } catch(e) {}
    process.exit(0);
  } catch (err) {
    console.error(\`[\${recordingId}] spaces_upload_failed or transcode_failed\`, err);
    process.exit(1);
  }
}

run();
`;

fs.writeFileSync('recorder/transcoder.js', runPrefix + newRunFunction);

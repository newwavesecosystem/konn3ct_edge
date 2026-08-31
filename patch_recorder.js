const fs = require('fs');
let code = fs.readFileSync('recorder/index.js', 'utf8');
const prefix = code.split('async function processRecordingJob(job, workerId) {')[0];

const newProcessRecordingJob = `
async function processRecordingJob(job, workerId) {
  activeBrowsers++;
  const displayId = \`:\${displayCounter++}\`;
  
  const { roomId, url, recordingId, botToken, workerGeneration = 1, nextSegmentIndex = 0 } = job;
  const workerOwnerStr = \`\${workerId}:\${workerGeneration}\`;
  
  let browser = null;
  let xvfbProc = null;
  let pulseProc = null;
  let ffmpegProc = null;
  
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
  const recordingsDir = process.env.RECORDINGS_DIR || require('path').join(__dirname, 'recordings');
  
  const generationId = \`\${recordingId}_gen\${workerGeneration}\`;
  const isolatedDir = require('path').join(recordingsDir, recordingId, \`gen-\${workerGeneration}\`);
  fs.mkdirSync(isolatedDir, { recursive: true });
  
  const outputPathRawTpl = require('path').join(isolatedDir, \`\${roomId}_%03d.mp4\`);
  
  if (!url) {
    console.error(JSON.stringify({ timestamp: new Date().toISOString(), event: "recorder_invalid_route_detected", roomId, recordingId }));
    activeBrowsers--;
    return;
  }

  recordingManifests.set(recordingId, { recordingId, roomId, startedAt: new Date().toISOString(), validationStatus: 'pending' });
  
  // Atomic heartbeat
  const heartbeatInterval = setInterval(() => {
    const lua = \`if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('EXPIRE', KEYS[1], 30) else return 0 end\`;
    redis.eval(lua, 1, \`recording:\${recordingId}:lease\`, workerOwnerStr).catch(()=>{});
  }, 10000);

  const pendingSegments = new Set();
  let cleanupStarted = false;

  const cleanup = async () => {
    if (cleanupStarted) return;
    cleanupStarted = true;
    
    clearInterval(heartbeatInterval);
    activeBrowsers--;
    
    if (ffmpegProc && !ffmpegProc.killed) {
      try {
        if (ffmpegProc.stdin && ffmpegProc.stdin.writable) {
           ffmpegProc.stdin.write('q\\n');
           await new Promise(r => setTimeout(r, 5000));
        }
        ffmpegProc.kill('SIGTERM');
        await new Promise(r => setTimeout(r, 2000));
        ffmpegProc.kill('SIGKILL');
      } catch(e){}
    }
    if (browser) { try { await browser.close(); } catch(e){} }
    if (pulseProc) { try { pulseProc.kill('SIGKILL'); } catch(e){} }
    if (xvfbProc) { try { xvfbProc.kill('SIGKILL'); } catch(e){} }
    
    // Process only segments that were recorded by us and not yet fully offloaded
    try {
      const files = fs.readdirSync(isolatedDir).filter(f => f.endsWith('.mp4'));
      for (const file of files) {
         if (!pendingSegments.has(file)) continue; // skip already processed
         
         const filePath = require('path').join(isolatedDir, file);
         const stat = fs.statSync(filePath);
         if (stat.size > 1000) {
             const transcoderPath = require('path').join(__dirname, 'transcoder.js');
             const stdoutPath = require('path').join(isolatedDir, \`\${file}_stdout.log\`);
             const stderrPath = require('path').join(isolatedDir, \`\${file}_stderr.log\`);
             
             // Extract segment index from filename
             const match = file.match(/_(\\d+)\\.mp4$/);
             const sIndex = match ? parseInt(match[1], 10) : 0;
             
             const isCrashStr = (await isStopRequested()) ? 'false' : 'true';
             const child = spawn('node', [transcoderPath, roomId, recordingId, botToken, filePath, stdoutPath, stderrPath, sIndex, workerGeneration, isCrashStr], {
               detached: true, stdio: 'ignore'
             });
             child.unref();
         }
      }
    } catch(e) {}
    
    const luaDel = \`if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end\`;
    redis.eval(luaDel, 1, \`recording:\${recordingId}:lease\`, workerOwnerStr).catch(()=>{});
  };
  
  async function isStopRequested() {
    try {
      const val = await redis.get(\`recording:\${recordingId}:control\`);
      return val === 'STOP_REQUESTED' || val === 'STOPPING' || val === 'STOPPED';
    } catch (e) { return false; }
  }

  try {
    console.log(JSON.stringify({ event: "recorder_job_display_allocated", recordingId, workerGeneration, displayId }));

    if (await isStopRequested()) return cleanup();

    // Strict CAS
    const casRes = await redis.eval(\`
      local current = redis.call('GET', KEYS[1])
      if current == 'STARTING' or current == 'RECOVERING' or current == 'RECORDING' then
        redis.call('SET', KEYS[1], 'RECORDING', 'EX', 86400)
        return {1, 'RECORDING'}
      end
      return {0, current}
    \`, 1, \`recording:\${recordingId}:control\`);
    
    if (casRes && casRes[0] === 0) return cleanup();

    xvfbProc = spawn('Xvfb', [displayId, '-screen', '0', '1920x1080x24', '-ac', '-nolisten', 'tcp']);
    await new Promise(r => setTimeout(r, 1000));
    
    const pulseDir = \`/tmp/pulse_\${generationId}\`;
    fs.mkdirSync(pulseDir, { recursive: true });
    pulseProc = spawn('pulseaudio', [
      '-n', '-F', '/dev/null', '--exit-idle-time=-1', '--daemonize=false', \`-p\`, pulseDir,
      \`--load=module-null-sink sink_name=RecorderSink_\${generationId} sink_properties=device.description=RecorderSink\`,
      \`--load=module-native-protocol-unix socket=\${pulseDir}/pulse-socket\`
    ], { env: { ...process.env, DISPLAY: displayId, PULSE_RUNTIME_PATH: pulseDir } });
    await new Promise(r => setTimeout(r, 1500));
    
    const pulseSocketPath = \`\${pulseDir}/pulse-socket\`;
    const sinkName = \`RecorderSink_\${generationId}\`;

    const browserArgs = [
      '--window-size=1920,1080', '--kiosk', '--no-sandbox', '--disable-setuid-sandbox',
      '--autoplay-policy=no-user-gesture-required', '--disable-dev-shm-usage', '--disable-gpu',
      '--auto-select-desktop-capture-source=BotRecord', '--auto-select-tab-capture-source-by-title=BotRecord',
      '--enable-usermedia-screen-capturing', '--use-fake-ui-for-media-stream', '--disable-web-security', '--hide-scrollbars',
      \`--user-data-dir=/tmp/chrome_profile_\${generationId}\`
    ];
    
    const silentWavPath = require('path').join(__dirname, 'silent.wav');
    if (fs.existsSync(silentWavPath)) browserArgs.push(\`--use-file-for-fake-audio-capture=\${silentWavPath}\`);

    browser = await launch({
      executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome',
      headless: false, defaultViewport: null, ignoreDefaultArgs: ['--mute-audio', '--enable-automation'],
      env: { DISPLAY: displayId, PULSE_SERVER: \`unix:\${pulseSocketPath}\`, ...process.env }, args: browserArgs
    });

    const pages = await browser.pages();
    const page = pages[0];
    await browser.defaultBrowserContext().overridePermissions(new URL(url).origin, ['camera', 'microphone']);
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.bringToFront();
    await page.waitForNetworkIdle({ timeout: 60000 }).catch(() => {});
    
    const ffmpegArgs = [
      '-y', '-thread_queue_size', '1024', '-f', 'x11grab', '-draw_mouse', '0', '-video_size', '1920x1080', '-framerate', '30',
      '-i', \`\${displayId}.0\`, '-thread_queue_size', '1024', '-f', 'pulse', '-i', \`\${sinkName}.monitor\`,
      '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k',
      '-f', 'segment', '-segment_time', '60', '-segment_start_number', nextSegmentIndex.toString(), '-reset_timestamps', '1',
      '-segment_format', 'mp4', outputPathRawTpl
    ];
    
    console.log(JSON.stringify({ event: "recorder_ffmpeg_capture_started", recordingId, workerGeneration, nextSegmentIndex }));
    ffmpegProc = spawn('ffmpeg', ffmpegArgs);
    
    await notifyBackendWithRetry(backendUrl, \`/api/recordings/\${recordingId}/callback/started\`, recordingId, job.jobId, botToken, "callback_started");

    const chokidar = require('chokidar');
    const watcher = chokidar.watch(isolatedDir, { ignored: /(^|[\\\\/\\\\])\\../, persistent: true, ignoreInitial: true });
    
    let lastSegment = null;
    watcher.on('add', (filePath) => {
        if (filePath.endsWith('.mp4')) {
           const fileName = require('path').basename(filePath);
           pendingSegments.add(fileName);
           
           // Extract segment index and reserve it globally
           const match = fileName.match(/_(\\d+)\\.mp4$/);
           if (match) {
               const sIndex = parseInt(match[1], 10);
               redis.set(\`recording:\${recordingId}:last-segment-index\`, sIndex).catch(()=>{});
           }
           
           if (lastSegment) {
               console.log(\`[Segment Finalized] \${lastSegment}. Queuing for upload.\`);
               const transcoderPath = require('path').join(__dirname, 'transcoder.js');
               const stdoutPath = require('path').join(isolatedDir, \`\${lastSegment}_stdout.log\`);
               const stderrPath = require('path').join(isolatedDir, \`\${lastSegment}_stderr.log\`);
               
               const lsMatch = lastSegment.match(/_(\\d+)\\.mp4$/);
               const lsIndex = lsMatch ? parseInt(lsMatch[1], 10) : 0;
               
               const child = spawn('node', [transcoderPath, roomId, recordingId, botToken, require('path').join(isolatedDir, lastSegment), stdoutPath, stderrPath, lsIndex, workerGeneration, 'false'], {
                 detached: true, stdio: 'ignore'
               });
               child.unref();
               pendingSegments.delete(lastSegment);
           }
           lastSegment = fileName;
        }
    });

    const stopHandler = async (channel, message) => {
      if (channel === \`recorder:stop:\${recordingId}\`) {
         console.log(JSON.stringify({ event: "recorder_stop_signal_received", recordingId }));
         pubsub.removeListener('message', stopHandler);
         watcher.close();
         await cleanup();
      }
    };
    pubsub.on('message', stopHandler);
    pubsub.subscribe(\`recorder:stop:\${recordingId}\`);

    ffmpegProc.on('exit', async (code) => {
       console.log(JSON.stringify({ event: "recorder_ffmpeg_exit_code", recordingId, workerGeneration, code }));
       pubsub.removeListener('message', stopHandler);
       watcher.close();
       await cleanup();
    });

    browser.on('disconnected', async () => {
       pubsub.removeListener('message', stopHandler);
       watcher.close();
       await cleanup();
    });

  } catch (err) {
    console.error('Error during recording execution:', err);
    await cleanup();
  }
}
`;

fs.writeFileSync('recorder/index.js', prefix + newProcessRecordingJob);

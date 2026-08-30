const fs = require('fs');

const content = fs.readFileSync('recorder/index.js', 'utf8');

const prefix = content.split('async function processRecordingJob(job, workerId) {')[0];

const newProcessRecordingJob = `
async function processRecordingJob(job, workerId) {
  activeBrowsers++;
  const displayId = \`:\${displayCounter++}\`;
  
  const { roomId, url, recordingId, botToken } = job;
  let browser = null;
  let xvfbProc = null;
  let pulseProc = null;
  let ffmpegProc = null;
  let currentSegmentIndex = 0;
  
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
  // Isolate namespace to avoid cross-contamination
  const recordingsDir = process.env.RECORDINGS_DIR || require('path').join(__dirname, 'recordings');
  const isolatedDir = require('path').join(recordingsDir, recordingId);
  fs.mkdirSync(isolatedDir, { recursive: true });
  
  const outputPathRawTpl = require('path').join(isolatedDir, \`\${roomId}_%03d.mp4\`);
  
  if (!url.includes('/recording/')) {
    console.error(JSON.stringify({ timestamp: new Date().toISOString(), event: "recorder_invalid_route_detected", roomId, recordingId, url }));
    activeBrowsers--;
    return;
  }

  recordingManifests.set(recordingId, {
    recordingId, roomId, startedAt: new Date().toISOString(), validationStatus: 'pending'
  });
  
  // Heartbeat loop
  const heartbeatInterval = setInterval(() => {
    redis.expire(\`recording:\${recordingId}:lease\`, 30).catch(()=>{});
  }, 10000);

  const cleanup = async () => {
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
    if (browser) {
      try { await browser.close(); } catch(e){}
    }
    if (pulseProc) {
      try { pulseProc.kill('SIGKILL'); } catch(e){}
    }
    if (xvfbProc) {
      try { xvfbProc.kill('SIGKILL'); } catch(e){}
    }
    
    // Attempt to process any leftover segments
    try {
      const files = fs.readdirSync(isolatedDir).filter(f => f.endsWith('.mp4'));
      for (const file of files) {
         const filePath = require('path').join(isolatedDir, file);
         const stat = fs.statSync(filePath);
         if (stat.size > 10000) {
             const transcoderPath = require('path').join(__dirname, 'transcoder.js');
             const stdoutPath = require('path').join(isolatedDir, \`\${file}_stdout.log\`);
             const stderrPath = require('path').join(isolatedDir, \`\${file}_stderr.log\`);
             const child = spawn('node', [transcoderPath, roomId, recordingId, botToken, filePath, stdoutPath, stderrPath, currentSegmentIndex++], {
               detached: true, stdio: 'ignore'
             });
             child.unref();
         }
      }
    } catch(e) {}
    
    redis.del(\`recording:\${recordingId}:lease\`).catch(()=>{});
  };
  
  async function isStopRequested() {
    try {
      const val = await redis.get(\`recording:\${recordingId}:control\`);
      return val === 'STOP_REQUESTED' || val === 'STOPPING' || val === 'STOPPED';
    } catch (e) {
      return false;
    }
  }

  try {
    console.log(JSON.stringify({ event: "recorder_job_display_allocated", recordingId, displayId }));

    if (await isStopRequested()) {
      console.log(JSON.stringify({ event: "recorder_stop_observed_before_startup", recordingId }));
      return cleanup();
    }

    const casRes = await redis.eval(\`
      local key = KEYS[1]
      local current = redis.call('GET', key)
      if current == 'STOP_REQUESTED' or current == 'STOPPING' or current == 'STOPPED' then
        return {0, current}
      end
      redis.call('SET', key, 'RECORDING', 'EX', 86400)
      return {1, 'RECORDING'}
    \`, 1, \`recording:\${recordingId}:control\`);
    
    if (casRes && casRes[0] === 0) {
      console.log(JSON.stringify({ event: "recorder_stop_observed_during_startup", recordingId }));
      return cleanup();
    }

    // 1. Start Xvfb
    console.log(JSON.stringify({ event: "recorder_xvfb_starting", recordingId, displayId }));
    xvfbProc = spawn('Xvfb', [displayId, '-screen', '0', '1920x1080x24', '-ac', '-nolisten', 'tcp']);
    await new Promise(r => setTimeout(r, 1000));
    
    // 2. Start PulseAudio
    const pulseDir = \`/tmp/pulse_\${recordingId}\`;
    fs.mkdirSync(pulseDir, { recursive: true });
    console.log(JSON.stringify({ event: "recorder_pulse_starting", recordingId, pulseDir }));
    pulseProc = spawn('pulseaudio', [
      '-n',
      '-F', '/dev/null',
      '--exit-idle-time=-1',
      '--daemonize=false',
      \`-p\`, pulseDir,
      \`--load=module-null-sink sink_name=RecorderSink_\${recordingId} sink_properties=device.description=RecorderSink\`,
      \`--load=module-native-protocol-unix socket=\${pulseDir}/pulse-socket\`
    ], { env: { ...process.env, DISPLAY: displayId, PULSE_RUNTIME_PATH: pulseDir } });
    await new Promise(r => setTimeout(r, 1500));
    
    const pulseSocketPath = \`\${pulseDir}/pulse-socket\`;
    const sinkName = \`RecorderSink_\${recordingId}\`;

    // 3. Launch Chrome
    console.log(JSON.stringify({ event: "recorder_browser_starting", recordingId }));
    
    const silentWavPath = require('path').join(__dirname, 'silent.wav');
    const hasSilentWav = fs.existsSync(silentWavPath);

    const browserArgs = [
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
      '--hide-scrollbars',
      \`--user-data-dir=/tmp/chrome_profile_\${recordingId}\`
    ];
    if (hasSilentWav) browserArgs.push(\`--use-file-for-fake-audio-capture=\${silentWavPath}\`);

    browser = await launch({
      executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome',
      headless: false,
      defaultViewport: null,
      ignoreDefaultArgs: ['--mute-audio', '--enable-automation'],
      env: {
        DISPLAY: displayId,
        PULSE_SERVER: \`unix:\${pulseSocketPath}\`,
        ...process.env
      },
      args: browserArgs
    });

    const pages = await browser.pages();
    const page = pages[0];
    
    const context = browser.defaultBrowserContext();
    await context.overridePermissions(new URL(url).origin, ['camera', 'microphone']);
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.bringToFront();
    await page.waitForNetworkIdle({ timeout: 60000 }).catch(() => {});
    
    console.log(JSON.stringify({ event: "recorder_media_ready", recordingId }));
    
    // 4. Start FFmpeg (Segmented)
    const ffmpegArgs = [
      '-y',
      '-thread_queue_size', '1024',
      '-f', 'x11grab',
      '-draw_mouse', '0',
      '-video_size', '1920x1080',
      '-framerate', '30',
      '-i', \`\${displayId}.0\`,
      '-thread_queue_size', '1024',
      '-f', 'pulse',
      '-i', \`\${sinkName}.monitor\`,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-f', 'segment',
      '-segment_time', '60', // 60 seconds per segment
      '-reset_timestamps', '1',
      '-segment_format', 'mp4',
      outputPathRawTpl
    ];
    
    console.log(JSON.stringify({ event: "recorder_ffmpeg_capture_started", recordingId, args: ffmpegArgs.join(' ') }));
    ffmpegProc = spawn('ffmpeg', ffmpegArgs);
    
    await notifyBackendWithRetry(backendUrl, \`/api/recordings/\${recordingId}/callback/started\`, recordingId, job.jobId, botToken, "callback_started");

    // File watcher for segments
    const chokidar = require('chokidar');
    const watcher = chokidar.watch(isolatedDir, {
      ignored: /(^|[\\/\\\\])\\../,
      persistent: true
    });
    
    watcher.on('add', (filePath) => {
      console.log(\`[Segment Started] \${filePath}\`);
    });

    let lastSegment = null;
    watcher.on('add', (filePath) => {
        if (filePath.endsWith('.mp4')) {
           if (lastSegment) {
               console.log(\`[Segment Finalized] \${lastSegment}. Queuing for upload.\`);
               const transcoderPath = require('path').join(__dirname, 'transcoder.js');
               const stdoutPath = \`\${lastSegment}_stdout.log\`;
               const stderrPath = \`\${lastSegment}_stderr.log\`;
               const child = spawn('node', [transcoderPath, roomId, recordingId, botToken, lastSegment, stdoutPath, stderrPath, currentSegmentIndex++], {
                 detached: true, stdio: 'ignore'
               });
               child.unref();
           }
           lastSegment = filePath;
        }
    });

    // Supervisor logic
    const stopHandler = async (channel, message) => {
      if (channel === \`recorder:stop:\${recordingId}\` || channel === \`recorder:stop:\${roomId}\`) {
         console.log(JSON.stringify({ event: "recorder_stop_signal_received", recordingId }));
         await cleanup();
         pubsub.removeListener('message', stopHandler);
         watcher.close();
         
         if (lastSegment) {
             const transcoderPath = require('path').join(__dirname, 'transcoder.js');
             const child = spawn('node', [transcoderPath, roomId, recordingId, botToken, lastSegment, \`\${lastSegment}_stdout.log\`, \`\${lastSegment}_stderr.log\`, currentSegmentIndex], {
               detached: true, stdio: 'ignore'
             });
             child.unref();
         }
      }
    };
    pubsub.on('message', stopHandler);
    pubsub.subscribe(\`recorder:stop:\${recordingId}\`);
    pubsub.subscribe(\`recorder:stop:\${roomId}\`);

    ffmpegProc.on('exit', async (code) => {
       console.log(JSON.stringify({ event: "recorder_ffmpeg_exit_code", recordingId, code }));
       if (!(await isStopRequested())) {
           console.log(JSON.stringify({ event: "recorder_unexpected_crash_recovering", recordingId }));
           await cleanup();
           pubsub.removeListener('message', stopHandler);
           watcher.close();
           // Re-queue job for auto-restart
           redis.lpush('recorder:queue', JSON.stringify(job));
       }
    });

    browser.on('disconnected', async () => {
       if (!(await isStopRequested())) {
           console.log(JSON.stringify({ event: "recorder_browser_crash_recovering", recordingId }));
           await cleanup();
           pubsub.removeListener('message', stopHandler);
           watcher.close();
           redis.lpush('recorder:queue', JSON.stringify(job));
       }
    });

  } catch (err) {
    console.error('Error during recording execution:', err);
    await cleanup();
  }
}
`;

fs.writeFileSync('recorder/index.js', prefix + newProcessRecordingJob);

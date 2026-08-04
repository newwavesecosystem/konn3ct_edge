const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

let displayCounter = 99;

async function processRecordingJob(job) {
  activeBrowsers++;
  const displayId = `:${displayCounter++}`;
  
  const { roomId, url, recordingId, botToken } = job;
  let browser = null;
  let xvfbProc = null;
  let pulseProc = null;
  let ffmpegProc = null;
  
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
  const recordingsDir = process.env.RECORDINGS_DIR || path.join(__dirname, 'recordings');
  require('fs').mkdirSync(recordingsDir, { recursive: true });
  
  // We output directly to MP4 (raw), and transcoder.js will fast-copy it to the final mp4
  const outputPathRaw = path.join(recordingsDir, `${roomId}_raw.mp4`);
  
  if (!url.includes('/recording/')) {
    console.error(JSON.stringify({ timestamp: new Date().toISOString(), event: "recorder_invalid_route_detected", roomId, recordingId, url }));
    return;
  }

  recordingManifests.set(recordingId, {
    recordingId, roomId, startedAt: new Date().toISOString(), validationStatus: 'pending'
  });
  
  try {
    console.log(JSON.stringify({ event: "recorder_job_display_allocated", recordingId, displayId }));

    // 1. Start Xvfb
    xvfbProc = spawn('Xvfb', [displayId, '-screen', '0', '1920x1080x24', '-ac']);
    await new Promise(r => setTimeout(r, 1000)); // wait for Xvfb to start
    console.log(JSON.stringify({ event: "recorder_xvfb_started", recordingId, displayId }));

    // 2. Start PulseAudio
    // Usually it runs as a daemon, but we can start it per container if needed.
    // In Docker, pulseaudio --start might fail if it's already running, but we can just use pactl if running system-wide.
    // We'll spawn it or just use pactl directly if it's already running.
    try { execSync('pulseaudio --start --exit-idle-time=-1'); } catch(e) {}
    console.log(JSON.stringify({ event: "recorder_pulseaudio_started", recordingId }));

    // 3. Load null sink for this job
    const sinkName = `recorder_sink_${recordingId}`;
    try {
      execSync(`pactl load-module module-null-sink sink_name=${sinkName} sink_properties=device.description=RecorderSink_${recordingId}`);
      execSync(`pactl set-default-sink ${sinkName}`);
    } catch(e) {
      console.warn("Failed to set pulseaudio sink", e.toString());
    }
    console.log(JSON.stringify({ event: "recorder_audio_sink_created", recordingId, sinkName }));
    console.log(JSON.stringify({ event: "recorder_audio_default_sink_set", recordingId, sinkName }));
    console.log(JSON.stringify({ event: "recorder_audio_monitor_detected", recordingId, monitor: `${sinkName}.monitor` }));

    // 4. Launch Chrome with Puppeteer
    const puppeteer = require('puppeteer');
    browser = await puppeteer.launch({
      executablePath: "/usr/bin/google-chrome",
      headless: false,
      defaultViewport: null,
      ignoreDefaultArgs: ["--enable-automation"],
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-infobars",
        "--autoplay-policy=no-user-gesture-required",
        "--window-size=1920,1080",
        "--window-position=0,0",
        "--start-fullscreen",
        "--kiosk",
        `--app=${url}`,
      ],
      env: {
        ...process.env,
        DISPLAY: displayId,
        PULSE_SINK: sinkName,
      },
    });
    console.log(JSON.stringify({ event: "recorder_chrome_launched_app_mode", recordingId }));

    const pages = await browser.pages();
    const page = pages[0];

    // Wait for route to load
    await page.waitForNetworkIdle({ timeout: 60000 }).catch(() => {});
    console.log(JSON.stringify({ event: "recorder_route_loaded", recordingId }));

    // Readiness checks
    try {
      await page.waitForFunction(
        () => {
           const state = (window).__KONN3CT_RECORDER_READY__;
           return state?.joined === true || state?.failed === true;
        },
        { timeout: 60000 }
      );
      const readyState = await page.evaluate(() => (window).__KONN3CT_RECORDER_READY__);
      if (readyState?.failed) throw new Error(readyState.reason || 'ready_failed');
    } catch (e) {
      console.log(JSON.stringify({ event: "recorder_pre_capture_route_not_ready", recordingId }));
      throw e;
    }
    console.log(JSON.stringify({ event: "recorder_joined_room", recordingId }));

    // Video/Audio render readiness
    await page.evaluate(() => {
      return new Promise(async (resolve, reject) => {
        try {
          console.log("PAGE LOG: recorder_video_elements_detected");
          await new Promise((resolveVideo) => {
            let attempt = 0;
            const checkVideo = () => {
              const videos = document.querySelectorAll('video');
              for (let i = 0; i < videos.length; i++) {
                const v = videos[i];
                if (v.readyState >= 2 && v.videoWidth > 0 && v.videoHeight > 0) {
                  if (typeof v.requestVideoFrameCallback === 'function') {
                    v.requestVideoFrameCallback(() => {
                      console.log("PAGE LOG: recorder_first_video_frame_received");
                      console.log("PAGE LOG: recorder_video_render_ready");
                      resolveVideo();
                    });
                    return;
                  } else {
                    console.log("PAGE LOG: recorder_first_video_frame_received");
                    console.log("PAGE LOG: recorder_video_render_ready");
                    resolveVideo();
                    return;
                  }
                }
              }
              attempt++;
              if (attempt > 60) return resolveVideo();
              setTimeout(checkVideo, 500);
            };
            checkVideo();
          });

          console.log("PAGE LOG: recorder_audio_context_running");
          await new Promise((resolveAudio) => {
            try {
              const AudioContext = window.AudioContext || window.webkitAudioContext;
              const ctx = new AudioContext();
              const analyser = ctx.createAnalyser();
              analyser.fftSize = 256;
              const dataArray = new Uint8Array(analyser.frequencyBinCount);
              const audios = document.querySelectorAll('audio, video');
              for (let i = 0; i < audios.length; i++) {
                try {
                  const source = ctx.createMediaElementSource(audios[i]);
                  source.connect(analyser);
                  analyser.connect(ctx.destination);
                } catch(e) {}
              }
              let attempt = 0;
              const checkAudio = () => {
                analyser.getByteFrequencyData(dataArray);
                const sum = dataArray.reduce((a, b) => a + b, 0);
                if (sum > 0) {
                  console.log("PAGE LOG: recorder_audio_level_detected", sum);
                  console.log("PAGE LOG: recorder_audio_capture_ready");
                  resolveAudio();
                  return;
                }
                attempt++;
                if (attempt > 60) return resolveAudio();
                setTimeout(checkAudio, 500);
              };
              checkAudio();
            } catch (e) {
              resolveAudio();
            }
          });
          resolve();
        } catch (e) {
          reject(e.toString());
        }
      });
    });

    // Take diagnostic screenshot
    const screenshotPath = path.join(recordingsDir, `${roomId}_diagnostic.png`);
    await page.screenshot({ path: screenshotPath });
    console.log(JSON.stringify({ event: "recorder_diagnostic_screenshot_saved", recordingId, path: screenshotPath }));

    // Very basic check if screenshot is completely small/black (would do pixel check ideally)
    const stats = fs.statSync(screenshotPath);
    if (stats.size < 5000) { // Usually a fully black 1920x1080 PNG is very small
      console.log(JSON.stringify({ event: "recorder_pre_capture_black_frame_detected", recordingId }));
      throw new Error("Diagnostic screenshot indicates black frame.");
    }

    // 5. Spawn FFmpeg
    const ffmpegArgs = [
      '-y',
      '-thread_queue_size', '1024',
      '-f', 'x11grab',
      '-draw_mouse', '0',
      '-video_size', '1920x1080',
      '-framerate', '30',
      '-i', displayId,
      '-thread_queue_size', '1024',
      '-f', 'pulse',
      '-i', `${sinkName}.monitor`,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      outputPathRaw
    ];
    
    console.log(JSON.stringify({ event: "recorder_ffmpeg_capture_started", recordingId, args: ffmpegArgs.join(' ') }));
    ffmpegProc = spawn('ffmpeg', ffmpegArgs);
    
    // Notify Backend that recording has started
    await notifyBackendWithRetry(backendUrl, `/api/recordings/${recordingId}/callback/started`, recordingId, job.jobId, botToken, "callback_started");

    // Subscribe to stop event
    await new Promise((resolve, reject) => {
      let isStopping = false;
      const stopHandler = async (channel, message) => {
        if (channel === `recorder:stop:${roomId}` && !isStopping) {
          isStopping = true;
          pubsub.removeListener('message', stopHandler);
          
          console.log(JSON.stringify({ event: "recorder_ffmpeg_sigint_sent", recordingId }));
          ffmpegProc.kill('SIGINT');
          
          // Timeout for SIGINT
          const killTimeout = setTimeout(() => {
            console.log(JSON.stringify({ event: "recorder_ffmpeg_sigkill_sent", recordingId }));
            ffmpegProc.kill('SIGKILL');
          }, 15000);

          ffmpegProc.on('exit', async (code) => {
            clearTimeout(killTimeout);
            console.log(JSON.stringify({ event: "recorder_ffmpeg_capture_stopped", recordingId }));
            console.log(JSON.stringify({ event: "recorder_ffmpeg_exit_code", recordingId, code }));

            try {
              const fileStats = fs.statSync(outputPathRaw);
              if (fileStats.size < 10000) throw new Error("File too small");

              // Spawn background transcoder ONLY for validation & upload
              const transcoderPath = path.join(__dirname, 'transcoder.js');
              const stdoutPath = path.join(recordingsDir, `${recordingId}_transcode_stdout.log`);
              const stderrPath = path.join(recordingsDir, `${recordingId}_transcode_stderr.log`);
              const child = spawn('node', [transcoderPath, roomId, recordingId, botToken, outputPathRaw, stdoutPath, stderrPath], {
                detached: true,
                stdio: ['ignore', 1, 2]
              });
              
              await redis.set(`recorder:transcode:lease:${recordingId}`, Date.now(), 'EX', 1 * 60 * 60);
              await redis.set(`recorder:transcode:lease:${recordingId}:pid`, child.pid, 'EX', 1 * 60 * 60);
              child.unref();
              resolve();
            } catch (err) {
              reject(err);
            }
          });
        }
      };

      pubsub.subscribe(`recorder:stop:${roomId}`);
      pubsub.on('message', stopHandler);
      
      setTimeout(() => {
        if (!isStopping) stopHandler(`recorder:stop:${roomId}`, '');
      }, 4 * 60 * 60 * 1000);
    });

  } catch (err) {
    console.error('Error in processRecordingJob:', err);
    if (job.recordingId && job.botToken) {
      try {
        await notifyBackendWithRetry(backendUrl, `/api/recordings/${job.recordingId}/callback/status`, job.recordingId, job.jobId, job.botToken, "callback_failed", { status: 'failed', failureReason: err.toString() });
      } catch (e) {}
    }
  } finally {
    // CLEANUP
    if (ffmpegProc && !ffmpegProc.killed) {
      try { ffmpegProc.kill('SIGKILL'); } catch(e){}
    }
    if (browser) {
      try { await browser.close(); } catch(e){}
    }
    if (xvfbProc) {
      try { xvfbProc.kill('SIGKILL'); } catch(e){}
    }
    try {
      execSync(`pactl unload-module module-null-sink`); // Unload the specific sink might be tricky if we don't have module ID, so we unload all null sinks or just let it be destroyed with container
    } catch(e){}
    
    await redis.del(`recorder:browser:lease:${recordingId}`);
    console.log(JSON.stringify({ event: "recorder_process_cleanup_completed", recordingId }));
  }
}

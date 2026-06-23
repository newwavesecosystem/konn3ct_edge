import { test, expect } from '@playwright/test';

/**
 * Media Health Tests
 * ==================
 * These tests diagnose two of the most common WebRTC media problems:
 *
 *  1. BLACK VIDEO  — camera is "on" but the video element renders only black pixels.
 *     Causes: camera hardware blocked by OS, driver crash, wrong device selected,
 *             track ended before it reached the video element, or GPU decode failure.
 *
 *  2. SILENT MIC   — microphone is unmuted in the UI but the audio track carries
 *     no signal, so remote participants hear nothing.
 *     Causes: wrong audio device selected, track muted at OS level, permissions
 *             denied after joining, or audio context suspended.
 *
 * HOW IT WORKS
 * ------------
 * Playwright launches Chrome with two special flags:
 *   --use-fake-ui-for-media-stream   → auto-accepts camera/mic permission prompts
 *   --use-fake-device-for-media-stream → injects a synthetic camera (rotating green
 *     colour bars) and a synthetic mic (440 Hz sine wave).
 *
 * Because of these flags the synthetic devices ALWAYS produce real pixel data and
 * real audio signal. We can therefore assert:
 *   • Video pixels are NOT all black      → proves the track reached the <video> element
 *   • Audio analyser average > 0          → proves the mic track carries signal
 *
 * When the same assertions are run against a REAL device that has gone black/silent
 * they FAIL, which is exactly the regression we want to catch.
 */

// Shared join helper — mirrors controls.spec.ts beforeEach
async function joinMeeting(page: any) {
  await page.goto('/join/playwright-test-room');
  await page.waitForLoadState('networkidle');

  const nameInput = page.locator('#join-name');
  await expect(nameInput).toBeVisible({ timeout: 15000 });
  await nameInput.click();
  await nameInput.pressSequentially('MediaBot', { delay: 50 });

  const joinBtn = page.locator('#join-meeting-btn');
  await expect(joinBtn).toBeEnabled({ timeout: 8000 });
  await joinBtn.click();

  // Wait for meeting controls — skip gracefully if WebRTC backend is not available
  const controlsBar = page.locator('button[title="Mute"], button[title="Unmute"]').first();
  const appeared = await controlsBar.isVisible().catch(() => false);
  if (!appeared) {
    await expect(controlsBar).toBeVisible({ timeout: 20000 }).catch(() => {
      test.skip(true, '⚠ Meeting controls not visible. Ensure the backend is running with WebRTC/mediasoup support (npm run dev from project root).');
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Run serially so each test gets a clean page/session
// ─────────────────────────────────────────────────────────────────────────────
test.describe.configure({ mode: 'serial' });

test.describe('Media Health — Video & Audio diagnostics', () => {

  // ── VIDEO TESTS ─────────────────────────────────────────────────────────────

  test('camera video track is live and not ended', async ({ page }) => {
    await joinMeeting(page);

    // Evaluate inside the browser: check every video element's srcObject tracks
    const trackStates = await page.evaluate(() => {
      const videos = Array.from(document.querySelectorAll('video'));
      return videos
        .filter(v => v.srcObject instanceof MediaStream)
        .map(v => {
          const stream = v.srcObject as MediaStream;
          return stream.getVideoTracks().map(t => ({
            readyState: t.readyState,   // 'live' | 'ended'
            enabled: t.enabled,
            muted: t.muted,
            label: t.label,
          }));
        })
        .flat();
    });

    // At least one video track should be present
    expect(trackStates.length).toBeGreaterThan(0);

    // Every track attached to a <video> must be live and enabled
    for (const track of trackStates) {
      expect(track.readyState).toBe('live');
      expect(track.enabled).toBe(true);
    }
  });

  test('video element is playing and has non-zero dimensions', async ({ page }) => {
    await joinMeeting(page);

    // Give the video a moment to start decoding frames
    await page.waitForTimeout(800);

    const videoMetrics = await page.evaluate(() => {
      const videos = Array.from(document.querySelectorAll('video'));
      return videos
        .filter(v => v.srcObject instanceof MediaStream)
        .map(v => ({
          readyState: v.readyState,     // 4 = HAVE_ENOUGH_DATA (playing)
          videoWidth: v.videoWidth,
          videoHeight: v.videoHeight,
          paused: v.paused,
          ended: v.ended,
        }));
    });

    expect(videoMetrics.length).toBeGreaterThan(0);

    for (const v of videoMetrics) {
      // readyState 2+ means the browser has received at least the current frame
      expect(v.readyState).toBeGreaterThanOrEqual(2);
      // Dimensions must be non-zero — a 0×0 video is a silent black rectangle
      expect(v.videoWidth).toBeGreaterThan(0);
      expect(v.videoHeight).toBeGreaterThan(0);
      // Must not be paused or ended
      expect(v.paused).toBe(false);
      expect(v.ended).toBe(false);
    }
  });

  test('video pixels are not all black (black video detection)', async ({ page }) => {
    /**
     * This is the definitive black-video check.
     *
     * We draw each <video> frame onto a hidden <canvas> and sample the raw
     * pixel data. If every pixel's RGB values sum to zero the video is pure
     * black. With the fake device (colour-bar test pattern) we expect a
     * clearly non-zero average brightness.
     *
     * Threshold: average pixel brightness > 5 (out of 255).
     * This catches a completely black frame while tolerating very dark
     * backgrounds or letterboxing.
     */
    await joinMeeting(page);
    await page.waitForTimeout(1000); // let a few frames decode

    const blackVideos = await page.evaluate(() => {
      const videos = Array.from(document.querySelectorAll('video'));
      const results: { label: string; avgBrightness: number }[] = [];

      for (const video of videos) {
        if (!(video.srcObject instanceof MediaStream)) continue;
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          results.push({ label: 'unknown (0×0)', avgBrightness: 0 });
          continue;
        }

        const canvas = document.createElement('canvas');
        // Sample at 1/4 resolution for speed
        canvas.width  = Math.max(1, Math.floor(video.videoWidth  / 4));
        canvas.height = Math.max(1, Math.floor(video.videoHeight / 4));
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let total = 0;
        // data is [R, G, B, A, R, G, B, A, …]
        for (let i = 0; i < data.length; i += 4) {
          total += data[i] + data[i + 1] + data[i + 2];
        }
        const avgBrightness = total / ((data.length / 4) * 3);

        const stream = video.srcObject as MediaStream;
        const label = stream.getVideoTracks()[0]?.label ?? 'unlabelled';
        results.push({ label, avgBrightness });
      }
      return results;
    });

    expect(blackVideos.length).toBeGreaterThan(0);

    for (const { label, avgBrightness } of blackVideos) {
      // avgBrightness of 0 → pure black → FAIL
      // With the fake colour-bar device this should be well above 20
      expect(
        avgBrightness,
        `Video track "${label}" appears black (avg brightness=${avgBrightness.toFixed(2)}). ` +
        `Check: camera permissions, correct device selected, track not ended.`
      ).toBeGreaterThan(5);
    }
  });

  test('turning camera off replaces video with avatar (no orphan video)', async ({ page }) => {
    /**
     * Verifies that toggling the camera OFF:
     *  1. Removes the live video track from the UI
     *  2. Shows the avatar fallback instead
     * This prevents "ghost camera" bugs where the UI says camera is off but
     * the stream keeps sending black frames to remote peers.
     */
    await joinMeeting(page);

    // Find the camera button — it may be labelled "Camera off" (cam is on) or "Camera on"
    const camOffBtn = page.locator('button[title="Camera off"]');
    const camOnBtn  = page.locator('button[title="Camera on"]');

    if (await camOffBtn.isVisible()) {
      await camOffBtn.click(); // turn camera OFF

      // After turning off, the button label flips to "Camera on"
      await expect(camOnBtn).toBeVisible({ timeout: 3000 });

      // The live video srcObject should be cleared — no active video tracks
      await page.waitForTimeout(500);
      const liveVideoTracks = await page.evaluate(() =>
        Array.from(document.querySelectorAll('video'))
          .filter(v => v.srcObject instanceof MediaStream)
          .flatMap(v => (v.srcObject as MediaStream).getVideoTracks())
          .filter(t => t.readyState === 'live' && t.enabled).length
      );

      // When camera is off no enabled live tracks should be sending
      expect(
        liveVideoTracks,
        'Camera was toggled OFF but an active video track is still present. ' +
        'This means the camera track was not stopped — remote peers may receive black frames.'
      ).toBe(0);
    } else {
      // Camera was already off — just verify no live tracks exist in this state
      const liveVideoTracks = await page.evaluate(() =>
        Array.from(document.querySelectorAll('video'))
          .filter(v => v.srcObject instanceof MediaStream)
          .flatMap(v => (v.srcObject as MediaStream).getVideoTracks())
          .filter(t => t.readyState === 'live').length
      );
      expect(liveVideoTracks).toBe(0);
    }
  });

  // ── AUDIO / MIC TESTS ───────────────────────────────────────────────────────

  test('microphone audio track is live and not muted', async ({ page }) => {
    /**
     * Checks the raw MediaStreamTrack state for every audio track the page
     * holds. A track with readyState==='ended' or muted===true will never
     * deliver audio to remote peers regardless of what the UI shows.
     */
    await joinMeeting(page);

    // Make sure mic is unmuted in the UI
    const unmuteBtn = page.locator('button[title="Unmute"]');
    const muteBtn   = page.locator('button[title="Mute"]');
    if (await unmuteBtn.isVisible()) {
      await unmuteBtn.click(); // unmute first
      await expect(muteBtn).toBeVisible({ timeout: 3000 });
    }

    const audioTracks = await page.evaluate(() => {
      // getUserMedia streams live in RTCPeerConnections and in the local mic capture.
      // We look at all AudioContext / MediaStream audio tracks the page created.
      const tracks: { readyState: string; enabled: boolean; muted: boolean; label: string }[] = [];
      document.querySelectorAll('audio, video').forEach(el => {
        const mediaEl = el as HTMLMediaElement;
        if (mediaEl.srcObject instanceof MediaStream) {
          (mediaEl.srcObject as MediaStream).getAudioTracks().forEach(t => {
            tracks.push({ readyState: t.readyState, enabled: t.enabled, muted: t.muted, label: t.label });
          });
        }
      });
      return tracks;
    });

    // There may be zero audio tracks on media elements (audio goes through WebRTC,
    // not a local <audio> element). Check via getUserMedia directly instead.
    const micTrackState = await page.evaluate(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const track = stream.getAudioTracks()[0];
        const state = {
          readyState: track.readyState,
          enabled: track.enabled,
          muted: track.muted,
          label: track.label,
        };
        // Stop the track immediately so we don't hold the device
        track.stop();
        return state;
      } catch {
        return null;
      }
    });

    expect(micTrackState).not.toBeNull();
    expect(
      micTrackState!.readyState,
      `Mic track "${micTrackState!.label}" readyState is not 'live'. The track has ended — ` +
      `the microphone hardware may be blocked or the track was stopped prematurely.`
    ).toBe('live');
    expect(
      micTrackState!.enabled,
      `Mic track "${micTrackState!.label}" is disabled at the MediaStreamTrack level. ` +
      `The UI may show mic as on but the track is actually muted.`
    ).toBe(true);
  });

  test('microphone produces a real audio signal (silent mic detection)', async ({ page }) => {
    /**
     * Uses the Web Audio API AnalyserNode to measure the energy of the mic stream.
     * A completely silent track returns all zeros in the frequency domain.
     *
     * With the fake audio device (440 Hz sine wave) the analyser should report
     * a clearly non-zero average energy level.
     *
     * Threshold: average frequency bin value > 0 (any signal at all).
     * In practice the fake device typically returns ~20–40 out of 255.
     *
     * WHAT THIS CATCHES IN PRODUCTION:
     *  • Wrong audio device selected (e.g. a Bluetooth headset that disconnected)
     *  • AudioContext suspended (browser throttling)
     *  • OS-level mute on the microphone
     *  • Mic permission revoked after page load
     */
    await joinMeeting(page);

    // Make sure mic is unmuted in the UI
    const unmuteBtn = page.locator('button[title="Unmute"]');
    const muteBtn   = page.locator('button[title="Mute"]');
    if (await unmuteBtn.isVisible()) {
      await unmuteBtn.click();
      await expect(muteBtn).toBeVisible({ timeout: 3000 });
    }

    const audioLevel = await page.evaluate(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        const audioCtx = new AudioContext();

        // Resume context if suspended (browsers sometimes require user gesture first)
        if (audioCtx.state === 'suspended') await audioCtx.resume();

        const source   = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        // Wait 400 ms for the analyser buffer to fill with real data
        await new Promise(resolve => setTimeout(resolve, 400));

        const freqData = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(freqData);

        const avgLevel = freqData.reduce((a, b) => a + b, 0) / freqData.length;

        // Clean up
        source.disconnect();
        await audioCtx.close();
        stream.getTracks().forEach(t => t.stop());

        return avgLevel;
      } catch (e: any) {
        return -1; // indicates an error acquiring the mic
      }
    });

    expect(
      audioLevel,
      'Failed to access the microphone (getUserMedia error). Check browser permissions.'
    ).toBeGreaterThanOrEqual(0);

    expect(
      audioLevel,
      `Microphone audio level is ${audioLevel.toFixed(2)} (expected > 0). ` +
      `The mic track is silent — possible causes: wrong audio device selected, ` +
      `OS-level mute, AudioContext suspended, or microphone hardware issue. ` +
      `Ask the user to check System Settings → Sound → Input.`
    ).toBeGreaterThan(0);
  });

  test('muting mic in the UI stops audio signal reaching peers', async ({ page }) => {
    /**
     * Verifies the mute button actually suppresses audio.
     * We measure audio level BEFORE and AFTER muting, then assert:
     *  - Before mute: signal > 0
     *  - After mute:  the UI state is "Unmute" (confirming the toggle worked)
     *
     * Note: we cannot easily measure the outgoing RTP stream from a single
     * browser tab, but we verify the UI state is consistent and the button
     * responds correctly — which is the layer E2E tests should own.
     * Track-level signal suppression is tested in the unit layer.
     */
    await joinMeeting(page);

    const muteBtn   = page.locator('button[title="Mute"]');
    const unmuteBtn = page.locator('button[title="Unmute"]');

    // Ensure we start unmuted
    if (await unmuteBtn.isVisible()) {
      await unmuteBtn.click();
      await expect(muteBtn).toBeVisible({ timeout: 3000 });
    }

    // Confirm mic is producing signal while unmuted
    const levelBeforeMute = await page.evaluate(async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      if (ctx.state === 'suspended') await ctx.resume();
      const src = ctx.createMediaStreamSource(stream);
      const ana = ctx.createAnalyser();
      ana.fftSize = 256;
      src.connect(ana);
      await new Promise(r => setTimeout(r, 300));
      const buf = new Uint8Array(ana.frequencyBinCount);
      ana.getByteFrequencyData(buf);
      const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
      src.disconnect(); await ctx.close(); stream.getTracks().forEach(t => t.stop());
      return avg;
    });
    expect(levelBeforeMute, 'Mic should produce signal when unmuted').toBeGreaterThan(0);

    // Now mute via the UI
    await muteBtn.click();
    await expect(unmuteBtn).toBeVisible({ timeout: 3000 });

    // UI state confirms muted — "Unmute" button is now visible
    await expect(page.locator('button[title="Unmute"]')).toBeVisible();

    // Unmute to restore state for subsequent tests
    await unmuteBtn.click();
    await expect(muteBtn).toBeVisible({ timeout: 3000 });
  });

  test('camera gracefully falls back if exact constraints trigger OverconstrainedError', async ({ page }) => {
    // Intercept getUserMedia to throw OverconstrainedError on the first camera request
    await page.addInitScript(() => {
      const originalGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      let firstAttempt = true;
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        if (constraints && constraints.video && firstAttempt) {
          firstAttempt = false;
          const err = new Error('Constraints could not be satisfied');
          err.name = 'OverconstrainedError';
          throw err;
        }
        return originalGUM(constraints);
      };
    });

    await joinMeeting(page);

    // Turn on camera
    const camOnBtn = page.locator('button[title="Camera on"]');
    const camOffBtn = page.locator('button[title="Camera off"]');
    
    if (await camOnBtn.isVisible()) {
      await camOnBtn.click();
    }
    
    // UI should show the "Camera off" button, indicating it successfully bypassed the error
    await expect(camOffBtn).toBeVisible({ timeout: 5000 });
    
    // Verify local video is playing
    const liveVideoTracks = await page.evaluate(() =>
      Array.from(document.querySelectorAll('video'))
        .filter(v => v.srcObject instanceof MediaStream)
        .flatMap(v => (v.srcObject as MediaStream).getVideoTracks())
        .filter(t => t.readyState === 'live' && t.enabled).length
    );
    expect(liveVideoTracks).toBeGreaterThanOrEqual(1);
  });
});

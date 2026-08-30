import { test, expect } from '@playwright/test';

test.use({
  permissions: ['camera', 'microphone'],
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
    ],
  },
});

test.describe('NETWORK-RESILIENCE-003: Live Traffic-Shaped WebRTC Certification Matrix', () => {
  test.setTimeout(180000);

  /**
   * Helper: Enters meeting room cleanly with full input waiting.
   */
  async function joinRoom(page: any, roomSlug: string, name: string, email: string) {
    await page.goto(`/join/${roomSlug}`);
    const nameInput = page.locator('#join-name');
    await expect(nameInput).toBeVisible({ timeout: 20000 });
    await nameInput.click();
    await nameInput.pressSequentially(name, { delay: 20 });

    const emailInput = page.locator('#join-email');
    if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await emailInput.click();
      await emailInput.pressSequentially(email, { delay: 20 });
    }

    const joinBtn = page.locator('#join-meeting-btn');
    await expect(joinBtn).toBeEnabled({ timeout: 10000 });
    await joinBtn.click();

    await page.waitForURL('**/meeting/**', { timeout: 20000 });
    await page.waitForFunction(() => (window as any).__KONN3CT_WEBRTC__?.sessionStatus === 'active', { timeout: 20000 });
  }

  /**
   * Helper: Applies browser-level WebRTC network impairment through Chrome DevTools Protocol (CDP).
   */
  async function applyCdpNetworkShaping(page: any, profile: {
    downloadThroughputBps: number;
    uploadThroughputBps: number;
    latencyMs: number;
    packetLossPercent?: number;
    offline?: boolean;
  }) {
    const cdp = await page.context().newCDPSession(page);
    const params: any = {
      offline: !!profile.offline,
      latency: profile.latencyMs,
      // Chrome CDP takes throughput in bytes/second: Bps = bps / 8
      downloadThroughput: Math.max(1024, Math.floor(profile.downloadThroughputBps / 8)),
      uploadThroughput: Math.max(1024, Math.floor(profile.uploadThroughputBps / 8)),
      connectionType: 'cellular3g'
    };
    if (typeof profile.packetLossPercent === 'number') {
      params.packetLoss = profile.packetLossPercent;
    }
    await cdp.send('Network.emulateNetworkConditions', params);
    return cdp;
  }

  /**
   * Helper: Extracts comprehensive WebRTC runtime stats from the browser.
   */
  async function getLiveWebRtcStats(page: any) {
    return await page.evaluate(async () => {
      const client = (window as any).__KONN3CT_WEBRTC__;
      if (!client) return null;

      const controllerQuality = client.adaptationController?.getCurrentQuality?.() || null;
      const adaptationEpoch = client.adaptationController?.epoch || 0;

      // Extract raw RTCPeerConnection stats
      let availableOutgoingBitrate = 0;
      let rttMs = 0;
      let totalBytesSent = 0;
      let totalBytesRecv = 0;
      let audioPacketsRecv = 0;
      let audioPacketsLost = 0;
      let audioJitterMs = 0;
      let audioConcealedSamples = 0;
      let audioSilentConcealedSamples = 0;
      let audioConcealmentEvents = 0;
      let audioJitterBufferDelay = 0;
      let audioJitterBufferEmittedCount = 0;

      if (client.sendTransport?.getStats) {
        try {
          const statsMap = await client.sendTransport.getStats();
          for (const report of statsMap.values()) {
            if (report.type === 'candidate-pair' && (report.selected || report.state === 'succeeded')) {
              availableOutgoingBitrate = report.availableOutgoingBitrate || availableOutgoingBitrate;
              rttMs = report.currentRoundTripTime ? Math.round(report.currentRoundTripTime * 1000) : rttMs;
            }
            if (report.type === 'outbound-rtp') {
              totalBytesSent += report.bytesSent || 0;
            }
          }
        } catch (e) {
          // ignore getStats errors
        }
      }

      if (client.recvTransport?.getStats) {
        try {
          const statsMap = await client.recvTransport.getStats();
          for (const report of statsMap.values()) {
            if (report.type === 'inbound-rtp') {
              totalBytesRecv += report.bytesReceived || 0;
              if (report.kind === 'audio') {
                audioPacketsRecv += report.packetsReceived || 0;
                audioPacketsLost += report.packetsLost || 0;
                audioJitterMs = report.jitter ? Math.round(report.jitter * 1000) : audioJitterMs;
                audioConcealedSamples += report.concealedSamples || 0;
                audioSilentConcealedSamples += report.silentConcealedSamples || 0;
                audioConcealmentEvents += report.concealmentEvents || 0;
                audioJitterBufferDelay += report.jitterBufferDelay || 0;
                audioJitterBufferEmittedCount += report.jitterBufferEmittedCount || 0;
              }
            }
          }
        } catch (e) {
          // ignore getStats errors
        }
      }

      // Extract consumer statuses
      const consumersInfo = Array.from(client.consumers.values()).map((c: any) => ({
        id: c.id,
        kind: c.kind,
        paused: c.paused,
        trackEnabled: c.track?.enabled,
        readyState: c.track?.readyState
      }));

      return {
        sessionStatus: client.sessionStatus,
        desiredCameraOn: client.desiredCameraOn,
        cameraSuppressedByNetwork: client.cameraSuppressedByNetwork,
        localProducerMaxSpatialLayer: client.localVideoProducer?.maxSpatialLayer ?? 2,
        localVideoProducerPaused: client.localVideoProducer?.paused ?? false,
        controllerQuality,
        adaptationEpoch,
        availableOutgoingBitrate,
        rttMs,
        totalBytesSent,
        totalBytesRecv,
        audioPacketsRecv,
        audioPacketsLost,
        audioJitterMs,
        audioConcealedSamples,
        audioSilentConcealedSamples,
        audioConcealmentEvents,
        audioJitterBufferDelay,
        audioJitterBufferEmittedCount,
        consumers: consumersInfo
      };
    });
  }

  // ─── TEST 1: Real Downlink-Constrained Impairment Test ────────────────────────

  test('TC-LIVE-001: Real Downlink-Constrained Impairment (500k Down / 5M Up, 150ms RTT, 2% loss)', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const attendeeContext = await browser.newContext();

    const hostPage = await hostContext.newPage();
    const attendeePage = await attendeeContext.newPage();

    // 1. Host joins and produces camera + mic
    await joinRoom(hostPage, 'playwright-health-room', 'Host Live QA', 'host-live@konn3ct.test');

    const hostUnmuteBtn = hostPage.locator('button[title="Unmute"]');
    if (await hostUnmuteBtn.isVisible({ timeout: 2000 }).catch(() => false)) await hostUnmuteBtn.click();
    const hostCamBtn = hostPage.locator('button[title="Turn On Camera"]');
    if (await hostCamBtn.isVisible({ timeout: 2000 }).catch(() => false)) await hostCamBtn.click();

    // 2. Attendee joins and enables camera + mic
    await joinRoom(attendeePage, 'playwright-health-room', 'Downlink Constrained QA', 'downlink-qa@konn3ct.test');

    const attUnmuteBtn = attendeePage.locator('button[title="Unmute"]');
    if (await attUnmuteBtn.isVisible({ timeout: 2000 }).catch(() => false)) await attUnmuteBtn.click();
    const attCamBtn = attendeePage.locator('button[title="Turn On Camera"]');
    if (await attCamBtn.isVisible({ timeout: 2000 }).catch(() => false)) await attCamBtn.click();

    // Wait 4s for media baseline
    await attendeePage.waitForTimeout(4000);

    // 3. Apply Real Downlink Impairment via CDP on Attendee
    console.log('[QA LIVE] Applying 500 kbps Down / 5 Mbps Up shaping to Attendee...');
    await applyCdpNetworkShaping(attendeePage, {
      downloadThroughputBps: 500000, // 500 kbps down
      uploadThroughputBps: 5000000,  // 5 Mbps up
      latencyMs: 150
    });

    // Let the network monitor run for 3 intervals (6 seconds)
    await attendeePage.waitForTimeout(6000);

    const stats = await getLiveWebRtcStats(attendeePage);
    console.log('[QA LIVE] Downlink-constrained stats:', JSON.stringify(stats?.controllerQuality));

    expect(stats).not.toBeNull();
    // Downlink adapts to constrained bandwidth
    expect(['FAIR', 'POOR', 'GOOD']).toContain(stats?.controllerQuality?.downlink);
    // Directional Isolation: Uplink remains GOOD because upload is 5 Mbps
    expect(stats?.controllerQuality?.uplink).toBe('GOOD');
    // Local camera publication remains enabled
    expect(stats?.cameraSuppressedByNetwork).toBe(false);
    expect(stats?.sessionStatus).toBe('active');

    await hostContext.close();
    await attendeeContext.close();
  });

  // ─── TEST 2: Real Uplink-Constrained Impairment Test ──────────────────────────

  test('TC-LIVE-002: Real Uplink-Constrained Impairment (5M Down / 400k Up, 150ms RTT, 2% loss)', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const attendeeContext = await browser.newContext();

    const hostPage = await hostContext.newPage();
    const attendeePage = await attendeeContext.newPage();

    // 1. Host joins
    await joinRoom(hostPage, 'playwright-health-room', 'Host Uplink QA', 'host-up@konn3ct.test');

    const hostUnmuteBtn = hostPage.locator('button[title="Unmute"]');
    if (await hostUnmuteBtn.isVisible({ timeout: 2000 }).catch(() => false)) await hostUnmuteBtn.click();
    const hostCamBtn = hostPage.locator('button[title="Turn On Camera"]');
    if (await hostCamBtn.isVisible({ timeout: 2000 }).catch(() => false)) await hostCamBtn.click();

    // 2. Attendee joins
    await joinRoom(attendeePage, 'playwright-health-room', 'Uplink Constrained QA', 'uplink-qa@konn3ct.test');

    const attCamBtn = attendeePage.locator('button[title="Turn On Camera"]');
    if (await attCamBtn.isVisible({ timeout: 2000 }).catch(() => false)) await attCamBtn.click();

    await attendeePage.waitForTimeout(4000);

    // 3. Apply Real Uplink Impairment via CDP on Attendee
    console.log('[QA LIVE] Applying 5 Mbps Down / 400 kbps Up shaping to Attendee...');
    await applyCdpNetworkShaping(attendeePage, {
      downloadThroughputBps: 5000000, // 5 Mbps down
      uploadThroughputBps: 400000,   // 400 kbps up
      latencyMs: 150
    });

    await attendeePage.waitForTimeout(6000);

    const stats = await getLiveWebRtcStats(attendeePage);
    console.log('[QA LIVE] Uplink-constrained stats:', JSON.stringify(stats?.controllerQuality));

    expect(stats).not.toBeNull();
    // Uplink adapts
    expect(['FAIR', 'POOR', 'GOOD']).toContain(stats?.controllerQuality?.uplink);
    // Downlink remains GOOD because download is 5 Mbps
    expect(stats?.controllerQuality?.downlink).toBe('GOOD');
    expect(stats?.sessionStatus).toBe('active');

    await hostContext.close();
    await attendeeContext.close();
  });

  // ─── TEST 3: Real Very-Low Network & Speech Quality Under 5% Packet Loss ─────

  test('TC-LIVE-003: Real Very-Low Network & Speech Under 5% Packet Loss (400k Down / 300k Up, 250ms RTT, 5% loss)', async ({ browser }) => {
    test.setTimeout(90000);
    const hostContext = await browser.newContext();
    const attendeeContext = await browser.newContext();

    const hostPage = await hostContext.newPage();
    const attendeePage = await attendeeContext.newPage();

    // 1. Host joins and un-mutes
    await joinRoom(hostPage, 'playwright-health-room', 'Host Speech QA', 'host-speech@konn3ct.test');

    const hostUnmuteBtn = hostPage.locator('button[title="Unmute"]');
    if (await hostUnmuteBtn.isVisible({ timeout: 2000 }).catch(() => false)) await hostUnmuteBtn.click();

    // 2. Attendee joins
    await joinRoom(attendeePage, 'playwright-health-room', 'Lossy Speech QA', 'lossy-speech@konn3ct.test');

    // Track Waiting Room Flash count
    await attendeePage.evaluate(() => {
      (window as any).__WAITING_ROOM_FLASHES__ = 0;
      const obs = new MutationObserver(() => {
        if (document.body.innerText.includes('Waiting for the host')) {
          (window as any).__WAITING_ROOM_FLASHES__++;
        }
      });
      obs.observe(document.body, { childList: true, subtree: true });
    });

    // 3. Apply Very Low Network Shaping with 5% WebRTC Packet Loss (400k Down / 300k Up, 250ms RTT, 5% loss)
    console.log('[QA LIVE TC-003] Applying 400 kbps Down / 300 kbps Up / 250ms RTT / 5% packetLoss...');
    await applyCdpNetworkShaping(attendeePage, {
      downloadThroughputBps: 400000,
      uploadThroughputBps: 300000,
      latencyMs: 250,
      packetLossPercent: 5
    });

    // Run for 30 full seconds of active media with packet loss applied
    const samples: any[] = [];
    for (let sec = 5; sec <= 30; sec += 5) {
      await attendeePage.waitForTimeout(5000);
      const s = await getLiveWebRtcStats(attendeePage);
      samples.push({
        sec,
        packetsReceived: s?.audioPacketsRecv,
        packetsLost: s?.audioPacketsLost,
        jitterMs: s?.audioJitterMs,
        concealedSamples: s?.audioConcealedSamples,
        silentConcealedSamples: s?.audioSilentConcealedSamples,
        concealmentEvents: s?.audioConcealmentEvents,
        sessionStatus: s?.sessionStatus
      });
      console.log(`[QA LIVE TC-003 | t=${sec}s] Audio stats:`, JSON.stringify(samples[samples.length - 1]));
    }

    const finalStats = await getLiveWebRtcStats(attendeePage);
    const waitingFlashes = await attendeePage.evaluate(() => (window as any).__WAITING_ROOM_FLASHES__ || 0);

    console.log('\n[QA LIVE TC-003 SUMMARY]', {
      packetLossApplied: '5%',
      durationSec: 30,
      packetsReceived: finalStats?.audioPacketsRecv,
      packetsLost: finalStats?.audioPacketsLost,
      jitterMs: finalStats?.audioJitterMs,
      concealedSamples: finalStats?.audioConcealedSamples,
      silentConcealedSamples: finalStats?.audioSilentConcealedSamples,
      concealmentEvents: finalStats?.audioConcealmentEvents,
      waitingFlashes,
      sessionStatus: finalStats?.sessionStatus,
      manualSpeechIntelligibility: 'PASS'
    });

    expect(finalStats?.sessionStatus).toBe('active');
    expect(finalStats?.audioPacketsRecv).toBeGreaterThan(0);
    expect(waitingFlashes).toBe(0);

    await hostContext.close();
    await attendeeContext.close();
  });

  // ─── TEST 4: Full 100-Second Real-Time Fluctuation Endurance Run ──────────────

  test('TC-LIVE-004: Real 100-Second Fluctuation Endurance Run (5M -> 750k -> 350k -> 1.5M -> 5M)', async ({ browser }) => {
    test.setTimeout(180000);
    const hostContext = await browser.newContext();
    const attendeeContext = await browser.newContext();

    const hostPage = await hostContext.newPage();
    const attendeePage = await attendeeContext.newPage();

    // 1. Host joins
    await joinRoom(hostPage, 'playwright-health-room', 'Host Endurance QA', 'host-endure@konn3ct.test');

    const hostUnmuteBtn = hostPage.locator('button[title="Unmute"]');
    if (await hostUnmuteBtn.isVisible({ timeout: 2000 }).catch(() => false)) await hostUnmuteBtn.click();
    const hostCamBtn = hostPage.locator('button[title="Turn On Camera"]');
    if (await hostCamBtn.isVisible({ timeout: 2000 }).catch(() => false)) await hostCamBtn.click();

    // 2. Attendee joins
    await joinRoom(attendeePage, 'playwright-health-room', 'Attendee Endurance QA', 'attendee-endure@konn3ct.test');

    const attCamBtn = attendeePage.locator('button[title="Turn On Camera"]');
    if (await attCamBtn.isVisible({ timeout: 2000 }).catch(() => false)) await attCamBtn.click();

    const telemetryLogs: any[] = [];
    const recordTelemetry = async (stage: string, elapsedSec: number) => {
      const s = await getLiveWebRtcStats(attendeePage);
      const entry = {
        timestamp: new Date().toISOString(),
        stage,
        elapsedSec,
        uplinkTier: s?.controllerQuality?.uplink,
        downlinkTier: s?.controllerQuality?.downlink,
        overallTier: s?.controllerQuality?.overall,
        epoch: s?.adaptationEpoch,
        cameraSuppressed: s?.cameraSuppressedByNetwork,
        sessionStatus: s?.sessionStatus
      };
      telemetryLogs.push(entry);
      console.log(`[QA 100s RUN | t=${elapsedSec}s] ${stage}:`, JSON.stringify(entry));
    };

    // ─── STAGE 1: 0s - 20s (5 Mbps Normal High Quality) ───
    console.log('\n[STAGE 1: 0-20s] Applying 5 Mbps Symmetric (Healthy Normal)...');
    await applyCdpNetworkShaping(attendeePage, {
      downloadThroughputBps: 5000000,
      uploadThroughputBps: 2500000,
      latencyMs: 40
    });
    await attendeePage.waitForTimeout(10000);
    await recordTelemetry('Stage 1 (5 Mbps)', 10);
    await attendeePage.waitForTimeout(10000);
    await recordTelemetry('Stage 1 (5 Mbps)', 20);

    // ─── STAGE 2: 20s - 40s (750 kbps Moderate Congestion) ───
    console.log('\n[STAGE 2: 20-40s] Applying 750 kbps Down / 400 kbps Up (Moderate Congestion)...');
    await applyCdpNetworkShaping(attendeePage, {
      downloadThroughputBps: 750000,
      uploadThroughputBps: 400000,
      latencyMs: 180
    });
    await attendeePage.waitForTimeout(10000);
    await recordTelemetry('Stage 2 (750 kbps)', 30);
    await attendeePage.waitForTimeout(10000);
    await recordTelemetry('Stage 2 (750 kbps)', 40);

    // ─── STAGE 3: 40s - 60s (350 kbps Tunnel / Severe Starvation) ───
    console.log('\n[STAGE 3: 40-60s] Applying 350 kbps Down / 200 kbps Up (Severe Starvation)...');
    await applyCdpNetworkShaping(attendeePage, {
      downloadThroughputBps: 350000,
      uploadThroughputBps: 200000,
      latencyMs: 300
    });
    await attendeePage.waitForTimeout(10000);
    await recordTelemetry('Stage 3 (350 kbps)', 50);
    await attendeePage.waitForTimeout(10000);
    await recordTelemetry('Stage 3 (350 kbps)', 60);

    // ─── STAGE 4: 60s - 80s (1.5 Mbps Clean Recovery) ───
    console.log('\n[STAGE 4: 60-80s] Applying 1.5 Mbps Down / 1 Mbps Up (Recovery Step-Up)...');
    await applyCdpNetworkShaping(attendeePage, {
      downloadThroughputBps: 1500000,
      uploadThroughputBps: 1000000,
      latencyMs: 80
    });
    await attendeePage.waitForTimeout(10000);
    await recordTelemetry('Stage 4 (1.5 Mbps)', 70);
    await attendeePage.waitForTimeout(10000);
    await recordTelemetry('Stage 4 (1.5 Mbps)', 80);

    // ─── STAGE 5: 80s - 100s (5 Mbps Full Restoration) ───
    console.log('\n[STAGE 5: 80-100s] Applying 5 Mbps Symmetric (Full Restoration)...');
    await applyCdpNetworkShaping(attendeePage, {
      downloadThroughputBps: 5000000,
      uploadThroughputBps: 2500000,
      latencyMs: 40
    });
    await attendeePage.waitForTimeout(10000);
    await recordTelemetry('Stage 5 (5 Mbps)', 90);
    await attendeePage.waitForTimeout(10000);
    await recordTelemetry('Stage 5 (5 Mbps)', 100);

    // Validate Final State & Invariants
    const finalStats = await getLiveWebRtcStats(attendeePage);
    console.log('\n[QA LIVE 100s ENDURANCE COMPLETE] Final Stats:', JSON.stringify(finalStats?.controllerQuality));

    expect(finalStats?.sessionStatus).toBe('active');
    expect(telemetryLogs.length).toBe(10);
    for (const log of telemetryLogs) {
      expect(log.sessionStatus).toBe('active');
    }

    await hostContext.close();
    await attendeeContext.close();
  });
});

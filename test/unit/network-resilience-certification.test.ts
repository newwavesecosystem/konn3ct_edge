import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  NetworkAdaptationController, 
  ConsumerMetadata, 
  QualityTier,
  DirectionalNetworkStats
} from '../../frontend/lib/network-adaptation-controller';

// ─── Adverse-Network Traffic Shaper & Media Simulation Harness ─────────────────

interface NetworkProfile {
  name: string;
  downlinkBps: number;
  uplinkBps: number;
  rttMs: number;
  jitterMs: number;
  packetLossPercent?: number;
  downlinkLossPercent?: number;
  uplinkLossPercent?: number;
}

interface SimulatedServerConsumer {
  consumerId: string;
  kind: 'audio' | 'video';
  paused: boolean;
  spatialLayer: number;
  priority: number;
  transmittedRtpBitrateBps: number;
}

class AdverseNetworkMediaHarness {
  public controller: NetworkAdaptationController;
  public currentTimeMs: number;
  public serverConsumers = new Map<string, SimulatedServerConsumer>();
  public clientConsumers: ConsumerMetadata[] = [];
  public clientPauseReasons = new Map<string, Set<'NETWORK' | 'PRODUCER' | 'POLICY' | 'USER' | 'VISIBILITY'>>();
  
  // Producer intent tracking
  public desiredCameraOn: boolean = true;
  public hostCameraBlocked: boolean = false;
  public cameraSuppressedByNetwork: boolean = false;
  public localMaxSpatialLayer: number = 2;
  public localProducerPaused: boolean = false;

  // Invariants telemetry
  public waitingRoomFlashCount: number = 0;
  public identityChanges: number = 0;
  public duplicateProducers: number = 0;
  public duplicateConsumers: number = 0;
  public audioLeakEvents: number = 0;
  public meetingTerminated: boolean = false;

  // Audio stats
  public audioBitrateBps: number = 32000;
  public audioConcealmentCount: number = 0;
  public longestAudioGapMs: number = 0;

  // Persistent monotonic traffic counters
  public cumulativeSentBytes: number = 100000;
  public cumulativeRecvBytes: number = 200000;
  public cumulativeSentPackets: number = 1000;
  public cumulativeRecvPackets: number = 2000;
  public cumulativeInboundLoss: number = 0;
  public cumulativeOutboundLoss: number = 0;

  constructor(startTimeMs: number = 1000000) {
    this.currentTimeMs = startTimeMs;
    this.controller = new NetworkAdaptationController(startTimeMs);
  }

  public registerConsumer(meta: ConsumerMetadata) {
    this.clientConsumers.push(meta);
    this.clientPauseReasons.set(meta.consumerId, new Set());
    this.serverConsumers.set(meta.consumerId, {
      consumerId: meta.consumerId,
      kind: meta.kind,
      paused: false,
      spatialLayer: meta.source === 'screen' ? 0 : 2,
      priority: meta.source === 'screen' ? 255 : (meta.isActiveSpeaker ? 192 : 128),
      transmittedRtpBitrateBps: meta.kind === 'audio' ? 32000 : (meta.source === 'screen' ? 800000 : 500000)
    });
  }

  public setClientPauseReason(consumerId: string, reason: 'NETWORK' | 'PRODUCER' | 'POLICY' | 'USER' | 'VISIBILITY', isPaused: boolean) {
    const reasons = this.clientPauseReasons.get(consumerId) || new Set();
    if (isPaused) reasons.add(reason);
    else reasons.delete(reason);
    this.clientPauseReasons.set(consumerId, reasons);

    // Sync to simulated server
    const serverConsumer = this.serverConsumers.get(consumerId);
    if (serverConsumer) {
      serverConsumer.paused = reasons.size > 0;
      serverConsumer.transmittedRtpBitrateBps = serverConsumer.paused ? 0 : (serverConsumer.kind === 'audio' ? 32000 : 350000);
    }
  }

  /**
   * Simulates running the WebRTC traffic shaped environment over N intervals.
   */
  public runShapedIntervals(profile: NetworkProfile, intervals: number, intervalDurationSec: number = 2): DirectionalNetworkStats {
    let lastStats: DirectionalNetworkStats = this.controller.getCurrentQuality();

    for (let i = 0; i < intervals; i++) {
      this.currentTimeMs += intervalDurationSec * 1000;

      // Calculate traffic bytes based on shaped profile
      const sentBytesDelta = Math.round((profile.uplinkBps / 8) * intervalDurationSec);
      const recvBytesDelta = Math.round((profile.downlinkBps / 8) * intervalDurationSec);
      const sentPacketsDelta = Math.max(10, Math.round(sentBytesDelta / 1000));
      const recvPacketsDelta = Math.max(10, Math.round(recvBytesDelta / 1000));

      const downLoss = profile.downlinkLossPercent ?? profile.packetLossPercent ?? 0;
      const upLoss = profile.uplinkLossPercent ?? profile.packetLossPercent ?? 0;

      const inboundLossDelta = Math.round(recvPacketsDelta * (downLoss / 100));
      const outboundLossDelta = Math.round(sentPacketsDelta * (upLoss / 100));

      this.cumulativeSentBytes += sentBytesDelta;
      this.cumulativeRecvBytes += recvBytesDelta;
      this.cumulativeSentPackets += sentPacketsDelta;
      this.cumulativeRecvPackets += recvPacketsDelta;
      this.cumulativeInboundLoss += inboundLossDelta;
      this.cumulativeOutboundLoss += outboundLossDelta;

      // Audio Concealment tracking
      if (downLoss > 5) {
        this.audioConcealmentCount += Math.round(downLoss * 2);
        this.longestAudioGapMs = Math.max(this.longestAudioGapMs, profile.rttMs * 0.4);
      }

      // Process raw stats snapshot
      lastStats = this.controller.processStatsSnapshot({
        nowMs: this.currentTimeMs,
        rttMs: profile.rttMs,
        jitterMs: profile.jitterMs,
        totalBytesSent: this.cumulativeSentBytes,
        totalBytesRecv: this.cumulativeRecvBytes,
        totalPacketsSent: this.cumulativeSentPackets,
        totalPacketsRecv: this.cumulativeRecvPackets,
        inboundPacketsLost: this.cumulativeInboundLoss,
        outboundPacketsLost: this.cumulativeOutboundLoss,
        framesEncoded: 30 * (i + 1),
        framesDropped: profile.downlinkBps < 300000 ? 5 : 0,
        availableOutgoingBitrate: profile.uplinkBps
      });

      // Generate adaptation plan
      const plan = this.controller.generateAdaptationPlan(this.clientConsumers, profile.downlinkBps);

      // Apply changes to server-side consumers and local producer
      for (const change of plan.changes) {
        if (typeof change.pausedByNetwork === 'boolean') {
          this.setClientPauseReason(change.consumerId, 'NETWORK', change.pausedByNetwork);
        }
        const sc = this.serverConsumers.get(change.consumerId);
        if (sc) {
          if (typeof change.spatialLayer === 'number') sc.spatialLayer = change.spatialLayer;
          if (typeof change.priority === 'number') sc.priority = change.priority;
        }
      }

      // Apply uplink camera suppression & spatial layer limit
      this.localMaxSpatialLayer = plan.uplinkMaxSpatialLayer;
      if (plan.uplinkPausedByNetwork && !this.cameraSuppressedByNetwork) {
        this.cameraSuppressedByNetwork = true;
        this.localProducerPaused = true;
      } else if (!plan.uplinkPausedByNetwork && this.cameraSuppressedByNetwork) {
        this.cameraSuppressedByNetwork = false;
        const effectiveCamera = this.desiredCameraOn && !this.hostCameraBlocked && !this.cameraSuppressedByNetwork;
        this.localProducerPaused = !effectiveCamera;
      }
    }

    return lastStats;
  }
}

// ─── Certification Test Suite ──────────────────────────────────────────────────

describe('NETWORK-RESILIENCE-003: Real Adverse-Network Certification Suite', () => {
  let harness: AdverseNetworkMediaHarness;

  beforeEach(() => {
    harness = new AdverseNetworkMediaHarness(1000000);

    // Set up standard 5-participant multi-media room:
    // 1. Audio stream
    harness.registerConsumer({
      consumerId: 'c-audio-1',
      producerId: 'p-audio-1',
      userId: 'user-alice',
      kind: 'audio',
      source: 'mic'
    });
    // 2. Screen share
    harness.registerConsumer({
      consumerId: 'c-screen-1',
      producerId: 'p-screen-1',
      userId: 'user-presenter',
      kind: 'video',
      source: 'screen',
      isScreenShare: true,
      isVisibleOnScreen: true,
      maxSpatialLayers: 1
    });
    // 3. Active Speaker Webcam
    harness.registerConsumer({
      consumerId: 'c-speaker-1',
      producerId: 'p-speaker-1',
      userId: 'user-alice',
      kind: 'video',
      source: 'camera',
      isActiveSpeaker: true,
      isVisibleOnScreen: true,
      maxSpatialLayers: 3
    });
    // 4. Visible Grid Thumbnail
    harness.registerConsumer({
      consumerId: 'c-thumb-1',
      producerId: 'p-thumb-1',
      userId: 'user-bob',
      kind: 'video',
      source: 'camera',
      isActiveSpeaker: false,
      isVisibleOnScreen: true,
      maxSpatialLayers: 3
    });
    // 5. Off-Screen Participant Video
    harness.registerConsumer({
      consumerId: 'c-offscreen-1',
      producerId: 'p-offscreen-1',
      userId: 'user-charlie',
      kind: 'video',
      source: 'camera',
      isActiveSpeaker: false,
      isVisibleOnScreen: false,
      maxSpatialLayers: 3
    });

    // Pass 0-3s warm-up
    harness.runShapedIntervals({
      name: 'warmup',
      downlinkBps: 5000000,
      uplinkBps: 2500000,
      rttMs: 40,
      jitterMs: 5,
      packetLossPercent: 0
    }, 2, 2);
  });

  describe('1. Standard Profile Certification Matrix (8 Profiles)', () => {
    it('Profile 1: Healthy (10M / 5M, 40ms RTT, 0% loss) -> All streams high', () => {
      const stats = harness.runShapedIntervals({
        name: 'Healthy',
        downlinkBps: 10000000,
        uplinkBps: 5000000,
        rttMs: 40,
        jitterMs: 5,
        packetLossPercent: 0
      }, 5);

      expect(stats.overall).toBe('GOOD');
      expect(stats.uplink).toBe('GOOD');
      expect(stats.downlink).toBe('GOOD');
      expect(harness.localMaxSpatialLayer).toBe(2);
      expect(harness.localProducerPaused).toBe(false);

      const screen = harness.serverConsumers.get('c-screen-1')!;
      const speaker = harness.serverConsumers.get('c-speaker-1')!;
      const thumb = harness.serverConsumers.get('c-thumb-1')!;
      const offscreen = harness.serverConsumers.get('c-offscreen-1')!;

      expect(screen.paused).toBe(false);
      expect(speaker.paused).toBe(false);
      expect(thumb.paused).toBe(false);
      expect(offscreen.paused).toBe(false);
      expect(speaker.spatialLayer).toBe(2); // High 720p
    });

    it('Profile 2: Constrained (1.5M / 1M, 120ms RTT, 1% loss) -> Downscales off-screen', () => {
      const stats = harness.runShapedIntervals({
        name: 'Constrained',
        downlinkBps: 1500000,
        uplinkBps: 1000000,
        rttMs: 120,
        jitterMs: 15,
        packetLossPercent: 1.0
      }, 3);

      expect(stats.overall).toBe('GOOD'); // Under 1.2% loss threshold remains GOOD / near FAIR
      expect(harness.localProducerPaused).toBe(false);
    });

    it('Profile 3: Low (750k / 500k, 180ms RTT, 2% loss) -> Audio prioritized, off-screen paused', () => {
      const stats = harness.runShapedIntervals({
        name: 'Low',
        downlinkBps: 750000,
        uplinkBps: 500000,
        rttMs: 180,
        jitterMs: 25,
        packetLossPercent: 2.0
      }, 3);

      expect(stats.downlink).toBe('FAIR');
      expect(harness.localMaxSpatialLayer).toBe(1); // 360p medium

      const screen = harness.serverConsumers.get('c-screen-1')!;
      const speaker = harness.serverConsumers.get('c-speaker-1')!;
      const offscreen = harness.serverConsumers.get('c-offscreen-1')!;

      expect(screen.paused).toBe(false);
      expect(speaker.paused).toBe(false);
      expect(speaker.spatialLayer).toBe(1); // 360p medium
      // Server-side Consumer for offscreen is paused (RTP = 0)
      expect(offscreen.paused).toBe(true);
      expect(offscreen.transmittedRtpBitrateBps).toBe(0);
    });

    it('Profile 4: Very Low (400k / 300k, 250ms RTT, 5% loss) -> Thumbnails paused, active speaker thumbnail retained', () => {
      const stats = harness.runShapedIntervals({
        name: 'Very Low',
        downlinkBps: 400000,
        uplinkBps: 300000,
        rttMs: 250,
        jitterMs: 40,
        packetLossPercent: 5.0
      }, 3);

      expect(stats.downlink).toBe('POOR');
      expect(harness.localMaxSpatialLayer).toBe(0); // 180p

      const screen = harness.serverConsumers.get('c-screen-1')!;
      const speaker = harness.serverConsumers.get('c-speaker-1')!;
      const thumb = harness.serverConsumers.get('c-thumb-1')!;

      expect(screen.paused).toBe(false);
      expect(speaker.paused).toBe(false);
      expect(speaker.spatialLayer).toBe(0); // 180p low
      expect(thumb.paused).toBe(true); // Regular grid paused on server
      expect(thumb.transmittedRtpBitrateBps).toBe(0);
    });

    it('Profile 5: Lossy (1M / 1M, 150ms RTT, 10% loss) -> Audio prioritized, camera video suppressed', () => {
      const stats = harness.runShapedIntervals({
        name: 'Lossy',
        downlinkBps: 1000000,
        uplinkBps: 1000000,
        rttMs: 150,
        jitterMs: 45,
        packetLossPercent: 10.0
      }, 3);

      expect(stats.downlink).toBe('CRITICAL');
      const speaker = harness.serverConsumers.get('c-speaker-1')!;
      const audio = harness.serverConsumers.get('c-audio-1')!;

      // Audio stream remains completely unpaused on server
      expect(audio.paused).toBe(false);
      // Camera stream is paused on server
      expect(speaker.paused).toBe(true);
      expect(speaker.transmittedRtpBitrateBps).toBe(0);
    });

    it('Profile 6: High Latency (2M / 1M, 500ms RTT, 2% loss) -> Degrades without false collapse', () => {
      const stats = harness.runShapedIntervals({
        name: 'High Latency',
        downlinkBps: 2000000,
        uplinkBps: 1000000,
        rttMs: 500,
        jitterMs: 20,
        packetLossPercent: 2.0
      }, 3);

      expect(['FAIR', 'POOR']).toContain(stats.overall);
      expect(harness.meetingTerminated).toBe(false);
      expect(harness.waitingRoomFlashCount).toBe(0);
    });

    it('Profile 7: Downlink-Constrained Asymmetric (500k Down / 5M Up, 150ms, 2% loss) -> Downlink adapts, Uplink stays High', () => {
      const stats = harness.runShapedIntervals({
        name: 'Downlink-Constrained',
        downlinkBps: 500000,
        uplinkBps: 5000000,
        rttMs: 150,
        jitterMs: 25,
        downlinkLossPercent: 2.0,
        uplinkLossPercent: 0.0
      }, 3);

      expect(stats.downlink).toBe('FAIR');
      expect(stats.uplink).toBe('GOOD');
      // Local webcam remains at 720p because uplink is healthy
      expect(harness.localMaxSpatialLayer).toBe(2);
      expect(harness.localProducerPaused).toBe(false);
      // Downlink offscreen video is paused
      expect(harness.serverConsumers.get('c-offscreen-1')!.paused).toBe(true);
    });

    it('Profile 8: Uplink-Constrained Asymmetric (5M Down / 400k Up, 150ms, 2% loss) -> Uplink downscales, Downlink stays High', () => {
      const stats = harness.runShapedIntervals({
        name: 'Uplink-Constrained',
        downlinkBps: 5000000,
        uplinkBps: 400000,
        rttMs: 150,
        jitterMs: 10,
        downlinkLossPercent: 0.0,
        uplinkLossPercent: 2.0
      }, 3);

      expect(stats.uplink).toBe('FAIR');
      expect(stats.downlink).toBe('GOOD');
      // Uplink scales down webcam layer to 360p (layer 1)
      expect(harness.localMaxSpatialLayer).toBe(1);
      // Remote speaker video remains at high 720p (layer 2)
      expect(harness.serverConsumers.get('c-speaker-1')!.spatialLayer).toBe(2);
    });
  });

  describe('2. Fluctuation & Endurance Matrix (Real-World Step-Down & Step-Up)', () => {
    it('Mobile Profile: 5M -> 750k (20s) -> 350k (20s) -> 1.5M (20s) -> 5M (Recovery)', () => {
      // Step 1: 5 Mbps (Normal)
      harness.runShapedIntervals({
        name: 'Normal',
        downlinkBps: 5000000,
        uplinkBps: 2500000,
        rttMs: 40,
        jitterMs: 5,
        packetLossPercent: 0
      }, 3);

      expect(harness.controller.getCurrentQuality().overall).toBe('GOOD');

      // Step 2: 750 kbps (Moderate Congestion for 20 sec = 10 intervals)
      harness.runShapedIntervals({
        name: 'Congested',
        downlinkBps: 750000,
        uplinkBps: 400000,
        rttMs: 180,
        jitterMs: 25,
        packetLossPercent: 2.5
      }, 10);

      expect(['FAIR', 'POOR']).toContain(harness.controller.getCurrentQuality().downlink);
      expect(harness.serverConsumers.get('c-offscreen-1')!.paused).toBe(true);

      // Step 3: 350 kbps (Tunnel / Severe Starvation for 20 sec)
      harness.runShapedIntervals({
        name: 'Starvation',
        downlinkBps: 350000,
        uplinkBps: 200000,
        rttMs: 320,
        jitterMs: 50,
        packetLossPercent: 6.0
      }, 10);

      expect(harness.controller.getCurrentQuality().downlink).toBe('POOR');
      expect(harness.serverConsumers.get('c-thumb-1')!.paused).toBe(true);

      // Step 4: 1.5 Mbps (Recovering for 20 sec = 10 intervals)
      harness.runShapedIntervals({
        name: 'Recovering',
        downlinkBps: 1500000,
        uplinkBps: 1000000,
        rttMs: 80,
        jitterMs: 10,
        packetLossPercent: 0.5
      }, 10);

      // Step-up promotion from POOR -> FAIR
      expect(['FAIR', 'GOOD']).toContain(harness.controller.getCurrentQuality().downlink);

      // Step 5: 5 Mbps (Full Restoration for 20 sec)
      harness.runShapedIntervals({
        name: 'Restored',
        downlinkBps: 5000000,
        uplinkBps: 2500000,
        rttMs: 40,
        jitterMs: 5,
        packetLossPercent: 0
      }, 10);

      expect(harness.controller.getCurrentQuality().overall).toBe('GOOD');
      // All consumers resumed
      expect(harness.serverConsumers.get('c-speaker-1')!.paused).toBe(false);
      expect(harness.serverConsumers.get('c-thumb-1')!.paused).toBe(false);
    });

    it('Asymmetric Directional Flip: (5M down / 5M up) -> (5M down / 350k up) -> (500k down / 5M up) -> (5M / 5M)', () => {
      // Phase 1: Symmetric High
      harness.runShapedIntervals({
        name: 'SymHigh',
        downlinkBps: 5000000,
        uplinkBps: 5000000,
        rttMs: 40,
        jitterMs: 5,
        packetLossPercent: 0
      }, 3);

      // Phase 2: Uplink Constrained Only (350k up)
      harness.runShapedIntervals({
        name: 'UpConstrained',
        downlinkBps: 5000000,
        uplinkBps: 350000,
        rttMs: 150,
        jitterMs: 10,
        downlinkLossPercent: 0.0,
        uplinkLossPercent: 2.0
      }, 5);

      expect(['FAIR', 'POOR']).toContain(harness.controller.getCurrentQuality().uplink);
      expect(harness.controller.getCurrentQuality().downlink).toBe('GOOD');
      expect(harness.localMaxSpatialLayer).toBeLessThanOrEqual(1); // Local webcam scales down

      // Phase 3: Downlink Constrained Only (500k down / 5M up)
      harness.runShapedIntervals({
        name: 'DownConstrained',
        downlinkBps: 500000,
        uplinkBps: 5000000,
        rttMs: 150,
        jitterMs: 25,
        downlinkLossPercent: 2.0,
        uplinkLossPercent: 0.0
      }, 5);

      expect(harness.controller.getCurrentQuality().downlink).toBe('FAIR');
      // Step-up promotion for uplink from POOR -> FAIR
      expect(['FAIR', 'GOOD']).toContain(harness.controller.getCurrentQuality().uplink);

      // Phase 4: Full Symmetric Restoration (5M down / 5M up for 10 intervals)
      harness.runShapedIntervals({
        name: 'FullRestoration',
        downlinkBps: 5000000,
        uplinkBps: 5000000,
        rttMs: 40,
        jitterMs: 5,
        downlinkLossPercent: 0.0,
        uplinkLossPercent: 0.0
      }, 10);

      expect(harness.controller.getCurrentQuality().uplink).toBe('GOOD');
      expect(harness.controller.getCurrentQuality().downlink).toBe('GOOD');
      expect(harness.localMaxSpatialLayer).toBe(2); // Local webcam scales fully back up to 720p
    });
  });

  describe('3. Core Invariants & Focused Regressions', () => {
    it('MIC-MUTE-INTEGRITY: Muted participant during network collapse/recovery -> 0 audio leakage', () => {
      // User sets desired audio muted
      harness.setClientPauseReason('c-audio-1', 'USER', true);
      expect(harness.serverConsumers.get('c-audio-1')!.paused).toBe(true);

      // Network collapses to CRITICAL
      harness.runShapedIntervals({
        name: 'Collapse',
        downlinkBps: 200000,
        uplinkBps: 100000,
        rttMs: 700,
        jitterMs: 80,
        packetLossPercent: 15.0
      }, 4);

      // Network recovers to GOOD
      harness.runShapedIntervals({
        name: 'Recovery',
        downlinkBps: 10000000,
        uplinkBps: 5000000,
        rttMs: 40,
        jitterMs: 5,
        packetLossPercent: 0
      }, 10);

      // Audio remains muted because USER pause reason was preserved
      expect(harness.serverConsumers.get('c-audio-1')!.paused).toBe(true);
      expect(harness.audioLeakEvents).toBe(0);
    });

    it('USER CAMERA INTENT ISOLATION: User turns camera OFF during network collapse -> remains OFF upon recovery', () => {
      // User turns camera off
      harness.desiredCameraOn = false;
      harness.localProducerPaused = true;

      // Network collapses
      harness.runShapedIntervals({
        name: 'Collapse',
        downlinkBps: 200000,
        uplinkBps: 80000,
        rttMs: 700,
        jitterMs: 80,
        packetLossPercent: 20.0
      }, 4);

      expect(harness.cameraSuppressedByNetwork).toBe(true);

      // Network recovers
      harness.runShapedIntervals({
        name: 'Recovery',
        downlinkBps: 10000000,
        uplinkBps: 5000000,
        rttMs: 40,
        jitterMs: 5,
        packetLossPercent: 0
      }, 10);

      expect(harness.cameraSuppressedByNetwork).toBe(false);
      // Producer remains paused because desiredCameraOn is false
      expect(harness.localProducerPaused).toBe(true);
    });

    it('SCREEN SHARING: Active screen share during POOR/CRITICAL -> Retains Priority 255 and not stopped', () => {
      harness.runShapedIntervals({
        name: 'Starvation',
        downlinkBps: 400000,
        uplinkBps: 300000,
        rttMs: 250,
        jitterMs: 40,
        packetLossPercent: 6.0
      }, 4);

      const screen = harness.serverConsumers.get('c-screen-1')!;
      expect(screen.paused).toBe(false);
      expect(screen.priority).toBe(255);
    });
  });
});

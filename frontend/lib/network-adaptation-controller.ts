/**
 * NETWORK-RESILIENCE-003: Adaptive Network & Media Controller
 * 
 * Provides directional network health classification (Uplink vs Downlink),
 * delta-based EWMA smoothing, bandwidth budgeting, adaptation epoch fencing,
 * and differential Consumer layer & priority management.
 */

export type QualityTier = 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL';

export type DiagnosticType = 
  | 'healthy' 
  | 'local_uplink' 
  | 'local_downlink' 
  | 'device' 
  | 'server_recovery';

export interface DirectionalNetworkStats {
  uplink: QualityTier;
  downlink: QualityTier;
  overall: QualityTier;
  rttMs: number;
  jitterMs: number;
  uplinkLossPercent: number;
  downlinkLossPercent: number;
  sendBitrateBps: number;
  recvBitrateBps: number;
  availableUplinkBps: number;
  availableDownlinkBps: number;
  frameDropRate: number;
  diagnosticType: DiagnosticType;
  epoch: number;
}

export interface ConsumerMetadata {
  consumerId: string;
  producerId: string;
  participantId?: string;
  userId: string;
  kind: 'audio' | 'video';
  source: 'camera' | 'screen' | 'mic' | 'screen-audio';
  isScreenShare?: boolean;
  isActiveSpeaker?: boolean;
  isPinned?: boolean;
  isVisibleOnScreen?: boolean;
  maxSpatialLayers?: number; // 1 for single-layer screen/webcam, 3 for simulcast VP8/H264
}

export interface ConsumerAdaptationChange {
  consumerId: string;
  spatialLayer?: number;
  temporalLayer?: number;
  priority?: number; // 1 (lowest) to 255 (highest)
  pausedByNetwork?: boolean;
}

export interface AdaptationPlan {
  adaptationEpoch: number;
  downlinkTier: QualityTier;
  uplinkTier: QualityTier;
  uplinkMaxSpatialLayer: number; // 0 (180p), 1 (360p), 2 (720p/1080p)
  uplinkPausedByNetwork: boolean;
  changes: ConsumerAdaptationChange[];
}

export class NetworkAdaptationController {
  private joinedAt: number;
  private epoch: number = 0;
  
  // Directional State
  private uplinkTier: QualityTier = 'GOOD';
  private downlinkTier: QualityTier = 'GOOD';
  private overallTier: QualityTier = 'GOOD';
  
  // Hysteresis Streaks & Dwell
  private uplinkDegradeStreak: number = 0;
  private uplinkRecoverStreak: number = 0;
  private downlinkDegradeStreak: number = 0;
  private downlinkRecoverStreak: number = 0;
  private lastDownlinkTransitionTime: number = 0;
  private lastUplinkTransitionTime: number = 0;
  private readonly MIN_DWELL_TIME_MS = 3000; // Minimum 3s between tier shifts

  // EWMA Smoothed Values
  private smoothedRtt: number = 50;
  private smoothedJitter: number = 5;
  private smoothedUplinkLoss: number = 0;
  private smoothedDownlinkLoss: number = 0;
  private readonly EWMA_ALPHA = 0.35;

  // Previous Raw Counters for Delta Calculation
  private lastBytesSent: number = 0;
  private lastBytesRecv: number = 0;
  private lastPacketsSent: number = 0;
  private lastPacketsRecv: number = 0;
  private lastInboundPacketsLost: number = 0;
  private lastOutboundPacketsLost: number = 0;
  private lastFramesEncoded: number = 0;
  private lastFramesDropped: number = 0;
  private lastSampleTime: number = 0;

  // Applied Consumer State for Differential Dispatch
  private appliedConsumerState = new Map<string, {
    spatialLayer?: number;
    temporalLayer?: number;
    priority?: number;
    pausedByNetwork?: boolean;
  }>();

  constructor(joinedAtMs: number = Date.now()) {
    this.joinedAt = joinedAtMs;
    this.lastSampleTime = joinedAtMs;
  }

  public getJoinedAt(): number {
    return this.joinedAt;
  }

  public getEpoch(): number {
    return this.epoch;
  }

  public getCurrentQuality(): DirectionalNetworkStats {
    return {
      uplink: this.uplinkTier,
      downlink: this.downlinkTier,
      overall: this.overallTier,
      rttMs: Math.round(this.smoothedRtt),
      jitterMs: Math.round(this.smoothedJitter),
      uplinkLossPercent: parseFloat(this.smoothedUplinkLoss.toFixed(1)),
      downlinkLossPercent: parseFloat(this.smoothedDownlinkLoss.toFixed(1)),
      sendBitrateBps: 0,
      recvBitrateBps: 0,
      availableUplinkBps: 0,
      availableDownlinkBps: 0,
      frameDropRate: 0,
      diagnosticType: this.determineDiagnosticType(),
      epoch: this.epoch
    };
  }

  /**
   * Process raw WebRTC stats delta and update directional quality tiers.
   */
  public processStatsSnapshot(rawStats: {
    nowMs: number;
    rttMs: number;
    jitterMs: number;
    totalBytesSent: number;
    totalBytesRecv: number;
    totalPacketsSent: number;
    totalPacketsRecv: number;
    inboundPacketsLost: number;
    outboundPacketsLost: number;
    framesEncoded: number;
    framesDropped: number;
    availableOutgoingBitrate?: number | null;
    iceState?: string;
    isRepublishing?: boolean;
  }): DirectionalNetworkStats {
    const elapsedSinceJoin = rawStats.nowMs - this.joinedAt;
    const dt = Math.max(0.5, (rawStats.nowMs - this.lastSampleTime) / 1000);
    this.lastSampleTime = rawStats.nowMs;

    // 1. Stage 1: Warm-up period (0 to 3 seconds)
    // No adaptation state changes while ICE/DTLS handshakes stabilize
    if (elapsedSinceJoin < 3000) {
      this.lastBytesSent = rawStats.totalBytesSent;
      this.lastBytesRecv = rawStats.totalBytesRecv;
      this.lastPacketsSent = rawStats.totalPacketsSent;
      this.lastPacketsRecv = rawStats.totalPacketsRecv;
      this.lastInboundPacketsLost = rawStats.inboundPacketsLost;
      this.lastOutboundPacketsLost = rawStats.outboundPacketsLost;
      this.lastFramesEncoded = rawStats.framesEncoded;
      this.lastFramesDropped = rawStats.framesDropped;
      
      return this.getCurrentQuality();
    }

    // 2. Compute Interval Deltas
    const dBytesSent = Math.max(0, rawStats.totalBytesSent - this.lastBytesSent);
    const dBytesRecv = Math.max(0, rawStats.totalBytesRecv - this.lastBytesRecv);
    const dPacketsSent = Math.max(0, rawStats.totalPacketsSent - this.lastPacketsSent);
    const dPacketsRecv = Math.max(0, rawStats.totalPacketsRecv - this.lastPacketsRecv);
    const dInboundLoss = Math.max(0, rawStats.inboundPacketsLost - this.lastInboundPacketsLost);
    const dOutboundLoss = Math.max(0, rawStats.outboundPacketsLost - this.lastOutboundPacketsLost);
    const dFramesEncoded = Math.max(0, rawStats.framesEncoded - this.lastFramesEncoded);
    const dFramesDropped = Math.max(0, rawStats.framesDropped - this.lastFramesDropped);

    this.lastBytesSent = rawStats.totalBytesSent;
    this.lastBytesRecv = rawStats.totalBytesRecv;
    this.lastPacketsSent = rawStats.totalPacketsSent;
    this.lastPacketsRecv = rawStats.totalPacketsRecv;
    this.lastInboundPacketsLost = rawStats.inboundPacketsLost;
    this.lastOutboundPacketsLost = rawStats.outboundPacketsLost;
    this.lastFramesEncoded = rawStats.framesEncoded;
    this.lastFramesDropped = rawStats.framesDropped;

    const sendBitrateBps = Math.round((dBytesSent * 8) / dt);
    const recvBitrateBps = Math.round((dBytesRecv * 8) / dt);

    const instantDownlinkLoss = (dPacketsRecv + dInboundLoss) > 0 
      ? (dInboundLoss / (dPacketsRecv + dInboundLoss)) * 100 
      : 0;

    const instantUplinkLoss = (dPacketsSent + dOutboundLoss) > 0 
      ? (dOutboundLoss / (dPacketsSent + dOutboundLoss)) * 100 
      : 0;

    const totalFrames = dFramesEncoded + dFramesDropped;
    const frameDropRate = totalFrames > 0 ? (dFramesDropped / totalFrames) : 0;

    // 3. Apply EWMA Smoothing
    this.smoothedRtt = this.applyEwma(this.smoothedRtt, rawStats.rttMs);
    this.smoothedJitter = this.applyEwma(this.smoothedJitter, rawStats.jitterMs);
    this.smoothedDownlinkLoss = this.applyEwma(this.smoothedDownlinkLoss, instantDownlinkLoss);
    this.smoothedUplinkLoss = this.applyEwma(this.smoothedUplinkLoss, instantUplinkLoss);

    // 4. Directional Evaluation
    const availableUplinkBps = rawStats.availableOutgoingBitrate || Math.max(sendBitrateBps, 150000);
    const availableDownlinkBps = Math.max(recvBitrateBps, 200000);

    const targetDownlinkTier = this.classifyDownlinkTier(
      this.smoothedRtt, 
      this.smoothedDownlinkLoss, 
      this.smoothedJitter,
      instantDownlinkLoss,
      rawStats.rttMs,
      availableDownlinkBps,
      rawStats.iceState, 
      rawStats.isRepublishing
    );
    const targetUplinkTier = this.classifyUplinkTier(
      this.smoothedRtt, 
      this.smoothedUplinkLoss, 
      availableUplinkBps,
      instantUplinkLoss,
      rawStats.iceState, 
      rawStats.isRepublishing
    );

    // 5. Update State Machines with Hysteresis
    this.updateDownlinkHysteresis(targetDownlinkTier, rawStats.nowMs, instantDownlinkLoss);
    this.updateUplinkHysteresis(targetUplinkTier, rawStats.nowMs, instantUplinkLoss);
    this.overallTier = this.computeOverallTier(this.uplinkTier, this.downlinkTier, frameDropRate);

    return {
      uplink: this.uplinkTier,
      downlink: this.downlinkTier,
      overall: this.overallTier,
      rttMs: Math.round(this.smoothedRtt),
      jitterMs: Math.round(this.smoothedJitter),
      uplinkLossPercent: parseFloat(this.smoothedUplinkLoss.toFixed(1)),
      downlinkLossPercent: parseFloat(this.smoothedDownlinkLoss.toFixed(1)),
      sendBitrateBps,
      recvBitrateBps,
      availableUplinkBps,
      availableDownlinkBps,
      frameDropRate: parseFloat(frameDropRate.toFixed(2)),
      diagnosticType: this.determineDiagnosticType(frameDropRate),
      epoch: this.epoch
    };
  }

  /**
   * Generates a complete differential adaptation plan for consumers and local publication.
   */
  public generateAdaptationPlan(
    consumers: ConsumerMetadata[],
    availableDownlinkBps: number
  ): AdaptationPlan {
    this.epoch++;

    // 1. Calculate dynamic audio & signaling reserve based on active audio consumers
    const activeAudioConsumers = consumers.filter(c => c.kind === 'audio').length;
    // Base 40 kbps per audio stream (Opus speech 32kbps + RTP header) + 50 kbps signaling / control headroom, bounded between 80 kbps and 300 kbps
    const dynamicAudioReserve = Math.max(80000, Math.min(300000, (activeAudioConsumers * 40000) + 50000));
    const safeDownlink = Math.max(100000, availableDownlinkBps * 0.80);
    let remainingVideoBudget = Math.max(0, safeDownlink - dynamicAudioReserve);

    // 2. Uplink publication settings based on uplink tier
    let uplinkMaxSpatialLayer = 2; // 720p/1080p
    let uplinkPausedByNetwork = false;

    switch (this.uplinkTier) {
      case 'GOOD':
        uplinkMaxSpatialLayer = 2;
        uplinkPausedByNetwork = false;
        break;
      case 'FAIR':
        uplinkMaxSpatialLayer = 1; // 360p
        uplinkPausedByNetwork = false;
        break;
      case 'POOR':
        uplinkMaxSpatialLayer = 0; // 180p
        uplinkPausedByNetwork = false;
        break;
      case 'CRITICAL':
        uplinkMaxSpatialLayer = 0;
        uplinkPausedByNetwork = true; // Pause camera on severe uplink starvation
        break;
    }

    // 3. Sort consumers by strict priority ladder:
    // Screen Share (255) > Active Speaker / Pinned (192) > Visible Grid (128) > Off-screen (64)
    const videoConsumers = consumers.filter(c => c.kind === 'video');
    const sortedConsumers = [...videoConsumers].sort((a, b) => {
      const getWeight = (c: ConsumerMetadata) => {
        if (c.source === 'screen' || c.isScreenShare) return 400;
        if (c.isActiveSpeaker || c.isPinned) return 300;
        if (c.isVisibleOnScreen) return 200;
        return 100;
      };
      return getWeight(b) - getWeight(a);
    });

    const changes: ConsumerAdaptationChange[] = [];

    // 4. Allocate layers and priorities under Downlink Tier
    for (const c of sortedConsumers) {
      let desiredLayer = 0;
      let desiredPriority = 128;
      let desiredPausedByNetwork = false;

      const isScreen = c.source === 'screen' || c.isScreenShare;
      const isPrioritySpeaker = c.isActiveSpeaker || c.isPinned;
      const isVisible = c.isVisibleOnScreen !== false;
      const maxLayers = c.maxSpatialLayers ?? 3;

      if (this.downlinkTier === 'CRITICAL') {
        // Audio-First Mode: aggressively pause camera streams
        if (isScreen) {
          desiredLayer = 0;
          desiredPriority = 255;
          desiredPausedByNetwork = false; // Preserve screen share if possible
        } else {
          desiredPausedByNetwork = true;
          desiredPriority = 64;
        }
      } else if (this.downlinkTier === 'POOR') {
        if (isScreen) {
          desiredLayer = Math.min(1, maxLayers - 1);
          desiredPriority = 255;
          desiredPausedByNetwork = false;
        } else if (isPrioritySpeaker && isVisible) {
          desiredLayer = 0; // Low thumbnail layer
          desiredPriority = 192;
          desiredPausedByNetwork = false;
        } else {
          // Off-screen and regular thumbnails paused to protect audio
          desiredPausedByNetwork = true;
          desiredPriority = 64;
        }
      } else if (this.downlinkTier === 'FAIR') {
        if (isScreen) {
          desiredLayer = Math.min(2, maxLayers - 1);
          desiredPriority = 255;
          desiredPausedByNetwork = false;
        } else if (isPrioritySpeaker) {
          desiredLayer = Math.min(1, maxLayers - 1); // 360p medium
          desiredPriority = 192;
          desiredPausedByNetwork = false;
        } else if (isVisible) {
          desiredLayer = 0; // 180p
          desiredPriority = 128;
          desiredPausedByNetwork = false;
        } else {
          desiredPausedByNetwork = true; // Off-screen paused
          desiredPriority = 64;
        }
      } else {
        // GOOD Quality Tier
        if (isScreen) {
          desiredLayer = maxLayers - 1; // High
          desiredPriority = 255;
          desiredPausedByNetwork = false;
        } else if (isPrioritySpeaker) {
          desiredLayer = maxLayers - 1; // High
          desiredPriority = 192;
          desiredPausedByNetwork = false;
        } else if (isVisible) {
          desiredLayer = Math.min(1, maxLayers - 1); // Medium
          desiredPriority = 128;
          desiredPausedByNetwork = false;
        } else {
          desiredLayer = 0; // Low
          desiredPriority = 64;
          desiredPausedByNetwork = false;
        }
      }

      // Check against applied state to calculate differential diff
      const currentApplied = this.appliedConsumerState.get(c.consumerId);
      const isDiff = !currentApplied ||
        currentApplied.spatialLayer !== desiredLayer ||
        currentApplied.priority !== desiredPriority ||
        currentApplied.pausedByNetwork !== desiredPausedByNetwork;

      if (isDiff) {
        changes.push({
          consumerId: c.consumerId,
          spatialLayer: desiredLayer,
          priority: desiredPriority,
          pausedByNetwork: desiredPausedByNetwork
        });

        this.appliedConsumerState.set(c.consumerId, {
          spatialLayer: desiredLayer,
          priority: desiredPriority,
          pausedByNetwork: desiredPausedByNetwork
        });
      }
    }

    return {
      adaptationEpoch: this.epoch,
      downlinkTier: this.downlinkTier,
      uplinkTier: this.uplinkTier,
      uplinkMaxSpatialLayer,
      uplinkPausedByNetwork,
      changes
    };
  }

  public removeConsumer(consumerId: string) {
    this.appliedConsumerState.delete(consumerId);
  }

  private classifyDownlinkTier(
    smoothedRttMs: number, 
    smoothedLossPercent: number, 
    smoothedJitterMs: number,
    instantLossPercent: number = 0,
    instantRttMs: number = 0,
    availableDownlinkBps: number = 2000000,
    iceState?: string,
    isRepublishing?: boolean
  ): QualityTier {
    if (iceState === 'disconnected' || iceState === 'failed' || isRepublishing) {
      return 'CRITICAL';
    }

    // Critical fast-path: severe RTT (>600ms), catastrophic packet loss (>6%), or severe jitter (>60ms)
    if (smoothedLossPercent >= 6.0 || instantLossPercent >= 8.0 || smoothedRttMs >= 600 || instantRttMs >= 600 || smoothedJitterMs >= 60) {
      return 'CRITICAL';
    }

    // Poor thresholds: requires loss >= 3.0%, bandwidth < 400 kbps, or severe RTT with jitter
    if (smoothedLossPercent >= 3.0 || instantLossPercent >= 3.5 || availableDownlinkBps < 400000 || (smoothedRttMs >= 350 && smoothedLossPercent > 0) || smoothedJitterMs >= 35) {
      return 'POOR';
    }

    // Fair thresholds: requires loss >= 1%, bandwidth < 800 kbps, or moderate RTT with jitter
    if (smoothedLossPercent >= 1.0 || instantLossPercent >= 1.5 || availableDownlinkBps < 800000 || (smoothedRttMs >= 180 && smoothedLossPercent > 0) || smoothedJitterMs >= 15) {
      return 'FAIR';
    }

    return 'GOOD';
  }

  private classifyUplinkTier(
    smoothedRttMs: number,
    smoothedLossPercent: number,
    availableUplinkBps: number,
    instantLossPercent: number = 0,
    iceState?: string,
    isRepublishing?: boolean
  ): QualityTier {
    if (iceState === 'disconnected' || iceState === 'failed' || isRepublishing) {
      return 'CRITICAL';
    }

    if (smoothedLossPercent >= 6.0 || instantLossPercent >= 8.0 || availableUplinkBps < 100000) {
      return 'CRITICAL';
    }

    if (smoothedLossPercent >= 3.0 || instantLossPercent >= 3.5 || availableUplinkBps < 400000 || smoothedRttMs >= 250) {
      return 'POOR';
    }

    if (smoothedLossPercent >= 1.0 || instantLossPercent >= 1.5 || availableUplinkBps < 800000 || smoothedRttMs >= 130) {
      return 'FAIR';
    }

    return 'GOOD';
  }

  private updateDownlinkHysteresis(target: QualityTier, nowMs: number, instantLossPercent: number = 0) {
    const tierRank: Record<QualityTier, number> = { 'GOOD': 0, 'FAIR': 1, 'POOR': 2, 'CRITICAL': 3 };
    const currentRank = tierRank[this.downlinkTier];
    const targetRank = tierRank[target];

    if (targetRank > currentRank) {
      // Degrading: requires 2 consecutive bad windows (or instant if critical catastrophic spike)
      this.downlinkRecoverStreak = 0;
      this.downlinkDegradeStreak++;

      const isCriticalSpike = target === 'CRITICAL' && (
        instantLossPercent >= 12 ||
        this.smoothedDownlinkLoss >= 8 || 
        (this.smoothedDownlinkLoss >= 5 && this.smoothedJitter >= 35) || 
        this.smoothedRtt >= 600
      );
      const isDwellPassed = (nowMs - this.lastDownlinkTransitionTime) >= this.MIN_DWELL_TIME_MS;

      if ((this.downlinkDegradeStreak >= 2 || isCriticalSpike) && isDwellPassed) {
        this.downlinkTier = target;
        this.downlinkDegradeStreak = 0;
        this.lastDownlinkTransitionTime = nowMs;
      }
    } else if (targetRank < currentRank) {
      // Recovering: requires 5 consecutive clean windows (~10s)
      this.downlinkDegradeStreak = 0;
      this.downlinkRecoverStreak++;

      const isDwellPassed = (nowMs - this.lastDownlinkTransitionTime) >= this.MIN_DWELL_TIME_MS;

      if (this.downlinkRecoverStreak >= 5 && isDwellPassed) {
        // Step up by 1 tier gradually rather than jumping all the way to GOOD
        const ranks: QualityTier[] = ['GOOD', 'FAIR', 'POOR', 'CRITICAL'];
        this.downlinkTier = ranks[currentRank - 1];
        this.downlinkRecoverStreak = 0;
        this.lastDownlinkTransitionTime = nowMs;
      }
    } else {
      this.downlinkDegradeStreak = 0;
      this.downlinkRecoverStreak = 0;
    }
  }

  private updateUplinkHysteresis(target: QualityTier, nowMs: number, instantLossPercent: number = 0) {
    const tierRank: Record<QualityTier, number> = { 'GOOD': 0, 'FAIR': 1, 'POOR': 2, 'CRITICAL': 3 };
    const currentRank = tierRank[this.uplinkTier];
    const targetRank = tierRank[target];

    if (targetRank > currentRank) {
      this.uplinkRecoverStreak = 0;
      this.uplinkDegradeStreak++;

      const isCriticalSpike = target === 'CRITICAL' && (
        instantLossPercent >= 12 ||
        this.smoothedUplinkLoss >= 8 || 
        this.smoothedRtt >= 600
      );
      const isDwellPassed = (nowMs - this.lastUplinkTransitionTime) >= this.MIN_DWELL_TIME_MS;

      if ((this.uplinkDegradeStreak >= 2 || isCriticalSpike) && isDwellPassed) {
        this.uplinkTier = target;
        this.uplinkDegradeStreak = 0;
        this.lastUplinkTransitionTime = nowMs;
      }
    } else if (targetRank < currentRank) {
      this.uplinkDegradeStreak = 0;
      this.uplinkRecoverStreak++;

      const isDwellPassed = (nowMs - this.lastUplinkTransitionTime) >= this.MIN_DWELL_TIME_MS;

      if (this.uplinkRecoverStreak >= 5 && isDwellPassed) {
        const ranks: QualityTier[] = ['GOOD', 'FAIR', 'POOR', 'CRITICAL'];
        this.uplinkTier = ranks[currentRank - 1];
        this.uplinkRecoverStreak = 0;
        this.lastUplinkTransitionTime = nowMs;
      }
    } else {
      this.uplinkDegradeStreak = 0;
      this.uplinkRecoverStreak = 0;
    }
  }

  private computeOverallTier(uplink: QualityTier, downlink: QualityTier, frameDropRate: number): QualityTier {
    const tierRank: Record<QualityTier, number> = { 'GOOD': 0, 'FAIR': 1, 'POOR': 2, 'CRITICAL': 3 };
    const maxRank = Math.max(tierRank[uplink], tierRank[downlink]);
    const ranks: QualityTier[] = ['GOOD', 'FAIR', 'POOR', 'CRITICAL'];
    return ranks[maxRank];
  }

  private determineDiagnosticType(frameDropRate: number = 0): DiagnosticType {
    if (this.downlinkTier === 'CRITICAL' || this.uplinkTier === 'CRITICAL') {
      return 'server_recovery';
    }
    if (frameDropRate > 0.20 && this.smoothedRtt < 100 && this.smoothedDownlinkLoss < 1) {
      return 'device';
    }
    if (this.uplinkTier !== 'GOOD' && this.downlinkTier === 'GOOD') {
      return 'local_uplink';
    }
    if (this.downlinkTier !== 'GOOD') {
      return 'local_downlink';
    }
    return 'healthy';
  }

  private applyEwma(previous: number, current: number): number {
    return (this.EWMA_ALPHA * current) + ((1 - this.EWMA_ALPHA) * previous);
  }
}

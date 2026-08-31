import { describe, it, expect, beforeEach } from 'vitest';
import { 
  NetworkAdaptationController, 
  ConsumerMetadata, 
  QualityTier 
} from '../../frontend/lib/network-adaptation-controller';

describe('NETWORK-RESILIENCE-003: Adaptive Network & Media Controller', () => {
  let controller: NetworkAdaptationController;
  const startTime = 1000000;

  beforeEach(() => {
    controller = new NetworkAdaptationController(startTime);
  });

  describe('1. 3-Stage Startup Monitoring', () => {
    it('should stay in warm-up (0-3s) without emitting premature false alarms', () => {
      // Sample at 1s (within 0-3s warm-up)
      const stats = controller.processStatsSnapshot({
        nowMs: startTime + 1000,
        rttMs: 400,
        jitterMs: 50,
        totalBytesSent: 10000,
        totalBytesRecv: 10000,
        totalPacketsSent: 100,
        totalPacketsRecv: 100,
        inboundPacketsLost: 20, // 20% loss
        outboundPacketsLost: 20,
        framesEncoded: 30,
        framesDropped: 0,
        iceState: 'connected'
      });

      // During warm-up, tiers remain default GOOD to allow ICE/DTLS to settle
      expect(stats.overall).toBe('GOOD');
      expect(stats.uplink).toBe('GOOD');
      expect(stats.downlink).toBe('GOOD');
    });

    it('should perform early classification after warm-up (>3s)', () => {
      // Warm-up sample at 2s
      controller.processStatsSnapshot({
        nowMs: startTime + 2000,
        rttMs: 50,
        jitterMs: 5,
        totalBytesSent: 10000,
        totalBytesRecv: 10000,
        totalPacketsSent: 100,
        totalPacketsRecv: 100,
        inboundPacketsLost: 0,
        outboundPacketsLost: 0,
        framesEncoded: 30,
        framesDropped: 0,
      });

      // Sample 1 at 4s with high packet loss (15%) -> critical fast-path triggers
      const stats = controller.processStatsSnapshot({
        nowMs: startTime + 5100,
        rttMs: 500,
        jitterMs: 45,
        totalBytesSent: 20000,
        totalBytesRecv: 20000,
        totalPacketsSent: 200,
        totalPacketsRecv: 200,
        inboundPacketsLost: 30,
        outboundPacketsLost: 30,
        framesEncoded: 60,
        framesDropped: 0,
      });

      expect(stats.downlink).toBe('CRITICAL');
      expect(stats.overall).toBe('CRITICAL');
    });
  });

  describe('2. Directional Isolation (Uplink vs Downlink)', () => {
    it('should degrade uplink independently when only upload is constrained', () => {
      // Warm-up
      controller.processStatsSnapshot({
        nowMs: startTime + 2000,
        rttMs: 40,
        jitterMs: 5,
        totalBytesSent: 10000,
        totalBytesRecv: 10000,
        totalPacketsSent: 100,
        totalPacketsRecv: 100,
        inboundPacketsLost: 0,
        outboundPacketsLost: 0,
        framesEncoded: 30,
        framesDropped: 0,
      });

      // Window 1: High outbound loss (uplink bad), zero inbound loss (downlink good)
      controller.processStatsSnapshot({
        nowMs: startTime + 6000,
        rttMs: 80,
        jitterMs: 5,
        totalBytesSent: 20000,
        totalBytesRecv: 2000000, // 2 MB healthy download
        totalPacketsSent: 200,
        totalPacketsRecv: 2000,
        inboundPacketsLost: 0,   // 0% download loss
        outboundPacketsLost: 6,  // 6% outbound loss
        framesEncoded: 60,
        framesDropped: 0,
        availableOutgoingBitrate: 350000 // 350 kbps upload
      });

      // Window 2: Continued poor uplink
      const stats = controller.processStatsSnapshot({
        nowMs: startTime + 10000,
        rttMs: 80,
        jitterMs: 5,
        totalBytesSent: 25000,
        totalBytesRecv: 4000000, // 4 MB healthy download
        totalPacketsSent: 300,
        totalPacketsRecv: 4000,
        inboundPacketsLost: 0,
        outboundPacketsLost: 12, // 6% delta loss
        framesEncoded: 90,
        framesDropped: 0,
        availableOutgoingBitrate: 350000
      });

      expect(stats.uplink).toBe('POOR');
      expect(stats.downlink).toBe('GOOD');

      const mockConsumers: ConsumerMetadata[] = [
        {
          consumerId: 'c-speaker',
          producerId: 'p-speaker',
          userId: 'user-speaker',
          kind: 'video',
          source: 'camera',
          isActiveSpeaker: true,
          isVisibleOnScreen: true,
          maxSpatialLayers: 3
        }
      ];

      const plan = controller.generateAdaptationPlan(mockConsumers, 2000000); // 2 Mbps downlink
      // Uplink degrades local webcam layer to 0 (180p)
      expect(plan.uplinkMaxSpatialLayer).toBe(0);
      expect(plan.uplinkPausedByNetwork).toBe(false);
      // Downlink consumers remain high because downlink is healthy
      expect(plan.changes.some(c => c.consumerId === 'c-speaker' && c.spatialLayer === 2)).toBe(true);
    });

    it('should degrade downlink consumers when only download is constrained without pausing local webcam', () => {
      // Warm-up
      controller.processStatsSnapshot({
        nowMs: startTime + 2000,
        rttMs: 40,
        jitterMs: 5,
        totalBytesSent: 10000,
        totalBytesRecv: 10000,
        totalPacketsSent: 100,
        totalPacketsRecv: 100,
        inboundPacketsLost: 0,
        outboundPacketsLost: 0,
        framesEncoded: 30,
        framesDropped: 0,
      });

      // Downlink is CRITICAL (>12% loss)
      const stats = controller.processStatsSnapshot({
        nowMs: startTime + 6000,
        rttMs: 650,
        jitterMs: 85,
        totalBytesSent: 200000, // Great upload
        totalBytesRecv: 20000,
        totalPacketsSent: 2000,
        totalPacketsRecv: 200,
        inboundPacketsLost: 40, // 20% download loss
        outboundPacketsLost: 0,
        framesEncoded: 60,
        framesDropped: 0,
        availableOutgoingBitrate: 2500000
      });

      expect(stats.downlink).toBe('CRITICAL');
      expect(stats.uplink).toBe('GOOD');

      const mockConsumers: ConsumerMetadata[] = [
        {
          consumerId: 'c-screen',
          producerId: 'p-screen',
          userId: 'user-presenter',
          kind: 'video',
          source: 'screen',
          isScreenShare: true,
          isVisibleOnScreen: true,
          maxSpatialLayers: 1
        },
        {
          consumerId: 'c-speaker',
          producerId: 'p-speaker',
          userId: 'user-speaker',
          kind: 'video',
          source: 'camera',
          isActiveSpeaker: true,
          isVisibleOnScreen: true,
          maxSpatialLayers: 3
        },
        {
          consumerId: 'c-thumb',
          producerId: 'p-thumb',
          userId: 'user-thumb',
          kind: 'video',
          source: 'camera',
          isVisibleOnScreen: true,
          maxSpatialLayers: 3
        }
      ];

      const plan = controller.generateAdaptationPlan(mockConsumers, 300000); // 300 kbps constrained download
      
      // Uplink camera remains enabled because upload is GOOD
      expect(plan.uplinkPausedByNetwork).toBe(false);
      expect(plan.uplinkMaxSpatialLayer).toBe(2);

      // Downlink Audio-First Mode: camera streams paused, screen share preserved
      const speakerChange = plan.changes.find(c => c.consumerId === 'c-speaker');
      const thumbChange = plan.changes.find(c => c.consumerId === 'c-thumb');
      const screenChange = plan.changes.find(c => c.consumerId === 'c-screen');

      expect(speakerChange?.pausedByNetwork).toBe(true);
      expect(thumbChange?.pausedByNetwork).toBe(true);
      expect(screenChange?.pausedByNetwork).toBe(false);
      expect(screenChange?.priority).toBe(255);
    });
  });

  describe('3. Asymmetric Hysteresis (Fast Degrade, Slow Step-by-Step Recovery)', () => {
    it('should require 5 consecutive clean samples to step up one quality tier', () => {
      // Warm-up
      controller.processStatsSnapshot({
        nowMs: startTime + 2000,
        rttMs: 40,
        jitterMs: 5,
        totalBytesSent: 10000,
        totalBytesRecv: 10000,
        totalPacketsSent: 100,
        totalPacketsRecv: 100,
        inboundPacketsLost: 0,
        outboundPacketsLost: 0,
        framesEncoded: 30,
        framesDropped: 0,
      });

      // Degrade to CRITICAL
      controller.processStatsSnapshot({
        nowMs: startTime + 6000,
        rttMs: 650,
        jitterMs: 90,
        totalBytesSent: 20000,
        totalBytesRecv: 20000,
        totalPacketsSent: 200,
        totalPacketsRecv: 200,
        inboundPacketsLost: 40,
        outboundPacketsLost: 40,
        framesEncoded: 60,
        framesDropped: 0,
      });

      expect(controller.getCurrentQuality().downlink).toBe('CRITICAL');

      let currentTime = startTime + 10000;

      // Initial clean samples allow EWMA loss to decay below threshold while maintaining CRITICAL
      for (let i = 0; i < 5; i++) {
        currentTime += 3000;
        const s = controller.processStatsSnapshot({
          nowMs: currentTime,
          rttMs: 30,
          jitterMs: 2,
          totalBytesSent: 30000 + ((i + 1) * 500000),
          totalBytesRecv: 30000 + ((i + 1) * 1000000),
          totalPacketsSent: 300 + ((i + 1) * 500),
          totalPacketsRecv: 300 + ((i + 1) * 1000),
          inboundPacketsLost: 40, // 0 delta loss
          outboundPacketsLost: 40,
          framesEncoded: 90 + (i * 30),
          framesDropped: 0,
        });
        expect(s.downlink).toBe('CRITICAL');
      }

      // Sustained clean samples trigger step-up from CRITICAL -> POOR
      let finalDownlinkTier: QualityTier = 'CRITICAL';
      for (let i = 5; i < 10; i++) {
        currentTime += 3000;
        const s = controller.processStatsSnapshot({
          nowMs: currentTime,
          rttMs: 30,
          jitterMs: 2,
          totalBytesSent: 30000 + ((i + 1) * 500000),
          totalBytesRecv: 30000 + ((i + 1) * 1000000),
          totalPacketsSent: 300 + ((i + 1) * 500),
          totalPacketsRecv: 300 + ((i + 1) * 1000),
          inboundPacketsLost: 40,
          outboundPacketsLost: 40,
          framesEncoded: 90 + (i * 30),
          framesDropped: 0,
        });
        finalDownlinkTier = s.downlink;
      }

      expect(finalDownlinkTier).toBe('POOR');
    });
  });

  describe('4. Epoch Fencing & Differential Change Tracking', () => {
    it('should increment adaptationEpoch monotonically and emit only changed consumers', () => {
      const mockConsumers: ConsumerMetadata[] = [
        {
          consumerId: 'c1',
          producerId: 'p1',
          userId: 'u1',
          kind: 'video',
          source: 'camera',
          isActiveSpeaker: true,
          isVisibleOnScreen: true,
          maxSpatialLayers: 3
        },
        {
          consumerId: 'c2',
          producerId: 'p2',
          userId: 'u2',
          kind: 'video',
          source: 'camera',
          isActiveSpeaker: false,
          isVisibleOnScreen: false,
          maxSpatialLayers: 3
        }
      ];

      // Plan 1: Initial state
      const plan1 = controller.generateAdaptationPlan(mockConsumers, 1500000);
      expect(plan1.adaptationEpoch).toBe(1);
      expect(plan1.changes.length).toBe(2);

      // Plan 2: Same conditions -> 0 changes emitted (differential optimization)
      const plan2 = controller.generateAdaptationPlan(mockConsumers, 1500000);
      expect(plan2.adaptationEpoch).toBe(2);
      expect(plan2.changes.length).toBe(0);

      // Make u2 visible -> only c2 change is emitted in Plan 3
      mockConsumers[1].isVisibleOnScreen = true;
      const plan3 = controller.generateAdaptationPlan(mockConsumers, 1500000);
      expect(plan3.adaptationEpoch).toBe(3);
      expect(plan3.changes.length).toBe(1);
      expect(plan3.changes[0].consumerId).toBe('c2');
    });
  });
});

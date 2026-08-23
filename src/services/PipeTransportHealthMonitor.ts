import logger from '../logger';
import { RouterKey } from '../types/topology';
import { PipeHealthState, PipeHealthRecord } from '../types/pipeTransport';
import { PipeTransportRegistry } from './PipeTransportRegistry';
import { TopologyFailoverCoordinator } from './TopologyFailoverCoordinator';

export interface TransportStatsSample {
  rtcpBytesSent: number;
  rtcpBytesReceived: number;
  rtpBytesSent: number;
  rtpBytesReceived: number;
  timestamp: number;
}

export class PipeTransportHealthMonitor {
  public static readonly PIPE_SUSPECT_AFTER_MS = 2000;
  public static readonly PIPE_FAILURE_AFTER_MS = 4000;

  /**
   * Evaluates autonomous PipeTransport health based on transport-level RTCP keepalive & packet movement.
   *
   * DISTINGUISHING SILENCE FROM BROKEN PIPE:
   * - Silent audio (RMS = 0) and unmoving video continuous generate RTCP Compound Packets (SR/RR keepalives)
   *   on mediasoup PipeTransports at regular 1-second intervals.
   * - Therefore, if RTCP/transport packet delta > 0, the pipe is HEALTHY regardless of media audio volume.
   * - Only when total transport packet movement is ZERO across consecutive probes while pipedProducers are active
   *   will the pipe transition HEALTHY -> PIPE_SUSPECT (2000ms) -> PIPE_FAILED (4000ms).
   */
  public static async evaluatePipeHealth(
    roomId: string,
    primaryRouterKey: RouterKey,
    relayRouterKey: RouterKey,
    currentSample: TransportStatsSample,
    previousSample?: TransportStatsSample,
    pipedProducerCount = 1
  ): Promise<PipeHealthRecord> {
    const now = currentSample.timestamp || Date.now();
    const existingRecord = await PipeTransportRegistry.getPipeHealth(roomId, primaryRouterKey, relayRouterKey);
    const pipeGen = existingRecord?.pipeGeneration || 1;

    // Calculate transport RTCP + RTP packet movement delta
    let packetDelta = 1; // Default to healthy if no previous sample
    if (previousSample) {
      const rtcpDelta = (currentSample.rtcpBytesSent - previousSample.rtcpBytesSent) +
                        (currentSample.rtcpBytesReceived - previousSample.rtcpBytesReceived);
      const rtpDelta = (currentSample.rtpBytesSent - previousSample.rtpBytesSent) +
                       (currentSample.rtpBytesReceived - previousSample.rtpBytesReceived);
      packetDelta = rtcpDelta + rtpDelta;
    }

    const lastHealthyAt = (packetDelta > 0 || pipedProducerCount === 0)
      ? now
      : (previousSample?.timestamp || existingRecord?.lastHealthyAt || now);

    const elapsedInactivityMs = now - lastHealthyAt;
    let nextState: PipeHealthState = 'HEALTHY';
    let reason: string | undefined;

    if (pipedProducerCount > 0 && elapsedInactivityMs >= this.PIPE_FAILURE_AFTER_MS) {
      nextState = 'PIPE_FAILED';
      reason = `udp_blackhole_inactivity_${elapsedInactivityMs}ms`;
    } else if (pipedProducerCount > 0 && elapsedInactivityMs >= this.PIPE_SUSPECT_AFTER_MS) {
      nextState = 'PIPE_SUSPECT';
      reason = `udp_blackhole_suspect_${elapsedInactivityMs}ms`;
    }

    const updatedRecord = await PipeTransportRegistry.markPipeHealth(
      roomId,
      primaryRouterKey,
      relayRouterKey,
      nextState,
      pipeGen,
      reason
    );

    // Autonomous failover trigger if PIPE_FAILED detected
    if (nextState === 'PIPE_FAILED' && existingRecord?.pipeHealthState !== 'PIPE_FAILED' && existingRecord?.pipeHealthState !== 'RECOVERING') {
      logger.warn(JSON.stringify({
        event: 'autonomous_pipe_failure_detected',
        roomId,
        primaryRouterKey,
        relayRouterKey,
        elapsedInactivityMs,
        pipeGeneration: pipeGen,
      }));
      // Trigger automatic recovery asynchronously
      TopologyFailoverCoordinator.executePipeFailover(roomId, primaryRouterKey, relayRouterKey).catch((err) => {
        logger.error(`Autonomous pipe failover failed for room ${roomId}`, err);
      });
    }

    return updatedRecord;
  }
}

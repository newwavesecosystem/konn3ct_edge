import { PipeTransport, Router, Producer } from 'mediasoup/node/lib/types';
import { logger } from '../logger';
import { LARGE_ROOM_CONFIG } from '../config/largeRoom';
import { RoomTopologyRegistry } from '../services/RoomTopologyRegistry';
import { PipeTransportRegistry } from '../services/PipeTransportRegistry';
import { PipePairMetadata, PipedProducerMetadata, PipeTransportResult } from '../types/pipeTransport';
import * as sfu from './sfu';
import crypto from 'crypto';

const localPipeTransports = new Map<string, PipeTransport>();
const pipedProducersMap = new Map<string, Producer>();

/**
 * Validates codec compatibility between Primary and Relay Mediasoup Routers.
 */
export function checkCodecCompatibility(primaryRouter: Router, relayRouter: Router): boolean {
  try {
    const primaryCodecs = primaryRouter.rtpCapabilities.codecs || [];
    const relayCodecs = relayRouter.rtpCapabilities.codecs || [];

    if (primaryCodecs.length === 0 || relayCodecs.length === 0) return false;

    const hasPrimaryOpus = primaryCodecs.some((c) => c.mimeType.toLowerCase() === 'audio/opus');
    const hasRelayOpus = relayCodecs.some((c) => c.mimeType.toLowerCase() === 'audio/opus');

    const compat = hasPrimaryOpus && hasRelayOpus;

    logger.info(JSON.stringify({
      event: 'pipe_transport_codec_compatibility_checked',
      compatible: compat,
    }));

    return compat;
  } catch (err) {
    logger.error('Failed to check router codec compatibility', err);
    return false;
  }
}

/**
 * Creates an intra-pod PipeTransport pair between Primary and Relay Routers.
 */
export async function createLocalPipeTransportPair(
  roomId: string,
  primaryRouterId: string,
  relayRouterId: string,
  podA = 'media-pod-1',
  podB = 'media-pod-2'
): Promise<PipeTransportResult<PipePairMetadata>> {
  logger.info(JSON.stringify({
    event: 'pipe_transport_create_requested',
    roomId,
    primaryRouterId,
    relayRouterId,
  }));

  const primaryRouterKey = RoomTopologyRegistry.getRouterKey(podA, primaryRouterId);
  const relayRouterKey = RoomTopologyRegistry.getRouterKey(podB, relayRouterId);

  // Idempotency check: see if pipe pair already exists in Redis
  const existingPair = await PipeTransportRegistry.getPipePair(roomId, primaryRouterKey, relayRouterKey);
  if (existingPair) {
    logger.info(JSON.stringify({
      event: 'pipe_transport_pair_reused',
      roomId,
      primaryRouterKey,
      relayRouterKey,
      pipePairId: existingPair.pipePairId,
    }));
    return { success: true, pipePairId: existingPair.pipePairId, data: existingPair };
  }

  const primaryRouter = sfu.getRouter(primaryRouterId);
  const relayRouter = sfu.getRouter(relayRouterId);

  if (!primaryRouter || !relayRouter) {
    return { success: false, error: 'Primary or Relay router not found in SFU' };
  }

  const isCompatible = checkCodecCompatibility(primaryRouter, relayRouter);
  if (!isCompatible) {
    return { success: false, error: 'Incompatible router codecs' };
  }

  const listenIp = LARGE_ROOM_CONFIG.pipeTransportListenIp === '0.0.0.0' ? '127.0.0.1' : LARGE_ROOM_CONFIG.pipeTransportListenIp;
  const announcedIp = LARGE_ROOM_CONFIG.pipeTransportAnnouncedIp;

  logger.info(JSON.stringify({
    event: 'pipe_transport_internal_ip_selected',
    listenIp,
    announcedIp,
  }));

  try {
    // Create PipeTransport on Primary Router
    const primaryPipeTransport = await primaryRouter.createPipeTransport({
      listenIp,
      enableSrtp: LARGE_ROOM_CONFIG.pipeTransportEnableSrtp,
    });

    logger.info(JSON.stringify({
      event: 'pipe_transport_created_primary',
      roomId,
      primaryPipeTransportId: primaryPipeTransport.id,
      tuple: primaryPipeTransport.tuple,
    }));

    // Create PipeTransport on Relay Router
    const relayPipeTransport = await relayRouter.createPipeTransport({
      listenIp,
      enableSrtp: LARGE_ROOM_CONFIG.pipeTransportEnableSrtp,
    });

    logger.info(JSON.stringify({
      event: 'pipe_transport_created_relay',
      roomId,
      relayPipeTransportId: relayPipeTransport.id,
      tuple: relayPipeTransport.tuple,
    }));

    // Connect Primary PipeTransport to Relay PipeTransport
    await primaryPipeTransport.connect({
      ip: relayPipeTransport.tuple.localIp,
      port: relayPipeTransport.tuple.localPort,
      srtpParameters: relayPipeTransport.srtpParameters,
    });

    logger.info(JSON.stringify({
      event: 'pipe_transport_connected_primary_to_relay',
      roomId,
      primaryPipeTransportId: primaryPipeTransport.id,
    }));

    // Connect Relay PipeTransport to Primary PipeTransport
    await relayPipeTransport.connect({
      ip: primaryPipeTransport.tuple.localIp,
      port: primaryPipeTransport.tuple.localPort,
      srtpParameters: primaryPipeTransport.srtpParameters,
    });

    logger.info(JSON.stringify({
      event: 'pipe_transport_connected_relay_to_primary',
      roomId,
      relayPipeTransportId: relayPipeTransport.id,
    }));

    const pipePairId = `pipe-${crypto.randomUUID()}`;
    localPipeTransports.set(primaryPipeTransport.id, primaryPipeTransport);
    localPipeTransports.set(relayPipeTransport.id, relayPipeTransport);

    const metadata: PipePairMetadata = {
      pipePairId,
      roomId,
      primaryRouterKey,
      relayRouterKey,
      primaryPipeTransportId: primaryPipeTransport.id,
      relayPipeTransportId: relayPipeTransport.id,
      connected: true,
      pipedProducerIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await PipeTransportRegistry.registerPipePair(roomId, primaryRouterKey, relayRouterKey, metadata);

    return { success: true, pipePairId, data: metadata };
  } catch (err: any) {
    logger.error(`Failed to create PipeTransport pair for room ${roomId}`, err);
    return { success: false, error: err.message || 'PipeTransport creation failed' };
  }
}

/**
 * Pipes a producer from Primary Router to Relay Router locally.
 */
export async function pipeLocalProducerToRelay(
  roomId: string,
  primaryRouterId: string,
  relayRouterId: string,
  producerId: string,
  podA = 'media-pod-1',
  podB = 'media-pod-2'
): Promise<PipeTransportResult<{ pipedProducerId: string }>> {
  logger.info(JSON.stringify({
    event: 'producer_pipe_requested',
    roomId,
    producerId,
    primaryRouterId,
    relayRouterId,
  }));

  const primaryRouterKey = RoomTopologyRegistry.getRouterKey(podA, primaryRouterId);
  const relayRouterKey = RoomTopologyRegistry.getRouterKey(podB, relayRouterId);

  // Idempotency check: see if producer is already piped to this relay
  const existingMeta = await PipeTransportRegistry.getPipedProducer(roomId, producerId, relayRouterKey);
  if (existingMeta) {
    logger.info(JSON.stringify({
      event: 'producer_pipe_duplicate_prevented',
      roomId,
      producerId,
      relayRouterKey,
      pipedProducerId: existingMeta.pipedProducerId,
    }));
    return { success: true, data: { pipedProducerId: existingMeta.pipedProducerId } };
  }

  const primaryRouter = sfu.getRouter(primaryRouterId);
  const relayRouter = sfu.getRouter(relayRouterId);

  if (!primaryRouter || !relayRouter) {
    return { success: false, error: 'Primary or Relay router not found in SFU' };
  }

  try {
    // Perform local in-process piping via Mediasoup router.pipeToRouter
    const { pipeProducer } = await primaryRouter.pipeToRouter({
      producerId,
      router: relayRouter,
    });

    if (!pipeProducer) {
      return { success: false, error: 'Mediasoup failed to create piped producer' };
    }

    pipedProducersMap.set(pipeProducer.id, pipeProducer);

    const metadata: PipedProducerMetadata = {
      roomId,
      originalProducerId: producerId,
      relayRouterKey,
      primaryRouterKey,
      pipePairId: `local-pipe-${producerId}`,
      pipeConsumerId: `local-consumer-${producerId}`,
      pipedProducerId: pipeProducer.id,
      kind: pipeProducer.kind as 'audio' | 'video',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await PipeTransportRegistry.registerPipedProducer(roomId, metadata);

    logger.info(JSON.stringify({
      event: 'producer_piped_to_relay',
      roomId,
      producerId,
      pipedProducerId: pipeProducer.id,
      relayRouterId,
    }));

    return { success: true, data: { pipedProducerId: pipeProducer.id } };
  } catch (err: any) {
    logger.error(`Failed to pipe producer ${producerId} to relay ${relayRouterId}`, err);
    return { success: false, error: err.message || 'Producer piping failed' };
  }
}

/**
 * Tears down a PipeTransport pair cleanly and removes registry state.
 */
export async function closeLocalPipePair(
  roomId: string,
  primaryRouterId: string,
  relayRouterId: string,
  podA = 'media-pod-1',
  podB = 'media-pod-2'
): Promise<PipeTransportResult> {
  const primaryRouterKey = RoomTopologyRegistry.getRouterKey(podA, primaryRouterId);
  const relayRouterKey = RoomTopologyRegistry.getRouterKey(podB, relayRouterId);

  try {
    const pair = await PipeTransportRegistry.getPipePair(roomId, primaryRouterKey, relayRouterKey);

    if (pair) {
      const pTransport = localPipeTransports.get(pair.primaryPipeTransportId);
      const rTransport = localPipeTransports.get(pair.relayPipeTransportId);

      if (pTransport) pTransport.close();
      if (rTransport) rTransport.close();

      localPipeTransports.delete(pair.primaryPipeTransportId);
      localPipeTransports.delete(pair.relayPipeTransportId);
    }

    await PipeTransportRegistry.closePipePair(roomId, primaryRouterKey, relayRouterKey);

    logger.info(JSON.stringify({
      event: 'pipe_transport_cleanup_completed',
      roomId,
      primaryRouterId,
      relayRouterId,
    }));

    return { success: true };
  } catch (err: any) {
    logger.error(`Failed to close pipe pair for room ${roomId}`, err);
    return { success: false, error: err.message || 'Pipe pair closure failed' };
  }
}

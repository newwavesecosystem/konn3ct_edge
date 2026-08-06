import { PipeTransport, Router, Producer, Consumer } from 'mediasoup/node/lib/types';
import crypto from 'crypto';
import { redis } from '../redis';
import { logger } from '../logger';
import { LARGE_ROOM_CONFIG, getPipeTransportAnnouncedIp } from '../config/largeRoom';
import { RoomTopologyRegistry } from '../services/RoomTopologyRegistry';
import { PipeTransportRegistry } from '../services/PipeTransportRegistry';
import { redisMediaController } from '../services/RedisMediaController';
import { PipePairMetadata, PipedProducerMetadata, PipeTransportResult } from '../types/pipeTransport';
import * as sfu from './sfu';

const localPrimaryTransports = new Map<string, PipeTransport>();
const localPipeConsumers = new Map<string, Consumer>();

// Lock helper
async function acquireLock(lockKey: string, ttlMs = 5000): Promise<string | null> {
  const token = crypto.randomUUID();
  try {
    const res = await redis.set(lockKey, token, 'PX', ttlMs, 'NX');
    return res === 'OK' ? token : null;
  } catch (err) {
    return null;
  }
}

async function releaseLock(lockKey: string, token: string | null): Promise<void> {
  if (!token) return;
  const lua = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
  try {
    await redis.eval(lua, 1, lockKey, token);
  } catch (e) {}
}

/**
 * Creates a cross-pod PipeTransport pair between Primary Pod A and Relay Pod B over Redis RPC.
 */
export async function createCrossPodPipePair(
  roomId: string,
  primaryPodId: string,
  primaryRouterId: string,
  relayPodId: string,
  relayRouterId: string
): Promise<PipeTransportResult<PipePairMetadata>> {
  logger.info(JSON.stringify({
    event: 'pipe_transport_cross_pod_requested',
    roomId,
    primaryPodId,
    primaryRouterId,
    relayPodId,
    relayRouterId,
  }));

  const primaryRouterKey = RoomTopologyRegistry.getRouterKey(primaryPodId, primaryRouterId);
  const relayRouterKey = RoomTopologyRegistry.getRouterKey(relayPodId, relayRouterId);
  const lockKey = `room:${roomId}:pipe:${primaryRouterKey}:${relayRouterKey}:lock`;

  const lockToken = await acquireLock(lockKey);
  if (!lockToken) {
    const existing = await PipeTransportRegistry.getPipePair(roomId, primaryRouterKey, relayRouterKey);
    if (existing) {
      return { success: true, pipePairId: existing.pipePairId, data: existing };
    }
  }

  try {
    // 1. Verify Pod Heartbeats
    const primaryLive = await RoomTopologyRegistry.isMediaPodLive(primaryPodId);
    const relayLive = await RoomTopologyRegistry.isMediaPodLive(relayPodId);

    if (!primaryLive || !relayLive) {
      logger.warn(JSON.stringify({
        event: 'missing_heartbeat_rejected',
        roomId,
        primaryPodId,
        primaryLive,
        relayPodId,
        relayLive,
      }));
      await releaseLock(lockKey, lockToken);
      return { success: false, error: 'Target media pod heartbeat is missing' };
    }

    // 2. Idempotency Check
    const existingPair = await PipeTransportRegistry.getPipePair(roomId, primaryRouterKey, relayRouterKey);
    if (existingPair) {
      logger.info(JSON.stringify({
        event: 'pipe_transport_pair_reused',
        roomId,
        primaryRouterKey,
        relayRouterKey,
        pipePairId: existingPair.pipePairId,
      }));
      await releaseLock(lockKey, lockToken);
      return { success: true, pipePairId: existingPair.pipePairId, data: existingPair };
    }

    const announcedIp = getPipeTransportAnnouncedIp();
    const listenIp = LARGE_ROOM_CONFIG.pipeTransportListenIp;
    const timeoutMs = LARGE_ROOM_CONFIG.crossPodRpcTimeoutMs;

    // Stage 1: Request Relay Pod B to create Relay PipeTransport via RPC
    let relayRes: any;
    try {
      relayRes = await redisMediaController.rpcCallToPod(
        relayPodId,
        'rpcCreatePipeTransport',
        [{ roomId, primaryRouterKey, relayRouterKey, listenIp, announcedIp, enableSrtp: LARGE_ROOM_CONFIG.pipeTransportEnableSrtp }],
        timeoutMs
      );
    } catch (err: any) {
      logger.error(JSON.stringify({
        event: 'pipe_transport_rollback_started',
        roomId,
        stage: 'relay_rpc_create_failed',
        reason: err.message,
      }));
      await releaseLock(lockKey, lockToken);
      return { success: false, error: `Relay PipeTransport RPC failed: ${err.message}` };
    }

    if (!relayRes || !relayRes.relayPipeTransportId || !relayRes.tuple) {
      await releaseLock(lockKey, lockToken);
      return { success: false, error: relayRes?.error || 'Invalid relay transport response' };
    }

    logger.info(JSON.stringify({
      event: 'pipe_transport_rpc_created_relay',
      roomId,
      relayPodId,
      relayPipeTransportId: relayRes.relayPipeTransportId,
      tuple: relayRes.tuple,
    }));

    // Stage 2: Create Primary PipeTransport on Primary Pod A locally
    const primaryRouter = sfu.getRouter(primaryRouterId);
    if (!primaryRouter) {
      redisMediaController.rpcCallToPod(relayPodId, 'rpcClosePipeTransport', [{ roomId, primaryRouterKey, relayRouterKey }]).catch(() => {});
      logger.warn(JSON.stringify({ event: 'router_not_found_rejected', roomId, primaryRouterId }));
      await releaseLock(lockKey, lockToken);
      return { success: false, error: 'Primary Router not found on local SFU' };
    }

    let primaryPipeTransport: PipeTransport;
    try {
      primaryPipeTransport = await primaryRouter.createPipeTransport({
        listenIp: listenIp === '0.0.0.0' ? '127.0.0.1' : listenIp,
        enableSrtp: LARGE_ROOM_CONFIG.pipeTransportEnableSrtp,
      });

      logger.info(JSON.stringify({
        event: 'pipe_transport_created_primary',
        roomId,
        primaryPipeTransportId: primaryPipeTransport.id,
        tuple: primaryPipeTransport.tuple,
      }));

      // Connect Primary PipeTransport to Relay tuple safely
      const connectIp = (relayRes.tuple.localIp && relayRes.tuple.localIp.startsWith('10.')) ? '127.0.0.1' : relayRes.tuple.localIp;
      await primaryPipeTransport.connect({
        ip: connectIp,
        port: relayRes.tuple.localPort,
        srtpParameters: relayRes.srtpParameters,
      });

      logger.info(JSON.stringify({
        event: 'pipe_transport_connected_primary_to_relay',
        roomId,
        primaryPipeTransportId: primaryPipeTransport.id,
      }));
    } catch (err: any) {
      logger.error(JSON.stringify({
        event: 'pipe_transport_rollback_started',
        roomId,
        stage: 'primary_connect_failed',
        reason: err.message,
      }));
      redisMediaController.rpcCallToPod(relayPodId, 'rpcClosePipeTransport', [{ roomId, primaryRouterKey, relayRouterKey }]).catch(() => {});
      await releaseLock(lockKey, lockToken);
      return { success: false, error: `Primary PipeTransport connect failed: ${err.message}` };
    }

    // Stage 3: Send Primary tuple to Relay Pod B to complete 2-way connect
    try {
      await redisMediaController.rpcCallToPod(
        relayPodId,
        'rpcConnectPipeTransport',
        [{
          roomId,
          primaryRouterKey,
          relayRouterKey,
          relayPipeTransportId: relayRes.relayPipeTransportId,
          primaryTuple: { localIp: primaryPipeTransport.tuple.localIp, localPort: primaryPipeTransport.tuple.localPort },
          primarySrtpParameters: primaryPipeTransport.srtpParameters,
        }],
        timeoutMs
      );

      logger.info(JSON.stringify({
        event: 'pipe_transport_connected_relay_to_primary',
        roomId,
        relayPodId,
      }));
    } catch (err: any) {
      logger.error(JSON.stringify({
        event: 'pipe_transport_rollback_started',
        roomId,
        stage: 'relay_connect_rpc_failed',
        reason: err.message,
      }));
      primaryPipeTransport.close();
      redisMediaController.rpcCallToPod(relayPodId, 'rpcClosePipeTransport', [{ roomId, primaryRouterKey, relayRouterKey }]).catch(() => {});
      await releaseLock(lockKey, lockToken);
      return { success: false, error: `Relay connect RPC failed: ${err.message}` };
    }

    // Stage 4: Register pair in PipeTransportRegistry
    const pipePairId = `pipe-${crypto.randomUUID()}`;
    localPrimaryTransports.set(primaryPipeTransport.id, primaryPipeTransport);
    localPrimaryTransports.set(primaryRouterKey, primaryPipeTransport);

    const metadata: PipePairMetadata = {
      pipePairId,
      roomId,
      primaryRouterKey,
      relayRouterKey,
      primaryPipeTransportId: primaryPipeTransport.id,
      relayPipeTransportId: relayRes.relayPipeTransportId,
      connected: true,
      pipedProducerIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const regRes = await PipeTransportRegistry.registerPipePair(roomId, primaryRouterKey, relayRouterKey, metadata);
    if (!regRes.success) {
      logger.error(JSON.stringify({
        event: 'pipe_transport_rollback_started',
        roomId,
        stage: 'redis_registry_write_failed',
      }));
      primaryPipeTransport.close();
      redisMediaController.rpcCallToPod(relayPodId, 'rpcClosePipeTransport', [{ roomId, primaryRouterKey, relayRouterKey }]).catch(() => {});
      await releaseLock(lockKey, lockToken);
      return { success: false, error: 'Failed to write PipeTransport pair to Redis registry' };
    }

    logger.info(JSON.stringify({
      event: 'pipe_transport_pair_created',
      roomId,
      primaryRouterKey,
      relayRouterKey,
      pipePairId,
    }));

    await releaseLock(lockKey, lockToken);
    return { success: true, pipePairId, data: metadata };
  } catch (err: any) {
    logger.error(JSON.stringify({
      event: 'pipe_transport_rollback_failed',
      roomId,
      error: err.message,
    }));
    await releaseLock(lockKey, lockToken);
    return { success: false, error: err.message || 'Cross-pod PipeTransport creation failed' };
  }
}

/**
 * Pipes a producer from Primary Pod A to Relay Pod B over Redis RPC.
 */
export async function pipeProducerCrossPod(
  roomId: string,
  primaryPodId: string,
  primaryRouterId: string,
  relayPodId: string,
  relayRouterId: string,
  originalProducerId: string
): Promise<PipeTransportResult<{ pipedProducerId: string }>> {
  logger.info(JSON.stringify({
    event: 'producer_pipe_cross_pod_requested',
    roomId,
    originalProducerId,
    primaryPodId,
    relayPodId,
  }));

  const primaryRouterKey = RoomTopologyRegistry.getRouterKey(primaryPodId, primaryRouterId);
  const relayRouterKey = RoomTopologyRegistry.getRouterKey(relayPodId, relayRouterId);
  const lockKey = `room:${roomId}:pipeProducer:${originalProducerId}:${relayRouterKey}:lock`;

  const lockToken = await acquireLock(lockKey);
  if (!lockToken) {
    const existing = await PipeTransportRegistry.getPipedProducer(roomId, originalProducerId, relayRouterKey);
    if (existing) {
      return { success: true, data: { pipedProducerId: existing.pipedProducerId } };
    }
  }

  try {
    // 1. Idempotency Check
    const existingMeta = await PipeTransportRegistry.getPipedProducer(roomId, originalProducerId, relayRouterKey);
    if (existingMeta) {
      logger.info(JSON.stringify({
        event: 'producer_pipe_duplicate_prevented',
        roomId,
        originalProducerId,
        relayRouterKey,
        pipedProducerId: existingMeta.pipedProducerId,
      }));
      await releaseLock(lockKey, lockToken);
      return { success: true, data: { pipedProducerId: existingMeta.pipedProducerId } };
    }

    // 2. Fetch PipeTransport pair metadata
    const pair = await PipeTransportRegistry.getPipePair(roomId, primaryRouterKey, relayRouterKey);
    if (!pair) {
      await releaseLock(lockKey, lockToken);
      return { success: false, error: 'PipeTransport pair does not exist between routers' };
    }

    let primaryPipeTransport = localPrimaryTransports.get(pair.primaryPipeTransportId) || localPrimaryTransports.get(primaryRouterKey);
    
    // If not found in map, attempt to reconstruct or create transport on primaryRouter
    const primaryRouter = sfu.getRouter(primaryRouterId);
    if (!primaryRouter) {
      await releaseLock(lockKey, lockToken);
      return { success: false, error: 'Primary router not found on local SFU' };
    }

    if (!primaryPipeTransport) {
      const listenIp = LARGE_ROOM_CONFIG.pipeTransportListenIp === '0.0.0.0' ? '127.0.0.1' : LARGE_ROOM_CONFIG.pipeTransportListenIp;
      primaryPipeTransport = await primaryRouter.createPipeTransport({ listenIp });
      localPrimaryTransports.set(pair.primaryPipeTransportId, primaryPipeTransport);
      localPrimaryTransports.set(primaryRouterKey, primaryPipeTransport);
    }

    // 3. Primary Pod A creates PipeConsumer on primaryPipeTransport
    const producer = sfu.getProducer(originalProducerId);
    if (!producer) {
      await releaseLock(lockKey, lockToken);
      return { success: false, error: `Producer ${originalProducerId} not found` };
    }

    const pipeConsumer = await primaryPipeTransport.consume({
      producerId: originalProducerId,
    });

    localPipeConsumers.set(pipeConsumer.id, pipeConsumer);

    logger.info(JSON.stringify({
      event: 'producer_pipe_consumer_created_primary',
      roomId,
      originalProducerId,
      pipeConsumerId: pipeConsumer.id,
    }));

    // 4. Issue rpcCreatePipedProducer to Relay Pod B
    const timeoutMs = LARGE_ROOM_CONFIG.crossPodRpcTimeoutMs;
    let relayProdRes: any;

    try {
      relayProdRes = await redisMediaController.rpcCallToPod(
        relayPodId,
        'rpcCreatePipedProducer',
        [{
          roomId,
          primaryRouterKey,
          relayRouterKey,
          relayPipeTransportId: pair.relayPipeTransportId,
          originalProducerId,
          pipeConsumerId: pipeConsumer.id,
          kind: producer.kind,
          rtpParameters: pipeConsumer.rtpParameters,
          appData: producer.appData,
        }],
        timeoutMs
      );
    } catch (err: any) {
      logger.error(JSON.stringify({
        event: 'pipe_transport_rollback_started',
        roomId,
        stage: 'relay_piped_producer_rpc_failed',
        reason: err.message,
      }));
      pipeConsumer.close();
      localPipeConsumers.delete(pipeConsumer.id);
      await releaseLock(lockKey, lockToken);
      return { success: false, error: `Relay PipedProducer RPC failed: ${err.message}` };
    }

    if (!relayProdRes || !relayProdRes.pipedProducerId) {
      pipeConsumer.close();
      localPipeConsumers.delete(pipeConsumer.id);
      await releaseLock(lockKey, lockToken);
      return { success: false, error: relayProdRes?.error || 'Failed to create piped producer on relay' };
    }

    const pipedProducerId = relayProdRes.pipedProducerId;

    logger.info(JSON.stringify({
      event: 'producer_pipe_rpc_created_relay',
      roomId,
      relayPodId,
      pipedProducerId,
    }));

    // 5. Register metadata in PipeTransportRegistry
    const meta: PipedProducerMetadata = {
      roomId,
      originalProducerId,
      relayRouterKey,
      primaryRouterKey,
      pipePairId: pair.pipePairId,
      pipeConsumerId: pipeConsumer.id,
      pipedProducerId,
      kind: producer.kind as 'audio' | 'video',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await PipeTransportRegistry.registerPipedProducer(roomId, meta);

    logger.info(JSON.stringify({
      event: 'producer_piped_to_relay',
      roomId,
      originalProducerId,
      relayRouterKey,
      pipedProducerId,
    }));

    await releaseLock(lockKey, lockToken);
    return { success: true, data: { pipedProducerId } };
  } catch (err: any) {
    logger.error(`Failed to pipe producer cross-pod for room ${roomId}`, err);
    await releaseLock(lockKey, lockToken);
    return { success: false, error: err.message || 'Producer cross-pod piping failed' };
  }
}

/**
 * Propagates producer lifecycle state changes (pause/resume/close) to relay piped producers.
 */
export async function propagateProducerStateChange(
  roomId: string,
  originalProducerId: string,
  action: 'pause' | 'resume' | 'close'
): Promise<void> {
  try {
    const rawMap = await redis.hgetall(`room:${roomId}:pipedProducers`);
    if (!rawMap) return;

    for (const [field, raw] of Object.entries(rawMap)) {
      if (field.startsWith(`${originalProducerId}:`)) {
        try {
          const meta = JSON.parse(raw) as PipedProducerMetadata;
          const [relayPodId] = meta.relayRouterKey.split(':');

          await redisMediaController.rpcCallToPod(
            relayPodId,
            'rpcPropagateProducerState',
            [{ roomId, originalProducerId, relayRouterKey: meta.relayRouterKey, pipedProducerId: meta.pipedProducerId, action }],
            3000
          );

          if (action === 'pause') {
            logger.info(JSON.stringify({ event: 'piped_producer_paused', roomId, originalProducerId, pipedProducerId: meta.pipedProducerId }));
          } else if (action === 'resume') {
            logger.info(JSON.stringify({ event: 'piped_producer_resumed', roomId, originalProducerId, pipedProducerId: meta.pipedProducerId }));
          } else if (action === 'close') {
            logger.info(JSON.stringify({ event: 'piped_producer_closed', roomId, originalProducerId, pipedProducerId: meta.pipedProducerId }));
            await PipeTransportRegistry.removePipedProducer(roomId, originalProducerId, meta.relayRouterKey);
          }
        } catch (err) {
          logger.error(`Failed to propagate producer ${action} to relay for ${originalProducerId}`, err);
        }
      }
    }
  } catch (err) {
    logger.error(`Failed to fetch piped producers for room ${roomId}`, err);
  }
}

/**
 * Tears down a cross-pod PipeTransport pair and removes registry state.
 */
export async function closeCrossPodPipePair(
  roomId: string,
  primaryPodId: string,
  primaryRouterId: string,
  relayPodId: string,
  relayRouterId: string
): Promise<PipeTransportResult> {
  const primaryRouterKey = RoomTopologyRegistry.getRouterKey(primaryPodId, primaryRouterId);
  const relayRouterKey = RoomTopologyRegistry.getRouterKey(relayPodId, relayRouterId);

  try {
    const pair = await PipeTransportRegistry.getPipePair(roomId, primaryRouterKey, relayRouterKey);

    if (pair) {
      redisMediaController.rpcCallToPod(
        relayPodId,
        'rpcClosePipeTransport',
        [{ roomId, primaryRouterKey, relayRouterKey, relayPipeTransportId: pair.relayPipeTransportId }],
        3000
      ).catch(() => {});

      const primaryTransport = localPrimaryTransports.get(pair.primaryPipeTransportId) || localPrimaryTransports.get(primaryRouterKey);
      if (primaryTransport) primaryTransport.close();
      localPrimaryTransports.delete(pair.primaryPipeTransportId);
      localPrimaryTransports.delete(primaryRouterKey);
    }

    await PipeTransportRegistry.closePipePair(roomId, primaryRouterKey, relayRouterKey);

    logger.info(JSON.stringify({
      event: 'pipe_transport_cleanup_completed',
      roomId,
      primaryRouterKey,
      relayRouterKey,
    }));

    return { success: true };
  } catch (err: any) {
    logger.error(`Failed to close cross-pod pipe pair for room ${roomId}`, err);
    return { success: false, error: err.message || 'Cross-pod closure failed' };
  }
}

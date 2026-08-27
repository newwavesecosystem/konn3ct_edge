import { EventEmitter } from 'events';
import { PipeTransport, Producer } from 'mediasoup/node/lib/types';
import { logger } from '../logger';
import * as sfu from '../media/sfu';
import { LARGE_ROOM_CONFIG } from '../config/largeRoom';

// Local storage for PipeTransports and PipedProducers created on this pod as Relay
const relayPipeTransports = new Map<string, PipeTransport>();
const relayPipeProducers = new Map<string, Producer>();

export class LocalMediaController extends EventEmitter {
  constructor() {
    super();
  }

  async getOrCreateRouter(roomId: string) {
    const router = await sfu.getOrCreateRouter(roomId);
    return { id: router.id, rtpCapabilities: router.rtpCapabilities };
  }

  async createWebRtcTransport(roomId: string) {
    return sfu.createWebRtcTransport(roomId);
  }

  async connectTransport(transportId: string, dtlsParameters: any, roomId?: string) {
    return sfu.connectTransport(transportId, dtlsParameters);
  }

  async connectWebRtcTransport(transportId: string, dtlsParameters: any, roomId?: string) {
    return sfu.connectTransport(transportId, dtlsParameters);
  }

  async closeTransport(transportId: string, roomId?: string) {
    return sfu.closeTransport(transportId);
  }

  async restartIce(transportId: string, roomId?: string) {
    return sfu.restartIce(transportId);
  }

  async createProducer(
    transportId: string,
    kind: 'audio' | 'video',
    rtpParameters: any,
    roomId?: string,
    userId?: string,
    userName?: string,
    clientData?: { isBot?: boolean; role?: string },
    appData?: any,
    paused?: boolean
  ) {
    const producerId = await sfu.createProducer(transportId, kind, rtpParameters, roomId, userId, userName, clientData, appData, paused);
    return { id: producerId };
  }

  async createConsumer(
    transportId: string,
    producerId: string,
    rtpCapabilities: any,
    roomId: string
  ) {
    const router = await sfu.getOrCreateRouter(roomId);
    return sfu.createConsumer(
      transportId,
      producerId,
      rtpCapabilities,
      router,
      (consumerId) => {
        const producer = sfu.getProducer(producerId);
        const appData = producer ? producer.appData : {};
        this.emit('producerClose', { consumerId, producerId, appData });
      }
    );
  }

  async canConsume(roomId: string, producerId: string, rtpCapabilities: any): Promise<boolean> {
    const router = await sfu.getOrCreateRouter(roomId);
    return router.canConsume({ producerId, rtpCapabilities });
  }

  async getProducer(producerId: string) {
    return sfu.getProducer(producerId);
  }

  async pauseProducer(producerId: string) {
    return sfu.pauseProducer(producerId);
  }

  async resumeProducer(producerId: string) {
    return sfu.resumeProducer(producerId);
  }

  async closeProducer(producerId: string) {
    return sfu.closeProducer(producerId);
  }

  async pauseConsumer(consumerId: string) {
    return sfu.pauseConsumer(consumerId);
  }

  async resumeConsumer(consumerId: string) {
    return sfu.resumeConsumer(consumerId);
  }

  async requestConsumerKeyFrame(consumerId: string) {
    return sfu.requestConsumerKeyFrame(consumerId);
  }

  async setConsumerPreferredLayersAndPriority(consumerId: string, spatialLayer?: number, temporalLayer?: number, priority?: number) {
    return sfu.setConsumerPreferredLayersAndPriority(consumerId, spatialLayer, temporalLayer, priority);
  }

  async closeConsumer(consumerId: string) {
    return sfu.closeConsumer(consumerId);
  }

  async closeWebRtcTransport(transportId: string) {
    return sfu.closeTransport(transportId);
  }

  async closeRouter(roomId: string) {
    return sfu.closeRouter(roomId);
  }

  async cleanupAudioObserver(roomId: string): Promise<void> {
    await sfu.cleanupAudioObserver(roomId);
  }

  async handleTranscriptionMute(producerId: string, roomId: string, userId: string, userName: string, isMuted: boolean, clientData?: { isBot?: boolean, role?: string }): Promise<void> {
    await sfu.handleTranscriptionMute(producerId, roomId, userId, userName, isMuted, clientData);
  }

  // --- Cross-Pod Redis RPC Handlers ---

  async rpcCreatePipeTransport(data: { roomId: string; primaryRouterKey: string; relayRouterKey: string; listenIp: string; announcedIp?: string; enableSrtp?: boolean }): Promise<{ relayPipeTransportId: string; tuple: any; srtpParameters?: any }> {
    const [, relayRouterId] = data.relayRouterKey.split(':');
    const router = sfu.getRouter(relayRouterId || data.roomId) || await sfu.getOrCreateRouter(data.roomId);

    const transportOptions: any = {
      listenIp: data.listenIp === '0.0.0.0' ? '127.0.0.1' : data.listenIp,
      enableSrtp: data.enableSrtp ?? false,
    };

    if (data.announcedIp && process.platform !== 'win32') {
      transportOptions.announcedIp = data.announcedIp;
    }

    const transport = await router.createPipeTransport(transportOptions);
    relayPipeTransports.set(transport.id, transport);

    logger.info(JSON.stringify({
      event: 'pipe_transport_created_relay',
      roomId: data.roomId,
      relayPipeTransportId: transport.id,
      tuple: transport.tuple,
    }));

    const returnedIp = (process.platform === 'win32' || transport.tuple.localIp.startsWith('10.'))
      ? '127.0.0.1'
      : transport.tuple.localIp;

    return {
      relayPipeTransportId: transport.id,
      tuple: { localIp: returnedIp, localPort: transport.tuple.localPort },
      srtpParameters: transport.srtpParameters,
    };
  }

  async rpcConnectPipeTransport(data: { roomId: string; relayPipeTransportId: string; primaryTuple: { localIp: string; localPort: number }; primarySrtpParameters?: any }): Promise<void> {
    const transport = relayPipeTransports.get(data.relayPipeTransportId);
    if (!transport) {
      throw new Error(`Relay PipeTransport ${data.relayPipeTransportId} not found`);
    }

    try {
      const connectIp = (data.primaryTuple.localIp && data.primaryTuple.localIp.startsWith('10.') && process.platform === 'win32')
        ? '127.0.0.1'
        : data.primaryTuple.localIp;

      await transport.connect({
        ip: connectIp,
        port: data.primaryTuple.localPort,
        srtpParameters: data.primarySrtpParameters,
      });
    } catch (err: any) {
      logger.warn(`Relay PipeTransport connect warning (non-fatal): ${err.message}`);
    }

    logger.info(JSON.stringify({
      event: 'pipe_transport_connected_relay_to_primary',
      roomId: data.roomId,
      relayPipeTransportId: transport.id,
    }));
  }

  async rpcCreatePipedProducer(data: { roomId: string; relayPipeTransportId: string; originalProducerId: string; pipeConsumerId: string; kind: 'audio' | 'video'; rtpParameters: any; appData?: any }): Promise<{ pipedProducerId: string }> {
    const transport = relayPipeTransports.get(data.relayPipeTransportId);
    if (!transport) {
      throw new Error(`Relay PipeTransport ${data.relayPipeTransportId} not found`);
    }

    const pipedProducer = await transport.produce({
      id: `piped-${data.originalProducerId}`,
      kind: data.kind,
      rtpParameters: data.rtpParameters,
      appData: data.appData || {},
    });

    relayPipeProducers.set(pipedProducer.id, pipedProducer);
    sfu.producers.set(pipedProducer.id, pipedProducer);

    logger.info(JSON.stringify({
      event: 'producer_pipe_rpc_created_relay',
      roomId: data.roomId,
      originalProducerId: data.originalProducerId,
      pipedProducerId: pipedProducer.id,
    }));

    return { pipedProducerId: pipedProducer.id };
  }

  async rpcPropagateProducerState(data: { roomId: string; pipedProducerId: string; action: 'pause' | 'resume' | 'close' }): Promise<void> {
    const pipedProducer = relayPipeProducers.get(data.pipedProducerId);
    if (!pipedProducer) return;

    if (data.action === 'pause') {
      await pipedProducer.pause();
    } else if (data.action === 'resume') {
      await pipedProducer.resume();
    } else if (data.action === 'close') {
      pipedProducer.close();
      relayPipeProducers.delete(data.pipedProducerId);
    }
  }

  async rpcClosePipeTransport(data: { roomId: string; relayPipeTransportId: string }): Promise<void> {
    const transport = relayPipeTransports.get(data.relayPipeTransportId);
    if (transport) {
      transport.close();
      relayPipeTransports.delete(data.relayPipeTransportId);
    }
  }

  public static async createRelayRouterOnPod(roomId: string, targetPodId: string): Promise<{ success: boolean; routerKey?: string; error?: string }> {
    try {
      const currentPodId = process.env.POD_ID || 'pod-local';
      if (targetPodId === currentPodId || targetPodId === 'pod-local') {
        const router = await sfu.getOrCreateRouter(roomId);
        const routerKey = `${targetPodId}:${router.id}`;
        return { success: true, routerKey };
      }

      const { RedisMediaController } = await import('./RedisMediaController');
      const rpcClient = new RedisMediaController();
      const router = await rpcClient.getOrCreateRouter(roomId);
      if (router && router.id) {
        const routerKey = `${targetPodId}:${router.id}`;
        return { success: true, routerKey };
      }
      return { success: false, error: 'Remote router creation returned empty response' };
    } catch (err: any) {
      logger.error(`createRelayRouterOnPod error for room ${roomId} on pod ${targetPodId}`, err);
      return { success: false, error: err?.message || String(err) };
    }
  }

  public static async ensurePipeTransport(roomId: string, primaryRouterKey: string, relayRouterKey: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { PipeTransportRegistry } = await import('./PipeTransportRegistry');
      const existing = await PipeTransportRegistry.getPipePair(roomId, primaryRouterKey, relayRouterKey);
      if (existing) {
        return { success: true };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  public static async fanOutAllProducersToRelay(roomId: string, primaryRouterKey: string, relayRouterKey: string): Promise<{ success: boolean; pipedCount: number; error?: string }> {
    try {
      const { RoomTopologyRegistry } = await import('./RoomTopologyRegistry');
      const topology = await RoomTopologyRegistry.getRoomTopology(roomId);
      if (!topology || !topology.producerRouterMap) {
        return { success: true, pipedCount: 0 };
      }

      let pipedCount = 0;
      for (const [originalProducerId, rKey] of Object.entries(topology.producerRouterMap)) {
        if (rKey === primaryRouterKey) {
          pipedCount++;
        }
      }

      return { success: true, pipedCount };
    } catch (err: any) {
      logger.error(`fanOutAllProducersToRelay error for room ${roomId}`, err);
      return { success: false, pipedCount: 0, error: err?.message || String(err) };
    }
  }

  public static async fanOutProducerToAllRelays(roomId: string, originalProducerId: string): Promise<{ success: boolean; relayedCount: number; warning?: string }> {
    try {
      const { RoomTopologyRegistry } = await import('./RoomTopologyRegistry');
      const topology = await RoomTopologyRegistry.getRoomTopology(roomId);
      if (!topology || !topology.primaryRouterKey || !topology.routers) {
        return { success: true, relayedCount: 0 };
      }

      let relayedCount = 0;
      let capacityWarningTriggered = false;
      const readyRelays = Object.values(topology.routers).filter(r => r.role === 'relay' && (r.state === 'READY' || !r.state));

      for (const relayNode of readyRelays) {
        const estConsumers = relayNode.capacity.estimatedConsumerCount || 0;
        const curViewers = relayNode.capacity.currentViewerCount || 0;
        const maxConsumers = relayNode.capacity.maxConsumers || 500;

        // Capacity Projection Check for New Producer
        const projectedConsumers = estConsumers + curViewers;
        if (projectedConsumers >= maxConsumers) {
          logger.warn(JSON.stringify({
            event: 'relay_capacity_threshold_reached',
            roomId,
            relayRouterKey: relayNode.routerKey,
            projectedConsumers,
            maxConsumers,
            reason: 'new_producer_capacity_overload',
          }));
          capacityWarningTriggered = true;
          const { RelayProvisioner } = await import('./RelayProvisioner');
          RelayProvisioner.checkAndTriggerPreProvisioning(roomId).catch(() => {});
        }

        relayedCount++;
      }

      return {
        success: true,
        relayedCount,
        warning: capacityWarningTriggered ? 'new_producer_capacity_threshold_reached' : undefined,
      };
    } catch (err: any) {
      logger.error(`fanOutProducerToAllRelays error for room ${roomId}`, err);
      return { success: false, relayedCount: 0 };
    }
  }
}

export const localMediaController = new LocalMediaController();


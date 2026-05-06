import * as mediasoup from 'mediasoup';
import { Worker, Router, Transport, Producer, Consumer } from 'mediasoup/node/lib/types';
import { config } from './config';
import { logger } from '../logger';

// Store workers, and map roomId -> Router
const workers: Worker[] = [];
let nextWorkerIdx = 0;

const routers = new Map<string, Router>();
const transports = new Map<string, Transport>();
const producers = new Map<string, Producer>();
const consumers = new Map<string, Consumer>();

/**
 * Initialize mediasoup workers based on CPU cores
 */
export async function initializeWorkers() {
  const { numWorkers } = config.mediasoup;
  
  for (let i = 0; i < numWorkers; i++) {
    const worker = await mediasoup.createWorker(config.mediasoup.worker);
    
    worker.on('died', () => {
      logger.error(`mediasoup Worker ${worker.pid} died, exiting in 2 seconds...`);
      setTimeout(() => process.exit(1), 2000);
    });

    workers.push(worker);
  }
  
  logger.info(`Initialized ${workers.length} mediasoup workers`);
}

/**
 * Get the next worker via round-robin
 */
function getWorker(): Worker {
  const worker = workers[nextWorkerIdx];
  nextWorkerIdx = (nextWorkerIdx + 1) % workers.length;
  return worker;
}

/**
 * Create or get a Router for a specific room
 */
export async function getOrCreateRouter(roomId: string): Promise<Router> {
  if (routers.has(roomId)) {
    return routers.get(roomId)!;
  }

  const worker = getWorker();
  const router = await worker.createRouter({ mediaCodecs: config.mediasoup.router.mediaCodecs });
  
  routers.set(roomId, router);
  logger.info(`Router created for room ${roomId}`);
  
  return router;
}

/**
 * Create a WebRTC Transport for a client to send/receive media
 */
export async function createWebRtcTransport(roomId: string) {
  const router = await getOrCreateRouter(roomId);
  
  const transport = await router.createWebRtcTransport({
    listenIps: config.mediasoup.webRtcTransport.listenIps,
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: config.mediasoup.webRtcTransport.initialAvailableOutgoingBitrate
  });

  transports.set(transport.id, transport);

  transport.on('dtlsstatechange', (dtlsState) => {
    if (dtlsState === 'closed' || dtlsState === 'failed') {
      transport.close();
      transports.delete(transport.id);
    }
  });

  return {
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters
  };
}

/**
 * Connect the transport using DTLS params from the client
 */
export async function connectTransport(transportId: string, dtlsParameters: any) {
  const transport = transports.get(transportId);
  if (!transport) throw new Error(`Transport ${transportId} not found`);
  
  await transport.connect({ dtlsParameters });
}

/**
 * Create a Producer (client sending media)
 */
export async function createProducer(transportId: string, kind: 'audio' | 'video', rtpParameters: any) {
  const transport = transports.get(transportId);
  if (!transport) throw new Error(`Transport ${transportId} not found`);

  const producer = await transport.produce({ kind, rtpParameters });
  producers.set(producer.id, producer);

  producer.on('transportclose', () => {
    producer.close();
    producers.delete(producer.id);
  });

  return producer.id;
}

/**
 * Create a Consumer (client receiving media)
 */
export async function createConsumer(transportId: string, producerId: string, rtpCapabilities: any, router: Router) {
  const transport = transports.get(transportId);
  if (!transport) throw new Error(`Transport ${transportId} not found`);

  if (!router.canConsume({ producerId, rtpCapabilities })) {
    throw new Error('Client cannot consume this producer');
  }

  const consumer = await transport.consume({
    producerId,
    rtpCapabilities,
    paused: true // Start paused according to mediasoup best practices
  });

  consumers.set(consumer.id, consumer);

  consumer.on('transportclose', () => {
    consumer.close();
    consumers.delete(consumer.id);
  });

  consumer.on('producerclose', () => {
    consumer.close();
    consumers.delete(consumer.id);
  });

  return {
    id: consumer.id,
    producerId,
    kind: consumer.kind,
    rtpParameters: consumer.rtpParameters
  };
}

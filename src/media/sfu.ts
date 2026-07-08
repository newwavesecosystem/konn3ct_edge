import * as mediasoup from 'mediasoup';
import { Worker, Router, Transport, Producer, Consumer, AudioLevelObserver } from 'mediasoup/node/lib/types';
import { config } from './config';
import { logger } from '../logger';

// Store workers, and map roomId -> Router
const workers: Worker[] = [];
let nextWorkerIdx = 0;

const routers = new Map<string, Router>();
const transports = new Map<string, Transport>();
const producers = new Map<string, Producer>();
const consumers = new Map<string, Consumer>();
const audioObservers = new Map<string, AudioLevelObserver>();

/**
 * Initialize mediasoup workers based on CPU cores
 */
export async function initializeWorkers() {
  const { numWorkers } = config.mediasoup;
  
  for (let i = 0; i < numWorkers; i++) {
    const worker = await mediasoup.createWorker(config.mediasoup.worker);
    attachWorkerListeners(worker);
    workers.push(worker);
  }
  
  logger.info(`Initialized ${workers.length} mediasoup workers`);
}

/**
 * Attach lifecycle listeners to a worker.
 * On death, spawn a replacement instead of crashing the process.
 */
function attachWorkerListeners(worker: Worker) {
  worker.on('died', () => {
    logger.error(
      `mediasoup Worker pid=${worker.pid} died — spawning replacement worker`
    );
    spawnReplacementWorker(worker);
  });
}

/**
 * Replace a dead worker in the pool with a fresh one.
 * Active transports/producers/consumers on the dead worker will close naturally
 * (their 'transportclose' / 'producerclose' events fire automatically).
 * New rooms will be routed to the replacement worker via round-robin.
 */
async function spawnReplacementWorker(deadWorker: Worker) {
  try {
    const idx = workers.indexOf(deadWorker);
    const newWorker = await mediasoup.createWorker(config.mediasoup.worker);
    attachWorkerListeners(newWorker);

    if (idx !== -1) {
      workers[idx] = newWorker;
    } else {
      workers.push(newWorker);
    }

    logger.info(
      `Replacement mediasoup worker started. New pid=${newWorker.pid} ` +
      `(replaced slot ${idx !== -1 ? idx : 'new'}). Total workers: ${workers.length}`
    );
  } catch (err) {
    logger.error('Failed to spawn replacement mediasoup worker:', err);
    // Only exit if we have no workers left at all — otherwise keep serving
    if (workers.filter(w => !w.closed).length === 0) {
      logger.error('All mediasoup workers are dead. Shutting down.');
      process.exit(1);
    }
  }
}


/**
 * Get the next worker via round-robin
 */
function getWorker(): Worker {
  const worker = workers[nextWorkerIdx];
  nextWorkerIdx = (nextWorkerIdx + 1) % workers.length;
  return worker;
}

const routersPromises = new Map<string, Promise<Router>>();

/**
 * Create or get a Router for a specific room
 */
export async function getOrCreateRouter(roomId: string): Promise<Router> {
  if (routers.has(roomId)) {
    return routers.get(roomId)!;
  }
  
  if (routersPromises.has(roomId)) {
    return routersPromises.get(roomId)!;
  }

  const promise = (async () => {
    const worker = getWorker();
    const router = await worker.createRouter({ mediaCodecs: config.mediasoup.router.mediaCodecs });
    
    routers.set(roomId, router);
    logger.info(`Router created for room ${roomId}`);
    return router;
  })();

  routersPromises.set(roomId, promise);
  
  try {
    const router = await promise;
    return router;
  } finally {
    routersPromises.delete(roomId);
  }
}

/**
 * Close a Router and remove it from memory
 */
export function closeRouter(roomId: string) {
  const router = routers.get(roomId);
  if (router) {
    router.close();
    routers.delete(roomId);
    logger.info(`Router closed for room ${roomId}`);
  }
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

const audioObserversPromises = new Map<string, Promise<void>>();

/**
 * Setup Audio Level Observer for a room
 */
export async function setupAudioObserver(roomId: string, onSpeaking: (producerIds: string[]) => void) {
  if (audioObservers.has(roomId)) return;
  if (audioObserversPromises.has(roomId)) {
    await audioObserversPromises.get(roomId);
    return;
  }
  
  const promise = (async () => {
    const router = await getOrCreateRouter(roomId);
    
    const observer = await router.createAudioLevelObserver({
      maxEntries: 100,
      threshold: -60, // dBov (typical silence is below -60)
      interval: 300   // Trigger every 300ms
    });

    observer.on('volumes', (volumes) => {
      // volumes is array of { producer, volume }
      onSpeaking(volumes.map(v => v.producer.id));
    });
    
    observer.on('silence', () => {
      onSpeaking([]); // No one is talking
    });

    audioObservers.set(roomId, observer);
  })();

  audioObserversPromises.set(roomId, promise);
  try {
    await promise;
  } finally {
    audioObserversPromises.delete(roomId);
  }
}

/**
 * Clean up Audio Observer
 */
export function cleanupAudioObserver(roomId: string) {
  const observer = audioObservers.get(roomId);
  if (observer) {
    observer.close();
    audioObservers.delete(roomId);
  }
}

import { startTranscription } from './transcriber';

/**
 * Get a specific Producer by ID
 */
export function getProducer(producerId: string): Producer | undefined {
  return producers.get(producerId);
}

/**
 * Create a Producer (client sending media)
 */
export async function createProducer(transportId: string, kind: 'audio' | 'video', rtpParameters: any, roomId?: string, userId?: string, userName?: string, clientData?: { isBot?: boolean, role?: string }) {
  const transport = transports.get(transportId);
  if (!transport) throw new Error(`Transport ${transportId} not found`);

  const producer = await transport.produce({ kind, rtpParameters });
  producers.set(producer.id, producer);

  // If this is an audio producer and we know the room, add it to the room's AudioLevelObserver
  if (kind === 'audio' && roomId) {
    if (audioObserversPromises.has(roomId)) {
      await audioObserversPromises.get(roomId);
    }
    const observer = audioObservers.get(roomId);
    if (observer && !producer.closed) {
      observer.addProducer({ producerId: producer.id }).catch(e => {
        if (!producer.closed) {
          logger.warn(`AudioLevelObserver addProducer failed for ${producer.id}:`, e.message);
        }
      });
    }

    // Start server-side transcription
    if (userId && userName) {
      const router = routers.get(roomId);
      if (router) {
        startTranscription(producer, router, roomId, userId, userName, clientData).catch(e => {
          logger.error(`Failed to start transcription for ${userId}:`, e);
        });
      }
    }
  }

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

/**
 * Resume a paused consumer
 */
export async function resumeConsumer(consumerId: string, clientCleanupStarted?: boolean) {
  const consumer = consumers.get(consumerId);
  try {
    if (!consumer || consumer.closed) {
      logger.info(`[SFU] sfu_consumer_resume_skipped: consumer not found or closed for ${consumerId}`);
      return;
    }
    const producer = producers.get(consumer.producerId);
    if (!producer || producer.closed) {
      logger.info(`[SFU] sfu_consumer_resume_skipped: producer closed for ${consumerId}`);
      return;
    }
    if (clientCleanupStarted) {
      logger.info(`[SFU] sfu_consumer_resume_skipped: client cleanup started for ${consumerId}`);
      return;
    }

    await consumer.resume();
  } catch (err: any) {
    if (err.message && err.message.includes('Channel request handler with ID')) {
      logger.warn(`[SFU] sfu_consumer_resume_failed_closed: Expected Mediasoup closure for ${consumerId}`);
      return;
    }
    logger.error(`[SFU] Error resuming consumer ${consumerId}:`, err);
  }
}

/**
 * Close a specific producer by ID (used when a client stops screen sharing)
 */
export function closeProducer(producerId: string) {
  const producer = producers.get(producerId);
  if (producer && !producer.closed) {
    producer.close();
    producers.delete(producerId);
  }
}

/**
 * Create a Consumer with an optional producerclose callback so the signaling
 * server can notify the receiving client when the remote producer stops.
 */
export async function createConsumerWithCallback(
  transportId: string,
  producerId: string,
  rtpCapabilities: any,
  router: Router,
  onProducerClose: (consumerId: string) => void,
  onScore?: (score: number) => void
) {
  const transport = transports.get(transportId);
  if (!transport) throw new Error(`Transport ${transportId} not found`);

  if (!router.canConsume({ producerId, rtpCapabilities })) {
    throw new Error('Client cannot consume this producer');
  }

  const consumer = await transport.consume({
    producerId,
    rtpCapabilities,
    paused: true
  });

  consumers.set(consumer.id, consumer);

  consumer.on('transportclose', () => {
    consumer.close();
    consumers.delete(consumer.id);
  });

  consumer.on('producerclose', () => {
    consumer.close();
    consumers.delete(consumer.id);
    onProducerClose(consumer.id); // Notify signaling server to forward event to client
  });

  consumer.on('score', (score) => {
    if (onScore) {
      // score is an object like { score: 10, producerScore: 10, ... }
      // We take the consumer's score (0-10, 10 is best)
      onScore(score.score);
    }
  });

  return {
    id: consumer.id,
    producerId,
    kind: consumer.kind,
    rtpParameters: consumer.rtpParameters
  };
}

/**
 * Close a specific transport by ID. This will automatically trigger 'transportclose'
 * on all its associated producers and consumers, cleaning them up cleanly.
 */
export function closeTransport(transportId: string) {
  const transport = transports.get(transportId);
  if (transport && !transport.closed) {
    transport.close();
    transports.delete(transportId);
  }
}

export async function pauseConsumer(consumerId: string) {
  const consumer = consumers.get(consumerId);
  if (consumer) {
    await consumer.pause();
  }
}

export async function requestConsumerKeyFrame(consumerId: string) {
  const consumer = consumers.get(consumerId);
  if (consumer && consumer.kind === 'video') {
    try {
      await consumer.requestKeyFrame();
    } catch (err) {
      console.warn(`[SFU] Failed to request keyframe for consumer ${consumerId}:`, err);
    }
  }
}

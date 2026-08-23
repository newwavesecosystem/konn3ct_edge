import * as mediasoup from 'mediasoup';
import { Worker, Router, Transport, WebRtcTransport, Producer, Consumer, AudioLevelObserver } from 'mediasoup/node/lib/types';
import { config } from './config';
import { logger } from '../logger';
import * as promClient from 'prom-client';

const workerGauge = new promClient.Gauge({ name: 'konn3ct_active_workers', help: 'Number of active Mediasoup workers' });
const routerGauge = new promClient.Gauge({ name: 'konn3ct_active_routers', help: 'Number of active routers' });
const transportGauge = new promClient.Gauge({ name: 'konn3ct_active_transports', help: 'Number of active transports' });
const producerGauge = new promClient.Gauge({ name: 'konn3ct_active_producers', help: 'Number of active producers' });
const consumerGauge = new promClient.Gauge({ name: 'konn3ct_active_consumers', help: 'Number of active consumers' });

// Phase 0 Deep Metrics
const inboundBitrateGauge = new promClient.Gauge({ name: 'konn3ct_inbound_bitrate', help: 'Total inbound WebRTC bitrate' });
const outboundBitrateGauge = new promClient.Gauge({ name: 'konn3ct_outbound_bitrate', help: 'Total outbound WebRTC bitrate' });
const packetLossGauge = new promClient.Gauge({ name: 'konn3ct_packet_loss_total', help: 'Total packet loss count' });
const nackCountGauge = new promClient.Gauge({ name: 'konn3ct_nack_total', help: 'Total NACK count' });
const pliCountGauge = new promClient.Gauge({ name: 'konn3ct_pli_total', help: 'Total PLI count' });
const firCountGauge = new promClient.Gauge({ name: 'konn3ct_fir_total', help: 'Total FIR count' });
const roomCreationLatencyGauge = new promClient.Gauge({ name: 'konn3ct_room_creation_latency_ms', help: 'Time to create a mediasoup router' });
const iceFailureGauge = new promClient.Gauge({ name: 'konn3ct_ice_failure_total', help: 'Total ICE failures' });




// Store workers, and map roomId -> Router
const workers: Worker[] = [];
let nextWorkerIdx = 0;

const routers = new Map<string, Router>();
export const transports = new Map<string, Transport>();
export const producers = new Map<string, Producer>();
const consumers = new Map<string, Consumer>();
const audioObservers = new Map<string, AudioLevelObserver>();

// --- Telemetry Data Structures ---
const consumerLatencies: { canConsume: number, consume: number, total: number }[] = [];

setInterval(async () => {
  // Worker Resource Usage
  for (const worker of workers) {
    try {
      const usage = await worker.getResourceUsage();
      let routerCount = 0;
      let transportCount = 0;
      let producerCount = 0;
      let consumerCount = 0;
      
      // Correlate with worker
      for (const router of routers.values()) {
        if ((router as any).appData?.workerPid === worker.pid) {
          routerCount++;
        }
      }
      
      // Global counts as fallback
      transportCount = transports.size;
      producerCount = producers.size;
      consumerCount = consumers.size;

      logger.info(`[Telemetry] Worker ${worker.pid} CPU: user=${usage.ru_utime}ms, sys=${usage.ru_stime}ms, RSS=${usage.ru_maxrss}kb. Globals: Transports=${transportCount}, Producers=${producerCount}, Consumers=${consumerCount}, Routers=${routerCount}`);
      
      workerGauge.set(workers.length);
      routerGauge.set(routers.size);
      transportGauge.set(transportCount);
      producerGauge.set(producerCount);
      consumerGauge.set(consumerCount);
    } catch (e) {
      logger.warn('Failed to get worker resource usage', e);
    }
  }
  
  // Latency Percentiles
  if (consumerLatencies.length > 0) {
    const latencies = consumerLatencies.splice(0, consumerLatencies.length); // clear and grab
    latencies.sort((a, b) => a.total - b.total);
    const getP = (p: number) => latencies[Math.floor((latencies.length - 1) * p)].total.toFixed(1);
    const fastest = latencies[0].total.toFixed(1);
    const slowest = latencies[latencies.length - 1].total.toFixed(1);
    const p50 = getP(0.5);
    const p95 = getP(0.95);
    const p99 = getP(0.99);
    
    // Average sub-stages
    const avgCanConsume = (latencies.reduce((sum, l) => sum + l.canConsume, 0) / latencies.length).toFixed(1);
    const avgConsume = (latencies.reduce((sum, l) => sum + l.consume, 0) / latencies.length).toFixed(1);
    
    logger.info(`[Telemetry] Consumer Latency (${latencies.length} samples): Fastest=${fastest}ms, P50=${p50}ms, P95=${p95}ms, P99=${p99}ms, Slowest=${slowest}ms. Sub-stages Avg: canConsume=${avgCanConsume}ms, consume=${avgConsume}ms`);
  }
}, 5000);

// --- Phase 0 Deep WebRTC Stats Polling ---
setInterval(async () => {
  let inBitrate = 0;
  let outBitrate = 0;
  let packetLoss = 0;
  let nackCount = 0;
  let pliCount = 0;
  let firCount = 0;

  for (const transport of transports.values()) {
    try {
      const stats = await transport.getStats();
      for (const stat of stats as any[]) {
        if (stat.type === 'inbound-rtp') {
          inBitrate += stat.bitrate || 0;
          packetLoss += stat.packetsLost || 0;
          nackCount += stat.nackCount || 0;
          pliCount += stat.pliCount || 0;
          firCount += stat.firCount || 0;
        } else if (stat.type === 'outbound-rtp') {
          outBitrate += stat.bitrate || 0;
        }
      }
    } catch (e) {
      // transport may be closed, ignore
    }
  }

  inboundBitrateGauge.set(inBitrate);
  outboundBitrateGauge.set(outBitrate);
  packetLossGauge.set(packetLoss);
  nackCountGauge.set(nackCount);
  pliCountGauge.set(pliCount);
  firCountGauge.set(firCount);
}, 15000);
// ----------------------------------


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
    const startMs = performance.now();
    const worker = getWorker();
    const router = await worker.createRouter({ mediaCodecs: config.mediasoup.router.mediaCodecs });
    router.appData.workerPid = worker.pid;
    
    routers.set(roomId, router);
    logger.info(`Router created for room ${roomId}`);
    roomCreationLatencyGauge.set(performance.now() - startMs);
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

export function getRouter(routerIdOrRoomId: string): Router | undefined {
  if (routers.has(routerIdOrRoomId)) {
    return routers.get(routerIdOrRoomId);
  }
  for (const router of routers.values()) {
    if (router.id === routerIdOrRoomId) {
      return router;
    }
  }
  return undefined;
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

  if (config.mediasoup.webRtcTransport.maxIncomingBitrate) {
    try {
      await transport.setMaxIncomingBitrate(config.mediasoup.webRtcTransport.maxIncomingBitrate);
    } catch (e) {
      logger.error('Failed to set max incoming bitrate:', e);
    }
  }

  transport.on('icestatechange', (iceState) => {
    logger.info(`Transport ${transport.id} icestatechange: ${iceState}`);
    if (iceState === 'disconnected' || iceState === 'closed') {
      iceFailureGauge.inc();
    }
  });

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

import { startTranscription, stopTranscription } from './transcriber';

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
export async function createConsumer(
  transportId: string,
  producerId: string,
  rtpCapabilities: any,
  router: Router,
  onProducerClose?: (consumerId: string) => void
) {
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
    if (onProducerClose) {
      onProducerClose(consumer.id);
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
export async function pauseProducer(producerId: string): Promise<void> {
  const producer = producers.get(producerId);
  if (producer && !producer.closed) {
    await producer.pause();
  }
}

export async function resumeProducer(producerId: string): Promise<void> {
  const producer = producers.get(producerId);
  if (producer && !producer.closed) {
    await producer.resume();
  }
}

export function closeConsumer(consumerId: string): void {
  const consumer = consumers.get(consumerId);
  if (consumer && !consumer.closed) {
    consumer.close();
    consumers.delete(consumerId);
  }
}

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
  const startTotal = performance.now();
  const transport = transports.get(transportId);
  if (!transport) throw new Error(`Transport ${transportId} not found`);

  const startCanConsume = performance.now();
  if (!router.canConsume({ producerId, rtpCapabilities })) {
    throw new Error('Client cannot consume this producer');
  }
  const endCanConsume = performance.now();

  const startConsume = performance.now();
  const consumer = await transport.consume({
    producerId,
    rtpCapabilities,
    paused: true
  });
  const endConsume = performance.now();
  
  const endTotal = performance.now();
  consumerLatencies.push({
    canConsume: endCanConsume - startCanConsume,
    consume: endConsume - startConsume,
    total: endTotal - startTotal
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

export async function restartIce(transportId: string) {
  const transport = transports.get(transportId) as WebRtcTransport;
  if (!transport || transport.closed) {
    throw new Error(`Transport ${transportId} not found or closed`);
  }
  const iceParameters = await transport.restartIce();
  return iceParameters;
}

export async function pauseConsumer(consumerId: string) {
  const consumer = consumers.get(consumerId);
  if (consumer) {
    await consumer.pause();
  }
}

export async function requestConsumerKeyFrame(consumerId: string) {
  const consumer = consumers.get(consumerId);
  if (!consumer) throw new Error(`Consumer ${consumerId} not found`);
  
  if (consumer.kind !== 'video') {
    return;
  }
  
  await consumer.requestKeyFrame();
}

export function handleTranscriptionMute(producerId: string, roomId: string, userId: string, userName: string, isMuted: boolean, clientData?: { isBot?: boolean, role?: string }) {
  if (isMuted) {
    stopTranscription(producerId);
  } else {
    const producer = producers.get(producerId);
    const router = routers.get(roomId);
    if (producer && router && !producer.closed) {
      startTranscription(producer, router, roomId, userId, userName, clientData).catch(e => {
        logger.error(`Failed to restart transcription for ${userId} on unmute:`, e);
      });
    }
  }
}

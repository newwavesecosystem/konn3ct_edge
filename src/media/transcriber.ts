import { Producer, Router, PlainTransport, Consumer } from 'mediasoup/node/lib/types';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import dgram from 'dgram';
import { DeepgramClient } from '@deepgram/sdk';
import { logger } from '../logger';
import { db } from '../db';
import { EventEmitter } from 'events';
import WebSocket from 'ws';

const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
const deepgram = deepgramApiKey ? new DeepgramClient({ apiKey: deepgramApiKey }) : null;

// Emitter to broadcast captions back to server.ts / media-server.ts
export const transcriberEvents = new EventEmitter();

// 4-digit port range for internal loopback RTP/RTCP
const TRANSCRIBER_MIN_PORT = 6500;
const TRANSCRIBER_MAX_PORT = 7500;
let currentPort = TRANSCRIBER_MIN_PORT;

async function isUdpPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    socket.once('error', () => resolve(false));
    socket.bind(port, '127.0.0.1', () => {
      socket.close(() => resolve(true));
    });
  });
}

async function getGuaranteedFreePortPair(): Promise<{ rtpPort: number; rtcpPort: number }> {
  for (let attempt = 0; attempt < 500; attempt++) {
    const rtp = currentPort;
    const rtcp = currentPort + 1;
    currentPort += 2;
    if (currentPort > TRANSCRIBER_MAX_PORT - 2) {
      currentPort = TRANSCRIBER_MIN_PORT;
    }

    const [rtpOk, rtcpOk] = await Promise.all([
      isUdpPortAvailable(rtp),
      isUdpPortAvailable(rtcp)
    ]);

    if (rtpOk && rtcpOk) {
      return { rtpPort: rtp, rtcpPort: rtcp };
    }
  }

  // Fallback to OS assigned ephemeral port if range is saturated
  return new Promise((resolve, reject) => {
    const s1 = dgram.createSocket('udp4');
    s1.bind(0, '127.0.0.1', () => {
      const p1 = s1.address().port;
      s1.close(() => {
        const s2 = dgram.createSocket('udp4');
        s2.bind(0, '127.0.0.1', () => {
          const p2 = s2.address().port;
          s2.close(() => resolve({ rtpPort: p1, rtcpPort: p2 }));
        });
        s2.once('error', reject);
      });
    });
    s1.once('error', reject);
  });
}

interface TranscriberSession {
  producerId: string;
  consumer: Consumer;
  plainTransport: PlainTransport;
  ffmpegProcess: ChildProcessWithoutNullStreams;
  dgSocket: WebSocket;
  gracePeriodTimer?: NodeJS.Timeout;
  keepAliveInterval?: NodeJS.Timeout;
  pingInterval?: NodeJS.Timeout;
  cleanup: () => void;
  isPaused: boolean;
}

// Map producerId -> active/warm transcriber session
const activeSessions = new Map<string, TranscriberSession>();

export async function startTranscription(
  producer: Producer,
  router: Router,
  roomId: string,
  userId: string,
  userName: string,
  clientData?: { isBot?: boolean; role?: string }
) {
  // If a warm session already exists, resume it immediately
  const existingSession = activeSessions.get(producer.id);
  if (existingSession) {
    if (existingSession.gracePeriodTimer) {
      clearTimeout(existingSession.gracePeriodTimer);
      existingSession.gracePeriodTimer = undefined;
    }
    if (existingSession.isPaused && !existingSession.consumer.closed) {
      try {
        await existingSession.consumer.resume();
        existingSession.isPaused = false;
        logger.info(`[DEEPGRAM] Resumed warm transcription session for user ${userId} in room ${roomId}`);
        return;
      } catch (err) {
        logger.warn(`[DEEPGRAM] Failed to resume warm consumer, rebuilding:`, err);
        existingSession.cleanup();
      }
    } else {
      return;
    }
  }

  logger.info(`[DEEPGRAM] startTranscription called for user ${userId} in room ${roomId}`);
  
  const isBot = clientData?.isBot || clientData?.role === 'bot' || clientData?.role === 'recorder';
  const isLoadTestMode = process.env.LOAD_TEST_MODE === 'true';
  const disableForBots = process.env.DISABLE_TRANSCRIPTION_FOR_BOTS === 'true';

  if ((isBot || isLoadTestMode) && disableForBots) {
    logger.info(`[DEEPGRAM] transcription_skipped_for_bot: user ${userId}`);
    return;
  }

  const room = await db.room.findFirst({
    where: { OR: [{ id: roomId }, { slug: roomId }] }
  });

  if (room && room.captionsEnabled === false) {
    logger.info(`[DEEPGRAM] caption_disabled_no_deepgram_connection: room ${roomId}`);
    return;
  }

  if (!deepgram || !deepgramApiKey) {
    logger.warn(`[DEEPGRAM] No API key found, skipping transcription for user ${userId}`);
    return;
  }

  // 1. Get guaranteed available 4-digit port pair (6500-7500)
  const { rtpPort, rtcpPort } = await getGuaranteedFreePortPair();
  
  // 2. Create PlainTransport on Mediasoup to send RTP to FFmpeg
  const plainTransport = await router.createPlainTransport({
    listenIp: { ip: '127.0.0.1' },
    rtcpMux: false,
    comedia: false
  });
  
  await plainTransport.connect({
    ip: '127.0.0.1',
    port: rtpPort,
    rtcpPort: rtcpPort
  });
  
  const consumer = await plainTransport.consume({
    producerId: producer.id,
    rtpCapabilities: router.rtpCapabilities,
    paused: true
  });
  
  // 3. Connect to Deepgram Nova-2 with real-time interim streaming & endpointing
  const deepgramUrl = 'wss://api.deepgram.com/v1/listen?model=nova-2&language=en&smart_format=true&interim_results=true&endpointing=300&vad_events=true&encoding=linear16&sample_rate=48000&channels=1';
  const dgSocket = new WebSocket(deepgramUrl, {
    headers: {
      Authorization: `Token ${deepgramApiKey}`
    }
  });
  
  // 4. Spawn FFmpeg with dedicated port pair
  const pt = consumer.rtpParameters.codecs[0].payloadType;
  const sdpString = `v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=FFmpeg\r\nc=IN IP4 127.0.0.1\r\nt=0 0\r\nm=audio ${rtpPort} RTP/AVP ${pt}\r\na=rtpmap:${pt} opus/48000/2\r\n`;
  
  const ffmpegArgs = [
    '-protocol_whitelist', 'file,rtp,udp,pipe',
    '-f', 'sdp',
    '-i', 'pipe:0',
    '-f', 's16le',
    '-ac', '1',
    '-ar', '48000',
    'pipe:1'
  ];
  
  const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
  
  // Write SDP to ffmpeg stdin
  ffmpegProcess.stdin.write(sdpString);
  ffmpegProcess.stdin.end();
  
  // Pipe ffmpeg stdout to Deepgram
  ffmpegProcess.stdout.on('data', (data: Buffer) => {
    if (dgSocket.readyState === WebSocket.OPEN) {
      dgSocket.send(data);
    }
  });
  
  let pingInterval: NodeJS.Timeout | undefined;
  let keepAliveInterval: NodeJS.Timeout | undefined;
  let intentionalClose = false;
  let cleanupStarted = false;

  const cleanup = () => {
    if (cleanupStarted) return;
    cleanupStarted = true;
    intentionalClose = true;

    logger.info(`[DEEPGRAM] deepgram_cleanup_started for user ${userId} (producer ${producer.id})`);
    
    if (keepAliveInterval) clearInterval(keepAliveInterval);
    if (pingInterval) clearInterval(pingInterval);
    
    const session = activeSessions.get(producer.id);
    if (session?.gracePeriodTimer) {
      clearTimeout(session.gracePeriodTimer);
    }
    activeSessions.delete(producer.id);

    producer.removeListener('transportclose', cleanup);
    producer.removeListener('@close' as any, cleanup);
    
    if (!consumer.closed) consumer.close();
    if (!plainTransport.closed) plainTransport.close();
    if (!ffmpegProcess.killed) {
      try { ffmpegProcess.kill('SIGTERM'); } catch (e) {}
    }
    
    try {
      if (dgSocket.readyState === WebSocket.OPEN) {
        dgSocket.close();
      } else if (dgSocket.readyState === WebSocket.CONNECTING) {
        dgSocket.terminate();
      }
    } catch (e) {}

    logger.info(`[DEEPGRAM] deepgram_cleanup_completed for user ${userId}`);
  };

  ffmpegProcess.on('error', (err: any) => {
    logger.error(`FFmpeg error for user ${userId}:`, err);
  });
  
  ffmpegProcess.on('exit', (code, signal) => {
    logger.warn(`FFmpeg process exited for user ${userId} with code ${code} signal ${signal}`);
    cleanup();
  });

  dgSocket.on('open', async () => {
    logger.info(`[DEEPGRAM] deepgram_connected: user ${userId}`);
    
    // Heartbeat ping every 15s to keep TCP connection healthy
    pingInterval = setInterval(() => {
      if (dgSocket.readyState === WebSocket.OPEN) {
         dgSocket.ping();
      }
    }, 15000);
    
    try {
      if (!consumer || consumer.closed) {
        logger.info(`[DEEPGRAM] sfu_consumer_resume_skipped: consumer closed for user ${userId}`);
        return;
      }
      if (!plainTransport || plainTransport.closed) return;
      if (!producer || producer.closed) return;

      await consumer.resume();
    } catch (err: any) {
      logger.error(`[DEEPGRAM] Error resuming consumer for user ${userId}:`, err);
    }
  });

  // KeepAlive frames every 8s so Deepgram doesn't timeout on pauses
  keepAliveInterval = setInterval(() => {
    if (dgSocket.readyState === WebSocket.OPEN) {
      dgSocket.send(JSON.stringify({ type: 'KeepAlive' }));
    }
  }, 8000);

  dgSocket.on('message', (data: any) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'Results') {
        const text = msg.channel?.alternatives?.[0]?.transcript;
        if (text && text.trim().length > 0) {
          transcriberEvents.emit('caption', {
            roomId,
            userId,
            name: userName,
            text: text.trim(),
            isFinal: !!msg.is_final,
            lang: 'en'
          });
        }
      }
    } catch (e) {}
  });

  dgSocket.on('error', (err: any) => {
    if (err.message && err.message.includes('429')) {
      logger.warn(`[DEEPGRAM] deepgram_rate_limited for user ${userId}: 429 Too Many Requests`);
      return;
    }
    logger.error(`Deepgram error for user ${userId}:`, err);
  });

  dgSocket.on('close', () => {
    logger.warn(`[DEEPGRAM] WebSocket closed for user ${userId}`);
    if (keepAliveInterval) clearInterval(keepAliveInterval);
    if (pingInterval) clearInterval(pingInterval);
    if (!intentionalClose && !producer.closed) {
      logger.info(`[DEEPGRAM] Reconnecting for user ${userId} in 2 seconds...`);
      cleanup();
      setTimeout(() => {
        if (!producer.closed) {
          startTranscription(producer, router, roomId, userId, userName).catch(e => {
            logger.error(`Failed to restart transcription for ${userId}:`, e);
          });
        }
      }, 2000);
    }
  });

  const session: TranscriberSession = {
    producerId: producer.id,
    consumer,
    plainTransport,
    ffmpegProcess,
    dgSocket,
    cleanup,
    isPaused: false
  };

  activeSessions.set(producer.id, session);
  
  producer.on('transportclose', cleanup);
  producer.on('@close' as any, cleanup);
}

/**
 * Called when a user mutes their microphone.
 * Pauses audio consumption and starts a 15-second warm grace period before destroying resources.
 */
export function pauseTranscription(producerId: string) {
  const session = activeSessions.get(producerId);
  if (!session) return;

  session.isPaused = true;
  if (!session.consumer.closed) {
    session.consumer.pause().catch(() => {});
  }

  // Clear any existing timer
  if (session.gracePeriodTimer) {
    clearTimeout(session.gracePeriodTimer);
  }

  // Keep session warm for 15s. If no unmute occurs, teardown cleanly to free RAM/ports.
  session.gracePeriodTimer = setTimeout(() => {
    logger.info(`[DEEPGRAM] 15s warm grace period expired for producer ${producerId}, cleaning up`);
    session.cleanup();
  }, 15000);
}

export function stopTranscription(producerId: string) {
  const session = activeSessions.get(producerId);
  if (session) {
    session.cleanup();
  }
}

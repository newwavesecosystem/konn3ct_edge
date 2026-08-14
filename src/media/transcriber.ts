import { Producer, Router } from 'mediasoup/node/lib/types';
import { spawn } from 'child_process';
import dgram from 'dgram';
import { DeepgramClient } from '@deepgram/sdk';
import { logger } from '../logger';
import { db } from '../db';
import { EventEmitter } from 'events';
import WebSocket from 'ws';

const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
const deepgram = deepgramApiKey ? new DeepgramClient({ apiKey: deepgramApiKey }) : null;

// Emitter to broadcast captions back to server.ts
export const transcriberEvents = new EventEmitter();

let nextPort = 40000;
async function getFreePort(): Promise<number> {
  const port = nextPort;
  nextPort += 2; // RTP and RTCP typically use even/odd pairs
  if (nextPort > 49000) nextPort = 40000;
  return port;
}

// Map producerId to cleanup function to avoid memory leaks
const transcribers = new Map<string, () => void>();

export async function startTranscription(producer: Producer, router: Router, roomId: string, userId: string, userName: string, clientData?: { isBot?: boolean, role?: string }) {
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

  logger.info(`[DEEPGRAM] deepgram_connection_attempt: user ${userId}`);

  if (!deepgram) {
    logger.warn(`[DEEPGRAM] No API key found, skipping transcription for user ${userId}`);
    return; // Silent return if no API key
  }
  // 1. Get free ports for FFmpeg to listen on
  const rtpPort = await getFreePort();
  const rtcpPort = await getFreePort();
  
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
  
  // 3. Connect to Deepgram using standard WebSocket
  const deepgramUrl = 'wss://api.deepgram.com/v1/listen?model=nova-2&language=en&smart_format=true&encoding=linear16&sample_rate=48000&channels=1';
  const dgSocket = new WebSocket(deepgramUrl, {
    headers: {
      Authorization: `Token ${deepgramApiKey}`
    }
  });
  
  // 4. Start FFmpeg
  const pt = consumer.rtpParameters.codecs[0].payloadType;
  const sdpString = `v=0
o=- 0 0 IN IP4 127.0.0.1
s=FFmpeg
c=IN IP4 127.0.0.1
t=0 0
m=audio ${rtpPort} RTP/AVP ${pt}
a=rtpmap:${pt} opus/48000/2
`;
  
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
  
  let pingInterval: NodeJS.Timeout;
  
  ffmpegProcess.on('error', (err: any) => {
    logger.error(`FFmpeg error for user ${userId}:`, err);
  });
  
  ffmpegProcess.on('exit', (code, signal) => {
    logger.warn(`FFmpeg process exited for user ${userId} with code ${code} signal ${signal}`);
    cleanup();
  });
  
  ffmpegProcess.on('close', () => {
    logger.warn(`FFmpeg process closed for user ${userId}`);
    cleanup();
  });
  
  dgSocket.on('open', async () => {
    logger.info(`[DEEPGRAM] deepgram_connected: user ${userId}`);
    
    // Ping mechanism to detect dead TCP connections
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
      if (err.message && err.message.includes('Channel request handler with ID')) {
        logger.warn(`[DEEPGRAM] sfu_consumer_resume_failed_closed: Expected mediasoup closure for user ${userId}`);
        return;
      }
      logger.error(`[DEEPGRAM] Error resuming consumer for user ${userId}:`, err);
    }
  });

  // Deepgram will close the connection if no audio is sent for 10-12 seconds (e.g. user is muted).
  // We must send a KeepAlive message periodically.
  const keepAliveInterval = setInterval(() => {
    if (dgSocket.readyState === WebSocket.OPEN) {
      dgSocket.send(JSON.stringify({ type: 'KeepAlive' }));
    }
  }, 8000);

  dgSocket.on('message', (data: any) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'Results') {
        const text = msg.channel?.alternatives?.[0]?.transcript;
        if (text) {
          logger.info(`[DEEPGRAM] Transcript received for user ${userId}: "${text}" (isFinal: ${msg.is_final})`);
          transcriberEvents.emit('caption', {
            roomId,
            userId,
            name: userName,
            text,
            isFinal: msg.is_final,
            lang: 'en'
          });
        }
      }
    } catch (e) {
      // ignore parse errors
    }
  });

  dgSocket.on('error', (err: any) => {
    if (err.message && err.message.includes('429')) {
      logger.warn(`[DEEPGRAM] deepgram_rate_limited for user ${userId}: 429 Too Many Requests`);
      return;
    }
    logger.error(`Deepgram error for user ${userId}:`, err);
  });

  let intentionalClose = false;

  dgSocket.on('close', () => {
    logger.warn(`[DEEPGRAM] WebSocket closed for user ${userId}`);
    clearInterval(keepAliveInterval);
    clearInterval(pingInterval);
    if (!intentionalClose && !producer.closed) {
        logger.info(`[DEEPGRAM] Reconnecting for user ${userId} in 2 seconds...`);
        cleanup(); // Cleanup old resources
        setTimeout(() => {
            if (!producer.closed) {
               startTranscription(producer, router, roomId, userId, userName).catch(e => {
                 logger.error(`Failed to restart transcription for ${userId}:`, e);
               });
            }
        }, 2000);
    }
  });

  let cleanupStarted = false;

  const cleanup = () => {
    if (cleanupStarted) return;
    cleanupStarted = true;
    logger.info(`[DEEPGRAM] deepgram_cleanup_started for user ${userId}`);
    
    intentionalClose = true;
    clearInterval(keepAliveInterval);
    clearInterval(pingInterval);
    
    producer.removeListener('transportclose', cleanup);
    producer.removeListener('@close' as any, cleanup);
    
    if (transcribers.has(producer.id)) {
      transcribers.delete(producer.id);
    }
    if (!consumer.closed) consumer.close();
    if (!plainTransport.closed) plainTransport.close();
    if (!ffmpegProcess.killed) ffmpegProcess.kill('SIGTERM');
    
    try {
      if (dgSocket.readyState === WebSocket.OPEN) {
        dgSocket.close();
      } else if (dgSocket.readyState === WebSocket.CONNECTING) {
        // Just terminate to avoid 'WebSocket was closed before the connection was established'
        dgSocket.terminate();
      } else {
        logger.info(`[DEEPGRAM] deepgram_cleanup_ignored_already_closed for user ${userId}`);
      }
    } catch(e){}

    logger.info(`[DEEPGRAM] deepgram_cleanup_completed for user ${userId}`);
  };
  
  transcribers.set(producer.id, cleanup);
  
  producer.on('transportclose', cleanup);
  // Also cleanup when the producer is closed natively
  producer.on('@close' as any, cleanup);
}

export function stopTranscription(producerId: string) {
  const cleanup = transcribers.get(producerId);
  if (cleanup) {
    cleanup();
  }
}

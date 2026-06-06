import { Producer, Router } from 'mediasoup/node/lib/types';
import { spawn } from 'child_process';
import dgram from 'dgram';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import { logger } from '../logger';
import { EventEmitter } from 'events';

const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
const deepgram = deepgramApiKey ? createClient(deepgramApiKey) : null;

// Emitter to broadcast captions back to server.ts
export const transcriberEvents = new EventEmitter();

async function getFreePort(): Promise<number> {
  return new Promise((resolve) => {
    const srv = dgram.createSocket('udp4');
    srv.bind(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

// Map producerId to cleanup function to avoid memory leaks
const transcribers = new Map<string, () => void>();

export async function startTranscription(producer: Producer, router: Router, roomId: string, userId: string, userName: string) {
  if (!deepgram) return; // Silent return if no API key
  
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
  
  // 3. Connect to Deepgram
  const dgConnection = deepgram.listen.live({
    model: 'nova-2',
    language: 'en',
    smart_format: true,
    encoding: 'linear16',
    sample_rate: 48000,
    channels: 1
  });
  
  // 4. Start FFmpeg
  // We need to tell FFmpeg how to interpret the incoming RTP. We use a simple SDP string.
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
  ffmpegProcess.stdout.on('data', (data) => {
    // 1 is OPEN state for deepgram sdk WebSocket
    if (dgConnection.getReadyState() === 1) {
      dgConnection.send(data);
    }
  });
  
  ffmpegProcess.on('error', (err) => {
    logger.error(`FFmpeg error for user ${userId}:`, err);
  });
  
  dgConnection.on(LiveTranscriptionEvents.Open, async () => {
    logger.info(`Deepgram connected for user ${userId}`);
    await consumer.resume();
  });
  
  dgConnection.on(LiveTranscriptionEvents.Transcript, (data) => {
    const text = data.channel.alternatives[0]?.transcript;
    if (text) {
      transcriberEvents.emit('caption', {
        roomId,
        userId,
        name: userName,
        text,
        isFinal: data.is_final,
        lang: 'en'
      });
    }
  });
  
  dgConnection.on(LiveTranscriptionEvents.Error, (err) => {
    logger.error(`Deepgram error for user ${userId}:`, err);
  });
  
  const cleanup = () => {
    if (transcribers.has(producer.id)) {
      transcribers.delete(producer.id);
    }
    if (!consumer.closed) consumer.close();
    if (!plainTransport.closed) plainTransport.close();
    if (!ffmpegProcess.killed) ffmpegProcess.kill('SIGTERM');
    dgConnection.finish();
  };
  
  transcribers.set(producer.id, cleanup);
  
  producer.on('transportclose', cleanup);
  producer.on('producerclose', cleanup);
}

export function stopTranscription(producerId: string) {
  const cleanup = transcribers.get(producerId);
  if (cleanup) {
    cleanup();
  }
}

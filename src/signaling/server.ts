import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server } from 'http';
import { URL } from 'url';
import jwt from 'jsonwebtoken';
import { logger } from '../logger';
import { db } from '../db';
import { redisMediaController as mediaController } from '../services/RedisMediaController';
import os from 'os';
import { redis, duplicateRedis } from '../redis';
import crypto from 'crypto';
import { generateMeetingSummaryData } from '../ai/summarizer';
import { transcriberEvents } from '../media/transcriber';
import { launchRecorderBot } from '../services/recorderLauncher';
import { getOrLoadRoomHistory, appendChatToCache, refreshPollsCache, refreshQaCache, refreshNoteCache, invalidateRoomHistoryCache } from './historyCache';
import { monitorEventLoopDelay, PerformanceObserver } from 'perf_hooks';
import { LARGE_ROOM_CONFIG, LargeRoomMode, LargeRoomSettings, validateLargeRoomConfig } from '../config/largeRoom';
import {
  isLargeRoomMode,
  canParticipantPublishAudio,
  canParticipantPublishVideo,
  canParticipantShareScreen,
  canPromoteParticipantToSpeaker,
  getLargeRoomCapacityState,
} from '../helpers/largeRoomHelpers';

// --- Event Loop & GC Telemetry ---
const eventLoopMonitor = monitorEventLoopDelay({ resolution: 10 });
eventLoopMonitor.enable();

setInterval(() => {
  logger.info(`[Telemetry] Event Loop Delay: Mean=${(eventLoopMonitor.mean / 1e6).toFixed(2)}ms, P50=${(eventLoopMonitor.percentile(50) / 1e6).toFixed(2)}ms, P95=${(eventLoopMonitor.percentile(95) / 1e6).toFixed(2)}ms, P99=${(eventLoopMonitor.percentile(99) / 1e6).toFixed(2)}ms, Max=${(eventLoopMonitor.max / 1e6).toFixed(2)}ms`);
  eventLoopMonitor.reset();
}, 5000);

const gcObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    logger.info(`[Telemetry] GC Pause: ${entry.duration.toFixed(2)}ms`);
  }
});
try {
  gcObserver.observe({ entryTypes: ['gc'] });
} catch (e) {
  // Ignore if gc is not supported
}

const consumeBursts = new Map<string, number[]>();

setInterval(() => {
  for (const [burstRoomId, timestamps] of consumeBursts.entries()) {
    if (timestamps.length === 0) continue;
    
    // Sort timestamps to ensure chronologial order
    timestamps.sort((a, b) => a - b);
    
    const firstTime = timestamps[0];
    const distribution = { '0-10ms': 0, '10-20ms': 0, '20-30ms': 0, '30-40ms': 0, '40-50ms': 0, '50ms+': 0 };
    for (const t of timestamps) {
      const diff = t - firstTime;
      if (diff <= 10) distribution['0-10ms']++;
      else if (diff <= 20) distribution['10-20ms']++;
      else if (diff <= 30) distribution['20-30ms']++;
      else if (diff <= 40) distribution['30-40ms']++;
      else if (diff <= 50) distribution['40-50ms']++;
      else distribution['50ms+']++;
    }
    
    logger.info(`[Telemetry] WebSocket Burst for room ${burstRoomId}: Total consumes=${timestamps.length}, Distribution=${JSON.stringify(distribution)}`);
  }
  consumeBursts.clear();
}, 5000);
// ----------------------------------
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('[FATAL] JWT_SECRET must be set in production');
}
if (!process.env.TURN_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('[FATAL] TURN_SECRET must be set in production');
}

redis.on("error", (e: any) => logger.error('Redis connection error', e));

const redisSubscriber = duplicateRedis(redis);
redisSubscriber.on("error", (e: any) => logger.error('Redis subscriber connection error', e));

redisSubscriber.subscribe('recorder:completed').catch((e: any) => logger.error('Failed to subscribe to recorder:completed', e));
redisSubscriber.subscribe('streamer:status').catch((e: any) => logger.error('Failed to subscribe to streamer:status', e));
redisSubscriber.on('message', async (channel: string, message: string) => {
  if (channel === 'recorder:completed') {
    try {
      const data = JSON.parse(message);
      // Update room or recording entry
      // For now, we will create a new recording record for the room
      const room = await db.room.findUnique({ where: { id: data.roomId } });
      if (room) {
        if (data.recordingId) {
          await db.recording.update({
            where: { id: data.recordingId },
            data: {
              url: data.recordingUrl,
              status: 'completed'
            }
          });
        } else {
          await db.recording.create({
            data: {
              ownerId: room.ownerId,
              title: `${room.name} Recording`,
              roomId: data.roomId,
              url: data.recordingUrl,
              status: 'completed',
              duration: 0,
            }
          });
        }
        logger.info(`Saved recording ${data.recordingUrl} to DB for room ${data.roomId}`);
      }
      
      // Notify active users in the room that recording is fully ready
      const clients = rooms.get(data.roomId);
      if (clients) {
        const payload = JSON.stringify({ type: 'recording_ready', url: data.recordingUrl });
        for (const client of clients.values()) {
          if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(payload);
          }
        }
        logger.info(`Recording completed for room ${data.roomId}`);
      }
    } catch (e) {
      logger.error('Failed to process recorder:completed message', e);
    }
  } else if (channel === 'streamer:status') {
    try {
      const data = JSON.parse(message);
      if (data.streamId && data.status) {
        await db.liveStream.update({
          where: { id: data.streamId },
          data: { 
            status: data.status,
            ...(data.status === 'stopped' || data.status === 'failed' ? { endedAt: new Date() } : {})
          }
        });
        logger.info(`Updated stream ${data.streamId} status to ${data.status}`);
      }
    } catch (e) {
      logger.error('Failed to process streamer:status message', e);
    }
  }
});

const POD_ID = process.env.POD_ID || 'pod-1';

interface Client {
  ws: WebSocket;
  userId: string;
  email: string;
  name: string;
  roomId: string;
  roomSlug: string;
  role: string;
  status: 'waiting' | 'active';
  transports: string[];
  isMobile: boolean;
  networkQuality?: 'good' | 'poor' | 'bad' | 'unknown';
  audioOnlyMode?: boolean;
  videoSuspendedReason?: 'network';
  isCameraOn?: boolean;
  isMuted: boolean;
  maxActiveCameras?: number;
  preempted?: boolean;
  maxParticipants?: number;
  roomCreatedDate: Date;
  isBot?: boolean;
  cleanupStarted?: boolean;
  participantId: string;
  micExemption?: boolean;
}

export const rooms = new Map<string, Map<string, Client>>();

const disconnectTimeouts = new Map<string, NodeJS.Timeout>();
const consumerOwners = new Map<string, Client>();
const roomECinema = new Map<string, string | null>();
const roomECinemaState = new Map<string, { action: 'play' | 'pause', time: number, serverTime: number }>();
export const roomTranscripts = new Map<string, Array<{ name: string, text: string, timestamp: number }>>();
const roomAdmissions = new Map<string, Set<string>>();
const sfuConsumeMismatchLogged = new Set<string>();

async function cleanupRoomData(roomId: string) {
  try {
    // 1. Close any active polls
    await db.meetingPoll.updateMany({
      where: { roomId, isActive: true },
      data: { isActive: false }
    });

    // 2. Check if chat persistence is enabled
    const room = await db.room.findUnique({
      where: { id: roomId },
      select: { persistChat: true }
    });

    // If persistChat is explicitly false, delete all chat messages
    if (room && room.persistChat === false) {
      const { count } = await db.chatMessage.deleteMany({
        where: { roomId }
      });
      logger.info(`Cleared ${count} chat messages for room ${roomId} (persistChat=false).`);
    }

    // 3. Clear Redis cache so new sessions don't load old history
    await invalidateRoomHistoryCache(roomId);

    // 4. Clear memory state for eCinema
    roomECinema.delete(roomId);
    roomECinemaState.delete(roomId);
  } catch (error) {
    logger.error(`Error during cleanupRoomData for room ${roomId}:`, error);
  }
}

async function asyncWithRetry<T>(
  operation: () => Promise<T>,
  onFail: (err: any) => void,
  maxRetries = 3
): Promise<T | void> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await operation();
    } catch (e) {
      attempt++;
      if (attempt >= maxRetries) {
        onFail(e);
        return;
      }
      await new Promise(resolve => setTimeout(resolve, attempt * 500));
    }
  }
}
export function getActiveRoomParticipants(roomId: string) {
  const activeParticipants: Array<{ userId: string, participantId: string, name: string, role: string, isMobile: boolean, isCameraOn?: boolean, isMuted: boolean, audioOnlyMode?: boolean, videoSuspendedReason?: 'network' }> = [];
  const roomClients = rooms.get(roomId);
  if (roomClients) {
    for (const client of roomClients.values()) {
      if (client.status === 'active') {
        activeParticipants.push({
          userId: client.userId,
          participantId: client.participantId,
          name: client.name,
          role: client.role,
          isMobile: client.isMobile,
          isCameraOn: client.isCameraOn,
          isMuted: client.isMuted,
          audioOnlyMode: client.audioOnlyMode,
          videoSuspendedReason: client.videoSuspendedReason
        });
      }
    }
  }
  return activeParticipants;
}




export interface RoomSettings extends LargeRoomSettings {
  micLocked: boolean;
  videoLocked: boolean;
  chatLocked: boolean;
  bypassWaitingRoom: boolean;
  networkDetectionEnabled?: boolean;
  poorNetworkRttMs?: number;
  poorNetworkLossPercent?: number;
  poorNetworkJitterMs?: number;
  networkWindowSize?: number;
  networkMonitorIntervalMs?: number;
}

export function getDefaultRoomSettings(): RoomSettings {
  return {
    micLocked: false,
    videoLocked: false,
    chatLocked: false,
    bypassWaitingRoom: false,
    ...validateLargeRoomConfig({}),
  };
}
export const roomSettingsMap = new Map<string, RoomSettings>();

export async function sendRoomHistoryAndState(client: Client) {
  const { ws, roomId, roomCreatedDate, participantId, userId } = client;
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  try {
    const activeParticipants = getActiveRoomParticipants(roomId);
    ws.send(JSON.stringify({ type: 'participants_list', participants: activeParticipants }));

    const history = await getOrLoadRoomHistory(roomId, roomCreatedDate, participantId, userId);
    
    if (ws.readyState === WebSocket.OPEN && history) {
      // Filter chat history for private messages intended for this user
      const filteredChatHistory = history.chatHistory.filter((msg: any) => {
        return !msg.isPrivate || msg.targetUserId === participantId || msg.userId === userId;
      });
      
      ws.send(JSON.stringify({ type: 'chat_history', messages: filteredChatHistory }));
      ws.send(JSON.stringify({ type: 'poll_history', polls: history.pollHistory }));
      ws.send(JSON.stringify({ type: 'qa_history', messages: history.qaHistory }));
      if (history.noteHistory) {
        ws.send(JSON.stringify({ type: 'note_history', content: history.noteHistory.content }));
      }
    }

    const settings = roomSettingsMap.get(roomId);
    if (settings && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'room_settings_updated', settings }));
    }

    if (ws.readyState === WebSocket.OPEN) {
      const eCinemaLink = roomECinema.get(roomId);
      if (eCinemaLink) {
        ws.send(JSON.stringify({ type: 'ecinema_update', link: eCinemaLink }));
        
        const eState = roomECinemaState.get(roomId);
        if (eState) {
          let currentTime = eState.time;
          if (eState.action === 'play') {
            currentTime += (Date.now() - eState.serverTime) / 1000;
          }
          // Send a delayed action to ensure the player has time to load
          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ecinema_action', action: eState.action, time: currentTime }));
            }
          }, 2000);
        }
      }
    }
  } catch (e) {
    logger.error("Failed to load history", e);
  }
}

const syncRoomTimeouts = new Map<string, NodeJS.Timeout>();

export function syncRoomStateToRedis(roomId: string, roomSlug: string) {
  const existingTimeout = syncRoomTimeouts.get(roomId);
  if (existingTimeout) clearTimeout(existingTimeout);
  
  const timeout = setTimeout(async () => {
    executeSyncRoomStateToRedis(roomId, roomSlug);
    syncRoomTimeouts.delete(roomId);
  }, 1000); // 1 second debounce
  
  syncRoomTimeouts.set(roomId, timeout);
}

async function executeSyncRoomStateToRedis(roomId: string, roomSlug: string) {
  try {
    const clients = rooms.get(roomId);
    if (!clients || clients.size === 0) {
      await redis.del(`room:${roomSlug}:participants`);
      return;
    }
    
    const participants = [];
    for (const client of clients.values()) {
      if (client.status === 'active') {
        participants.push({
          userId: client.userId,
          name: client.name,
          email: client.email,
          role: client.role,
          isMobile: client.isMobile
        });
      }
    }
    
    if (participants.length > 0) {
      await redis.set(`room:${roomSlug}:participants`, JSON.stringify(participants), "EX", 86400); // 24 hours expiry
    } else {
      await redis.del(`room:${roomSlug}:participants`);
    }
  } catch (e) {
    logger.error('Failed to sync room state to Redis', e);
  }
}

async function generateMeetingSummary(roomId: string) {
  try {
    const transcripts = roomTranscripts.get(roomId);
    if (!transcripts || transcripts.length === 0) return;

    // Combine transcripts into one big text block
    const fullText = transcripts
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(t => `[${new Date(t.timestamp).toLocaleTimeString()}] ${t.name}: ${t.text}`)
      .join('\n');

    // Save full transcript to DB
    await db.transcription.create({
      data: {
        roomId,
        content: fullText,
      }
    });

    const { summary: summaryText, actionItems } = await generateMeetingSummaryData(fullText);

    if (summaryText !== "Summary could not be generated.") {
      await db.meetingSummary.upsert({
        where: { roomId },
        update: { summary: summaryText, actionItems: actionItems },
        create: { roomId, summary: summaryText, actionItems: actionItems },
      });
      logger.info(`AI Summary auto-generated for room ${roomId}`);
    }
  } catch (error) {
    logger.error(`Failed to generate summary for room ${roomId}:`, error);
  } finally {
    // Clean up memory
    roomTranscripts.delete(roomId);
  }
}

export async function getRoomProducers(roomId: string): Promise<any[]> {
  const data = await redis.hgetall(`room:${roomId}:producers`);
  return Object.values(data).map(pStr => JSON.parse(pStr as string));
}

export async function removeRoomProducersByPredicate(roomId: string, predicate: (p: any) => boolean) {
  const data = await redis.hgetall(`room:${roomId}:producers`);
  const toDelete: string[] = [];
  for (const [pid, pStr] of Object.entries(data)) {
    if (predicate(JSON.parse(pStr as string))) toDelete.push(pid);
  }
  if (toDelete.length > 0) await redis.hdel(`room:${roomId}:producers`, ...toDelete);
}

export function initializeSignaling(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  mediaController.on('producerClose', (data) => {
    const { consumerId, producerId, appData } = data;
    const client = consumerOwners.get(consumerId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify({
        type: 'producer_closed',
        producerId,
        consumerId,
        appData
      }));
    }
    consumerOwners.delete(consumerId);
  });

  mediaController.on('activeSpeaker', async (data) => {
    const { roomId, producerIds } = data;
    const activeUsers = new Set<string>();
    const activeParticipantIds = new Set<string>();
    const allProducers = await getRoomProducers(roomId);
    for (const pid of producerIds) {
      const prod = allProducers.find(p => p.producerId === pid);
      if (prod) {
        activeUsers.add(prod.userId);
        activeParticipantIds.add(prod.participantId);
      }
    }
    broadcastToRoom(roomId, {
      type: 'active_speaker',
      userIds: Array.from(activeUsers),
      participantIds: Array.from(activeParticipantIds)
    });
  });

  transcriberEvents.on('caption', (data) => {
    const { roomId, userId, name, text, isFinal, lang } = data;
    logger.info(`[SIGNALING] Broadcasting caption to room ${roomId} for user ${userId}: "${text}"`);
    
    if (isFinal) {
      if (!roomTranscripts.has(roomId)) {
        roomTranscripts.set(roomId, []);
      }
      roomTranscripts.get(roomId)!.push({
        name,
        text,
        timestamp: Date.now()
      });
    }

    broadcastToRoom(roomId, {
      type: 'caption',
      userId,
      name,
      text,
      isFinal,
      lang
    });
  });

  // Periodically report CPU load to Redis and Broadcast Degradation (Method 1 & 2)
  setInterval(async () => {
    try {
      const load = os.loadavg()[0]; // 1-minute load average
      const cpuCount = os.cpus().length;
      // Convert to a percentage, capping at 100
      const cpuUsage = Math.min((load / cpuCount) * 100, 100);

      // Push to Redis for Pre-flight API checks (Method 1)
      await redis.set(`pod:${POD_ID}:cpu`, cpuUsage);
      await redis.expire(`pod:${POD_ID}:cpu`, 10);

      logger.info(`pod:${POD_ID}:cpu =>`, cpuUsage)

      // Method 2: Graceful Degradation if load is too high
      // If CPU is > MAX_DEGRADATION_CPU_LOAD (default 85%), tell all connected clients to optimize video feeds
      const maxDegradationLoad = parseInt(process.env.MAX_DEGRADATION_CPU_LOAD || "85", 10);
      if (cpuUsage > maxDegradationLoad) {
        for (const roomId of rooms.keys()) {
          logger.warn("CPU LOAD IS HIGH!!!", cpuUsage)
          broadcastToRoom(roomId, { type: 'server_load_high' });
        }
      }
    } catch (e) {
      logger.error('Failed to update CPU load', e);
    }
  }, 5000);

  server.on('upgrade', async (request: IncomingMessage, socket, head) => {
    try {
      const url = new URL(request.url || '', `http://${request.headers.host}`);
      if (url.pathname !== '/signal') {
        socket.destroy();
        return;
      }

      const token = url.searchParams.get('token');
      const roomSlug = url.searchParams.get('roomId');
      const isMobile = url.searchParams.get('isMobile') === 'true';
      const participantIdParam = url.searchParams.get('participantId');
      const userAgent = request.headers['user-agent'] || 'unknown_agent';

      if (!token || !roomSlug) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      const secret = process.env.JWT_SECRET || 'fallback-secret-key';
      const decoded = jwt.verify(token, secret) as { userId: string; email: string; name: string; role?: string };

      // Verify room exists
      const room = await db.room.findUnique({ where: { slug: roomSlug } });
      if (!room) {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
        return;
      }

      if (!roomSettingsMap.has(room.id)) {
        const largeConfig = validateLargeRoomConfig({
          largeRoomMode: (room.largeRoomMode as LargeRoomMode) || 'standard',
          largeRoomEnabled: room.largeRoomEnabled,
          maxActiveVideoPublishers: room.maxActiveVideoPublishers,
          maxActiveAudioPublishers: room.maxActiveAudioPublishers,
          maxScreenShares: room.maxScreenShares,
          maxViewersPerRelayRouter: room.maxViewersPerRelayRouter,
          relayProvisionThresholdPercent: room.relayProvisionThresholdPercent,
        });

        roomSettingsMap.set(room.id, {
          micLocked: false,
          videoLocked: false,
          chatLocked: false,
          bypassWaitingRoom: false,
          networkDetectionEnabled: room.networkDetectionEnabled,
          poorNetworkRttMs: room.poorNetworkRttMs,
          poorNetworkLossPercent: room.poorNetworkLossPercent,
          poorNetworkJitterMs: room.poorNetworkJitterMs,
          networkWindowSize: room.networkWindowSize,
          networkMonitorIntervalMs: room.networkMonitorIntervalMs,
          ...largeConfig,
        });
      }

      // Extract role directly from the JWT token (set by the frontend API)
      let role = decoded.role || 'audience';
      if (room.ownerId === decoded.userId) {
        role = 'host';
      }

      if (role === 'bot' || role === 'recorder') {
        logger.info(`recorder_signaling_join_participant_id: ${participantIdParam}`);
      }

      // Recover dynamic roles (e.g. co-host) from existing session or Redis
      const existingClientForRole = participantIdParam ? rooms.get(room.id)?.get(participantIdParam) : null;
      if (existingClientForRole && existingClientForRole.role === 'co-host') {
        role = 'co-host';
      } else {
        try {
          const redisParticipantsStr = await redis.get(`room:${roomSlug}:participants`);
          if (redisParticipantsStr) {
            const redisParticipants = JSON.parse(redisParticipantsStr);
            const existingInRedis = redisParticipants.find((p: any) => p.userId === decoded.userId);
            if (existingInRedis && existingInRedis.role === 'co-host') {
              role = 'co-host';
            }
          }
        } catch (e) {
          logger.error('Failed to parse redis participants for role recovery', e);
        }
      }

      // Guardrails: Validate participantId
      if (!participantIdParam || participantIdParam === 'ssr-placeholder' || participantIdParam === 'pending' || participantIdParam.trim() === '') {
        logger.warn(`Rejecting connection due to invalid participantId: ${participantIdParam}`);
        socket.write('HTTP/1.1 400 Bad Request\r\nX-Conn3ct-Error: Invalid participantId\r\n\r\n');
        socket.destroy();
        return;
      }

      // Guardrails: Check if this user is already in the room (e.g. reconnecting within 15s grace period)
      const existingClient = rooms.get(room.id)?.get(participantIdParam);

      const currentParticipants = rooms.get(room.id)?.size || 0;
      const maxParticipants = room.maxParticipants ?? 100;
      const maxWebinarAudience = room.maxWebinarAudience ?? 1000;
      const limit = room.mode === 'webinar' ? maxWebinarAudience : maxParticipants;

      // Allow hosts, bots, and already-connected users (reconnecting) to bypass capacity limits
      if (role !== 'host' && role !== 'bot' && !existingClient && currentParticipants >= limit) {
        socket.write('HTTP/1.1 403 Forbidden\r\nX-Conn3ct-Error: Capacity Reached\r\n\r\n');
        socket.destroy();
        return;
      }

      if (existingClient && existingClient.ws.readyState === WebSocket.OPEN) {
        logger.info(`Preempting old connection for participantId: ${participantIdParam}`);
        existingClient.preempted = true;
        
        // If a disconnect timeout was already running for this user, clear it
        const timeoutKey = `${participantIdParam}:${room.id}`;
        if (disconnectTimeouts.has(timeoutKey)) {
          clearTimeout(disconnectTimeouts.get(timeoutKey));
          disconnectTimeouts.delete(timeoutKey);
        }

        try {
          existingClient.ws.terminate();
        } catch(e) {}
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, {
          userId: decoded.userId,
          email: decoded.email,
          name: decoded.name || 'Guest',
          roomId: room.id,
          roomName: room.name,
          roomSlug,
          role,
          participantId: participantIdParam,
          isWaitingRoomEnabled: room.isWaitingRoomEnabled,
          isMobile,
          userAgent,
          maxActiveCameras: room.maxActiveCameras ?? 15,
          maxParticipants: maxParticipants,
        });
      });
    } catch (error) {
      logger.error('WebSocket upgrade failed', error);
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
    }
  });

  wss.on('connection', async (ws: WebSocket, request: IncomingMessage, clientData: any) => {
    const { userId, email, name, roomId, roomName, roomSlug, role, isWaitingRoomEnabled, isMobile, participantId, userAgent } = clientData;

    logger.info(`User Connected [${roomId}]: participantId=${participantId}, userId=${userId}, agent="${userAgent}", isMobile=${isMobile}`);

    const roomSettings = roomSettingsMap.get(clientData.roomId);
    const bypassWaitingRoom = roomSettings?.bypassWaitingRoom === true;
    const hasBeenAdmitted = roomAdmissions.get(roomId)?.has(userId) === true;
    
    // Determine initial status
    const initialStatus = (isWaitingRoomEnabled && !bypassWaitingRoom && !hasBeenAdmitted && role !== 'host' && role !== 'bot') ? 'waiting' : 'active';
    const isBot = role === 'bot' || role === 'recorder' || name?.toLowerCase().includes('bot');
    const client: Client = { ws, userId, participantId, email, name, roomId, roomSlug, role, status: initialStatus, transports: [], isMobile, maxActiveCameras: clientData.maxActiveCameras, maxParticipants: clientData.maxParticipants, roomCreatedDate: clientData.roomCreatedDate, isCameraOn: false, isMuted: true, isBot };

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
      // Register this room to this specific Pod in Redis for NGINX scaling awareness
      redis.set(`room:${roomSlug}:pod`, POD_ID).catch(e => logger.warn('Redis set error', e));
      redis.expire(`room:${roomSlug}:pod`, 86400).catch(e => logger.warn('Redis expire error', e)); // 24h safety net

      // Setup audio observer for talking indicators
      mediaController.setupAudioObserver(roomId).catch(e => logger.error('Failed to setup audio observer', e));
    }

    // Check if there's an existing client in the room that was already admitted
    const existingClient = rooms.get(roomId)!.get(participantId);
    if (existingClient && existingClient.status === 'active') {
      client.status = 'active';
    }

    if (client.status === 'active') {
      let admissions = roomAdmissions.get(roomId);
      if (!admissions) { admissions = new Set(); roomAdmissions.set(roomId, admissions); }
      admissions.add(userId);
    }

    rooms.get(roomId)!.set(participantId, client);

    if (disconnectTimeouts.has(`${participantId}:${roomId}`)) {
      clearTimeout(disconnectTimeouts.get(`${participantId}:${roomId}`)!);
      disconnectTimeouts.delete(`${participantId}:${roomId}`);
      logger.info(`Participant ${participantId} (User ${userId}) reconnected to room ${roomId} during grace period`);
      ws.send(JSON.stringify({ 
        type: 'session_status', 
        recovered: true, 
        status: client.status,
        userId: client.userId,
        name: client.name,
        role: client.role,
        roomName,
        maxParticipants: client.maxParticipants
      }));
      broadcastRoomState(roomId);
    } else {
      logger.info(`User ${userId} (${role}) joined room ${roomId} with status ${client.status}`);

      // Pre-warm the router NOW so it is ready when the client asks for routerCapabilities.
      if (client.status === 'active') {
        try {
          await mediaController.getOrCreateRouter(roomId);
        } catch (e) {
          logger.error('Failed to pre-warm router on join', e);
        }
      }

      ws.send(JSON.stringify({ 
        type: 'session_status', 
        recovered: false, 
        status: client.status,
        userId: client.userId,
        name: client.name,
        role: client.role,
        roomName,
        maxParticipants: client.maxParticipants
      }));

      if (client.status === 'active') {
        broadcastToRoom(roomId, {
          type: 'user_joined',
          userId,
          participantId,
          name: client.name,
          role: client.role,
          isMobile: client.isMobile,
          isMuted: client.isMuted
        });
        broadcastRoomState(roomId);
        
        syncRoomStateToRedis(roomId, roomSlug);

        // Send existing waiting users to the host that just joined
        if (client.role === 'host') {
          const roomClients = rooms.get(roomId);
          if (roomClients) {
            for (const [id, c] of roomClients.entries()) {
              if (c.status === 'waiting') {
                client.ws.send(JSON.stringify({
                  type: 'waiting_room_request',
                  userId: c.userId,
                  name: c.name,
                }));
              }
            }
          }
        }
      } else {
        // Send a request to hosts for admission
        broadcastToHosts(roomId, {
          type: 'waiting_room_request',
          userId,
          name,
        });
      }
    }

    // ALWAYS send history and participants ASYNCHRONOUSLY — this must NOT block the routerCapabilities flow
    if (client.status === 'active') {
      setImmediate(() => {
        sendRoomHistoryAndState(client);
      });
    }

    ws.on('message', async (message: Buffer | string) => {
      try {
        if (Buffer.byteLength(typeof message === 'string' ? message : message) > 65536) {
          logger.warn(`User ${userId} sent oversized WS message (>64KB), ignoring.`);
          return;
        }
        const data = JSON.parse(message.toString());
        try {
          await handleMessage(client, data);
        } catch (handleError) {
          logger.error(`Error handling message of type ${data.type}:`, handleError);
          // Only send error back if it's a request expecting a response
          if (data.type === 'getRouterRtpCapabilities' || data.type === 'createWebRtcTransport' || data.type === 'connectWebRtcTransport' || data.type === 'produce') {
            ws.send(JSON.stringify({ type: 'error', message: 'Internal server error while handling media request.' }));
          }
        }
      } catch (error) {
        logger.warn('Failed to parse WS message', error);
      }
    });

    ws.on('close', () => {
      if (client.preempted) {
        logger.info(`[CLEANUP] client_cleanup_ignored_preempted for user ${userId}`);
        return;
      }
      if (client.cleanupStarted) {
        logger.info(`[CLEANUP] client_cleanup_ignored_duplicate for user ${userId}`);
        return;
      }
      client.cleanupStarted = true;
      logger.info(`[CLEANUP] client_cleanup_started for user ${userId} in room ${roomId}`);

      // If the user already explicitly left (via leave_meeting), they are no longer in the room map.
      // Do not trigger the grace period in this case.
      const stillInRoom = rooms.get(roomId)?.has(participantId);
      if (!stillInRoom) {
        logger.info(`User ${userId} disconnected from room ${roomId} after explicit leave.`);
        return;
      }

      logger.info(`User ${userId} disconnected from room ${roomId}. Starting 30s grace period...`);

      // IMMEDAITELY clean up Mediasoup transports for this connection.
      // If the client reconnects, they will create new WebRTC transports anyway.
      // This prevents orphaned ports from causing "UDP connection failed" errors.
      client.transports.forEach(tId => {
        try {
          mediaController.closeTransport(tId);
        } catch (e) {
          logger.warn(`Failed to close transport ${tId}`, e);
        }
      });
      client.transports = [];

      // Clean up consumer owners to prevent invalid ownership spam
      for (const [consumerId, owner] of consumerOwners.entries()) {
        if (owner === client) {
          consumerOwners.delete(consumerId);
        }
      }

      const gracePeriodMs = 30000;
      const graceExpiresAt = new Date(Date.now() + gracePeriodMs).toISOString();
      logger.info(`[CLEANUP] client_disconnect_grace_started for user ${userId}. gracePeriodMs: ${gracePeriodMs}, graceExpiresAt: ${graceExpiresAt}`);

      const timeout = setTimeout(async () => {
        logger.info(`Participant ${participantId} (User ${userId}) grace period expired. Cleaning up session.`);
        logger.info(`[CLEANUP] client_cleanup_completed for user ${userId} in room ${roomId}`);
        const roomClients = rooms.get(roomId);
        if (roomClients) {
          roomClients.delete(participantId);
          if (roomClients.size === 0) {
            rooms.delete(roomId);
            cleanupRoomData(roomId);
            redis.del(`room:${roomId}:producers`).catch(e => logger.warn('Redis del error', e));
            roomAdmissions.delete(roomId);
            mediaController.cleanupAudioObserver(roomId); // Clean up talking indicator
            mediaController.closeRouter(roomId); // Prevent Mediasoup Router memory leaks
            redis.del(`room:${roomSlug}:pod`).catch(e => logger.warn('Redis del error', e));
            syncRoomStateToRedis(roomId, roomSlug);
            generateMeetingSummary(roomId).catch(e => logger.error(`Error triggering summary for room ${roomId}`, e));
          } else {
            // Remove their producers from the array
            await removeRoomProducersByPredicate(roomId, (p: any) => p.participantId === participantId);

            broadcastToRoom(roomId, {
              type: 'user_left',
              userId,
              participantId
            });
            broadcastRoomState(roomId);
            syncRoomStateToRedis(roomId, roomSlug);
          }
        }
        disconnectTimeouts.delete(`${participantId}:${roomId}`);
      }, gracePeriodMs);

      disconnectTimeouts.set(`${participantId}:${roomId}`, timeout);
    });
  });

  type ActionAckPayload = {
    type: 'action:ack';
    clientEventId: string;
    serverEventId: string;
    actionType: string;
    roomId: string;
    senderParticipantId: string;
    status: 'accepted' | 'failed';
    acceptedAt?: string;
    failedAt?: string;
    errorCode?: string;
    message?: string;
  };

  const PROCESSED_EVENT_TTL_MS = 5 * 60 * 1000;
  const MAX_PROCESSED_EVENTS = 50000;

  type ProcessedClientEvent = {
    ack: ActionAckPayload;
    createdAt: number;
  };

  const processedClientEvents = new Map<string, ProcessedClientEvent>();

  function getClientEventKey(roomId: string, senderParticipantId: string, clientEventId: string): string {
    return `${roomId}:${senderParticipantId}:${clientEventId}`;
  }

  function cleanupProcessedClientEvents(now = Date.now()) {
    for (const [key, value] of processedClientEvents.entries()) {
      if (now - value.createdAt > PROCESSED_EVENT_TTL_MS) {
        processedClientEvents.delete(key);
      }
    }

    while (processedClientEvents.size > MAX_PROCESSED_EVENTS) {
      const oldestKey = processedClientEvents.keys().next().value;
      if (!oldestKey) break;
      processedClientEvents.delete(oldestKey);
    }
  }

  function getCachedClientEventAck(
    roomId: string,
    senderParticipantId: string,
    clientEventId: string
  ): ActionAckPayload | undefined {
    cleanupProcessedClientEvents();
    return processedClientEvents.get(getClientEventKey(roomId, senderParticipantId, clientEventId))?.ack;
  }

  function cacheClientEventAck(
    roomId: string,
    senderParticipantId: string,
    clientEventId: string,
    ack: ActionAckPayload
  ) {
    cleanupProcessedClientEvents();
    processedClientEvents.set(getClientEventKey(roomId, senderParticipantId, clientEventId), {
      ack,
      createdAt: Date.now(),
    });
  }

  function emitActionAck(
    client: Client,
    clientEventId: string,
    actionType: string,
    serverEventId: string,
    status: 'accepted' | 'failed' = 'accepted',
    errorCode?: string,
    message?: string
  ) {
    const eventTime = new Date().toISOString();
    const ack: ActionAckPayload = {
      type: 'action:ack',
      clientEventId,
      serverEventId,
      actionType,
      roomId: client.roomId,
      senderParticipantId: client.userId,
      status,
      ...(status === 'accepted' ? { acceptedAt: eventTime } : { failedAt: eventTime }),
      errorCode,
      message
    };
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(ack));
    }
    cacheClientEventAck(client.roomId, client.userId, clientEventId, ack);
    logger.info(JSON.stringify({
      timestamp: ack.acceptedAt ?? ack.failedAt ?? new Date().toISOString(),
      stage: status === 'accepted' ? 'acknowledged' : 'failed',
      actionType,
      clientEventId,
      serverEventId,
      roomId: client.roomId,
      participantId: client.userId,
      socketId: client.ws.url ? client.ws.url.substring(0, 8) : 'unknown',
      status,
      errorCode
    }));
  }

  async function handleMessage(client: Client, data: any) {
    const { roomId, userId } = client;

    // If client is in waiting room, they can only send basic messages
    if (client.status === 'waiting' && data.type !== 'chat') {
      logger.warn(`User ${userId} attempted ${data.type} while in waiting room`);
      return;
    }

    const confirmableActions = new Set(['chat', 'camera_state', 'mute_state', 'audio_connection_status', 'hand_raise', 'reaction', 'produce']);
    const isConfirmable = confirmableActions.has(data.type) || (data.type === 'stop_producer' && data.appData?.source === 'screen');
    
    // Ensure clientEventId exists for QA/Bot scripts in these actions
    let clientEventId = data.clientEventId;
    if (isConfirmable && !clientEventId) {
      clientEventId = crypto.randomUUID(); // Fallback for old clients
      data.clientEventId = clientEventId;
    }

    if (clientEventId) {
      const cachedAck = getCachedClientEventAck(roomId, userId, clientEventId);

      if (cachedAck) {
        logger.info(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'info',
          event: 'action_lifecycle',
          stage: 'duplicate',
          actionType: data.type,
          clientEventId,
          roomId: client.roomId,
          participantId: client.userId,
          errorCode: 'DUPLICATE_EVENT'
        }));
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(JSON.stringify(cachedAck));
        }
        return;
      }
    }

    switch (data.type) {
      case 'admit_user':
        if (client.role === 'host') {
          for (const targetClient of rooms.get(roomId)?.values() || []) {
            if (targetClient.userId === data.userId && targetClient.status === 'waiting') {
              targetClient.status = 'active';
              targetClient.ws.send(JSON.stringify({ type: 'session_status', status: 'active', recovered: false, userId: targetClient.userId, name: targetClient.name, role: targetClient.role }));
              
              // Re-fetch admissions set since the client object may be recreated
              let updatedAdmissions = roomAdmissions.get(roomId);
              if (!updatedAdmissions) { updatedAdmissions = new Set(); roomAdmissions.set(roomId, updatedAdmissions); }
              updatedAdmissions.add(targetClient.userId);

              broadcastToRoom(roomId, { type: 'user_joined', userId: targetClient.userId, participantId: targetClient.participantId, name: targetClient.name, role: targetClient.role, isMuted: targetClient.isMuted }, targetClient.participantId);
              broadcastRoomState(roomId);
              sendRoomHistoryAndState(targetClient);
              syncRoomStateToRedis(roomId, client.roomSlug);
            }
          }
        }
        break;

      case 'deny_user':
        if (client.role === 'host') {
          for (const targetClient of rooms.get(roomId)?.values() || []) {
            if (targetClient.userId === data.userId && targetClient.status === 'waiting') {
              targetClient.ws.send(JSON.stringify({ type: 'session_status', recovered: false, status: 'denied' }));
              targetClient.ws.close();
              rooms.get(roomId)?.delete(targetClient.participantId);
              // Notify all other hosts that this user was denied
              broadcastToHosts(roomId, {
                type: 'waiting_room_denied',
                userId: data.userId,
              });
            }
          }
        }
        break;

      case 'kick_user':
        if (client.role === 'host') {
          for (const targetClient of rooms.get(roomId)?.values() || []) {
            // Don't allow kicking other hosts (or maybe we should? for now let's say only attendees)
            if (targetClient.userId === data.userId && targetClient.role !== 'host') {
              // Remove first so the close handler skips grace period
              rooms.get(roomId)?.delete(targetClient.participantId);
              await removeRoomProducersByPredicate(roomId, (p: any) => p.userId === data.userId);
              broadcastToRoom(roomId, { type: 'user_left', userId: data.userId, participantId: targetClient.participantId });
              targetClient.ws.send(JSON.stringify({ type: 'session_status', recovered: false, status: 'kicked' }));
              targetClient.ws.close();
            }
          }
        }
        break;

      case 'change_role':
        if (client.role === 'host') {
          for (const targetClient of rooms.get(roomId)?.values() || []) {
            if (targetClient.userId === data.userId && data.newRole && data.userId !== client.userId) {
              targetClient.role = data.newRole;
              logger.info(`Host ${userId} changed role of ${data.userId} to ${data.newRole}`);
              broadcastToRoom(roomId, { 
                type: 'role_changed', 
                userId: targetClient.userId, 
                participantId: targetClient.participantId,
                role: targetClient.role 
              });
              broadcastRoomState(roomId);
              syncRoomStateToRedis(roomId, client.roomSlug);
            }
          }
        }
        break;

      case 'force_mute':
        if (client.role === 'host' || client.role === 'co-host') {
          const roomClients = rooms.get(roomId);
          if (!roomClients) break;

          const broadcastForceMute = (predicate: (c: Client) => boolean, type: 'force_mute' | 'force_video_off' = 'force_mute') => {
            for (const [id, c] of roomClients.entries()) {
              if (c.status === 'active' && predicate(c)) {
                c.ws.send(JSON.stringify({ type, reason: 'host_action' }));
              }
            }
          };

          if (data.userId) {
            broadcastForceMute(c => c.userId === data.userId);
          } else if (data.target === 'all') {
            broadcastForceMute(c => c.userId !== userId);
          } else if (data.target === 'all_except_hosts') {
            broadcastForceMute(c => c.role !== 'host' && c.role !== 'co-host');
          } else if (data.target === 'all_except_presenters') {
            const presenters = new Set(
              (await getRoomProducers(roomId))
                .filter(p => p.appData?.source === 'screen')
                .map(p => p.userId)
            );
            broadcastForceMute(c => c.userId !== userId && !presenters.has(c.userId));
          } else {
            broadcastForceMute(c => c.role !== 'host');
          }
        }
        break;

      case 'ask_to_unmute':
        if (client.role === 'host' || client.role === 'co-host') {
          const roomClients = rooms.get(roomId);
          if (!roomClients) break;
          for (const [id, c] of roomClients.entries()) {
            if (c.status === 'active' && c.userId === data.userId) {
              c.micExemption = true;
              c.ws.send(JSON.stringify({ type: 'ask_to_unmute', hostName: client.name }));
            }
          }
        }
        break;

      case 'force_video_off':
        if (client.role === 'host' || client.role === 'co-host') {
          const roomClients = rooms.get(roomId);
          if (!roomClients) break;

          const broadcastForceVideoOff = (predicate: (c: Client) => boolean) => {
            for (const [id, c] of roomClients.entries()) {
              if (c.status === 'active' && predicate(c)) {
                c.ws.send(JSON.stringify({ type: 'force_video_off', reason: 'host_action' }));
              }
            }
          };

          if (data.userId) {
            broadcastForceVideoOff(c => c.userId === data.userId);
          } else if (data.target === 'all') {
            broadcastForceVideoOff(c => c.userId !== userId);
          } else if (data.target === 'all_except_hosts') {
            broadcastForceVideoOff(c => c.role !== 'host' && c.role !== 'co-host');
          } else if (data.target === 'all_except_presenters') {
            const presenters = new Set(
              (await getRoomProducers(roomId))
                .filter(p => p.appData?.source === 'screen')
                .map(p => p.userId)
            );
            broadcastForceVideoOff(c => c.userId !== userId && !presenters.has(c.userId));
          } else {
            broadcastForceVideoOff(c => c.role !== 'host');
          }
        }
        break;

      case 'update_room_settings':
        if (client.role === 'host' || client.role === 'co-host') {
          const currentSettings = roomSettingsMap.get(roomId) || getDefaultRoomSettings();
          const d = data.settings || {};
          const newSettings = { ...currentSettings };
          
          if (d.micLocked !== undefined) newSettings.micLocked = d.micLocked;
          if (d.videoLocked !== undefined) newSettings.videoLocked = d.videoLocked;
          if (d.chatLocked !== undefined) newSettings.chatLocked = d.chatLocked;
          if (d.bypassWaitingRoom !== undefined) newSettings.bypassWaitingRoom = d.bypassWaitingRoom;
          
          if (d.networkDetectionEnabled !== undefined) newSettings.networkDetectionEnabled = d.networkDetectionEnabled;
          if (d.poorNetworkRttMs !== undefined) {
             if (d.poorNetworkRttMs >= 100 && d.poorNetworkRttMs <= 3000) newSettings.poorNetworkRttMs = d.poorNetworkRttMs;
             else logger.warn("network_detection_settings_update_rejected_validation (RTT)");
          }
          if (d.poorNetworkLossPercent !== undefined) {
             if (d.poorNetworkLossPercent >= 1 && d.poorNetworkLossPercent <= 50) newSettings.poorNetworkLossPercent = d.poorNetworkLossPercent;
             else logger.warn("network_detection_settings_update_rejected_validation (Loss)");
          }
          if (d.poorNetworkJitterMs !== undefined) {
             if (d.poorNetworkJitterMs >= 10 && d.poorNetworkJitterMs <= 1000) newSettings.poorNetworkJitterMs = d.poorNetworkJitterMs;
             else logger.warn("network_detection_settings_update_rejected_validation (Jitter)");
          }
          if (d.networkWindowSize !== undefined) {
             if (d.networkWindowSize >= 3 && d.networkWindowSize <= 20) newSettings.networkWindowSize = d.networkWindowSize;
             else logger.warn("network_detection_settings_update_rejected_validation (WindowSize)");
          }
          if (d.networkMonitorIntervalMs !== undefined) {
             if (d.networkMonitorIntervalMs >= 1000 && d.networkMonitorIntervalMs <= 10000) newSettings.networkMonitorIntervalMs = d.networkMonitorIntervalMs;
             else logger.warn("network_detection_settings_update_rejected_validation (Interval)");
          }
          
          roomSettingsMap.set(roomId, newSettings);
          
          db.room.update({
            where: { id: roomId },
            data: {
              networkDetectionEnabled: newSettings.networkDetectionEnabled,
              poorNetworkRttMs: newSettings.poorNetworkRttMs,
              poorNetworkLossPercent: newSettings.poorNetworkLossPercent,
              poorNetworkJitterMs: newSettings.poorNetworkJitterMs,
              networkWindowSize: newSettings.networkWindowSize,
              networkMonitorIntervalMs: newSettings.networkMonitorIntervalMs,
            }
          }).catch((e: any) => logger.error("Failed to persist network settings", e));
          
          broadcastToRoom(roomId, {
            type: 'room_settings_updated',
            settings: newSettings,
            updatedBy: client.name
          });

          const roomClients = rooms.get(roomId);
          if (roomClients) {
            // If mic just got locked, force mute all attendees
            if (!currentSettings.micLocked && newSettings.micLocked) {
              for (const [id, c] of roomClients.entries()) {
                if (c.status === 'active' && c.role !== 'host' && c.role !== 'co-host') {
                  c.micExemption = false;
                  c.ws.send(JSON.stringify({ type: 'force_mute', reason: 'host_action' }));
                }
              }
            }
            // If video just got locked, force video off for all attendees
            if (!currentSettings.videoLocked && newSettings.videoLocked) {
              for (const [id, c] of roomClients.entries()) {
                if (c.status === 'active' && c.role !== 'host' && c.role !== 'co-host') {
                  c.ws.send(JSON.stringify({ type: 'force_video_off', reason: 'host_action' }));
                }
              }
            }
          }
        } else {
          logger.warn(`network_detection_settings_update_rejected_permission: User ${client.userId} (${client.role}) attempted to update room settings in ${roomId}`);
        }
        break;

      case 'update_large_room_settings': {
        if (['host', 'co-host', 'admin'].includes(client.role)) {
          const currentSettings = roomSettingsMap.get(roomId) || getDefaultRoomSettings();
          const updatedConfig = validateLargeRoomConfig({
            ...currentSettings,
            ...data.settings,
          });

          const newSettings: RoomSettings = {
            ...currentSettings,
            ...updatedConfig,
          };

          roomSettingsMap.set(roomId, newSettings);

          db.room.update({
            where: { id: roomId },
            data: {
              largeRoomMode: newSettings.largeRoomMode,
              largeRoomEnabled: newSettings.largeRoomEnabled,
              maxActiveVideoPublishers: newSettings.maxActiveVideoPublishers,
              maxActiveAudioPublishers: newSettings.maxActiveAudioPublishers,
              maxScreenShares: newSettings.maxScreenShares,
              maxViewersPerRelayRouter: newSettings.maxViewersPerRelayRouter,
              relayProvisionThresholdPercent: newSettings.relayProvisionThresholdPercent,
            }
          }).catch((e: any) => logger.error("Failed to persist large room settings", e));

          logger.info(JSON.stringify({
            event: newSettings.largeRoomEnabled ? 'large_room_mode_enabled' : 'large_room_mode_disabled',
            roomId,
            participantId: client.participantId,
            userRole: client.role,
            largeRoomMode: newSettings.largeRoomMode,
            maxActiveVideoPublishers: newSettings.maxActiveVideoPublishers,
            maxActiveAudioPublishers: newSettings.maxActiveAudioPublishers,
            maxScreenShares: newSettings.maxScreenShares,
          }));

          logger.info(JSON.stringify({
            event: 'large_room_mode_updated',
            roomId,
            participantId: client.participantId,
            userRole: client.role,
            largeRoomMode: newSettings.largeRoomMode,
            settings: newSettings,
          }));

          broadcastToRoom(roomId, {
            type: 'large_room_settings_updated',
            settings: newSettings,
            updatedBy: client.name
          });
        } else {
          logger.warn(`large_room_settings_update_rejected: User ${client.userId} (${client.role}) attempted to update large room settings in ${roomId}`);
        }
        break;
      }

      case 'speaker_promotion_requested': {
        const currentSettings = roomSettingsMap.get(roomId) || getDefaultRoomSettings();
        const speakerRequests = Array.from(new Set([...(currentSettings.speakerRequests || []), client.participantId]));
        const updatedSettings: RoomSettings = { ...currentSettings, speakerRequests };
        roomSettingsMap.set(roomId, updatedSettings);

        logger.info(JSON.stringify({
          event: 'large_room_speaker_request_created',
          roomId,
          participantId: client.participantId,
          userRole: client.role,
          largeRoomMode: currentSettings.largeRoomMode,
        }));

        broadcastToHosts(roomId, {
          type: 'speaker_promotion_requested',
          participantId: client.participantId,
          userId: client.userId,
          name: client.name,
        });
        break;
      }

      case 'speaker_promotion_approved': {
        if (canPromoteParticipantToSpeaker(client.role, data.targetParticipantId, roomSettingsMap.get(roomId) || getDefaultRoomSettings())) {
          const currentSettings = roomSettingsMap.get(roomId) || getDefaultRoomSettings();
          const targetId = data.targetParticipantId;
          const promotedSpeakers = Array.from(new Set([...(currentSettings.promotedSpeakers || []), targetId]));
          const speakerRequests = (currentSettings.speakerRequests || []).filter((id) => id !== targetId);

          const updatedSettings: RoomSettings = { ...currentSettings, promotedSpeakers, speakerRequests };
          roomSettingsMap.set(roomId, updatedSettings);

          logger.info(JSON.stringify({
            event: 'large_room_speaker_request_approved',
            roomId,
            participantId: client.participantId,
            targetParticipantId: targetId,
            userRole: client.role,
            largeRoomMode: currentSettings.largeRoomMode,
          }));

          broadcastToRoom(roomId, {
            type: 'speaker_promotion_approved',
            targetParticipantId: targetId,
            approvedBy: client.name,
          });
        }
        break;
      }

      case 'speaker_promotion_rejected': {
        if (canPromoteParticipantToSpeaker(client.role, data.targetParticipantId, roomSettingsMap.get(roomId) || getDefaultRoomSettings())) {
          const currentSettings = roomSettingsMap.get(roomId) || getDefaultRoomSettings();
          const targetId = data.targetParticipantId;
          const speakerRequests = (currentSettings.speakerRequests || []).filter((id) => id !== targetId);

          const updatedSettings: RoomSettings = { ...currentSettings, speakerRequests };
          roomSettingsMap.set(roomId, updatedSettings);

          logger.info(JSON.stringify({
            event: 'large_room_speaker_request_rejected',
            roomId,
            participantId: client.participantId,
            targetParticipantId: targetId,
            userRole: client.role,
            largeRoomMode: currentSettings.largeRoomMode,
            reason: 'host_rejected',
          }));

          broadcastToRoom(roomId, {
            type: 'speaker_promotion_rejected',
            targetParticipantId: targetId,
            rejectedBy: client.name,
          });
        }
        break;
      }

      case 'speaker_demoted': {
        if (canPromoteParticipantToSpeaker(client.role, data.targetParticipantId, roomSettingsMap.get(roomId) || getDefaultRoomSettings())) {
          const currentSettings = roomSettingsMap.get(roomId) || getDefaultRoomSettings();
          const targetId = data.targetParticipantId;
          const promotedSpeakers = (currentSettings.promotedSpeakers || []).filter((id) => id !== targetId);

          const updatedSettings: RoomSettings = { ...currentSettings, promotedSpeakers };
          roomSettingsMap.set(roomId, updatedSettings);

          logger.info(JSON.stringify({
            event: 'speaker_demoted',
            roomId,
            participantId: client.participantId,
            targetParticipantId: targetId,
            userRole: client.role,
            largeRoomMode: currentSettings.largeRoomMode,
          }));

          broadcastToRoom(roomId, {
            type: 'speaker_demoted',
            targetParticipantId: targetId,
            demotedBy: client.name,
          });
        }
        break;
      }

      case 'leave_meeting':
        logger.info(`User ${userId} explicitly left room ${roomId}. Skipping grace period.`);
        const rc = rooms.get(roomId);
        if (rc) {
          rc.delete(client.participantId);
          if (rc.size === 0) {
            rooms.delete(roomId);
            cleanupRoomData(roomId);
            redis.del(`room:${roomId}:producers`).catch(e => logger.warn('Redis del error', e));
            roomAdmissions.delete(roomId);
            mediaController.cleanupAudioObserver(roomId);
            redis.del(`room:${client.roomSlug}:pod`).catch(e => logger.warn('Redis del error', e));
            syncRoomStateToRedis(roomId, client.roomSlug);
            generateMeetingSummary(roomId).catch(e => logger.error(`Error triggering summary for room ${roomId}`, e));
          } else {
            await removeRoomProducersByPredicate(roomId, (p: any) => p.participantId === client.participantId);
            broadcastToRoom(roomId, { type: 'user_left', userId, participantId: client.participantId });
            syncRoomStateToRedis(roomId, client.roomSlug);
          }
        }
        // If there's an existing disconnect timeout, clear it so it doesn't fire later
        if (disconnectTimeouts.has(`${userId}:${roomId}`)) {
          clearTimeout(disconnectTimeouts.get(`${userId}:${roomId}`)!);
          disconnectTimeouts.delete(`${userId}:${roomId}`);
        }
        try { client.ws.close(); } catch(e) { logger.warn('ws.close() error on leave_meeting', e); }
        break;

      case 'end_meeting':
        if (client.role === 'host') {
          logger.info(`Host ${userId} ended the meeting in room ${roomId}`);
          const roomClients = rooms.get(roomId);
          if (roomClients) {
            // Immediately destroy the room to prevent 30s grace periods on close
            rooms.delete(roomId);
            cleanupRoomData(roomId);
            redis.del(`room:${roomId}:producers`).catch(e => logger.warn('Redis del error', e));
            roomAdmissions.delete(roomId);
            mediaController.cleanupAudioObserver(roomId);
            redis.del(`room:${client.roomSlug}:pod`).catch(e => logger.warn('Redis del error', e));
            syncRoomStateToRedis(roomId, client.roomSlug);
            
            mediaController.closeRouter(roomId);
            roomSettingsMap.delete(roomId);

            for (const [id, c] of roomClients.entries()) {
              if (c.userId !== userId) { // Don't send 'ended' to the host that just ended it
                c.ws.send(JSON.stringify({ type: 'session_status', recovered: false, status: 'ended' }));
              }
              
              if (disconnectTimeouts.has(`${c.userId}:${roomId}`)) {
                clearTimeout(disconnectTimeouts.get(`${c.userId}:${roomId}`)!);
                disconnectTimeouts.delete(`${c.userId}:${roomId}`);
              }
              c.ws.close();
            }
          }
          
          // Stop any active recordings
          const reason = 'meeting_ended';
          redis.publish(`recorder:stop:${roomId}`, JSON.stringify({ reason })).catch(e => logger.error("Failed to stop recording on end_meeting", e));
          
          // Stop any active streams
          db.liveStream.findMany({ where: { roomId, status: { in: ['live', 'processing'] } } })
            .then((streams: { id: string }[]) => {
              for (const stream of streams) {
                redis.publish(`streamer:stop:${stream.id}`, 'stop').catch((e: unknown) => logger.error(`Failed to stop stream ${stream.id}`, e));
              }
            })
            .catch((e: unknown) => logger.error("Failed to fetch streams to stop on end_meeting", e));

          // Fire off AI Summary generation in the background
          generateMeetingSummary(roomId).catch(e => logger.error(e));
          // The socket close handlers will trigger full room cleanup
        }
        break;

      case 'chat':
        try {
          const settings = roomSettingsMap.get(roomId);
          if (settings && settings.chatLocked && client.role === 'attendee') {
            if (clientEventId) emitActionAck(client, clientEventId, 'chat', '', 'failed', 'NOT_AUTHORIZED', 'Chat is currently locked by the host.');
            else client.ws.send(JSON.stringify({ type: 'error', message: 'Chat is currently locked by the host.' }));
            return;
          }
          if (!data.message || typeof data.message !== 'string' || data.message.trim().length === 0) {
            if (clientEventId) emitActionAck(client, clientEventId, 'chat', '', 'failed', 'INVALID_PAYLOAD', 'Empty message.');
            return;
          }
          if (data.message.length > 4000) {
            if (clientEventId) emitActionAck(client, clientEventId, 'chat', '', 'failed', 'INVALID_PAYLOAD', 'Message too long (max 4000 characters).');
            else client.ws.send(JSON.stringify({ type: 'error', message: 'Message too long (max 4000 characters).' }));
            return;
          }
          if (data.fileUrl && (typeof data.fileUrl !== 'string' || !/^https?:\/\//i.test(data.fileUrl))) {
            if (clientEventId) emitActionAck(client, clientEventId, 'chat', '', 'failed', 'INVALID_PAYLOAD', 'Invalid file URL.');
            else client.ws.send(JSON.stringify({ type: 'error', message: 'Invalid file URL.' }));
            return;
          }

          const serverEventId = crypto.randomUUID();
          const createdAt = new Date();
          const msgPayload = {
            type: 'chat',
            actionType: 'chat',
            clientEventId,
            serverEventId,
            roomId,
            userId,
            senderParticipantId: client.participantId,
            name: client.name,
            message: data.message,
            timestamp: createdAt.toISOString(),
            broadcastAt: createdAt.toISOString(),
            isPrivate: !!data.targetUserId,
            fileUrl: data.fileUrl || null,
            id: serverEventId
          };

          if (clientEventId) {
            emitActionAck(client, clientEventId, 'chat', serverEventId, 'accepted');
          }

          if (data.targetUserId) {
            const roomClients = rooms.get(roomId);
            if (roomClients) {
              const targetClient = roomClients.get(data.targetUserId);
              if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
                targetClient.ws.send(JSON.stringify(msgPayload));
              }
            }
          } else {
            broadcastToRoom(roomId, msgPayload, client.participantId);
          }

          asyncWithRetry(
            async () => {
              const dbFormatMessage = {
                id: serverEventId,
                roomId,
                userId,
                senderName: client.name,
                content: data.message,
                fileUrl: data.fileUrl || null,
                isPrivate: !!data.targetUserId,
                targetUserId: data.targetUserId || null,
                createdAt
              };
              await db.chatMessage.create({
                data: dbFormatMessage
              });
              // Write-through to cache after successful DB persist (Option A)
              await appendChatToCache(roomId, dbFormatMessage);
            },
            (err) => {
              logger.error("Failed to persist chat message after retries", err);
              if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(JSON.stringify({
                  type: 'chat_persistence_failed',
                  serverEventId,
                  clientEventId
                }));
              }
            }
          );
        } catch (e) {
          logger.error("Failed to process chat message", e);
          if (clientEventId) emitActionAck(client, clientEventId, 'chat', '', 'failed', 'SERVER_ERROR', 'Failed to process chat message');
        }
        break;

      case 'clear_chat': {
        if (client.role === 'host' || client.role === 'co-host') {
          try {
            await db.chatMessage.deleteMany({
              where: { roomId }
            });
            broadcastToRoom(roomId, { type: 'chat_cleared' });
          } catch (e) {
            logger.error("Failed to clear chat", e);
          }
        }
        break;
      }

      case 'reaction':
        if (clientEventId) {
          const serverEventId = crypto.randomUUID();
          emitActionAck(client, clientEventId, 'reaction', serverEventId, 'accepted');
          // Exclude the sender — they already show the reaction locally via sendReaction()
          broadcastToRoom(roomId, {
            type: 'reaction',
            actionType: 'reaction',
            clientEventId,
            serverEventId,
            roomId,
            userId,
            senderParticipantId: userId,
            name: client.name, // Always include name so clients don't need to look it up
            reaction: data.reaction,
            broadcastAt: new Date().toISOString()
          }, client.participantId); // <-- userId as excludeUserId prevents the double-animation
        } else {
          broadcastToRoom(roomId, {
            type: 'reaction',
            actionType: 'reaction',
            roomId,
            userId,
            senderParticipantId: userId,
            name: client.name,
            reaction: data.reaction,
            broadcastAt: new Date().toISOString()
          }, client.participantId);
        }
        break;

      case 'network_quality':
        broadcastToRoom(roomId, {
          type: 'network_quality',
          userId,
          quality: data.quality
        }, client.participantId);
        break;

      case 'caption':
        // Client-side captions are deprecated in favor of server-side Deepgram.
        // We safely ignore any straggler caption events from older clients.
        break;

      case 'ecinema_update':
        if (client.role === 'host' || client.role === 'co-host' || client.role === 'presenter') {
          if (data.link) {
            try {
              const url = new URL(data.link);
              if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                client.ws.send(JSON.stringify({ type: 'error', message: 'Invalid eCinema URL.' }));
                return;
              }
            } catch {
              client.ws.send(JSON.stringify({ type: 'error', message: 'Invalid eCinema URL.' }));
              return;
            }
          } else {
            roomECinemaState.delete(roomId);
          }
          roomECinema.set(roomId, data.link || null);
          broadcastToRoom(roomId, {
            type: 'ecinema_update',
            link: data.link || null
          });
        }
        break;

      case 'ecinema_action':
        if (client.role === 'host' || client.role === 'co-host' || client.role === 'presenter') {
          roomECinemaState.set(roomId, { action: data.action, time: data.time || 0, serverTime: Date.now() });
          broadcastToRoom(roomId, {
            type: 'ecinema_action',
            action: data.action,
            time: data.time
          }, client.participantId);
        }
        break;

      case 'donation_status':
        if (client.role === 'host' || client.role === 'co-host') {
          broadcastToRoom(roomId, {
            type: 'donation_status',
            active: data.active
          }, client.participantId);
        }
        break;

      case 'donation_success':
        broadcastToRoom(roomId, {
          type: 'donation_success',
          userId,
          name: client.name,
          amount: data.amount,
          currency: data.currency
        }, client.participantId);
        break;

      case 'note_update':
        try {
          await db.sharedNote.upsert({
            where: { roomId },
            create: { roomId, content: data.content },
            update: { content: data.content }
          });
          await refreshNoteCache(roomId, data.content);
          broadcastToRoom(roomId, {
            type: 'note_update',
            userId,
            content: data.content
          }, client.participantId);
        } catch (e) {
          logger.error("Failed to update shared note", e);
        }
        break;

      case 'poll_create':
        if (client.role === 'host' || client.role === 'co-host') {
          try {
            const newPoll = await db.meetingPoll.create({
              data: {
                id: data.pollId,
                roomId,
                question: data.question,
                options: data.options,
                createdBy: userId,
              }
            });
            await refreshPollsCache(roomId);
            broadcastToRoom(roomId, {
              type: 'poll_create',
              pollId: newPoll.id,
              question: newPoll.question,
              options: newPoll.options,
              userId
            }, client.participantId);
          } catch (e) {
            logger.error("Failed to create poll", e);
          }
        }
        break;
      case 'end_poll':
        try {
          if (client.role === 'host' || client.role === 'co-host') {
            await db.meetingPoll.update({
              where: { id: data.pollId },
              data: { isActive: false }
            });
            await refreshPollsCache(roomId);
            broadcastToRoom(roomId, {
              type: 'poll_ended',
              pollId: data.pollId
            });
          }
        } catch (e) {
          logger.error("Failed to end poll", e);
        }
        break;

      case 'poll_vote':
        try {
          // Increment vote in DB
          const poll = await db.meetingPoll.findUnique({ where: { id: data.pollId } });
          if (poll && Array.isArray(poll.options)) {
            // Check for duplicate vote
            const alreadyVoted = (poll.options as any[]).some(
              (opt: any) => Array.isArray(opt.votedBy) && opt.votedBy.some((v: any) => typeof v === 'string' ? v === userId : v.userId === userId)
            );
            if (alreadyVoted) {
              client.ws.send(JSON.stringify({ type: 'error', message: 'You have already voted on this poll.' }));
              return;
            }
            const updatedOptions = (poll.options as any[]).map((opt: any) => {
              if (opt.id === data.optionId) {
                return { ...opt, votes: (opt.votes || 0) + 1, votedBy: [...(opt.votedBy || []), { userId, name: client.name }] };
              }
              return opt;
            });
            await db.meetingPoll.update({
              where: { id: data.pollId },
              data: { options: updatedOptions }
            });
            await refreshPollsCache(roomId);
          }

          broadcastToRoom(roomId, {
            type: 'poll_vote',
            pollId: data.pollId,
            optionId: data.optionId,
            userId: userId,
            name: client.name
          });
        } catch (e) {
          logger.error("Failed to vote on poll", e);
        }
        break;

      case 'audio_connection_status': {
        const serverEventId = crypto.randomUUID();
        if (clientEventId) emitActionAck(client, clientEventId, 'audio_connection_status', serverEventId, 'accepted');
        
        logger.info(JSON.stringify({
          event: "audio_connection_status_broadcast",
          roomId,
          userId,
          participantId: client.participantId,
          audioConnectionStatus: data.audioConnectionStatus,
          timestamp: new Date().toISOString()
        }));

        broadcastToRoom(roomId, {
          type: 'audio_connection_status',
          actionType: 'audio_connection_status',
          clientEventId,
          serverEventId,
          roomId,
          userId,
          participantId: client.participantId,
          audioConnectionStatus: data.audioConnectionStatus,
          broadcastAt: new Date().toISOString()
        }, client.participantId);
        break;
      }

      case 'mute_state': {
        const serverEventId = crypto.randomUUID();
        if (clientEventId) emitActionAck(client, clientEventId, 'mute_state', serverEventId, 'accepted');
        client.isMuted = data.isMuted;
        
        // Pause or resume transcription based on mute state
        const producersList = await getRoomProducers(roomId);
        if (producersList) {
          const audioProducer = producersList.find((p: any) => p.participantId === client.participantId && p.kind === 'audio');
          if (audioProducer) {
             mediaController.handleTranscriptionMute(audioProducer.producerId, roomId, userId, client.name, data.isMuted, { isBot: client.isBot, role: client.role });
          }
        }
        
        broadcastToRoom(roomId, {
          type: 'mute_state',
          actionType: 'mute_state',
          clientEventId,
          serverEventId,
          roomId,
          userId,
          senderParticipantId: userId,
          isMuted: data.isMuted,
          broadcastAt: new Date().toISOString()
        });
        break;
      }

      case 'camera_state': {
        // Update client's tracked state for late joiners
        client.isCameraOn = data.isCameraOn;
        client.audioOnlyMode = data.audioOnlyMode;
        if (data.videoSuspendedReason) client.videoSuspendedReason = data.videoSuspendedReason;
        else delete client.videoSuspendedReason;

        const serverEventId = crypto.randomUUID();
        if (clientEventId) emitActionAck(client, clientEventId, 'camera_state', serverEventId, 'accepted');
        
        broadcastToRoom(roomId, {
          type: 'camera_state',
          actionType: 'camera_state',
          clientEventId,
          serverEventId,
          roomId,
          userId,
          senderParticipantId: userId,
          isCameraOn: data.isCameraOn,
          audioOnlyMode: data.audioOnlyMode,
          videoSuspendedReason: data.videoSuspendedReason,
          broadcastAt: new Date().toISOString()
        });
        break;
      }

      case 'hand_raise': {
        const serverEventId = crypto.randomUUID();
        if (clientEventId) emitActionAck(client, clientEventId, 'hand_raise', serverEventId, 'accepted');
        broadcastToRoom(roomId, {
          type: 'hand_raise',
          actionType: 'hand_raise',
          clientEventId,
          serverEventId,
          roomId,
          userId,
          senderParticipantId: userId,
          isHandRaised: data.isHandRaised,
          broadcastAt: new Date().toISOString()
        });
        break;
      }

      case 'sync_panel':
        if (client.role === 'host' || client.role === 'co-host') {
          broadcastToRoom(roomId, {
            type: 'sync_panel',
            panel: data.panel
          }, client.participantId);
        }
        break;

      case 'start_recording':
        if (client.role === 'host' || client.role === 'co-host') {
          try {
            const room = await db.room.findUnique({ where: { id: roomId } });
            if (room) {
              const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
              const domain = process.env.NEXT_PUBLIC_FRONTEND_DOMAIN || 'konn3ctedge.konn3ct.net';
              
              // 1. Create DB entry for the recording
              const recording = await db.recording.create({
                data: {
                  title: `${room.name} - Recording`,
                  roomId: room.id,
                  ownerId: userId,
                  status: 'starting'
                }
              });

              // 2. Generate secure short-lived token for the bot
              const participantId = crypto.randomUUID();
              const botToken = jwt.sign(
                { role: 'recorder', purpose: 'recording_bot', roomId: room.id, roomSlug: room.slug, recordingId: recording.id, participantId },
                process.env.JWT_SECRET || 'fallback',
                { expiresIn: '4h' }
              );

              // 3. Launch via central queue
              const launchResult = await launchRecorderBot({
                roomId: room.id,
                roomSlug: room.slug,
                recordingId: recording.id,
                botToken,
                url: `${protocol}://${domain}/recording/${room.slug}?botToken=${botToken}`
              });

              if (launchResult.queued) {
                broadcastToRoom(roomId, { type: 'recording_started' });

                // Watchdog to prevent recording getting stuck in 'starting' forever
                setTimeout(async () => {
                  try {
                    const check = await db.recording.findUnique({ where: { id: recording.id } });
                    if (check && check.status === 'starting') {
                      await db.recording.update({
                        where: { id: recording.id },
                        data: { status: 'failed' }
                      });
                      logger.warn(`Recording watchdog timed out for job ${recording.id}`);
                      broadcastToRoom(roomId, { type: 'recording_stopped' });
                    }
                  } catch (err) {
                    logger.error(`Watchdog check failed for recording ${recording.id}`, err);
                  }
                }, 75000); // 75 seconds (readiness timeout in worker is 60s)
              } else {
                await db.recording.update({
                  where: { id: recording.id },
                  data: { status: 'failed' }
                });
                logger.error(`Failed to push recording job to queue for room ${roomId}: ${launchResult.error}`);
              }
            }
          } catch (e) {
            logger.error('Failed to start recording', e);
          }
        }
        break;

      case 'stop_recording':
        if (client.role === 'host' || client.role === 'co-host') {
          // Publish stop event to the worker
          const reason = data.reason || 'manual_stop';
          redis.publish(`recorder:stop:${roomId}`, JSON.stringify({ reason })).catch(e => logger.error("Failed to publish stop recording", e));
          broadcastToRoom(roomId, { type: 'recording_stopped' });
        }
        break;

      case 'admit_all':
        if (client.role === 'host' || client.role === 'co-host') {
          const roomClients = rooms.get(roomId);
          if (roomClients) {
            for (const [id, c] of roomClients.entries()) {
              if (c.status === 'waiting') {
                c.status = 'active';
                c.ws.send(JSON.stringify({ type: 'session_status', status: 'active', recovered: false, userId: c.userId, name: c.name, role: c.role }));
                broadcastToRoom(roomId, {
                  type: 'user_joined',
                  userId: c.userId,
                  participantId: c.participantId,
                  name: c.name,
                  role: c.role,
                  isMobile: c.isMobile,
                  isMuted: c.isMuted
                });
                sendRoomHistoryAndState(c);
              }
            }
            syncRoomStateToRedis(roomId, client.roomSlug);
          }
        }
        break;

      case 'deny_all':
        if (client.role === 'host' || client.role === 'co-host') {
          const roomClients = rooms.get(roomId);
          if (roomClients) {
            let deniedAny = false;
            for (const [id, c] of Array.from(roomClients.entries())) {
              if (c.status === 'waiting') {
                c.ws.send(JSON.stringify({ type: 'error', message: 'You have been denied entry to this room.' }));
                roomClients.delete(id);
                deniedAny = true;
              }
            }
            if (deniedAny) {
              broadcastToHosts(roomId, { type: 'waiting_room_denied_all' });
            }
          }
        }
        break;

      case 'ask_question':
        try {
          const newQ = await db.meetingQA.create({
            data: {
              roomId,
              userId: data.isAnonymous ? null : userId,
              authorName: data.isAnonymous ? 'Anonymous' : client.name,
              isAnonymous: !!data.isAnonymous,
              question: data.question,
            }
          });
          await refreshQaCache(roomId);
          broadcastToRoom(roomId, {
            type: 'qa_updated',
            action: 'ask',
            message: newQ
          });
        } catch (e) {
          logger.error("Failed to ask question", e);
        }
        break;

      case 'upvote_question':
        try {
          const q = await db.meetingQA.findUnique({ where: { id: data.questionId } });
          if (q) {
            const voterIds = Array.isArray(q.voterIds) ? q.voterIds : [];
            if (!voterIds.includes(userId)) {
              const updated = await db.meetingQA.update({
                where: { id: data.questionId },
                data: {
                  upvotes: q.upvotes + 1,
                  voterIds: [...voterIds, userId]
                }
              });
              await refreshQaCache(roomId);
              broadcastToRoom(roomId, {
                type: 'qa_updated',
                action: 'upvote',
                message: updated
              });
            }
          }
        } catch (e) {
          logger.error("Failed to upvote question", e);
        }
        break;

      case 'answer_question':
        if (client.role === 'host' || client.role === 'co-host') {
          try {
            const updated = await db.meetingQA.update({
              where: { id: data.questionId },
              data: {
                isAnswered: true,
                answerText: data.answerText,
                answeredBy: client.name
              }
            });
            await refreshQaCache(roomId);
            broadcastToRoom(roomId, {
              type: 'qa_updated',
              action: 'answer',
              message: updated
            });
          } catch (e) {
            logger.error("Failed to answer question", e);
          }
        }
        break;

      case 'delete_question':
        if (client.role === 'host' || client.role === 'co-host') {
          try {
            await db.meetingQA.delete({ where: { id: data.questionId } });
            await refreshQaCache(roomId);
            broadcastToRoom(roomId, {
              type: 'qa_updated',
              action: 'delete',
              questionId: data.questionId
            });
          } catch (e) {
            logger.error("Failed to delete question", e);
          }
        }
        break;

      // --- WebRTC Media Signaling ---
      case 'getRouterRtpCapabilities': {
        try {
          const routerObj = await mediaController.getOrCreateRouter(roomId);
          const rtpCapabilities = (routerObj as any)?.rtpCapabilities?.rtpCapabilities 
            || (routerObj as any)?.rtpCapabilities 
            || ((routerObj as any)?.codecs ? routerObj : undefined);
            
          if (!rtpCapabilities || !rtpCapabilities.codecs) {
            logger.error(`[SFU] getRouterRtpCapabilities: rtpCapabilities missing or invalid for room ${roomId}`);
          }
          client.ws.send(JSON.stringify({ type: 'routerCapabilities', rtpCapabilities }));
        } catch (err) {
          logger.error(`[SFU] getRouterRtpCapabilities error for room ${roomId}:`, err);
          client.ws.send(JSON.stringify({ type: 'routerCapabilities', rtpCapabilities: null, error: 'Failed to fetch router capabilities' }));
        }
        break;
      }

      case 'createWebRtcTransport': {
        const transportParams = await mediaController.createWebRtcTransport(roomId);
        client.transports.push(transportParams.id);

        // Generate temporary TURN credentials for this client
        const turnSecret = process.env.TURN_SECRET || 'my-super-strong-conn3ct-secret-123';
        const turnDomain = process.env.TURN_DOMAIN || 'turnedge.konn3ct.net';
        
        // Credentials valid for 24 hours
        const unixTime = Math.floor(Date.now() / 1000) + 86400; 
        const username = `${unixTime}:${client.userId}`;
        const password = crypto.createHmac('sha1', turnSecret).update(username).digest('base64');
        
        const iceServers = [
          {
            urls: [
              `turn:${turnDomain}:443`,
              `turn:${turnDomain}:3478`
            ],
            username,
            credential: password
          }
        ];

        // Attach iceServers into the transportParams
        const fullTransportParams = {
          ...transportParams,
          iceServers
        };

        client.ws.send(JSON.stringify({ type: 'transportCreated', transportParams: fullTransportParams, direction: data.direction }));
        break;
      }

      case 'connectWebRtcTransport': {
        if (!client.transports.includes(data.transportId)) {
          logger.warn(`User ${userId} tried to connect a transport they don't own: ${data.transportId}`);
          return;
        }
        await mediaController.connectTransport(data.transportId, data.dtlsParameters, roomId);
        client.ws.send(JSON.stringify({ type: 'transportConnected', transportId: data.transportId }));
        break;
      }

      case 'produce': {
        if (!client.transports || !client.transports.includes(data.transportId)) {
          const errPayload = {
            event: "sfu_produce_failed",
            errorCode: "SEND_TRANSPORT_NOT_READY",
            roomId: roomId,
            participantId: userId,
            socketId: client.ws.url || 'unknown',
            transportId: data.transportId
          };
          logger.warn(`Produce failed: ${JSON.stringify(errPayload)}`);
          client.ws.send(JSON.stringify({
            type: 'produce_failed',
            errorCode: 'SEND_TRANSPORT_NOT_READY',
            clientEventId: data.clientEventId,
            serverEventId: crypto.randomUUID(),
            message: 'Send transport not ready. Create/connect transport before produce.'
          }));
          return;
        }

        if (!data.kind || !data.rtpParameters) {
          logger.warn(`Missing required parameters for produce from ${userId}`);
          return;
        }
        
        const settings = roomSettingsMap.get(roomId) || validateLargeRoomConfig({ largeRoomMode: 'standard' });
        const roomProducersList = await getRoomProducers(roomId);
        const participantCtx = {
          userId: client.userId,
          participantId: client.participantId,
          role: client.role,
          micExemption: client.micExemption,
        };

        const appData: Record<string, any> = data.appData || {};
        const source = appData.source || 'camera'; // 'camera' | 'screen'

        if (data.kind === 'audio') {
          const audioCheck = canParticipantPublishAudio(participantCtx, settings, roomProducersList);
          if (!audioCheck.allowed) {
            client.ws.send(JSON.stringify({
              type: 'produce_failed',
              errorCode: 'AUDIO_PUBLISH_LIMIT_REACHED',
              clientEventId: data.clientEventId,
              serverEventId: crypto.randomUUID(),
              message: audioCheck.reason,
            }));
            return;
          }
        }

        if (data.kind === 'video' && source !== 'screen') {
          const videoCheck = canParticipantPublishVideo(participantCtx, settings, roomProducersList);
          if (!videoCheck.allowed) {
            client.ws.send(JSON.stringify({
              type: 'produce_failed',
              errorCode: 'VIDEO_PUBLISH_LIMIT_REACHED',
              clientEventId: data.clientEventId,
              serverEventId: crypto.randomUUID(),
              message: videoCheck.reason,
            }));
            return;
          }
        }

        if (data.kind === 'video' && source === 'screen') {
          const screenCheck = canParticipantShareScreen(participantCtx, settings, roomProducersList);
          if (!screenCheck.allowed) {
            client.ws.send(JSON.stringify({
              type: 'produce_failed',
              errorCode: 'SCREEN_SHARE_LIMIT_REACHED',
              clientEventId: data.clientEventId,
              serverEventId: crypto.randomUUID(),
              message: screenCheck.reason,
            }));
            return;
          }
        }

        const { id: producerId } = await mediaController.createProducer(data.transportId, data.kind, data.rtpParameters, roomId, userId, client.name, { isBot: client.isBot, role: client.role });
        
        logger.info(JSON.stringify({
          event: "producer_created",
          timestamp: Date.now(),
          roomId,
          participantId: userId,
          kind: data.kind,
          source,
          producerId,
          clientEventId: data.clientEventId || undefined
        }));

        // QA-004 Codec Logging
        if (data.kind === 'video' && process.env.NODE_ENV !== 'production') {
          const codec = data.rtpParameters?.codecs?.[0];
          if (codec) {
            logger.info(`[QA-004 Codec] Video producer created | User: ${userId.substring(0,6)}... | Codec: ${codec.mimeType} | Params: ${JSON.stringify(codec.parameters || {})} | ProducerID: ${producerId.substring(0,6)}...`);
          }
        }

        // Track for late joiners — store appData so late joiners know source type
        const newProd = { producerId, userId, participantId: client.participantId, name: client.name, kind: data.kind, appData };
        await redis.hset(`room:${roomId}:producers`, producerId, JSON.stringify(newProd));

        client.ws.send(JSON.stringify({ type: 'produced', id: producerId, kind: data.kind }));
        if (clientEventId) emitActionAck(client, clientEventId, 'produce', producerId, 'accepted');

        // Broadcast to others — include appData.source so they render screen share correctly
        broadcastToRoom(roomId, { type: 'newProducer', producerId, userId, participantId: client.participantId, name: client.name, kind: data.kind, appData }, client.participantId);

        // For screen share, send a dedicated state event so peers update isScreenSharing immediately
        if (source === 'screen') {
          const ssEventId = crypto.randomUUID();
          broadcastToRoom(roomId, { 
            type: 'screen_share_started',
            actionType: 'screen_share_started',
            clientEventId,
            serverEventId: ssEventId,
            roomId,
            userId,
            senderParticipantId: userId,
            producerId,
            broadcastAt: new Date().toISOString()
          }, client.participantId);
        }
        break;
      }

      case 'consume': {
        const now = Date.now();
        if (!consumeBursts.has(roomId)) consumeBursts.set(roomId, []);
        consumeBursts.get(roomId)!.push(now);
        
        try {
          const router = await mediaController.getOrCreateRouter(roomId);
          const allProducers = await getRoomProducers(client.roomId);
          const targetProducer = allProducers.find((p: any) => p.producerId === data.producerId);

          const hasRecvTransport = client.transports && client.transports.includes(data.transportId);
          const hasRtpCapabilities = !!data.rtpCapabilities;
          
          let canConsume = false;
          try {
            canConsume = await mediaController.canConsume(roomId, data.producerId, data.rtpCapabilities);
          } catch (err) {
            logger.error(`[SFU] router.canConsume threw error for producer ${data.producerId}:`, err);
          }

          // 1. Log structured attempt
          logger.info(JSON.stringify({
            event: "sfu_consume_attempt",
            roomId: roomId,
            participantId: userId,
            socketId: client.ws.url || 'unknown',
            producerId: data.producerId,
            producerOwnerId: targetProducer?.userId || "unknown",
            producerKind: targetProducer?.kind || "unknown",
            producerSource: targetProducer?.appData?.source || "unknown",
            hasRecvTransport,
            hasRtpCapabilities,
            canConsume
          }));

          let failReason = null;
          let preciseReason = "UNKNOWN_RTP_CAPABILITY_MISMATCH";
          let sfuProducer = null;

          if (!hasRecvTransport) failReason = "RECV_TRANSPORT_NOT_READY";
          else if (!hasRtpCapabilities) failReason = "MISSING_RTP_CAPABILITIES";
          else if (!targetProducer) failReason = "PRODUCER_CLOSED";
          else if (targetProducer.participantId === client.participantId) failReason = "SELF_CONSUME_NOT_ALLOWED";
          else if (!canConsume) {
            failReason = "RTP_CAPABILITIES_MISMATCH";
            sfuProducer = await mediaController.getProducer(data.producerId);
            const consumerCodecs = data.rtpCapabilities?.codecs || [];
            const hasAudioOpus = consumerCodecs.some((c: any) => c.mimeType?.toLowerCase() === 'audio/opus');
            const hasVideoCodec = consumerCodecs.some((c: any) => c.mimeType?.toLowerCase().startsWith('video/'));
            
            // Assume producer and consumer share the same router unless routerId is explicitly on producer appData
            const producerRouterId = sfuProducer?.appData?.routerId || router.id;
            
            if (producerRouterId !== router.id) {
              preciseReason = "ROUTER_MISMATCH";
            } else if (!data.rtpCapabilities?.codecs || data.rtpCapabilities.codecs.length === 0) {
              preciseReason = "CONSUMER_CAPABILITIES_EMPTY_CODECS";
            } else if (targetProducer.kind === 'audio' && !hasAudioOpus) {
              preciseReason = "CONSUMER_CAPABILITIES_MISSING_OPUS";
            } else if (targetProducer.kind === 'video' && !hasVideoCodec) {
              preciseReason = "CONSUMER_CAPABILITIES_MISSING_VIDEO_CODEC";
            } else if (sfuProducer && sfuProducer.rtpParameters?.codecs?.[0]) {
              const producerMimeType = sfuProducer.rtpParameters.codecs[0].mimeType?.toLowerCase();
              const isInConsumer = consumerCodecs.some((c: any) => c.mimeType?.toLowerCase() === producerMimeType);
              if (!isInConsumer) {
                preciseReason = "PRODUCER_CODEC_NOT_IN_CONSUMER_CAPABILITIES";
              }
            }

            // Rate limit or only QA log the large payload
            if (process.env.NODE_ENV !== 'production' || process.env.QA_DIAGNOSTICS_MODE === 'true') {
              const logKey = `${userId}:${data.producerId}`;
              if (!sfuConsumeMismatchLogged.has(logKey)) {
                sfuConsumeMismatchLogged.add(logKey);
                // Clear the cache after 60 seconds to avoid memory leak and allow future logging
                setTimeout(() => sfuConsumeMismatchLogged.delete(logKey), 60000);

                const fingerprintPayload = {
                  event: "sfu_rtp_capability_compare_failed",
                  roomId: roomId,
                  participantId: userId,
                  producerId: data.producerId,
                  producerOwnerId: targetProducer.userId,
                  producerKind: targetProducer.kind,
                  producerSource: targetProducer.appData?.source || "unknown",
                  producerCodec: sfuProducer?.rtpParameters?.codecs?.[0]?.mimeType || "unknown",
                  consumerCodecList: consumerCodecs.map((c: any) => c.mimeType),
                  routerCodecList: ((router as any)?.rtpCapabilities?.codecs || (router as any)?.codecs)?.map((c: any) => c.mimeType),
                  canConsume: false,
                  reason: preciseReason,
                  routerId: router.id,
                  producerRouterId: producerRouterId,
                  consumerHeaderExtensions: data.rtpCapabilities?.headerExtensions?.map((h: any) => h.uri) || []
                };
                logger.warn(JSON.stringify(fingerprintPayload));
              }
            }
          }

          if (failReason) {
            const errPayload = {
              event: "sfu_consume_failed",
              errorCode: failReason === "RTP_CAPABILITIES_MISMATCH" ? preciseReason : failReason,
              reason: failReason,
              roomId: roomId,
              participantId: userId,
              producerId: data.producerId
            };
            logger.warn(JSON.stringify(errPayload));
            client.ws.send(JSON.stringify({
              type: 'consume_failed',
              requestId: data.requestId,
              errorCode: failReason === "RTP_CAPABILITIES_MISMATCH" ? preciseReason : failReason,
              producerId: data.producerId,
              producerKind: targetProducer?.kind || "unknown",
              producerSource: targetProducer?.appData?.source || "unknown",
              reason: failReason === "RTP_CAPABILITIES_MISMATCH" ? preciseReason : failReason
            }));
            return;
          }

          const consumerParams = await mediaController.createConsumer(
            data.transportId,
            data.producerId,
            data.rtpCapabilities,
            roomId
          );
          // Track which client owns this consumer for cleanup
          consumerOwners.set(consumerParams.id, client);
          client.ws.send(JSON.stringify({ type: 'consumed', requestId: data.requestId, ...consumerParams }));
        } catch (e) {
          logger.warn(`Consume failed for producer ${data.producerId}:`, e);
          // Don't send a response, let the client timeout or we can send an error response if we want.
          // To prevent the 10s client timeout, we should resolve it. But the client expects specific data.
          // Let's just send a dummy response or let it timeout. It's fine to timeout if it fails.
          // Actually, let's send 'consumed_error' and handle it on the client if needed.
        }
        break;
      }

      case 'screen_share': {
        // Unknown legacy message type handling
        client.ws.send(JSON.stringify({
          type: 'error',
          errorCode: 'LEGACY_SCREEN_SHARE_UNSUPPORTED',
          message: 'Use produce with source=screen instead'
        }));
        break;
      }

      case 'reset_webrtc_state': {
        logger.info(`User ${userId} requested WebRTC state reset (IP change detected)`);
        for (const tid of client.transports) {
          mediaController.closeTransport(tid);
        }
        client.transports = [];
        
        // Clean up consumer owners to prevent invalid ownership spam on reconnect
        for (const [consumerId, owner] of consumerOwners.entries()) {
          if (owner === client) {
            consumerOwners.delete(consumerId);
          }
        }
        
        await removeRoomProducersByPredicate(roomId, (p: any) => p.participantId === client.participantId);
        break;
      }

      case 'restart_ice': {
        const { transportId } = data;
        try {
          logger.info(`User ${userId} requesting ICE Restart for transport ${transportId}`);
          const iceParameters = await mediaController.restartIce(transportId);
          client.ws.send(JSON.stringify({
            type: 'ice_restarted',
            transportId,
            iceParameters
          }));
        } catch (error) {
          logger.error(`Failed to restart ICE for transport ${transportId}: ${error}`);
          client.ws.send(JSON.stringify({
            type: 'error',
            message: 'Failed to restart ICE'
          }));
        }
        break;
      }

      case 'stop_producer': {
        // Client is explicitly closing a producer (e.g. stopped screen sharing)
        const rp0 = await getRoomProducers(roomId);
        const ownedProducer = rp0?.find(p => p.producerId === data.producerId && p.userId === userId);
        if (!ownedProducer) {
          logger.warn(`User ${userId} tried to stop a producer they don't own: ${data.producerId}`);
          return;
        }

        const { producerId: pidToStop, appData: stopAppData } = data;
        const source = (stopAppData || {}).source || 'unknown';

        // Remove from room tracking
        await redis.hdel(`room:${roomId}:producers`, pidToStop);
        if (true) {
          // Close the Mediasoup producer — this triggers producerclose on all consumers
          mediaController.closeProducer(pidToStop);

          if (clientEventId) emitActionAck(client, clientEventId, 'stop_producer', crypto.randomUUID(), 'accepted');

          // Broadcast a state update to all peers
          if (source === 'screen') {
            const ssEventId = crypto.randomUUID();
            broadcastToRoom(roomId, { 
              type: 'screen_share_stopped',
              actionType: 'screen_share_stopped',
              clientEventId,
              serverEventId: ssEventId,
              roomId,
              userId,
              senderParticipantId: userId,
              producerId: pidToStop,
              broadcastAt: new Date().toISOString()
            }, client.participantId);
          } else {
            // Send producer_closed event to everyone else
            broadcastToRoom(roomId, { type: 'producer_closed', producerId: pidToStop }, client.participantId);
          };
        }
        break;
      }

      case 'resume': {
        if (consumerOwners.get(data.consumerId) !== client) {
          logger.warn(`User ${userId} tried to resume a consumer they don't own`);
          return;
        }
        await mediaController.resumeConsumer(data.consumerId);
        client.ws.send(JSON.stringify({ type: 'resumed', consumerId: data.consumerId }));
        break;
      }

      case 'pause_consumer': {
        if (consumerOwners.get(data.consumerId) !== client) {
          logger.warn(`User ${userId} tried to pause a consumer they don't own (${data.consumerId})`);
          // Send an error response so the client's await doesn't time out
          client.ws.send(JSON.stringify({ type: 'error', errorCode: 'INVALID_OWNERSHIP', message: 'Not consumer owner' }));
          return;
        }
        await mediaController.pauseConsumer(data.consumerId);
        client.ws.send(JSON.stringify({ type: 'consumer_paused', consumerId: data.consumerId }));
        break;
      }

      case 'request_screen_keyframe': {
        if (data.consumerId) {
          logger.info(`Requesting keyframe for screen share consumer ${data.consumerId} by user ${userId}`);
          await mediaController.requestConsumerKeyFrame(data.consumerId);
        }
        break;
      }

      case 'getProducers': {
        const producers = await getRoomProducers(roomId);
        // Exclude own producers
        const othersProducers = producers.filter((p: any) => p.participantId !== client.participantId);
        // Include appData so late joiners know which producers are screen share vs camera
        client.ws.send(JSON.stringify({ type: 'producersList', producers: othersProducers }));
        break;
      }

      case 'ping':
        // Silently ignore ping messages used for keep-alive
        break;

      case 'webrtc_client_stats':
        logger.info(`[ClientStats] Room ${roomId} | User ${client.userId}: RTT=${data.roundTripTime || 0}ms, Jitter=${data.jitter || 0}, Loss=${data.packetsLost || 0}`);
        break;

      default:
        logger.warn(`Unknown message type: ${data.type}`);
    }
  }

  function broadcastRoomState(roomId: string) {
    const activeParticipants = getActiveRoomParticipants(roomId);
    logger.info(`[PRESENCE] Broadcasting authoritative room state for ${roomId}. Participants: ${activeParticipants.length}`);
    broadcastToRoom(roomId, { type: 'participants_list', participants: activeParticipants });
  }

  function broadcastToRoom(roomId: string, message: any, excludeParticipantId?: string) {
    const roomClients = rooms.get(roomId);
    if (!roomClients) return;

    const payload = JSON.stringify(message);
    const clientsArr = Array.from(roomClients.entries());
    const CHUNK_SIZE = 500;
    
    let currentIndex = 0;
    
    function processChunk() {
      const end = Math.min(currentIndex + CHUNK_SIZE, clientsArr.length);
      for (let i = currentIndex; i < end; i++) {
        const [id, client] = clientsArr[i];
        if (id !== excludeParticipantId && client.status === 'active' && client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(payload);
        }
      }
      
      currentIndex = end;
      if (currentIndex < clientsArr.length) {
        setImmediate(processChunk);
      }
    }
    
    processChunk();
  }

  function broadcastToHosts(roomId: string, message: any) {
    const roomClients = rooms.get(roomId);
    if (!roomClients) return;

    const payload = JSON.stringify(message);
    const clientsArr = Array.from(roomClients.entries());
    const CHUNK_SIZE = 500;
    let sentToHost = false;
    let currentIndex = 0;

    function processChunk() {
      const end = Math.min(currentIndex + CHUNK_SIZE, clientsArr.length);
      for (let i = currentIndex; i < end; i++) {
        const [id, client] = clientsArr[i];
        if (client.role === 'host' && client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(payload);
          logger.info(`Sent waiting_room_request to host ${client.userId}`);
          sentToHost = true;
        }
      }
      
      currentIndex = end;
      if (currentIndex < clientsArr.length) {
        setImmediate(processChunk);
      } else if (!sentToHost) {
        logger.warn(`Tried to broadcast to hosts in room ${roomId}, but no active hosts were found!`);
      }
    }
    
    processChunk();
  }
}

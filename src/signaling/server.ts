import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server } from 'http';
import { URL } from 'url';
import jwt from 'jsonwebtoken';
import { logger } from '../logger';
import { db } from '../db';
import { getOrCreateRouter, createWebRtcTransport, connectTransport, createProducer, createConsumerWithCallback, resumeConsumer, pauseConsumer, closeProducer, closeTransport, setupAudioObserver, cleanupAudioObserver } from '../media/sfu';
import os from 'os';
import Redis from 'ioredis';
import crypto from 'crypto';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key_if_missing',
});

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl, {
  retryStrategy: (times) => {
    if (process.env.NODE_ENV !== 'production') return null;
    return Math.min(times * 50, 2000);
  },
  maxRetriesPerRequest: 1
});

redis.on("error", () => { }); // Catch unhandled connection error events silently

const redisSubscriber = new Redis(redisUrl, {
  retryStrategy: (times) => {
    if (process.env.NODE_ENV !== 'production') return null;
    return Math.min(times * 50, 2000);
  },
  maxRetriesPerRequest: 1
});
redisSubscriber.on("error", () => { });

redisSubscriber.subscribe('recorder:completed').catch(e => logger.error('Failed to subscribe to recorder:completed', e));
redisSubscriber.on('message', async (channel, message) => {
  if (channel === 'recorder:completed') {
    try {
      const data = JSON.parse(message);
      // Update room or recording entry
      // For now, we will create a new recording record for the room
      const room = await db.room.findUnique({ where: { id: data.roomId } });
      if (room) {
        await db.recording.create({
          data: {
            ownerId: room.ownerId,
            title: `${room.name} Recording`,
            roomId: data.roomId,
            url: data.recordingUrl,
            status: 'completed',
            duration: 0, // Duration tracking can be enhanced later
          }
        });
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
      }
    } catch (e) {
      logger.error('Failed to process recorder:completed event', e);
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
  role: string;
  status: 'waiting' | 'active';
  transports: string[];
  isMobile: boolean;
}

const rooms = new Map<string, Map<string, Client>>();
const roomProducers = new Map<string, Array<{ producerId: string, userId: string, kind: string, appData?: Record<string, any> }>>();
const disconnectTimeouts = new Map<string, NodeJS.Timeout>();
// Maps consumerId -> the client who owns that consumer (for producerclose forwarding)
const consumerOwners = new Map<string, Client>();
const roomECinema = new Map<string, string | null>();
const roomTranscripts = new Map<string, Array<{ name: string, text: string, timestamp: number }>>();

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

    if (process.env.OPENAI_API_KEY) {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an AI Meeting Assistant. Read the following meeting transcript and provide a very brief summary and a list of actionable items. Format your response clearly.",
          },
          {
            role: "user",
            content: fullText,
          },
        ],
        temperature: 0.3,
      });

      const aiResponse = response.choices[0]?.message?.content?.trim();
      if (aiResponse) {
        // We will split the response naively or just store it all in 'summary'
        const splitIndex = aiResponse.indexOf("Action");
        const summaryText = splitIndex > -1 ? aiResponse.substring(0, splitIndex).trim() : aiResponse;
        const actionItemsText = splitIndex > -1 ? aiResponse.substring(splitIndex).trim() : "";

        await db.meetingSummary.upsert({
          where: { roomId },
          update: { summary: summaryText, actionItems: actionItemsText },
          create: { roomId, summary: summaryText, actionItems: actionItemsText },
        });
        logger.info(`AI Summary generated and saved for room ${roomId}`);
      }
    }
  } catch (error) {
    logger.error(`Failed to generate summary for room ${roomId}:`, error);
  } finally {
    // Clean up memory
    roomTranscripts.delete(roomId);
  }
}

export function initializeSignaling(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

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

      console.info(`pod:${POD_ID}:cpu =>`, cpuUsage)

      // Method 2: Graceful Degradation if load is too high
      // If CPU is > MAX_DEGRADATION_CPU_LOAD (default 85%), tell all connected clients to optimize video feeds
      const maxDegradationLoad = parseInt(process.env.MAX_DEGRADATION_CPU_LOAD || "85", 10);
      if (cpuUsage > maxDegradationLoad) {
        for (const roomId of rooms.keys()) {
          console.warn("CPU LOAD IS HIGH!!!", cpuUsage)
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

      if (!token || !roomSlug) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      const secret = process.env.JWT_SECRET || 'fallback-secret-key';
      const decoded = jwt.verify(token, secret) as { userId: string; email: string; name: string; role?: string };

      console.log("decoded", decoded);

      // Verify room exists
      const room = await db.room.findUnique({ where: { slug: roomSlug } });
      if (!room) {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
        return;
      }

      // Extract role directly from the JWT token (set by the frontend API)
      let role = decoded.role || 'audience';
      if (room.ownerId === decoded.userId) {
        role = 'host';
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, {
          userId: decoded.userId,
          email: decoded.email,
          name: decoded.name || 'Guest',
          roomId: room.id,
          roomSlug,
          role,
          isWaitingRoomEnabled: room.isWaitingRoomEnabled,
          isMobile,
        });
      });
    } catch (error) {
      logger.error('WebSocket upgrade failed', error);
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
    }
  });

  wss.on('connection', async (ws: WebSocket, request: IncomingMessage, clientData: any) => {
    const { userId, email, name, roomId, roomSlug, role, isWaitingRoomEnabled, isMobile } = clientData;

    // Determine initial status
    const initialStatus = (isWaitingRoomEnabled && role !== 'host' && role !== 'bot') ? 'waiting' : 'active';

    const client: Client = { ws, userId, email, name, roomId, role, status: initialStatus, transports: [], isMobile };

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
      // Register this room to this specific Pod in Redis for NGINX scaling awareness
      redis.set(`room:${roomSlug}:pod`, POD_ID).catch(e => logger.warn('Redis set error', e));
      redis.expire(`room:${roomSlug}:pod`, 86400).catch(e => logger.warn('Redis expire error', e)); // 24h safety net

      // Setup audio observer for talking indicators
      setupAudioObserver(roomId, (producerIds) => {
        // Map producer IDs to user IDs
        const activeUsers = new Set<string>();
        const allProducers = roomProducers.get(roomId) || [];
        for (const pid of producerIds) {
          const prod = allProducers.find(p => p.producerId === pid);
          if (prod) activeUsers.add(prod.userId);
        }
        
        broadcastToRoom(roomId, {
          type: 'active_speaker',
          userIds: Array.from(activeUsers)
        });
      }).catch(e => logger.error('Failed to setup audio observer', e));
    }

    // Check if there's an existing client in the room that was already admitted
    const existingClient = rooms.get(roomId)!.get(userId);
    if (existingClient && existingClient.status === 'active') {
      client.status = 'active';
    }

    rooms.get(roomId)!.set(userId, client);

    if (disconnectTimeouts.has(userId)) {
      clearTimeout(disconnectTimeouts.get(userId)!);
      disconnectTimeouts.delete(userId);
      logger.info(`User ${userId} reconnected to room ${roomId} during grace period`);
      ws.send(JSON.stringify({ type: 'session_status', recovered: true, status: client.status }));
    } else {
      logger.info(`User ${userId} (${role}) joined room ${roomId} with status ${client.status}`);

      if (client.status === 'active') {
        // Pre-warm the router NOW so it is ready when the client asks for routerCapabilities.
        // This ensures getOrCreateRouter() is already resolved before session_status triggers
        // initializeMediasoup() on the client side.
        try {
          await getOrCreateRouter(roomId);
        } catch (e) {
          logger.error('Failed to pre-warm router on join', e);
        }
      }

      // Send session_status IMMEDIATELY after router is ready (not after DB queries)
      ws.send(JSON.stringify({ type: 'session_status', recovered: false, status: client.status }));

      if (client.status === 'active') {
        broadcastToRoom(roomId, {
          type: 'user_joined',
          userId,
          name,
          role,
          isMobile: client.isMobile
        });

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

        // Send history ASYNCHRONOUSLY — this must NOT block the routerCapabilities flow
        setImmediate(async () => {
          try {
            const activeParticipants = Array.from(rooms.get(roomId)?.values() || [])
              .filter(c => c.status === 'active')
              .map(c => ({ userId: c.userId, name: c.name, role: c.role, isMobile: c.isMobile }));
            ws.send(JSON.stringify({ type: 'participants_list', participants: activeParticipants }));

            const chatHistory = await db.chatMessage.findMany({
              where: { roomId, OR: [{ isPrivate: false }, { targetUserId: userId }, { userId }] },
              orderBy: { createdAt: 'asc' },
              take: 100
            });
            const pollHistory = await db.meetingPoll.findMany({
              where: { roomId, isActive: true },
              orderBy: { createdAt: 'asc' }
            });
            const noteHistory = await db.sharedNote.findUnique({
              where: { roomId }
            });

            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'chat_history', messages: chatHistory }));
              ws.send(JSON.stringify({ type: 'poll_history', polls: pollHistory }));
              if (noteHistory) {
                ws.send(JSON.stringify({ type: 'note_history', content: noteHistory.content }));
              }
              const eCinemaLink = roomECinema.get(roomId);
              if (eCinemaLink) {
                ws.send(JSON.stringify({ type: 'ecinema_update', link: eCinemaLink }));
              }
            }
          } catch (e) {
            logger.error("Failed to load history", e);
          }
        });
      } else {
        // Send a request to hosts
        broadcastToHosts(roomId, {
          type: 'waiting_room_request',
          userId,
          name,
        });
      }
    }

    ws.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message);
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
      logger.info(`User ${userId} disconnected from room ${roomId}. Starting 60s grace period...`);

      // IMMEDAITELY clean up Mediasoup transports for this connection.
      // If the client reconnects, they will create new WebRTC transports anyway.
      // This prevents orphaned ports from causing "UDP connection failed" errors.
      client.transports.forEach(tId => {
        try {
          closeTransport(tId);
        } catch (e) {
          logger.warn(`Failed to close transport ${tId}`, e);
        }
      });
      client.transports = [];

      const timeout = setTimeout(() => {
        logger.info(`User ${userId} grace period expired. Cleaning up session.`);
        const roomClients = rooms.get(roomId);
        if (roomClients) {
          roomClients.delete(userId);
          if (roomClients.size === 0) {
            rooms.delete(roomId);
            roomProducers.delete(roomId); // Clean up producers array when room empties
            cleanupAudioObserver(roomId); // Clean up talking indicator
            redis.del(`room:${roomSlug}:pod`).catch(e => logger.warn('Redis del error', e));
          } else {
            // Remove their producers from the array
            const producers = roomProducers.get(roomId) || [];
            roomProducers.set(roomId, producers.filter(p => p.userId !== userId));

            broadcastToRoom(roomId, {
              type: 'user_left',
              userId
            });
          }
        }
        disconnectTimeouts.delete(userId);
      }, 60000); // 60 seconds

      disconnectTimeouts.set(userId, timeout);
    });
  });

  async function handleMessage(client: Client, data: any) {
    const { roomId, userId } = client;

    // If client is in waiting room, they can only send basic messages
    if (client.status === 'waiting' && data.type !== 'chat') {
      logger.warn(`User ${userId} attempted ${data.type} while in waiting room`);
      return;
    }

    switch (data.type) {
      case 'admit_user':
        if (client.role === 'host') {
          const targetClient = rooms.get(roomId)?.get(data.userId);
          if (targetClient && targetClient.status === 'waiting') {
            targetClient.status = 'active';
            targetClient.ws.send(JSON.stringify({ type: 'session_status', recovered: false, status: 'active' }));
            broadcastToRoom(roomId, { type: 'user_joined', userId: targetClient.userId, name: targetClient.name, role: targetClient.role });
            
            const activeParticipants = Array.from(rooms.get(roomId)?.values() || [])
              .filter(c => c.status === 'active')
              .map(c => ({ userId: c.userId, name: c.name, role: c.role }));
            targetClient.ws.send(JSON.stringify({ type: 'participants_list', participants: activeParticipants }));
          }
        }
        break;

      case 'deny_user':
        if (client.role === 'host') {
          const targetClient = rooms.get(roomId)?.get(data.userId);
          if (targetClient && targetClient.status === 'waiting') {
            targetClient.ws.send(JSON.stringify({ type: 'session_status', recovered: false, status: 'denied' }));
            targetClient.ws.close();
            rooms.get(roomId)?.delete(data.userId);
          }
        }
        break;

      case 'kick_user':
        if (client.role === 'host') {
          const targetClient = rooms.get(roomId)?.get(data.userId);
          // Don't allow kicking other hosts (or maybe we should? for now let's say only attendees)
          if (targetClient && targetClient.role !== 'host') {
            targetClient.ws.send(JSON.stringify({ type: 'session_status', recovered: false, status: 'kicked' }));
            targetClient.ws.close();
            // Disconnect handlers will clean up their presence
          }
        }
        break;

      case 'force_mute':
        if (client.role === 'host') {
          if (data.userId) {
            const targetClient = rooms.get(roomId)?.get(data.userId);
            if (targetClient) {
              targetClient.ws.send(JSON.stringify({ type: 'force_mute' }));
            }
          } else {
            // Mute everyone else
            const roomClients = rooms.get(roomId);
            if (roomClients) {
              for (const [id, c] of roomClients.entries()) {
                if (c.role !== 'host' && c.status === 'active') {
                  c.ws.send(JSON.stringify({ type: 'force_mute' }));
                }
              }
            }
          }
        }
        break;

      case 'end_meeting':
        if (client.role === 'host') {
          logger.info(`Host ${userId} ended the meeting in room ${roomId}`);
          const roomClients = rooms.get(roomId);
          if (roomClients) {
            for (const [id, c] of roomClients.entries()) {
              if (c.userId !== userId) { // Don't send 'ended' to the host that just ended it
                c.ws.send(JSON.stringify({ type: 'session_status', recovered: false, status: 'ended' }));
              }
              c.ws.close();
            }
          }
          // Fire off AI Summary generation in the background
          generateMeetingSummary(roomId).catch(e => logger.error(e));
          // The socket close handlers will trigger full room cleanup
        }
        break;

      case 'chat':
        try {
          const newMsg = await db.chatMessage.create({
            data: {
              roomId,
              userId,
              senderName: client.name,
              content: data.message,
              fileUrl: data.fileUrl || null,
              isPrivate: !!data.targetUserId,
              targetUserId: data.targetUserId || null,
            }
          });

          const msgPayload = {
            type: 'chat',
            userId,
            name: client.name, // Always include display name — never make client guess from userId
            message: newMsg.content,
            timestamp: newMsg.createdAt.toISOString(),
            isPrivate: newMsg.isPrivate,
            fileUrl: newMsg.fileUrl,
            id: newMsg.id
          };

          if (data.targetUserId) {
            const roomClients = rooms.get(roomId);
            if (roomClients) {
              const targetClient = roomClients.get(data.targetUserId);
              if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
                targetClient.ws.send(JSON.stringify(msgPayload));
              }
              if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(JSON.stringify(msgPayload));
              }
            }
          } else {
            broadcastToRoom(roomId, msgPayload, userId);
          }
        } catch (e) {
          logger.error("Failed to save chat message", e);
        }
        break;

      case 'reaction':
        // Exclude the sender — they already show the reaction locally via sendReaction()
        broadcastToRoom(roomId, {
          type: 'reaction',
          userId,
          name: client.name, // Always include name so clients don't need to look it up
          reaction: data.reaction
        }, userId); // <-- userId as excludeUserId prevents the double-animation
        break;

      case 'network_quality':
        broadcastToRoom(roomId, {
          type: 'network_quality',
          userId,
          quality: data.quality
        }, userId);
        break;

      case 'caption':
        if (data.isFinal) {
          if (!roomTranscripts.has(roomId)) {
            roomTranscripts.set(roomId, []);
          }
          roomTranscripts.get(roomId)!.push({
            name: client.name,
            text: data.text,
            timestamp: Date.now()
          });
        }
        
        // In the future, we can append this to the MeetingTranscript in the database for AI Summary.
        broadcastToRoom(roomId, {
          type: 'caption',
          userId,
          text: data.text,
          isFinal: data.isFinal,
          lang: data.lang
        }, userId);
        break;

      case 'ecinema_update':
        if (client.role === 'host' || client.role === 'presenter') {
          roomECinema.set(roomId, data.link || null);
          broadcastToRoom(roomId, {
            type: 'ecinema_update',
            link: data.link || null
          });
        }
        break;

      case 'ecinema_action':
        if (client.role === 'host' || client.role === 'presenter') {
          broadcastToRoom(roomId, {
            type: 'ecinema_action',
            action: data.action,
            time: data.time
          }, userId);
        }
        break;

      case 'donation_status':
        if (client.role === 'host' || client.role === 'co-host') {
          broadcastToRoom(roomId, {
            type: 'donation_status',
            active: data.active
          }, userId);
        }
        break;

      case 'donation_success':
        broadcastToRoom(roomId, {
          type: 'donation_success',
          userId,
          name: client.name,
          amount: data.amount,
          currency: data.currency
        }, userId);
        break;

      case 'note_update':
        try {
          await db.sharedNote.upsert({
            where: { roomId },
            create: { roomId, content: data.content },
            update: { content: data.content }
          });
          broadcastToRoom(roomId, {
            type: 'note_update',
            userId,
            content: data.content
          }, userId);
        } catch (e) {
          logger.error("Failed to update shared note", e);
        }
        break;

      case 'poll_create':
        if (client.role === 'host') {
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
            broadcastToRoom(roomId, {
              type: 'poll_create',
              pollId: newPoll.id,
              question: newPoll.question,
              options: newPoll.options,
              userId
            }, userId);
          } catch (e) {
            logger.error("Failed to create poll", e);
          }
        }
        break;

      case 'poll_vote':
        try {
          // Increment vote in DB
          const poll = await db.meetingPoll.findUnique({ where: { id: data.pollId } });
          if (poll && Array.isArray(poll.options)) {
            const updatedOptions = poll.options.map((opt: any) => {
              if (opt.id === data.optionId) return { ...opt, votes: (opt.votes || 0) + 1 };
              return opt;
            });
            await db.meetingPoll.update({
              where: { id: data.pollId },
              data: { options: updatedOptions }
            });
          }

          broadcastToRoom(roomId, {
            type: 'poll_vote',
            pollId: data.pollId,
            optionId: data.optionId,
            userId: userId
          });
        } catch (e) {
          logger.error("Failed to vote on poll", e);
        }
        break;

      case 'mute_state':
        broadcastToRoom(roomId, {
          type: 'mute_state',
          userId,
          isMuted: data.isMuted
        });
        break;

      case 'camera_state':
        broadcastToRoom(roomId, {
          type: 'camera_state',
          userId,
          isCameraOn: data.isCameraOn
        });
        break;

      case 'hand_raise':
        broadcastToRoom(roomId, {
          type: 'hand_raise',
          userId,
          isHandRaised: data.isHandRaised
        });
        break;

      case 'sync_panel':
        if (client.role === 'host' || client.role === 'co-host') {
          broadcastToRoom(roomId, {
            type: 'sync_panel',
            panel: data.panel
          }, userId);
        }
        break;

      case 'start_recording':
        if (client.role === 'host' || client.role === 'co-host') {
          // Push job to redis queue
          const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
          const domain = process.env.NEXT_PUBLIC_FRONTEND_DOMAIN || 'konn3ctedge.konn3ct.net';
          
          db.room.findUnique({ where: { id: roomId } }).then(room => {
            if (room) {
              const recordingUrl = `${protocol}://${domain}/meeting/${room.slug}?bot=true`;
              
              redis.lpush('recorder:queue', JSON.stringify({
                roomId,
                roomSlug: room.slug,
                url: recordingUrl
              })).catch(e => logger.error("Failed to push recording job to queue", e));

              broadcastToRoom(roomId, { type: 'recording_started' });
            }
          });
        }
        break;

      case 'stop_recording':
        if (client.role === 'host' || client.role === 'co-host') {
          // Publish stop event to the worker
          redis.publish(`recorder:stop:${roomId}`, 'stop').catch(e => logger.error("Failed to publish stop recording", e));
          broadcastToRoom(roomId, { type: 'recording_stopped' });
        }
        break;

      // --- WebRTC Media Signaling ---
      case 'getRouterRtpCapabilities': {
        const router = await getOrCreateRouter(roomId);
        client.ws.send(JSON.stringify({ type: 'routerCapabilities', rtpCapabilities: router.rtpCapabilities }));
        break;
      }

      case 'createWebRtcTransport': {
        const transportParams = await createWebRtcTransport(roomId);
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
        await connectTransport(data.transportId, data.dtlsParameters);
        client.ws.send(JSON.stringify({ type: 'transportConnected', transportId: data.transportId }));
        break;
      }

      case 'produce': {
        const appData: Record<string, any> = data.appData || {};
        const source = appData.source || 'camera'; // 'camera' | 'screen'

        // Camera cap only applies to actual cameras, NOT screen share producers
        if (data.kind === 'video' && source !== 'screen') {
          const roomProducersList = roomProducers.get(roomId) || [];
          const cameraProducers = roomProducersList.filter(p => p.kind === 'video' && p.appData?.source !== 'screen');
          const maxCameras = parseInt(process.env.MAX_ACTIVE_CAMERAS || "15", 10);
          if (cameraProducers.length >= maxCameras) {
            client.ws.send(JSON.stringify({
              type: 'error',
              message: `Maximum number of active cameras (${maxCameras}) reached in this room to preserve server stability.`
            }));
            return;
          }
        }

        const producerId = await createProducer(data.transportId, data.kind, data.rtpParameters, roomId);

        // Track for late joiners — store appData so late joiners know source type
        if (!roomProducers.has(roomId)) roomProducers.set(roomId, []);
        roomProducers.get(roomId)!.push({ producerId, userId, kind: data.kind, appData });

        client.ws.send(JSON.stringify({ type: 'produced', id: producerId, kind: data.kind }));

        // Broadcast to others — include appData.source so they render screen share correctly
        broadcastToRoom(roomId, { type: 'newProducer', producerId, userId, kind: data.kind, appData }, userId);

        // For screen share, send a dedicated state event so peers update isScreenSharing immediately
        if (source === 'screen') {
          broadcastToRoom(roomId, { type: 'screen_share_started', userId, producerId }, userId);
        }
        break;
      }

      case 'consume': {
        try {
          const router = await getOrCreateRouter(roomId);
          const consumerParams = await createConsumerWithCallback(
            data.transportId,
            data.producerId,
            data.rtpCapabilities,
            router,
            (closedConsumerId) => {
              // Producer was closed (e.g. remote peer stopped screen share)
              // Find the appData of the producer so we know if it was a screen share
              const allProducers = Array.from(roomProducers.values()).flat();
              const closedProducer = allProducers.find(p => p.producerId === data.producerId);
              if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(JSON.stringify({
                  type: 'producer_closed',
                  producerId: data.producerId,
                  consumerId: closedConsumerId,
                  appData: closedProducer?.appData || {}
                }));
              }
              consumerOwners.delete(closedConsumerId);
            }
          );
          // Track which client owns this consumer for cleanup
          consumerOwners.set(consumerParams.id, client);
          client.ws.send(JSON.stringify({ type: 'consumed', ...consumerParams }));
        } catch (e) {
          logger.warn(`Consume failed for producer ${data.producerId}:`, e);
          // Don't send a response, let the client timeout or we can send an error response if we want.
          // To prevent the 10s client timeout, we should resolve it. But the client expects specific data.
          // Let's just send a dummy response or let it timeout. It's fine to timeout if it fails.
          // Actually, let's send 'consumed_error' and handle it on the client if needed.
        }
        break;
      }

      case 'reset_webrtc_state': {
        logger.info(`User ${userId} requested WebRTC state reset (IP change detected)`);
        for (const tid of client.transports) {
          closeTransport(tid);
        }
        client.transports = [];
        
        const rp = roomProducers.get(roomId);
        if (rp) {
          roomProducers.set(roomId, rp.filter(p => p.userId !== userId));
        }
        break;
      }

      case 'stop_producer': {
        // Client is explicitly closing a producer (e.g. stopped screen sharing)
        const { producerId: pidToStop, appData: stopAppData } = data;
        const source = (stopAppData || {}).source || 'unknown';

        // Remove from room tracking
        const rp = roomProducers.get(roomId);
        if (rp) {
          roomProducers.set(roomId, rp.filter(p => p.producerId !== pidToStop));
        }

        // Close the Mediasoup producer — this triggers producerclose on all consumers
        closeProducer(pidToStop);

        // Broadcast a state update to all peers
        if (source === 'screen') {
          broadcastToRoom(roomId, { type: 'screen_share_stopped', userId, producerId: pidToStop }, userId);
        }
        break;
      }

      case 'resume': {
        await resumeConsumer(data.consumerId);
        client.ws.send(JSON.stringify({ type: 'resumed', consumerId: data.consumerId }));
        break;
      }

      case 'pause_consumer': {
        await pauseConsumer(data.consumerId);
        client.ws.send(JSON.stringify({ type: 'consumer_paused', consumerId: data.consumerId }));
        break;
      }

      case 'getProducers': {
        const producers = roomProducers.get(roomId) || [];
        // Exclude own producers
        const othersProducers = producers.filter(p => p.userId !== userId);
        // Include appData so late joiners know which producers are screen share vs camera
        client.ws.send(JSON.stringify({ type: 'producersList', producers: othersProducers }));
        break;
      }

      default:
        logger.warn(`Unknown message type: ${data.type}`);
    }
  }

  function broadcastToRoom(roomId: string, message: any, excludeUserId?: string) {
    const roomClients = rooms.get(roomId);
    if (!roomClients) return;

    const payload = JSON.stringify(message);
    for (const [id, client] of roomClients.entries()) {
      if (id !== excludeUserId && client.status === 'active' && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }

  function broadcastToHosts(roomId: string, message: any) {
    const roomClients = rooms.get(roomId);
    if (!roomClients) return;

    const payload = JSON.stringify(message);
    let sentToHost = false;
    for (const [id, client] of roomClients.entries()) {
      if (client.role === 'host' && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
        logger.info(`Sent waiting_room_request to host ${client.userId}`);
        sentToHost = true;
      }
    }

    if (!sentToHost) {
      logger.warn(`Tried to broadcast to hosts in room ${roomId}, but no active hosts were found!`);
    }
  }
}

import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server } from 'http';
import { URL } from 'url';
import jwt from 'jsonwebtoken';
import { logger } from '../logger';
import { db } from '../db';
import { getOrCreateRouter, createWebRtcTransport, connectTransport, createProducer, createConsumer } from '../media/sfu';

interface Client {
  ws: WebSocket;
  userId: string;
  email: string;
  name: string;
  roomId: string;
  role: string;
  status: 'waiting' | 'active';
}

const rooms = new Map<string, Map<string, Client>>();
const roomProducers = new Map<string, Array<{ producerId: string, userId: string, kind: string }>>();
const disconnectTimeouts = new Map<string, NodeJS.Timeout>();

export function initializeSignaling(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (request: IncomingMessage, socket, head) => {
    try {
      const url = new URL(request.url || '', `http://${request.headers.host}`);
      if (url.pathname !== '/signal') {
        socket.destroy();
        return;
      }

      const token = url.searchParams.get('token');
      const roomSlug = url.searchParams.get('roomId');

      if (!token || !roomSlug) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // Verify token
      const secret = process.env.JWT_SECRET || 'fallback-secret-key';
      const decoded = jwt.verify(token, secret) as { userId: string; email: string, name: string };
      
      // Verify room exists
      const room = await db.room.findUnique({ where: { slug: roomSlug } });
      if (!room) {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
        return;
      }

      // Basic role logic (MVP)
      let role = 'audience';
      if (room.ownerId === decoded.userId) {
        role = 'host';
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, {
          userId: decoded.userId,
          email: decoded.email,
          name: decoded.name || 'Guest',
          roomId: room.id,
          role,
          isWaitingRoomEnabled: room.isWaitingRoomEnabled,
        });
      });
    } catch (error) {
      logger.error('WebSocket upgrade failed', error);
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
    }
  });

  wss.on('connection', (ws: WebSocket, request: IncomingMessage, clientData: any) => {
    const { userId, email, name, roomId, role, isWaitingRoomEnabled } = clientData;
    
    // Determine initial status
    const initialStatus = (isWaitingRoomEnabled && role !== 'host') ? 'waiting' : 'active';
    
    const client: Client = { ws, userId, email, name, roomId, role, status: initialStatus };
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
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
      ws.send(JSON.stringify({ type: 'session_status', recovered: false, status: client.status }));
      
      if (client.status === 'active') {
        broadcastToRoom(roomId, {
          type: 'user_joined',
          userId,
          name,
          role
        });
        
        // Fetch and send history
        try {
          const chatHistory = await db.chatMessage.findMany({
            where: { roomId, OR: [{ isPrivate: false }, { targetUserId: userId }, { userId }] },
            orderBy: { createdAt: 'asc' },
            take: 100
          });
          const pollHistory = await db.meetingPoll.findMany({
            where: { roomId, isActive: true },
            orderBy: { createdAt: 'asc' }
          });
          
          ws.send(JSON.stringify({ type: 'chat_history', messages: chatHistory }));
          ws.send(JSON.stringify({ type: 'poll_history', polls: pollHistory }));
        } catch (e) {
          logger.error("Failed to load history", e);
        }
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
        await handleMessage(client, data);
      } catch (error) {
        logger.warn('Failed to parse WS message', error);
      }
    });

    ws.on('close', () => {
      logger.info(`User ${userId} disconnected from room ${roomId}. Starting 60s grace period...`);
      
      const timeout = setTimeout(() => {
        logger.info(`User ${userId} grace period expired. Cleaning up session.`);
        const roomClients = rooms.get(roomId);
        if (roomClients) {
          roomClients.delete(userId);
          if (roomClients.size === 0) {
            rooms.delete(roomId);
            roomProducers.delete(roomId); // Clean up producers array when room empties
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
            broadcastToRoom(roomId, msgPayload);
          }
        } catch (e) {
          logger.error("Failed to save chat message", e);
        }
        break;
        
      case 'reaction':
        broadcastToRoom(roomId, {
          type: 'reaction',
          userId,
          reaction: data.reaction // e.g., 'thumbs_up', 'heart'
        });
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
            });
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

      case 'hand_raise':
        broadcastToRoom(roomId, {
          type: 'hand_raise',
          userId,
          isHandRaised: data.isHandRaised
        });
        break;

      // --- WebRTC Media Signaling ---
      case 'getRouterRtpCapabilities': {
        const router = await getOrCreateRouter(roomId);
        client.ws.send(JSON.stringify({ type: 'routerCapabilities', rtpCapabilities: router.rtpCapabilities }));
        break;
      }
      
      case 'createWebRtcTransport': {
        const transportParams = await createWebRtcTransport(roomId);
        client.ws.send(JSON.stringify({ type: 'transportCreated', transportParams, direction: data.direction }));
        break;
      }
      
      case 'connectWebRtcTransport': {
        await connectTransport(data.transportId, data.dtlsParameters);
        client.ws.send(JSON.stringify({ type: 'transportConnected', transportId: data.transportId }));
        break;
      }
      
      case 'produce': {
        const producerId = await createProducer(data.transportId, data.kind, data.rtpParameters);
        
        // Track for late joiners
        if (!roomProducers.has(roomId)) roomProducers.set(roomId, []);
        roomProducers.get(roomId)!.push({ producerId, userId, kind: data.kind });
        
        client.ws.send(JSON.stringify({ type: 'produced', id: producerId, kind: data.kind }));
        
        // Broadcast to others that a new producer (video/audio track) is available
        broadcastToRoom(roomId, { type: 'newProducer', producerId, userId, kind: data.kind }, userId);
        break;
      }
      
      case 'consume': {
        const router = await getOrCreateRouter(roomId);
        const consumerParams = await createConsumer(data.transportId, data.producerId, data.rtpCapabilities, router);
        client.ws.send(JSON.stringify({ type: 'consumed', ...consumerParams }));
        break;
      }

      case 'resume': {
        const { resumeConsumer } = require('../media/sfu');
        await resumeConsumer(data.consumerId);
        client.ws.send(JSON.stringify({ type: 'resumed', consumerId: data.consumerId }));
        break;
      }

      case 'getProducers': {
        const producers = roomProducers.get(roomId) || [];
        // Exclude own producers just in case
        const othersProducers = producers.filter(p => p.userId !== userId);
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
    for (const [id, client] of roomClients.entries()) {
      if (client.role === 'host' && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }
}

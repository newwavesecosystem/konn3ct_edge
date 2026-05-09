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
  roomId: string;
  role: string;
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
      const decoded = jwt.verify(token, secret) as { userId: string; email: string };
      
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
          roomId: room.id,
          role
        });
      });
    } catch (error) {
      logger.error('WebSocket upgrade failed', error);
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
    }
  });

  wss.on('connection', (ws: WebSocket, request: IncomingMessage, clientData: any) => {
    const { userId, email, roomId, role } = clientData;
    
    const client: Client = { ws, userId, email, roomId, role };
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
    }
    rooms.get(roomId)!.set(userId, client);

    if (disconnectTimeouts.has(userId)) {
      clearTimeout(disconnectTimeouts.get(userId)!);
      disconnectTimeouts.delete(userId);
      logger.info(`User ${userId} reconnected to room ${roomId} during grace period`);
      ws.send(JSON.stringify({ type: 'session_status', recovered: true }));
    } else {
      logger.info(`User ${userId} (${role}) joined room ${roomId}`);
      ws.send(JSON.stringify({ type: 'session_status', recovered: false }));
      // Broadcast presence to room
      broadcastToRoom(roomId, {
        type: 'user_joined',
        userId,
        role
      });
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

    switch (data.type) {
      case 'chat':
        if (data.targetUserId) {
          // Send only to the target user and the sender
          const roomClients = rooms.get(roomId);
          if (roomClients) {
            const targetClient = roomClients.get(data.targetUserId);
            const msg = {
              type: 'chat',
              userId,
              message: data.message,
              timestamp: new Date().toISOString(),
              isPrivate: true,
            };
            if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
              targetClient.ws.send(JSON.stringify(msg));
            }
            if (client.ws.readyState === WebSocket.OPEN) {
              client.ws.send(JSON.stringify(msg));
            }
          }
        } else {
          broadcastToRoom(roomId, {
            type: 'chat',
            userId,
            message: data.message,
            timestamp: new Date().toISOString()
          });
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
          broadcastToRoom(roomId, {
            type: 'poll_create',
            pollId: data.pollId,
            question: data.question,
            options: data.options
          });
        }
        break;

      case 'poll_vote':
        broadcastToRoom(roomId, {
          type: 'poll_vote',
          pollId: data.pollId,
          optionId: data.optionId,
          userId: userId
        });
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
      if (id !== excludeUserId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }
}

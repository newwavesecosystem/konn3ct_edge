import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createServer, Server as HttpServer } from 'http';
import WebSocket from 'ws';
import express from 'express';

vi.mock('ioredis', () => {
  class MockRedis {
    on = vi.fn();
    get = vi.fn().mockResolvedValue(null);
    set = vi.fn().mockResolvedValue('OK');
    expire = vi.fn().mockResolvedValue(1);
    subscribe = vi.fn().mockResolvedValue(1);
    publish = vi.fn().mockResolvedValue(1);
    del = vi.fn().mockResolvedValue(1);
  }
  return { default: MockRedis };
});

vi.mock('../../src/db', () => ({
  db: {
    room: {
      findUnique: vi.fn().mockImplementation(async ({ where }) => ({ id: where?.id || where?.slug || 'test-room-1', aiFeaturesEnabled: true, slug: 'test-slug', settings: {} })),
    },
    chatMessage: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    meetingPoll: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockImplementation(async ({ data }) => data),
    },
    sharedNote: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    meetingQA: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: vi.fn((cb) => cb()),
  },
}));

vi.mock('../../src/media/sfu', () => ({
  setupAudioObserver: vi.fn().mockResolvedValue(undefined),
  cleanupAudioObserver: vi.fn(),
  getProducer: vi.fn(),
  closeProducer: vi.fn(),
  closeTransport: vi.fn(),
  getOrCreateRouter: vi.fn().mockResolvedValue({}),
}));

import jwt from 'jsonwebtoken';
import { initializeSignaling } from '../../src/signaling/server';
import { logger } from '../../src/logger';

describe('Signaling Server Integration', () => {
  let server: HttpServer;
  let port: number;
  let wsUrl: string;

  beforeAll(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    process.env.JWT_SECRET = 'dummy_secret';
    process.env.TURN_SECRET = 'dummy_turn';
    const app = express();
    server = createServer(app);
    initializeSignaling(server);
    
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const address = server.address() as any;
        port = address.port;
        wsUrl = `ws://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    vi.useRealTimers();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('rejects connection without roomId or token', async () => {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`${wsUrl}/signal?token=invalid`);
      
      ws.on('unexpected-response', (req, res) => {
        expect(res.statusCode).toBe(401);
        resolve();
      });

      ws.on('open', () => {
        reject(new Error('Connection should not have opened'));
      });
    });
  });

  it('logs user-agent and device on connection', async () => {
    return new Promise<void>((resolve, reject) => {
      const infoSpy = vi.spyOn(logger, 'info');

      const validToken = jwt.sign({ userId: 'test-user-agent', email: 'ua@conn3ct', name: 'UA', role: 'audience' }, 'dummy_secret');
      const ws = new WebSocket(`${wsUrl}/signal?token=${validToken}&roomId=test-slug&participantId=ua-1`, {
        headers: {
          'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'
        }
      });
      
      ws.on('open', () => {
        setTimeout(() => {
          const logCall = infoSpy.mock.calls.find((call: any) => call[0] && call[0].includes('agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"'));
          expect(logCall).toBeDefined();
          ws.close();
          resolve();
        }, 50);
      });

      ws.on('error', reject);
    });
  });

  it('connects to bot test room', async () => {
    return new Promise<void>((resolve, reject) => {
      const validToken = jwt.sign({ userId: 'bot-1', email: 'bot@conn3ct', name: 'Bot', role: 'bot' }, 'dummy_secret');
      const url = `${wsUrl}/signal?roomId=test-room-1&token=${validToken}&participantId=part-1`;
      
      const ws = new WebSocket(url);
      
      ws.on('open', () => {
        // Send a ping message
        ws.send(JSON.stringify({ type: 'ping' }));
        
        // Send a chat message
        ws.send(JSON.stringify({ type: 'chat', message: 'Hello server' }));
        
        // Send mute state
        ws.send(JSON.stringify({ type: 'mute_state', isMicOn: false }));
        
        // Send camera state
        ws.send(JSON.stringify({ type: 'camera_state', isCameraOn: false }));

        // Send hand raise
        ws.send(JSON.stringify({ type: 'hand_raise', hasRaisedHand: true }));
        
        // Start recording
        ws.send(JSON.stringify({ type: 'start_recording' }));

        // Stop recording
        ws.send(JSON.stringify({ type: 'stop_recording' }));
        
        // Other actions
        ws.send(JSON.stringify({ type: 'reaction', reaction: '👍' }));
        ws.send(JSON.stringify({ type: 'poll_create', poll: { question: '?', options: [] } }));
        ws.send(JSON.stringify({ type: 'sync_panel', activePanel: 'chat' }));
        ws.send(JSON.stringify({ type: 'admit_user', userId: 'user-2' }));
        
        // Leave meeting
        ws.send(JSON.stringify({ type: 'leave_meeting' }));

        // Give server a moment to process before closing
        setTimeout(() => {
          ws.close();
          resolve();
        }, 50);
      });

      ws.on('unexpected-response', (req, res) => {
        reject(new Error(`Unexpected response: ${res.statusCode}`));
      });
    });
  });

  it('allows co-host to create polls and retains role on reconnect', async () => {
    return new Promise<void>(async (resolve, reject) => {
      // Create a mock co-host token
      const cohostToken = jwt.sign({ userId: 'cohost-1', email: 'cohost@conn3ct', name: 'Co-Host', role: 'co-host' }, 'dummy_secret');
      const url = `${wsUrl}/signal?roomId=test-room-1&token=${cohostToken}&participantId=part-cohost`;
      
      const ws = new WebSocket(url);
      
      ws.on('open', () => {
        // Send a poll create message
        ws.send(JSON.stringify({ 
          type: 'poll_create', 
          pollId: 'poll-123',
          question: 'Is this working?',
          options: ['Yes', 'No']
        }));
        
        setTimeout(() => {
          ws.close();
        }, 50);
      });

      ws.on('close', () => {
        // Reconnect with same participantId
        const reconnectUrl = `${wsUrl}/signal?roomId=test-room-1&token=${cohostToken}&participantId=part-cohost`;
        const wsReconnect = new WebSocket(reconnectUrl);
        
        let receivedSessionStatus = false;
        
        wsReconnect.on('message', (data: Buffer) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'session_status') {
             receivedSessionStatus = true;
             // Ensure role was preserved
             expect(msg.role).toBe('co-host');
          }
        });

        wsReconnect.on('open', () => {
          setTimeout(() => {
            expect(receivedSessionStatus).toBe(true);
            wsReconnect.close();
            resolve();
          }, 50);
        });
      });
      
      ws.on('unexpected-response', (req, res) => {
        reject(new Error(`Unexpected response: ${res.statusCode}`));
      });
    });
  });

  it('allows co-host to broadcast poll creation successfully', async () => {
    return new Promise<void>((resolve, reject) => {
      // Client 1 (Viewer)
      const viewerToken = jwt.sign({ userId: 'viewer-1', email: 'viewer@conn3ct', name: 'Viewer', role: 'audience' }, 'dummy_secret');
      const wsViewer = new WebSocket(`${wsUrl}/signal?roomId=test-room-1&token=${viewerToken}&participantId=part-viewer`);
      
      wsViewer.on('open', () => {
        // Client 2 (Co-Host)
        const cohostToken = jwt.sign({ userId: 'cohost-2', email: 'cohost@conn3ct', name: 'Co-Host', role: 'co-host' }, 'dummy_secret');
        const wsCohost = new WebSocket(`${wsUrl}/signal?roomId=test-room-1&token=${cohostToken}&participantId=part-cohost-2`);
        
        wsViewer.on('message', (data: Buffer) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'poll_create') {
            expect(msg.question).toBe('Is the test working?');
            wsViewer.close();
            wsCohost.close();
            resolve();
          }
        });

        wsCohost.on('open', () => {
          // Send a poll create message
          wsCohost.send(JSON.stringify({ 
            type: 'poll_create', 
            pollId: 'poll-456',
            question: 'Is the test working?',
            options: ['Yes', 'No']
          }));
        });
      });
    });
  });

  it('syncs isMuted state in participants_list and user_joined', async () => {
    return new Promise<void>((resolve, reject) => {
      const viewerToken = jwt.sign({ userId: 'test-viewer', email: 'v@conn3ct', name: 'Viewer', role: 'attendee' }, 'dummy_secret');
      const wsViewer = new WebSocket(`${wsUrl}/signal?roomId=test-room-1&token=${viewerToken}&participantId=part-viewer-mute`);

      let participantsListReceived = false;

      wsViewer.on('message', (data: any) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'participants_list') {
          participantsListReceived = true;
          const me = msg.participants.find((p: any) => p.participantId === 'part-viewer-mute');
          if (me) {
            console.log('me object:', me);
            expect(me.isMuted).toBe(true); // Should default to true

            // Send mute_state to false
            wsViewer.send(JSON.stringify({
              type: 'mute_state',
              isMuted: false
            }));
          }
        }

        if (msg.type === 'mute_state' && msg.participantId === 'part-viewer-mute' || msg.senderParticipantId === 'test-viewer') {
           if (msg.isMuted === false) {
             wsViewer.close();
             resolve();
           }
        }
      });
      
      wsViewer.on('error', reject);
    });
  });

  it('allows co-hosts to broadcast ecinema_update', async () => {
    return new Promise<void>((resolve, reject) => {
      const hostToken = jwt.sign({ userId: 'ecinema-host', email: 'host@conn3ct', name: 'Host', role: 'host' }, 'dummy_secret');
      const cohostToken = jwt.sign({ userId: 'ecinema-cohost', email: 'cohost@conn3ct', name: 'CoHost', role: 'co-host' }, 'dummy_secret');
      
      const wsHost = new WebSocket(`${wsUrl}/signal?roomId=test-room-ecinema&token=${hostToken}&participantId=part-ecinema-host`);
      const wsCohost = new WebSocket(`${wsUrl}/signal?roomId=test-room-ecinema&token=${cohostToken}&participantId=part-ecinema-cohost`);

      let hostConnected = false;
      let cohostConnected = false;

      const attemptAction = () => {
        if (hostConnected && cohostConnected) {
          // Cohost broadcasts an ecinema update
          wsCohost.send(JSON.stringify({ 
            type: 'ecinema_update', 
            link: 'https://youtube.com/watch?v=123'
          }));
        }
      };

      wsHost.on('open', () => { hostConnected = true; attemptAction(); });
      wsCohost.on('open', () => { cohostConnected = true; attemptAction(); });

      // Host listens for the broadcast
      wsHost.on('message', (data: any) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ecinema_update' && msg.link === 'https://youtube.com/watch?v=123') {
          wsHost.close();
          wsCohost.close();
          resolve();
        }
      });
      
      wsHost.on('error', reject);
      wsCohost.on('error', reject);
    });
  });
});

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
      findUnique: vi.fn().mockResolvedValue({ id: 'test-room-1', aiFeaturesEnabled: true, slug: 'test-slug', settings: {} }),
    },
    message: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock('../../src/media/sfu', () => ({
  setupAudioObserver: vi.fn().mockResolvedValue(undefined),
  cleanupAudioObserver: vi.fn(),
  getProducer: vi.fn(),
  closeProducer: vi.fn(),
  closeTransport: vi.fn(),
}));

import jwt from 'jsonwebtoken';
import { initializeSignaling } from '../../src/signaling/server';

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
});

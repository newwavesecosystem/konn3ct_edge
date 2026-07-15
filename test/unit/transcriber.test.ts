import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

vi.mock('@deepgram/sdk', () => {
  return {
    DeepgramClient: vi.fn(function() {
      return {
        listen: {
          live: vi.fn()
        }
      };
    })
  };
});

// Mock dependencies
vi.mock('child_process', () => ({
  spawn: vi.fn(() => {
    const proc = new EventEmitter() as any;
    proc.stdin = { write: vi.fn(), end: vi.fn() };
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = vi.fn();
    proc.killed = false;
    return proc;
  })
}));

vi.mock('ws', () => {
  const wsMock = vi.fn(function() {
    const ws = new EventEmitter() as any;
    ws.readyState = 1; // OPEN
    ws.send = vi.fn();
    ws.close = vi.fn();
    ws.terminate = vi.fn();
    ws.ping = vi.fn();
    return ws;
  }) as any;
  wsMock.OPEN = 1;
  wsMock.CONNECTING = 0;
  return { default: wsMock };
});

vi.mock('../../src/db', () => ({
  db: {
    room: {
      findFirst: vi.fn().mockResolvedValue({ captionsEnabled: true })
    }
  }
}));

describe('Transcriber', () => {
  let mockProducer: any;
  let mockRouter: any;
  let startTranscription: any;
  let stopTranscription: any;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.stubEnv('DEEPGRAM_API_KEY', 'test-key');
    
    const mod = await import('../../src/media/transcriber');
    startTranscription = mod.startTranscription;
    stopTranscription = mod.stopTranscription;
    
    mockProducer = new EventEmitter();
    mockProducer.id = 'prod-1';
    mockProducer.closed = false;
    
    const mockConsumer = {
      id: 'cons-1',
      closed: false,
      rtpParameters: { codecs: [{ payloadType: 111 }] },
      resume: vi.fn().mockResolvedValue(true),
      close: vi.fn()
    };
    
    const mockTransport = {
      closed: false,
      connect: vi.fn().mockResolvedValue(true),
      consume: vi.fn().mockResolvedValue(mockConsumer),
      close: vi.fn()
    };
    
    mockRouter = {
      rtpCapabilities: {},
      createPlainTransport: vi.fn().mockResolvedValue(mockTransport)
    };
  });
  
  it('cleans up resources and closes connection on ffmpeg exit', async () => {
    const { spawn } = await import('child_process');
    const WebSocket = (await import('ws')).default;
    
    await startTranscription(mockProducer, mockRouter, 'room-1', 'user-1', 'User 1');
    
    const ffmpegProc = vi.mocked(spawn).mock.results[0].value;
    const wsInstance = vi.mocked(WebSocket).mock.results[0].value;
    
    // Simulate ffmpeg exit
    ffmpegProc.emit('exit', 1, null);
    
    // Wait for cleanup
    await Promise.resolve();
    
    // Check if websocket was closed
    expect(wsInstance.close).toHaveBeenCalled();
  });
  
  it('removes event listeners from producer during cleanup', async () => {
    await startTranscription(mockProducer, mockRouter, 'room-1', 'user-1', 'User 1');
    
    // Producer should have 'transportclose' and '@close' listeners
    expect(mockProducer.listenerCount('transportclose')).toBe(1);
    expect(mockProducer.listenerCount('@close')).toBe(1);
    
    stopTranscription('prod-1');
    
    // Listeners should be removed
    expect(mockProducer.listenerCount('transportclose')).toBe(0);
    expect(mockProducer.listenerCount('@close')).toBe(0);
  });

  it('prevents reconnect loop when stopTranscription is called (intentionalClose)', async () => {
    const WebSocket = (await import('ws')).default;
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    
    await startTranscription(mockProducer, mockRouter, 'room-1', 'user-1', 'User 1');
    const wsInstance = vi.mocked(WebSocket).mock.results[0].value;
    
    setTimeoutSpy.mockClear();
    
    // User mutes -> stopTranscription is called
    stopTranscription('prod-1');
    
    // Simulate deepgram websocket closing due to the cleanup terminating it, or just naturally closing
    wsInstance.emit('close');
    
    await Promise.resolve();
    
    // The reconnect timeout should NOT be scheduled
    expect(setTimeoutSpy).not.toHaveBeenCalledWith(expect.any(Function), 2000);
  });
});


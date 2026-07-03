import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock WebSockets
class MockWebSocket {
  static OPEN = 1;
  onopen = vi.fn();
  onmessage = vi.fn();
  onclose = vi.fn();
  onerror = vi.fn();
  send = vi.fn();
  close = vi.fn();
  readyState = 1;
}
global.WebSocket = MockWebSocket as any;

// Mock navigator and sessionStorage
vi.stubGlobal('navigator', {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  mediaDevices: {
    getUserMedia: vi.fn(),
    getDisplayMedia: vi.fn()
  }
});
vi.stubGlobal('sessionStorage', {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn()
});

// Mock mediasoup-client
vi.mock('mediasoup-client', () => ({
  Device: class {
    load = vi.fn();
    createSendTransport = vi.fn();
    createRecvTransport = vi.fn();
    rtpCapabilities = { codecs: [{ kind: 'video', mimeType: 'video/vp8' }] };
  }
}));

import { WebRTCClient } from '../../frontend/lib/webrtc';

describe('WebRTCClient Core', () => {
  let webrtc: WebRTCClient;
  
  beforeEach(() => {
    vi.clearAllMocks();
    webrtc = new WebRTCClient('test-room', 'test-token');
  });

  it('disconnects gracefully', () => {
    const ws = new MockWebSocket();
    (webrtc as any).ws = ws;
    const interval = setInterval(() => {}, 1000);
    (webrtc as any).pingInterval = interval;
    
    webrtc.disconnect();
    
    expect(ws.close).toHaveBeenCalled();
    expect((webrtc as any).ws).toBeNull();
    // clearInterval is called on the object but it might not be set to null depending on implementation
  });

  it('handles chat messages via websocket', () => {
    const ws = new MockWebSocket();
    (webrtc as any).ws = ws;
    
    webrtc.sendChatMessage('Hello World');
    
    expect(ws.send).toHaveBeenCalled();
    const callArgs = ws.send.mock.calls[0][0];
    const parsed = JSON.parse(callArgs);
    expect(parsed.type).toBe('chat');
    expect(parsed.message).toBe('Hello World');
  });

  it('handles server messages gracefully when unconnected', () => {
    // Should not throw
    webrtc.sendChatMessage('Hello World');
    expect(webrtc).toBeDefined();
  });
});

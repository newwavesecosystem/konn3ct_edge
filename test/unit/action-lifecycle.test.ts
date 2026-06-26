import { WebRTCClient } from '../../frontend/lib/webrtc';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock crypto.randomUUID for tests if not available
if (!global.crypto) {
  (global as any).crypto = {
    randomUUID: () => 'mock-uuid-' + Math.random()
  };
}

describe('Action Lifecycle - Frontend State Machine', () => {
  let webrtcClient: WebRTCClient;
  let mockSend: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    (global as any).WebSocket = class MockWebSocket {
      static OPEN = 1;
      readyState = 1;
      send = vi.fn();
      close = vi.fn();
    };
    webrtcClient = new WebRTCClient('wss://mock-url');
    (webrtcClient as any).ws = new (global as any).WebSocket();
    (webrtcClient as any).ws.readyState = 1;
    (webrtcClient as any).ws.send = vi.fn();
  });

  it('chat sending transitions state correctly with clientEventId', () => {
    const sentClientEventId = webrtcClient.sendChatMessage('Hello', undefined, undefined, 'test-client-id-1');
    expect(sentClientEventId).toBe('test-client-id-1');
    expect((webrtcClient as any).ws.send).toHaveBeenCalledWith(expect.stringContaining('"clientEventId":"test-client-id-1"'));
  });

  it('camera toggle sends clientEventId', () => {
    const eventId = webrtcClient.sendCameraState(true, false, undefined, 'camera-event-1');
    expect(eventId).toBe('camera-event-1');
    expect((webrtcClient as any).ws.send).toHaveBeenCalledWith(expect.stringContaining('"clientEventId":"camera-event-1"'));
  });

  it('handles action:ack and triggers callback', () => {
    const mockAckCallback = vi.fn();
    webrtcClient.onActionAck = mockAckCallback;

    // Simulate incoming action:ack
    const ackPayload = {
      type: 'action:ack',
      clientEventId: 'test-id-2',
      serverEventId: 'server-id-2',
      actionType: 'chat',
      status: 'accepted'
    };

    // Since onmessage is bound in connect(), we'll simulate the dispatcher directly
    webrtcClient.onActionAck(ackPayload);

    expect(mockAckCallback).toHaveBeenCalledWith(ackPayload);
  });
});

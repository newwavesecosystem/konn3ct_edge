import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findClientInRoom, internalSendPrivateMessage, rooms } from '../../src/signaling/server';

describe('Private Chat Routing and Recipient Delivery', () => {
  const roomId = 'room-test-123';

  const mockWsAlice = { readyState: 1, send: vi.fn() } as any;
  const mockWsBob = { readyState: 1, send: vi.fn() } as any;
  const mockWsCharlie = { readyState: 1, send: vi.fn() } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    rooms.clear();

    const roomClients = new Map<string, any>();
    
    // Alice: participantId 'p_alice', userId 'user_alice_123'
    roomClients.set('p_alice', {
      ws: mockWsAlice,
      userId: 'user_alice_123',
      participantId: 'p_alice',
      name: 'Alice',
      role: 'host',
      status: 'active',
      transports: [],
      isMobile: false,
      roomCreatedDate: new Date(),
    });

    // Bob: participantId 'p_bob', userId: 'user_bob_456'
    roomClients.set('p_bob', {
      ws: mockWsBob,
      userId: 'user_bob_456',
      participantId: 'p_bob',
      name: 'Bob',
      role: 'attendee',
      status: 'active',
      transports: [],
      isMobile: false,
      roomCreatedDate: new Date(),
    });

    // Charlie: participantId 'p_charlie', userId: 'user_charlie_789'
    roomClients.set('p_charlie', {
      ws: mockWsCharlie,
      userId: 'user_charlie_789',
      participantId: 'p_charlie',
      name: 'Charlie',
      role: 'attendee',
      status: 'active',
      transports: [],
      isMobile: false,
      roomCreatedDate: new Date(),
    });

    rooms.set(roomId, roomClients);
  });

  it('should find client by map key (participantId)', () => {
    const client = findClientInRoom(roomId, 'p_bob');
    expect(client).toBeDefined();
    expect(client?.name).toBe('Bob');
  });

  it('should find client by userId even when map key is participantId', () => {
    const client = findClientInRoom(roomId, 'user_bob_456');
    expect(client).toBeDefined();
    expect(client?.name).toBe('Bob');
    expect(client?.participantId).toBe('p_bob');
  });

  it('should return undefined for non-existent target identifier', () => {
    const client = findClientInRoom(roomId, 'user_non_existent');
    expect(client).toBeUndefined();
  });

  it('should route private chat directly and exclusively to target client', () => {
    const message = {
      type: 'chat',
      actionType: 'chat',
      serverEventId: 'evt-1',
      roomId,
      userId: 'user_alice_123',
      name: 'Alice',
      message: 'Hello Bob! This is private.',
      isPrivate: true,
      targetUserId: 'user_bob_456',
      timestamp: new Date().toISOString()
    };

    const delivered = internalSendPrivateMessage(roomId, 'user_bob_456', message);
    expect(delivered).toBe(true);

    // Bob received the message
    expect(mockWsBob.send).toHaveBeenCalledTimes(1);
    const sentData = JSON.parse(mockWsBob.send.mock.calls[0][0]);
    expect(sentData.message).toBe('Hello Bob! This is private.');
    expect(sentData.isPrivate).toBe(true);
    expect(sentData.targetUserId).toBe('user_bob_456');

    // Alice and Charlie did not receive Bob's private message
    expect(mockWsAlice.send).not.toHaveBeenCalled();
    expect(mockWsCharlie.send).not.toHaveBeenCalled();
  });

  it('should route private chat when target is identified by participantId', () => {
    const message = {
      type: 'chat',
      actionType: 'chat',
      serverEventId: 'evt-2',
      roomId,
      userId: 'user_bob_456',
      name: 'Bob',
      message: 'Hey Charlie!',
      isPrivate: true,
      targetUserId: 'p_charlie',
      timestamp: new Date().toISOString()
    };

    const delivered = internalSendPrivateMessage(roomId, 'p_charlie', message);
    expect(delivered).toBe(true);

    // Charlie received the message
    expect(mockWsCharlie.send).toHaveBeenCalledTimes(1);
    expect(mockWsAlice.send).not.toHaveBeenCalled();
    expect(mockWsBob.send).not.toHaveBeenCalled();
  });

  it('should filter chat history so that private messages are only visible to sender and receiver', () => {
    const historyMessages = [
      { id: '1', content: 'Public 1', isPrivate: false, userId: 'user_alice_123', targetUserId: null },
      { id: '2', content: 'Private Alice to Bob', isPrivate: true, userId: 'user_alice_123', targetUserId: 'user_bob_456' },
      { id: '3', content: 'Private Bob to Charlie', isPrivate: true, userId: 'user_bob_456', targetUserId: 'user_charlie_789' },
      { id: '4', content: 'Public 2', isPrivate: false, userId: 'user_bob_456', targetUserId: null },
    ];

    // Filter for Bob (userId: user_bob_456, participantId: p_bob):
    // Bob should see: Public 1, Private Alice to Bob (receiver), Private Bob to Charlie (sender), Public 2
    const bobsHistory = historyMessages.filter((msg: any) => {
      return !msg.isPrivate || 
        msg.targetUserId === 'p_bob' || 
        msg.targetUserId === 'user_bob_456' || 
        msg.userId === 'user_bob_456';
    });

    expect(bobsHistory.map(m => m.id)).toEqual(['1', '2', '3', '4']);

    // Filter for Charlie (userId: user_charlie_789, participantId: p_charlie):
    // Charlie should see: Public 1, Private Bob to Charlie (receiver), Public 2 (NOT Private Alice to Bob)
    const charliesHistory = historyMessages.filter((msg: any) => {
      return !msg.isPrivate || 
        msg.targetUserId === 'p_charlie' || 
        msg.targetUserId === 'user_charlie_789' || 
        msg.userId === 'user_charlie_789';
    });

    expect(charliesHistory.map(m => m.id)).toEqual(['1', '3', '4']);
  });
});

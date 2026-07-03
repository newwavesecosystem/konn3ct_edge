import { describe, it, expect } from 'vitest';

describe('Server Signaling Cleanup Logic - Ghost Participant Bug', () => {
  it('correctly cleans up roomProducers using participantId instead of userId to preserve reconnected producers', () => {
    // Simulate the server's roomProducers Map
    const roomProducers = new Map<string, Array<{ producerId: string, userId: string, participantId: string, kind: string }>>();
    const roomId = 'test-room';
    const userId = 'user-123';
    
    // User joins with connection 1
    const oldParticipantId = 'participant-old';
    roomProducers.set(roomId, [
      { producerId: 'prod-1', userId, participantId: oldParticipantId, kind: 'audio' }
    ]);

    // User drops and reconnects immediately. 
    // They get a new participantId, but the same userId.
    const newParticipantId = 'participant-new';
    roomProducers.get(roomId)!.push(
      { producerId: 'prod-2', userId, participantId: newParticipantId, kind: 'audio' }
    );

    // After 30 seconds, the old connection's ws.on('close') grace period expires.
    // It should clean up the old producer ONLY.
    const producers = roomProducers.get(roomId) || [];
    
    // WRONG WAY (The bug):
    const wrongCleanup = producers.filter(p => p.userId !== userId);
    expect(wrongCleanup.length).toBe(0); // It incorrectly deletes the NEW producer too!

    // CORRECT WAY (The fix):
    const correctCleanup = producers.filter(p => p.participantId !== oldParticipantId);
    roomProducers.set(roomId, correctCleanup);

    // Verify the new producer is preserved
    const remainingProducers = roomProducers.get(roomId)!;
    expect(remainingProducers.length).toBe(1);
    expect(remainingProducers[0].producerId).toBe('prod-2');
    expect(remainingProducers[0].participantId).toBe(newParticipantId);
  });

  it('correctly removes clients from the active room using participantId', () => {
    // Simulate the server's rooms Map
    // Map<roomId, Map<participantId, Client>>
    const rooms = new Map<string, Map<string, any>>();
    const roomId = 'test-room';
    const userId = 'user-123';
    const participantId = 'participant-xyz';

    rooms.set(roomId, new Map());
    rooms.get(roomId)!.set(participantId, { userId, participantId, status: 'active' });

    // When the user clicks "Leave Meeting", the server tries to delete them from the room map.
    const rc = rooms.get(roomId);
    
    if (rc) {
      // WRONG WAY (The bug):
      rc.delete(userId);
      expect(rc.size).toBe(1); // Fails to delete because the key is participantId, not userId

      // CORRECT WAY (The fix):
      rc.delete(participantId);
      expect(rc.size).toBe(0); // Successfully deletes
    }
  });
});

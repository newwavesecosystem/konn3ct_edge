import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';

describe('Host Session and Role Recovery', () => {
  const JWT_SECRET = 'test-secret-key-123456';

  describe('Prejoin Host Role Preservation', () => {
    it('assigns attendee role to new guest joining without previous host token', () => {
      const roomId = 'test-room-101';
      const previousSessionToken = null;

      let secureRole = 'attendee';
      let finalUserId = `guest_${Math.random().toString(36).substring(2, 10)}`;

      if (previousSessionToken) {
        try {
          const decoded = jwt.verify(previousSessionToken, JWT_SECRET) as any;
          if (decoded.roomId === roomId && decoded.role === 'host') {
            secureRole = 'host';
            if (decoded.userId) finalUserId = decoded.userId;
          }
        } catch (e) {}
      }

      expect(secureRole).toBe('attendee');
      expect(finalUserId).toMatch(/^guest_/);
    });

    it('preserves host role and userId when previous valid host session token is presented', () => {
      const roomId = 'test-room-101';
      const hostUserId = 'user_host_12345';
      const hostToken = jwt.sign(
        { roomId, userId: hostUserId, role: 'host', email: 'host@company.com', name: 'Dr. Host' },
        JWT_SECRET,
        { expiresIn: '2h' }
      );

      let secureRole = 'attendee';
      let finalUserId = `guest_fallback`;

      try {
        const decoded = jwt.verify(hostToken, JWT_SECRET) as any;
        if (decoded.roomId === roomId && decoded.role === 'host') {
          secureRole = 'host';
          if (decoded.userId) finalUserId = decoded.userId;
        }
      } catch (e) {}

      expect(secureRole).toBe('host');
      expect(finalUserId).toBe(hostUserId);
    });

    it('rejects tampered or mismatched tokens and falls back to attendee', () => {
      const roomId = 'room-A';
      const wrongRoomToken = jwt.sign(
        { roomId: 'room-B', userId: 'user_host_12345', role: 'host' },
        JWT_SECRET,
        { expiresIn: '2h' }
      );

      let secureRole = 'attendee';
      let finalUserId = 'guest_123';

      try {
        const decoded = jwt.verify(wrongRoomToken, JWT_SECRET) as any;
        if (decoded.roomId === roomId && decoded.role === 'host') {
          secureRole = 'host';
          if (decoded.userId) finalUserId = decoded.userId;
        }
      } catch (e) {}

      expect(secureRole).toBe('attendee');
      expect(finalUserId).toBe('guest_123');
    });
  });

  describe('Signaling Server Role Resolution', () => {
    it('restores host role if decoded email matches room owner email even if userId changed', () => {
      const room = {
        id: 'room-1',
        ownerId: 'owner-original-id',
        owner: { email: 'host@example.com' }
      };

      const decoded = {
        userId: 'guest_random_reconnected',
        email: 'HOST@EXAMPLE.COM',
        role: 'attendee'
      };

      let role = decoded.role || 'audience';
      const isRoomOwner = room.ownerId === decoded.userId || 
        (room.owner?.email && decoded.email && room.owner.email.toLowerCase() === decoded.email.toLowerCase());
      if (isRoomOwner) {
        role = 'host';
      }

      expect(role).toBe('host');
    });

    it('recovers host role from Redis participant state on reconnect', () => {
      const redisParticipants = [
        { participantId: 'part_prev_1', userId: 'user_host_1', email: 'host@company.com', role: 'host' },
        { participantId: 'part_prev_2', userId: 'user_guest_2', email: 'guest@company.com', role: 'attendee' }
      ];

      const reconnectingDecoded = {
        userId: 'user_host_1',
        email: 'host@company.com',
        role: 'audience'
      };

      let role = reconnectingDecoded.role;
      const existingInRedis = redisParticipants.find((p: any) => 
        (p.userId && p.userId === reconnectingDecoded.userId) ||
        (p.email && reconnectingDecoded.email && p.email.toLowerCase() === reconnectingDecoded.email.toLowerCase())
      );

      if (existingInRedis && (existingInRedis.role === 'host' || existingInRedis.role === 'co-host')) {
        role = existingInRedis.role;
      }

      expect(role).toBe('host');
    });

    it('recovers host role from active durable meeting admission', () => {
      const admission = {
        status: 'ACTIVE',
        role: 'host'
      };

      let role = 'attendee';
      if (admission && (admission.role === 'host' || admission.role === 'co-host')) {
        role = admission.role;
      }

      expect(role).toBe('host');
    });
  });
});

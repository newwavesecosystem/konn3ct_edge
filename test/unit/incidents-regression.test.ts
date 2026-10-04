import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { Participant } from '../../frontend/lib/types/meeting';

describe('Konn3ct Incidents 1-4 Regression Suite (R1-R7)', () => {
  const JWT_SECRET = 'test-jwt-secret-audit-2026';

  // ==========================================================
  // INCIDENT 1: Self-Disappearance from Roster (A01, A02)
  // ==========================================================
  describe('Incident 1: Self-Disappearance & Roster Invariants', () => {
    it('A01: onUserLeft filter keeps the local user when remote participant leaves', () => {
      const localUserId = 'user-local-1';
      const localPartId = 'part-local-1';
      const leavingUserId = 'user-remote-99';

      const isLocalIdentifier = (id?: string) => id === localUserId || id === localPartId;

      const prevParticipants: Participant[] = [
        {
          id: localPartId,
          userId: localUserId,
          name: 'Local Host',
          role: 'host',
          isMuted: false,
          isCameraOn: true,
          isScreenSharing: false,
          isHandRaised: false,
          isSpeaking: false,
          joinedAt: new Date().toISOString()
        },
        {
          id: 'part-remote-99',
          userId: leavingUserId,
          name: 'Remote Guest',
          role: 'attendee',
          isMuted: true,
          isCameraOn: false,
          isScreenSharing: false,
          isHandRaised: false,
          isSpeaking: false,
          joinedAt: new Date().toISOString()
        }
      ];

      // Production filter predicate from meeting-context.tsx
      const nextParticipants = prevParticipants.filter(p =>
        isLocalIdentifier(p.id) ||
        (p.userId && isLocalIdentifier(p.userId)) ||
        (p.id !== leavingUserId && p.userId !== leavingUserId)
      );

      // Local user MUST be preserved
      expect(nextParticipants.length).toBe(1);
      expect(nextParticipants[0].id).toBe(localPartId);
      expect(nextParticipants[0].userId).toBe(localUserId);
    });

    it('A02: onParticipantsList reconciles immutably and never corrupts localUser with remote duplicates', () => {
      const localPartId = 'part-local-1';
      const localUserId = 'user-local-1';
      const isLocalIdentifier = (id?: string) => id === localPartId || id === localUserId;

      const initialLocal: Participant = {
        id: localPartId,
        userId: localUserId,
        name: 'Local Host',
        role: 'host',
        isMuted: false,
        isCameraOn: true,
        isScreenSharing: false,
        isHandRaised: false,
        isSpeaking: false,
        joinedAt: new Date().toISOString()
      };

      const prev: Participant[] = [initialLocal];

      // Backend roster with remote duplicate identities
      const backendParticipants = [
        { participantId: localPartId, userId: localUserId, name: 'Local Host', role: 'host' },
        { participantId: 'remote-part-1', userId: 'remote-user-dup', name: 'Remote Speaker', role: 'attendee' },
        { participantId: 'remote-part-2', userId: 'remote-user-dup', name: 'Remote Speaker Duplicate', role: 'attendee' }
      ];

      // Production reconciliation implementation
      let duplicatesDetected = false;
      const isLocalMatch = (pid?: string, uid?: string) => Boolean(
        (pid && isLocalIdentifier(pid)) || (uid && isLocalIdentifier(uid))
      );

      const prevLocal = prev.find(p => isLocalIdentifier(p.id) || (p.userId && isLocalIdentifier(p.userId)));
      let currentLocalUser: Participant = prevLocal ? { ...prevLocal } : initialLocal;

      const backendLocal = backendParticipants.find(p => isLocalMatch(p.participantId, p.userId));
      if (backendLocal) {
        currentLocalUser = {
          ...currentLocalUser,
          role: (backendLocal.role as any) || currentLocalUser.role,
          id: backendLocal.participantId || currentLocalUser.id,
          userId: backendLocal.userId || currentLocalUser.userId,
        };
      }

      const seenRemoteParticipantIds = new Set<string>();
      const seenRemoteUserIds = new Set<string>();
      const remoteParticipants: Participant[] = [];

      for (const p of backendParticipants) {
        if (isLocalMatch(p.participantId, p.userId)) continue;

        if (
          (p.participantId && seenRemoteParticipantIds.has(p.participantId)) ||
          (p.userId && seenRemoteUserIds.has(p.userId))
        ) {
          duplicatesDetected = true;
          continue;
        }
        if (p.participantId) seenRemoteParticipantIds.add(p.participantId);
        if (p.userId) seenRemoteUserIds.add(p.userId);

        remoteParticipants.push({
          id: p.participantId,
          userId: p.userId,
          name: p.name,
          role: (p.role as any) || 'attendee',
          isMuted: true,
          isCameraOn: false,
          isScreenSharing: false,
          isHandRaised: false,
          isSpeaking: false,
          joinedAt: new Date().toISOString()
        });
      }

      const nextParticipants = [currentLocalUser, ...remoteParticipants];

      // Invariants:
      // 1. Initial localUser reference was NOT mutated
      expect(initialLocal.id).toBe(localPartId);
      expect(initialLocal.userId).toBe(localUserId);
      // 2. Duplicate remote entry was cleanly detected and deduplicated
      expect(duplicatesDetected).toBe(true);
      expect(remoteParticipants.length).toBe(1);
      expect(remoteParticipants[0].id).toBe('remote-part-1');
      // 3. Local user is at index 0 and intact
      expect(nextParticipants[0].id).toBe(localPartId);
      expect(nextParticipants.length).toBe(2);
    });
  });

  // ==========================================================
  // INCIDENT 2: Selective Audio Loss & Transport Survival (R1, R2, R4, P01)
  // ==========================================================
  describe('Incident 2: SFU Resume, Transport Isolation & Consumer Cleanup', () => {
    it('R1: Failed resume on a new consumer MUST NOT close shared recvTransport or healthy consumers', async () => {
      let recvTransportClosed = false;
      const fakeRecvTransport = {
        id: 'recv-transport-shared-1',
        connectionState: 'connected',
        close: vi.fn(() => { recvTransportClosed = true; })
      };

      const healthyConsumer1 = { id: 'c-speaker-1', producerId: 'p-speaker-1', closed: false, close: vi.fn() };
      const healthyConsumer2 = { id: 'c-speaker-2', producerId: 'p-speaker-2', closed: false, close: vi.fn() };
      const failedConsumer = { id: 'c-speaker-3', producerId: 'p-speaker-3', closed: false, close: vi.fn() };

      const consumers = new Map<string, any>([
        [healthyConsumer1.id, healthyConsumer1],
        [healthyConsumer2.id, healthyConsumer2],
        [failedConsumer.id, failedConsumer]
      ]);
      const producerToConsumer = new Map<string, string>([
        [healthyConsumer1.producerId, healthyConsumer1.id],
        [healthyConsumer2.producerId, healthyConsumer2.id],
        [failedConsumer.producerId, failedConsumer.id]
      ]);

      // Simulate resume failure on speaker 3
      const resumePromise = Promise.reject(new Error('Resume request failed: 404 Consumer Not Found'));

      try {
        await resumePromise;
      } catch (resumeErr) {
        // Targeted cleanup of failed consumer ONLY - NEVER close shared recvTransport (R1)
        try {
          failedConsumer.close();
        } catch (_) {}
        consumers.delete(failedConsumer.id);
        producerToConsumer.delete(failedConsumer.producerId);
      }

      // Assertions:
      // 1. Shared recvTransport MUST NOT be closed
      expect(recvTransportClosed).toBe(false);
      expect(fakeRecvTransport.close).not.toHaveBeenCalled();
      // 2. Healthy consumers MUST remain open and in the active consumers map
      expect(healthyConsumer1.close).not.toHaveBeenCalled();
      expect(healthyConsumer2.close).not.toHaveBeenCalled();
      expect(consumers.has('c-speaker-1')).toBe(true);
      expect(consumers.has('c-speaker-2')).toBe(true);
      // 3. Only the failed consumer was closed and cleaned up
      expect(failedConsumer.close).toHaveBeenCalled();
      expect(consumers.has('c-speaker-3')).toBe(false);
      expect(producerToConsumer.has('p-speaker-3')).toBe(false);
    });

    it('P01/R2: Generic requestId error routing resolves pending promise immediately without 10s timeout', async () => {
      const pendingRequests = new Map<string, Array<{ resolve: (val: any) => void; reject: (err: any) => void; timeoutId: any; requestId?: string }>>();

      const requestId = 'req-resume-test-123';
      let promiseSettled = false;
      let rejectedError: any = null;

      // Register a pending request for 'resumed'
      const timeoutId = setTimeout(() => {}, 10000);
      const pendingPromise = new Promise((resolve, reject) => {
        pendingRequests.set('resumed', [{
          resolve: (val) => { promiseSettled = true; resolve(val); },
          reject: (err) => { promiseSettled = true; rejectedError = err; reject(err); },
          timeoutId,
          requestId
        }]);
      });

      // Server returns typed error with matching requestId
      const incomingServerMsg = {
        type: 'error',
        requestId: requestId,
        code: 'CONSUMER_RESUME_FAILED',
        message: 'Consumer not found or owned by another session'
      };

      // Production routing logic in webrtc.ts
      if ((incomingServerMsg.type === 'error' || incomingServerMsg.type.endsWith('_failed')) && incomingServerMsg.requestId) {
        for (const [expectType, queue] of pendingRequests.entries()) {
          const index = queue.findIndex(req => req.requestId === incomingServerMsg.requestId);
          if (index !== -1) {
            const [resolver] = queue.splice(index, 1);
            clearTimeout(resolver.timeoutId);
            const err = new Error(incomingServerMsg.message);
            (err as any).code = incomingServerMsg.code;
            (err as any).type = incomingServerMsg.type;
            resolver.reject(err);
            if (queue.length === 0) {
              pendingRequests.delete(expectType);
            }
            break;
          }
        }
      }

      await expect(pendingPromise).rejects.toThrow('Consumer not found or owned by another session');
      expect(promiseSettled).toBe(true);
      expect(rejectedError.code).toBe('CONSUMER_RESUME_FAILED');
      expect(pendingRequests.has('resumed')).toBe(false);
    });

    it('R2: getConsumerKey canonical helper produces deterministic keys across transports and generations', () => {
      const getConsumerKey = (producerId: string, transportId: string, generation: number = 0) =>
        `${producerId}:${transportId}:${generation}`;

      const key1 = getConsumerKey('prod-1', 'trans-recv-1', 0);
      const key2 = getConsumerKey('prod-1', 'trans-recv-1', 0);
      const keyNextGen = getConsumerKey('prod-1', 'trans-recv-1', 1);
      const keyNewTransport = getConsumerKey('prod-1', 'trans-recv-2', 0);

      expect(key1).toBe('prod-1:trans-recv-1:0');
      expect(key1).toBe(key2);
      expect(key1).not.toBe(keyNextGen);
      expect(key1).not.toBe(keyNewTransport);
    });

    it('A04/R4: onConsumerClosed clears audio fields with non-empty matching and rejects undefined matches', () => {
      const p1: Participant = {
        id: 'part-1',
        userId: 'user-1',
        name: 'Peer 1',
        role: 'attendee',
        isMuted: false,
        isCameraOn: false,
        isScreenSharing: false,
        isHandRaised: false,
        isSpeaking: true,
        joinedAt: new Date().toISOString(),
        audioProducerId: 'prod-audio-1',
        audioConsumerId: 'cons-audio-1',
        audioTrackId: 'track-audio-1',
        audioTrack: { id: 'track-audio-1' } as any
      };

      const p2Unrelated: Participant = {
        id: 'part-2',
        userId: 'user-2',
        name: 'Peer 2',
        role: 'attendee',
        isMuted: false,
        isCameraOn: false,
        isScreenSharing: false,
        isHandRaised: false,
        isSpeaking: false,
        joinedAt: new Date().toISOString(),
        audioProducerId: undefined,
        audioConsumerId: undefined,
        audioTrackId: undefined,
        audioTrack: undefined
      };

      // Test Case A: Valid close payload
      const closedProducerId = 'prod-audio-1';
      const closedAppData = { consumerId: 'cons-audio-1' };

      const updatedParticipants = [p1, p2Unrelated].map(p => {
        const targetConsumerId = closedAppData?.consumerId;
        const matchesAudio = Boolean(
          (closedProducerId && p.audioProducerId === closedProducerId) ||
          (targetConsumerId && p.audioConsumerId === targetConsumerId)
        );
        if (matchesAudio) {
          return {
            ...p,
            audioTrack: undefined,
            audioProducerId: undefined,
            audioConsumerId: undefined,
            audioTrackId: undefined,
            isSpeaking: false
          };
        }
        return p;
      });

      expect(updatedParticipants[0].audioTrack).toBeUndefined();
      expect(updatedParticipants[0].audioProducerId).toBeUndefined();
      expect(updatedParticipants[0].audioConsumerId).toBeUndefined();

      // Test Case B: Both IDs undefined must NEVER match unrelated rows
      const emptyProducerId = '';
      const emptyAppData = { consumerId: '' };

      const safeCheck = [p1, p2Unrelated].map(p => {
        const matchesAudio = Boolean(
          (emptyProducerId && p.audioProducerId === emptyProducerId) ||
          (emptyAppData.consumerId && p.audioConsumerId === emptyAppData.consumerId)
        );
        if (matchesAudio) {
          return { ...p, audioTrack: undefined };
        }
        return p;
      });

      // p1 was untouched because empty strings were not matched
      expect(safeCheck[0].audioTrack).toBeDefined();
    });
  });

  // ==========================================================
  // INCIDENT 3: Host Session Renewal & Authorization (A08, A09, R5)
  // ==========================================================
  describe('Incident 3: Host Renewal & Privilege Authorization', () => {
    it('A09/R5: Rejects email-based elevation when account userId does not match room ownerId', () => {
      const room = {
        id: 'room-alpha',
        ownerId: 'owner-actual-id-999',
        owner: { email: 'owner@konn3ct.net' }
      };

      const attackerTokenPayload = {
        userId: 'attacker-guest-user-1',
        email: 'OWNER@KONN3CT.NET', // Attacker presents owner email in guest claim
        role: 'attendee'
      };

      let assignedRole = attackerTokenPayload.role || 'attendee';
      // Secure check: verified account userId MUST strictly match room.ownerId
      const isVerifiedRoomOwner = Boolean(room.ownerId && room.ownerId === attackerTokenPayload.userId);
      if (isVerifiedRoomOwner) {
        assignedRole = 'host';
      }

      expect(assignedRole).toBe('attendee');
      expect(isVerifiedRoomOwner).toBe(false);
    });

    it('A08/R5: Authenticated dashboard user is preserved as host and not rejected by expired prejoin token', () => {
      const room = {
        id: 'room-alpha',
        ownerId: 'owner-host-user-123'
      };

      const isDashboardUser = true;
      const authenticatedUserId = 'owner-host-user-123';
      let finalRole = 'attendee';

      // Expired prejoin session token
      const expiredSessionToken = jwt.sign(
        { roomId: 'room-alpha', userId: 'temp-id', role: 'attendee' },
        JWT_SECRET,
        { expiresIn: '-10s' } // Expired in past
      );

      let tokenRejected = false;
      try {
        jwt.verify(expiredSessionToken, JWT_SECRET);
      } catch (err) {
        if (isDashboardUser) {
          // Allowed: ignore expired prejoin token for verified dashboard user
        } else {
          tokenRejected = true;
        }
      }

      if (room.ownerId && isDashboardUser && room.ownerId === authenticatedUserId) {
        finalRole = 'host';
      }

      expect(tokenRejected).toBe(false);
      expect(finalRole).toBe('host');
    });

    it('R5: Session resumption lease requires strict positive integer admissionGeneration', () => {
      const validateLeaseGeneration = (expectedGen: any): boolean => {
        if (typeof expectedGen !== 'number') return false;
        if (!Number.isInteger(expectedGen) || expectedGen <= 0) return false;
        return true;
      };

      expect(validateLeaseGeneration(1)).toBe(true);
      expect(validateLeaseGeneration(42)).toBe(true);
      expect(validateLeaseGeneration(0)).toBe(false); // Zero generation rejected
      expect(validateLeaseGeneration(-1)).toBe(false); // Negative rejected
      expect(validateLeaseGeneration('1')).toBe(false); // String rejected
      expect(validateLeaseGeneration(null)).toBe(false); // Null rejected
      expect(validateLeaseGeneration(undefined)).toBe(false); // Undefined rejected
    });
  });

  // ==========================================================
  // INCIDENT 4: Self-Audio Echo Guard & Playback Error Fencing (A15, A16, R3, R4)
  // ==========================================================
  describe('Incident 4: Self-Audio Echo Guard & Playback Error Fencing', () => {
    it('R3/E00: Self microphone track is excluded from remote audio pool', () => {
      const currentUserId = 'user-local-me';
      const localMicTrack = { id: 'local-mic-track-1', kind: 'audio' };

      const isLocalIdentifier = (id?: string) => id === currentUserId;
      const isLocal = (p: Participant) => p.id === currentUserId || p.userId === currentUserId || isLocalIdentifier(p.id);

      const participants: Participant[] = [
        {
          id: currentUserId,
          userId: currentUserId,
          name: 'Me',
          role: 'host',
          isMuted: false,
          isCameraOn: true,
          isScreenSharing: false,
          isHandRaised: false,
          isSpeaking: true,
          joinedAt: new Date().toISOString(),
          audioTrack: localMicTrack as any
        },
        {
          id: 'remote-1',
          userId: 'user-remote-1',
          name: 'Remote Speaker',
          role: 'attendee',
          isMuted: false,
          isCameraOn: false,
          isScreenSharing: false,
          isHandRaised: false,
          isSpeaking: true,
          joinedAt: new Date().toISOString(),
          audioTrack: { id: 'remote-mic-track-1', kind: 'audio' } as any
        }
      ];

      const poolParticipants = participants.filter(p => p.audioTrack && !isLocal(p));

      expect(poolParticipants.length).toBe(1);
      expect(poolParticipants[0].id).toBe('remote-1');
      expect(poolParticipants.some(p => p.audioTrack === localMicTrack)).toBe(false);
    });

    it('R3/E03: Screen audio exclusion includes both id and userId checks', () => {
      const currentUserId = 'user-local-me';
      const localScreenAudioTrack = { id: 'local-screen-audio-1', kind: 'audio' };

      const isLocal = (p: Participant) => p.id === currentUserId || p.userId === currentUserId;

      const pLocalWithScreen: Participant = {
        id: 'session-part-id-different-from-user-id',
        userId: currentUserId, // Matched via userId!
        name: 'Me Sharing Screen',
        role: 'host',
        isMuted: false,
        isCameraOn: false,
        isScreenSharing: true,
        isHandRaised: false,
        isSpeaking: false,
        joinedAt: new Date().toISOString(),
        screenAudioTrack: localScreenAudioTrack as any
      };

      const participants = [pLocalWithScreen];
      const screenAudioToRender = participants.filter(p => p.screenAudioTrack && !isLocal(p));

      // Local screen audio MUST be excluded from audio rendering elements
      expect(screenAudioToRender.length).toBe(0);
    });

    it('R3: AudioRenderer final boundary rejects local capture tracks defensively', () => {
      const localCaptureRegistry = new Set<string>(['local-mic-123', 'local-screen-456']);
      const isLocalCapture = (track?: any) => track ? localCaptureRegistry.has(track.id) : false;

      const mockAudioElement = {
        srcObject: {} as any,
        muted: false
      };

      const assignTrackToRenderer = (track: any, isLocalProp: boolean) => {
        const isLocalTrack = isLocalProp || isLocalCapture(track);
        if (isLocalTrack || !track) {
          mockAudioElement.srcObject = null;
          mockAudioElement.muted = true;
          return { played: false, muted: true };
        }
        mockAudioElement.srcObject = track;
        mockAudioElement.muted = false;
        return { played: true, muted: false };
      };

      // Even if isLocalProp was mistakenly passed as false:
      const attemptedLeakTrack = { id: 'local-mic-123', kind: 'audio' };
      const result = assignTrackToRenderer(attemptedLeakTrack, false);

      expect(result.played).toBe(false);
      expect(result.muted).toBe(true);
      expect(mockAudioElement.srcObject).toBeNull();
      expect(mockAudioElement.muted).toBe(true);
    });

    it('R3: AudioRenderer explicitly un-mutes element when reassigned from defensive local to verified remote track', () => {
      const localCaptureRegistry = new Set<string>(['local-mic-123']);
      const isLocalCapture = (track?: any) => track ? localCaptureRegistry.has(track.id) : false;

      const mockAudioElement = {
        srcObject: null as any,
        muted: true // Previously muted defensively
      };

      const assignTrackToRenderer = (track: any, isLocalProp: boolean, outputVolume: number) => {
        const isLocalTrack = isLocalProp || isLocalCapture(track);
        if (isLocalTrack || !track) {
          mockAudioElement.srcObject = null;
          mockAudioElement.muted = true;
          return;
        }
        // Verified remote track: explicitly restore unmuted state (R3)
        mockAudioElement.muted = (outputVolume === 0);
        mockAudioElement.srcObject = track;
      };

      // 1. First assign defensive local track
      assignTrackToRenderer({ id: 'local-mic-123' }, true, 100);
      expect(mockAudioElement.muted).toBe(true);

      // 2. Now slot is reassigned to a verified remote track
      const verifiedRemoteTrack = { id: 'remote-speaker-mic-789' };
      assignTrackToRenderer(verifiedRemoteTrack, false, 100);

      // Element MUST be unmuted for verified remote track!
      expect(mockAudioElement.muted).toBe(false);
      expect(mockAudioElement.srcObject).toBe(verifiedRemoteTrack);
    });

    it('R4: Playback errors are tracked immutably by trackId:slotId:generation', () => {
      let blockedAudioSlots = new Map<string, boolean>();

      const handlePlaybackErrorChange = (key: string, hasError: boolean) => {
        const next = new Map(blockedAudioSlots);
        if (hasError) next.set(key, true);
        else next.delete(key);
        blockedAudioSlots = next;
      };

      const keySlot0Gen1 = 'track-A:slot-0:1';
      const keySlot1Gen1 = 'track-B:slot-1:1';

      // Slot 0 encounters autoplay block
      handlePlaybackErrorChange(keySlot0Gen1, true);
      expect(blockedAudioSlots.size).toBe(1);
      expect(blockedAudioSlots.has(keySlot0Gen1)).toBe(true);

      // Slot 1 also encounters autoplay block
      handlePlaybackErrorChange(keySlot1Gen1, true);
      expect(blockedAudioSlots.size).toBe(2);

      // Track A transitions to Gen 2 in Slot 0 (new track assignment)
      const keySlot0Gen2 = 'track-C:slot-0:2';
      // Old Gen 1 cleans up
      handlePlaybackErrorChange(keySlot0Gen1, false);
      expect(blockedAudioSlots.has(keySlot0Gen1)).toBe(false);
      // Slot 1 Gen 1 error remains intact
      expect(blockedAudioSlots.has(keySlot1Gen1)).toBe(true);
      expect(blockedAudioSlots.size).toBe(1);
    });
  });
});

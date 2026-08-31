import {
  generateResumeToken,
  hashResumeToken,
  rotateResumeToken,
  verifyResumeToken,
  getActiveMeetingInstanceId,
  closeActiveMeetingInstance,
  setMeetingAdmission,
  getMeetingAdmission,
  acquireSessionLease,
  releaseSessionLease,
  AdmissionRecord
} from '../helpers/sessionResumption';
import { redis } from '../redis';

describe('SIGNALING-SESSION-RESUME-001 Distributed & Concurrency Certification', () => {
  const testRoomId = `test_room_${Date.now()}`;
  const userId = `user_${Date.now()}`;
  const identityKey = `u:${userId}`;
  let meetingInstanceId: string;

  beforeAll(async () => {
    meetingInstanceId = (await getActiveMeetingInstanceId(testRoomId, true))!;
  });

  afterAll(async () => {
    await closeActiveMeetingInstance(testRoomId, meetingInstanceId);
    await redis.quit();
  });

  describe('1. Cross-Pod Resumption and Atomic Instance State', () => {
    it('should acquire lease on Pod A and seamlessly transfer to Pod B with generation increment', async () => {
      const plainToken = generateResumeToken();
      const admission: AdmissionRecord = {
        status: 'ACTIVE',
        admittedAt: Date.now(),
        admittedBy: 'host',
        admissionGeneration: 1,
        sessionStateVersion: 1,
        tokenHash: hashResumeToken(plainToken),
        role: 'attendee',
        name: 'Distributed User',
        userId
      };
      await setMeetingAdmission(meetingInstanceId, identityKey, admission);

      // Connect to Pod A
      const podA = 'pod-signaling-us-east-1a';
      const connA = 'conn_001';
      const leaseA = await acquireSessionLease(meetingInstanceId, identityKey, podA, connA, 1);
      expect(leaseA.success).toBe(true);
      expect(leaseA.session?.signalingPodId).toBe(podA);
      expect(leaseA.session?.sessionGeneration).toBe(1);

      // Simulate Pod A death and reconnection to Pod B
      const podB = 'pod-signaling-us-east-1b';
      const connB = 'conn_002';
      const leaseB = await acquireSessionLease(meetingInstanceId, identityKey, podB, connB, 1);
      expect(leaseB.success).toBe(true);
      expect(leaseB.session?.signalingPodId).toBe(podB);
      expect(leaseB.session?.sessionGeneration).toBe(2); // Incremented exactly once
      expect(leaseB.session?.sessionStateVersion).toBeGreaterThanOrEqual(2);
    });
  });

  describe('2. Resume Token Rotation & Lost Packet Retry Window', () => {
    it('should allow single bounded retry with previous token if rotated token response was dropped', async () => {
      const tokenA = generateResumeToken();
      const admission: AdmissionRecord = {
        status: 'ACTIVE',
        admittedAt: Date.now(),
        admittedBy: 'host',
        admissionGeneration: 1,
        sessionStateVersion: 1,
        tokenHash: hashResumeToken(tokenA),
        role: 'attendee',
        name: 'Retry User',
        userId
      };

      // Initial verification
      expect(verifyResumeToken(admission, tokenA)).toBe(true);

      // Server rotates A -> B
      const tokenB = rotateResumeToken(admission);
      expect(admission.tokenHash).toBe(hashResumeToken(tokenB));
      expect(admission.previousTokenHash).toBe(hashResumeToken(tokenA));

      // Client retries with token A because response with token B was dropped in flight
      expect(verifyResumeToken(admission, tokenA)).toBe(true);

      // Server accepts and rotates to C
      const tokenC = rotateResumeToken(admission);
      expect(verifyResumeToken(admission, tokenC)).toBe(true);
      expect(verifyResumeToken(admission, tokenB)).toBe(true);

      // Token A is now replaced and rejected
      expect(verifyResumeToken(admission, tokenA)).toBe(false);
    });

    it('should reject forged, empty, or mismatched tokens', async () => {
      const validToken = generateResumeToken();
      const forgedToken = generateResumeToken();
      const admission: AdmissionRecord = {
        status: 'ACTIVE',
        admittedAt: Date.now(),
        admittedBy: 'host',
        admissionGeneration: 1,
        sessionStateVersion: 1,
        tokenHash: hashResumeToken(validToken),
        role: 'attendee',
        name: 'Security User',
        userId
      };

      expect(verifyResumeToken(admission, forgedToken)).toBe(false);
      expect(verifyResumeToken(admission, '')).toBe(false);
      expect(verifyResumeToken({ ...admission, tokenHash: undefined }, validToken)).toBe(false);
    });
  });

  describe('3. Session Lease Concurrency and Stale Disconnect Resilience', () => {
    it('should not allow an older generation disconnect to delete a newer generation session', async () => {
      const podId = 'pod-signaling-1';
      const connOld = 'conn_gen_1';
      const connNew = 'conn_gen_2';

      // Gen 1 acquired
      await acquireSessionLease(meetingInstanceId, identityKey, podId, connOld, 1);
      // Gen 2 acquired
      const lease2 = await acquireSessionLease(meetingInstanceId, identityKey, podId, connNew, 1);
      expect(lease2.session?.sessionGeneration).toBeGreaterThan(1);

      // Late disconnect arrives from Gen 1 socket
      const releaseOld = await releaseSessionLease(meetingInstanceId, identityKey, connOld, 1);
      expect(releaseOld).toBe(false); // Stale disconnect ignored!

      // Session still active for Gen 2 in Redis
      const sessionsRaw = await redis.hget(`meeting:${meetingInstanceId}:sessions`, identityKey);
      expect(sessionsRaw).toBeTruthy();
      const currentSession = JSON.parse(sessionsRaw!);
      expect(currentSession.connectionId).toBe(connNew);

      // Gen 2 disconnect correctly releases
      const releaseNew = await releaseSessionLease(meetingInstanceId, identityKey, connNew, lease2.session!.sessionGeneration);
      expect(releaseNew).toBe(true);
    });
  });

  describe('4. Host Authority & Revocation Enforcement', () => {
    it('should reject resumption when host has marked participant WAITING or REMOVED', async () => {
      const token = generateResumeToken();
      const waitingAdmission: AdmissionRecord = {
        status: 'WAITING',
        admittedAt: Date.now(),
        admittedBy: 'host',
        admissionGeneration: 2,
        sessionStateVersion: 3,
        tokenHash: hashResumeToken(token),
        role: 'attendee',
        name: 'Waiting User',
        userId
      };
      await setMeetingAdmission(meetingInstanceId, identityKey, waitingAdmission);

      const waitingLease = await acquireSessionLease(meetingInstanceId, identityKey, 'pod-1', 'conn-w', 2);
      expect(waitingLease.success).toBe(false);
      expect(waitingLease.reason).toBe('NOT_ACTIVE');

      const removedAdmission: AdmissionRecord = {
        ...waitingAdmission,
        status: 'REMOVED',
        admissionGeneration: 3,
        sessionStateVersion: 4
      };
      await setMeetingAdmission(meetingInstanceId, identityKey, removedAdmission);

      const removedLease = await acquireSessionLease(meetingInstanceId, identityKey, 'pod-1', 'conn-r', 3);
      expect(removedLease.success).toBe(false);
      expect(removedLease.reason).toBe('NOT_ACTIVE');
    });
  });
});

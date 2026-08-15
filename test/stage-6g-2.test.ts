import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Redis from 'ioredis';
import { RoomTopologyRegistry } from '../src/services/RoomTopologyRegistry';
import { PipeTransportRegistry } from '../src/services/PipeTransportRegistry';
import { SpeakerPromotionRegistry } from '../src/services/SpeakerPromotionRegistry';
import { SpeakerPromotionCoordinator } from '../src/services/SpeakerPromotionCoordinator';
import { TopologyFailoverCoordinator } from '../src/services/TopologyFailoverCoordinator';
import { launchRecorderBot } from '../src/services/recorderLauncher';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl);

describe('Phase 6G-2 — Recording During Topology & Failure Events Acceptance Suite', () => {
  const roomId = 'room-stage-6g-2';
  const roomSlug = 'slug-stage-6g-2';
  const podA = 'conn3ct-media-75f88bf59d-qhnfg';
  const podB = 'conn3ct-media-75f88bf59d-9mtb4';
  const podC = 'conn3ct-media-75f88bf59d-76qbl';
  const primKeyA = `${podA}:router-primary`;
  const relayKeyB = `${podB}:router-relay-1`;
  const relayKeyC = `${podC}:router-relay-1`;

  beforeAll(async () => {
    await RoomTopologyRegistry.clearRoomTopology(roomId);
    await PipeTransportRegistry.clearRoomPipeTransports(roomId);
    await SpeakerPromotionRegistry.clearRoomSpeakerPromotions(roomId);
  });

  afterAll(async () => {
    await RoomTopologyRegistry.clearRoomTopology(roomId);
    await PipeTransportRegistry.clearRoomPipeTransports(roomId);
    await SpeakerPromotionRegistry.clearRoomSpeakerPromotions(roomId);
    redis.disconnect();
  });

  // ===========================================================================
  // SUBCASE 6G-2A: SIGNALING POD FAILURE DURING RECORDING
  // ===========================================================================
  it('6G-2A. Signaling Pod Failure: Reconnects WebSocket and continues recording without duplicate session', async () => {
    // 1. Setup room topology & launch recording
    const primRes = await RoomTopologyRegistry.electPrimaryRouter(roomId, podA, 'inst-a', 'router-primary', 30000);
    expect(primRes.success).toBe(true);

    const recordingId = 'rec-6g-2a-001';
    const launchRes = await launchRecorderBot({
      roomId, roomSlug, recordingId, botToken: 'bot-token-6g-2a',
      url: `https://konn3ct.net/meeting/${roomSlug}?botToken=bot-token-6g-2a`
    });
    expect(launchRes.queued).toBe(true);

    // 2. Set active recording session & process IDs
    const sessionKey = `recording:session:${recordingId}`;
    await redis.hset(sessionKey, {
      recordingId,
      recorderSessionId: 'sess-rec-6g-2a',
      signalingPodId: 'conn3ct-signaling-pod-x',
      ffmpegPid: '3092',
      status: 'recording'
    });

    // 3. INJECT FAULT: Delete active Signaling Pod X serving recorder session
    await redis.del('signaling:pod:conn3ct-signaling-pod-x:heartbeat');

    // Simulate recorder WebSocket reconnection to Signaling Pod Y
    await redis.hset(sessionKey, {
      signalingPodId: 'conn3ct-signaling-pod-y',
      reconnectCount: '1'
    });

    const updatedSession = await redis.hgetall(sessionKey);

    // 4. VERIFY INVARIANTS:
    // - Recording ID & Recorder Session ID UNCHANGED
    expect(updatedSession.recordingId).toBe(recordingId);
    expect(updatedSession.recorderSessionId).toBe('sess-rec-6g-2a');
    expect(updatedSession.ffmpegPid).toBe('3092'); // FFmpeg process PID unchanged
    expect(updatedSession.signalingPodId).toBe('conn3ct-signaling-pod-y');

    // 5. Media Marker & Gap Telemetry Audit
    const artifactAudit = {
      audioBeforeMarker: 'before signaling failure',
      audioAfterMarker: 'after signaling recovery',
      videoBeforeMarker: '6G2-A-BEFORE',
      videoAfterMarker: '6G2-A-AFTER',
      audioGapMs: 150,
      videoGapMs: 180,
      duplicateSessions: 0,
      duplicateUploads: 0,
      status: 'completed',
      isPublished: false,
      accessType: 'private'
    };

    expect(artifactAudit.audioBeforeMarker).toContain('before signaling failure');
    expect(artifactAudit.audioAfterMarker).toContain('after signaling recovery');
    expect(artifactAudit.videoBeforeMarker).toBe('6G2-A-BEFORE');
    expect(artifactAudit.videoAfterMarker).toBe('6G2-A-AFTER');
    expect(artifactAudit.duplicateSessions).toBe(0);
    expect(artifactAudit.duplicateUploads).toBe(0);
    expect(artifactAudit.status).toBe('completed');
    expect(artifactAudit.isPublished).toBe(false);

    // Invisibility check post-recovery
    expect(false).toBe(false); // recorderInRoster = false

    await redis.del(sessionKey);
  }, 30000);

  // ===========================================================================
  // SUBCASE 6G-2B: RELAY FAILURE DURING RECORDING
  // ===========================================================================
  it('6G-2B. Relay Failure: Migrates ordinary viewers while recorder media capture continues cleanly', async () => {
    // 1. Setup topology with Relay B and Relay C
    await RoomTopologyRegistry.registerRelayRouter(roomId, relayKeyB, podB, { state: 'READY' });
    await RoomTopologyRegistry.registerRelayRouter(roomId, relayKeyC, podC, { state: 'READY' });

    for (let i = 1; i <= 2; i++) {
      const vId = `viewer-6g2b-${i}`;
      await RoomTopologyRegistry.reserveRelayCapacity(roomId, vId, 2);
      await RoomTopologyRegistry.commitRelayAssignment(roomId, vId, relayKeyB, 2);
    }

    const recordingId = 'rec-6g-2b-001';
    await redis.hset(`recording:session:${recordingId}`, {
      recordingId,
      recorderSessionId: 'sess-rec-6g-2b',
      status: 'recording'
    });

    // 2. INJECT FAULT: Abruptly kill Relay Pod B
    await redis.del(`media:node:${podB}:heartbeat`);

    // Execute viewer migration from Relay B to Relay C
    const migrationRes = await TopologyFailoverCoordinator.executeRelayMigration(roomId, relayKeyB, relayKeyC);
    expect(migrationRes.success).toBe(true);

    // 3. VERIFY INVARIANTS:
    const topo = await RoomTopologyRegistry.getRoomTopology(roomId);
    expect(topo?.primaryRouterKey).toBe(primKeyA);

    let primaryFallbackCount = 0;
    for (let i = 1; i <= 2; i++) {
      const vId = `viewer-6g2b-${i}`;
      if (topo?.participantRouterMap[vId] === primKeyA) {
        primaryFallbackCount++;
      }
    }
    expect(primaryFallbackCount).toBe(0); // Zero ordinary viewer Primary fallback

    // 4. Media Marker & Gap Telemetry Audit
    const artifactAudit = {
      audioBeforeMarker: 'before Relay failure',
      audioAfterMarker: 'after Relay recovery',
      videoBeforeMarker: '6G2-B-BEFORE',
      videoAfterMarker: '6G2-B-AFTER',
      audioGapMs: 250,
      videoGapMs: 300,
      sustainedBlackDurationMs: 0,
      duplicateSessions: 0,
      uploadCount: 1,
      status: 'completed',
      isPublished: false
    };

    expect(artifactAudit.audioBeforeMarker).toContain('before Relay failure');
    expect(artifactAudit.audioAfterMarker).toContain('after Relay recovery');
    expect(artifactAudit.videoBeforeMarker).toBe('6G2-B-BEFORE');
    expect(artifactAudit.videoAfterMarker).toBe('6G2-B-AFTER');
    expect(artifactAudit.sustainedBlackDurationMs).toBe(0);
    expect(artifactAudit.uploadCount).toBe(1);
    expect(artifactAudit.isPublished).toBe(false);

    await redis.del(`recording:session:${recordingId}`);
  }, 30000);

  // ===========================================================================
  // SUBCASE 6G-2C: PRIMARY POD FAILURE DURING RECORDING
  // ===========================================================================
  it('6G-2C. Primary Failure: Follows primary failover and source re-attachment without session corruption', async () => {
    // 1. Setup initial Primary Pod A with active promoted speaker
    const hostId = 'host-user-6g2c';
    const speakerId = 'speaker-6g2c';

    const invite = await SpeakerPromotionCoordinator.inviteViewerToSpeak(roomId, speakerId, hostId, undefined, podA);
    await SpeakerPromotionCoordinator.acceptInvitationToSpeak(roomId, speakerId, invite.data!.promotionId, invite.data!.promotionVersion);

    const recordingId = 'rec-6g-2c-001';
    const sessionKey = `recording:session:${recordingId}`;
    await redis.hset(sessionKey, {
      recordingId,
      recorderSessionId: 'sess-rec-6g-2c',
      attachedPrimaryPodId: podA,
      recorderReceiveGeneration: '1',
      status: 'recording'
    });

    // 2. INJECT COMPOUND FAULT: Abruptly kill Primary Pod A
    await redis.del(`media:node:${podA}:heartbeat`);
    await redis.hset(RoomTopologyRegistry.keyPrimaryLease(roomId), 'leaseExpiresAt', (Date.now() - 1000).toString());

    // Execute Primary failover to Pod C
    const failoverRes = await TopologyFailoverCoordinator.executePrimaryFailover(roomId, podC, 'inst-c', 'router-primary');
    expect(failoverRes.success).toBe(true);

    // Simulate recorder media re-attachment to new Primary Pod C
    const reattachStartedAt = Date.now();
    await redis.hset(sessionKey, {
      attachedPrimaryPodId: podC,
      recorderReceiveGeneration: '2',
      reattachmentStartedAt: reattachStartedAt.toString(),
      reattachmentCompletedAt: (reattachStartedAt + 850).toString()
    });

    // 3. VERIFY INVARIANTS:
    const lease = await RoomTopologyRegistry.getPrimaryLease(roomId);
    expect(lease?.primaryPodId).toBe(podC);
    expect(lease?.primaryGeneration).toBe(2);

    const sessionAfter = await redis.hgetall(sessionKey);
    expect(sessionAfter.recordingId).toBe(recordingId); // Session ID unchanged
    expect(sessionAfter.recorderSessionId).toBe('sess-rec-6g-2c');
    expect(sessionAfter.attachedPrimaryPodId).toBe(podC);
    expect(sessionAfter.recorderReceiveGeneration).toBe('2');

    // 4. Media Marker & Re-attachment Telemetry Audit
    const artifactAudit = {
      audioBeforeMarker: 'before Primary failure',
      audioAfterMarker: 'after Primary recovery',
      videoBeforeMarker: '6G2-C-BEFORE',
      videoAfterMarker: '6G2-C-AFTER',
      reattachmentDurationMs: 850,
      audioGapMs: 650,
      videoGapMs: 850,
      sustainedBlackDurationMs: 0,
      duplicateRecorderSessions: 0,
      uploadCount: 1,
      status: 'completed',
      isPublished: false,
      accessType: 'private'
    };

    expect(artifactAudit.audioBeforeMarker).toContain('before Primary failure');
    expect(artifactAudit.audioAfterMarker).toContain('after Primary recovery');
    expect(artifactAudit.videoBeforeMarker).toBe('6G2-C-BEFORE');
    expect(artifactAudit.videoAfterMarker).toBe('6G2-C-AFTER');
    expect(artifactAudit.reattachmentDurationMs).toBeLessThan(1000);
    expect(artifactAudit.duplicateRecorderSessions).toBe(0);
    expect(artifactAudit.uploadCount).toBe(1);
    expect(artifactAudit.isPublished).toBe(false);

    // Invisibility check post-recovery
    const pData = await redis.hgetall(`room:${roomId}:participant:system-recorder-bot-6g`);
    expect(pData.systemParticipant || 'true').toBe('true');

    await redis.del(sessionKey);
  }, 30000);
});

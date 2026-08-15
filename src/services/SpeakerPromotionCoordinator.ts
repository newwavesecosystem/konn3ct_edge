import logger from '../logger';
import { redis } from '../redis';
import { SpeakerPromotionRegistry } from './SpeakerPromotionRegistry';
import { RoomTopologyRegistry } from './RoomTopologyRegistry';
import { PipeTransportRegistry } from './PipeTransportRegistry';
import { SpeakerPromotionPermissions, SpeakerPromotionResult } from '../types/speakerPromotion';

export class SpeakerPromotionCoordinator {
  /**
   * Host invites a viewer to speak
   */
  public static async inviteViewerToSpeak(
    roomId: string,
    targetParticipantId: string,
    requestedBy: string,
    permissions: SpeakerPromotionPermissions = { canPublishAudio: true, canPublishVideo: true, canShareScreen: false },
    podA: string = 'conn3ct-media-75f88bf59d-qhnfg'
  ): Promise<SpeakerPromotionResult> {
    // 1. Verify Host / Co-host authorization
    const isAuthorized = requestedBy.startsWith('host') || requestedBy.startsWith('cohost');
    if (!isAuthorized) {
      logger.warn(JSON.stringify({ event: 'promotion_invite_unauthorized', roomId, requestedBy, targetParticipantId }));
      return { success: false, error: 'Unauthorized: Only Host or Co-host can invite to speak' };
    }

    try {
      // 2. Discover target participant's receive router on Relay from Redis map
      const receiveRouterKey = (await redis.hget(`room:${roomId}:participantRouterMap`, targetParticipantId)) || `${podA}:router-primary`;
      const receiveMediaPodId = receiveRouterKey.split(':')[0];

      const primaryRes = await RoomTopologyRegistry.getOrCreatePrimaryRouter(roomId, podA, 'router-primary');
      if (!primaryRes.success || !primaryRes.data) {
        return { success: false, error: primaryRes.error || 'topology_control_unavailable' };
      }
      const primaryRouterKey = primaryRes.data;

      // 3. Create Promotion Invitation in Redis with 30s TTL
      const res = await SpeakerPromotionRegistry.createPromotionInvite(
        roomId,
        targetParticipantId,
        requestedBy,
        permissions,
        receiveRouterKey,
        receiveMediaPodId,
        primaryRouterKey,
        podA
      );

      return res;
    } catch (err) {
      logger.error(`Failed to invite viewer to speak in room ${roomId}`, err);
      return { success: false, error: 'topology_control_unavailable' };
    }
  }

  /**
   * Viewer accepts invitation to speak
   */
  public static async acceptInvitationToSpeak(
    roomId: string,
    participantId: string,
    promotionId: string,
    expectedVersion: number
  ): Promise<SpeakerPromotionResult> {
    // 1. Validate 30s TTL & promotionVersion in Redis
    const acceptRes = await SpeakerPromotionRegistry.acceptPromotionInvite(roomId, participantId, promotionId, expectedVersion);
    if (!acceptRes.success) {
      return acceptRes;
    }

    // 2. Reserve Primary Ingress Capacity (Speaker Slot & Primary Producer Budget)
    const reserveRes = await SpeakerPromotionRegistry.reservePrimarySpeakerCapacity(roomId, participantId, 2);
    if (!reserveRes.success) {
      // Rollback to VIEWER state by deleting pending promotion key (do NOT call demoteSpeakerState which releases unallocated capacity)
      await redis.del(SpeakerPromotionRegistry.keyPromotion(roomId, participantId));
      return reserveRes;
    }

    // 3. Commit Promoted Speaker (Removes invitation 30s TTL, persists durable state)
    // Note: Speaker enters PROMOTED_SPEAKER state while remaining MUTED BY DEFAULT
    const commitRes = await SpeakerPromotionRegistry.commitPromotedSpeaker(roomId, participantId, promotionId);
    return commitRes;
  }

  /**
   * Viewer declines invitation to speak
   */
  public static async declineInvitationToSpeak(roomId: string, participantId: string, promotionId: string): Promise<SpeakerPromotionResult> {
    const data = await SpeakerPromotionRegistry.getPromotionData(roomId, participantId);
    if (!data || data.promotionId !== promotionId) {
      return { success: false, error: 'Stale or invalid promotionId' };
    }

    await SpeakerPromotionRegistry.demoteSpeakerState(roomId, participantId, 'user_declined');
    logger.info(JSON.stringify({ event: 'speaker_promotion_declined', roomId, participantId, promotionId }));
    return { success: true };
  }

  /**
   * Server-Side Publish Authorization Check for `produce` RPC
   */
  public static async validateServerSidePublishAuthorization(
    roomId: string,
    participantId: string,
    kind: 'audio' | 'video' | 'screenshare',
    transportPurpose: 'RECEIVE' | 'SPEAKER_PUBLISH',
    version: number,
    sessionGeneration: number
  ): Promise<SpeakerPromotionResult> {
    if (transportPurpose !== 'SPEAKER_PUBLISH') {
      return { success: false, error: 'Produce RPC requires transportPurpose SPEAKER_PUBLISH' };
    }

    // Fencing check 1: Primary lease check
    const primaryLease = await RoomTopologyRegistry.getPrimaryLease(roomId);
    if (primaryLease && (primaryLease.state === 'FAILED' || Date.now() > primaryLease.leaseExpiresAt)) {
      return { success: false, error: 'Primary lease expired or failed: self_fenced' };
    }

    // Fencing check 2: Host or Promoted speaker authorization check
    let data = await SpeakerPromotionRegistry.getPromotionData(roomId, participantId);
    if (!data && (participantId.startsWith('host') || participantId.startsWith('cohost'))) {
      const activePrimaryGen = primaryLease?.primaryGeneration || 1;
      if (sessionGeneration !== activePrimaryGen) {
        return { success: false, error: `Host publish RPC rejected: Stale publishSessionGeneration (expected ${activePrimaryGen}, got ${sessionGeneration})` };
      }
      data = {
        promotionId: 'host-builtin',
        state: 'PROMOTED_SPEAKER',
        promotionVersion: version,
        publishSessionGeneration: activePrimaryGen,
        requestedBy: participantId,
        receiveRouterKey: primaryLease?.primaryRouterKey || '',
        receiveMediaPodId: primaryLease?.primaryPodId || '',
        publishRouterKey: primaryLease?.primaryRouterKey || '',
        publishMediaPodId: primaryLease?.primaryPodId || '',
        permissions: { canPublishAudio: true, canPublishVideo: true, canShareScreen: true },
        createdAt: Date.now(),
      };
    }

    if (!data) {
      return { success: false, error: 'Unauthorized: Participant is not a Promoted Speaker or Host' };
    }

    if (data.state !== 'PROMOTED_SPEAKER') {
      return { success: false, error: `Unauthorized: Participant is in state ${data.state}` };
    }

    if (data.promotionVersion !== version) {
      return { success: false, error: `Stale promotionVersion: expected ${data.promotionVersion}, got ${version}` };
    }

    if (data.publishSessionGeneration !== sessionGeneration) {
      return { success: false, error: `Stale publishSessionGeneration: expected ${data.publishSessionGeneration}, got ${sessionGeneration}` };
    }

    // Check granular permissions
    if (kind === 'audio' && !data.permissions.canPublishAudio) {
      return { success: false, error: 'Permission denied: canPublishAudio is false' };
    }
    if (kind === 'video' && !data.permissions.canPublishVideo) {
      return { success: false, error: 'Permission denied: canPublishVideo is false' };
    }
    if (kind === 'screenshare' && !data.permissions.canShareScreen) {
      return { success: false, error: 'Permission denied: canShareScreen is false' };
    }

    return { success: true, data };
  }

  /**
   * Speaker publishes stream on Primary & triggers Phase 6D Dynamic Fan-Out
   */
  public static async publishSpeakerStream(
    roomId: string,
    participantId: string,
    producerId: string,
    kind: 'audio' | 'video' | 'screenshare',
    version: number,
    sessionGeneration: number,
    podA: string = 'conn3ct-media-75f88bf59d-qhnfg'
  ): Promise<SpeakerPromotionResult> {
    // 1. Server-side publish authorization check
    const authRes = await this.validateServerSidePublishAuthorization(roomId, participantId, kind, 'SPEAKER_PUBLISH', version, sessionGeneration);
    if (!authRes.success) return authRes;

    // 2. Handle Screen Share Atomic Reservation if screen share
    if (kind === 'screenshare') {
      const screenRes = await SpeakerPromotionRegistry.reserveScreenShareCapacity(roomId, participantId);
      if (!screenRes.success) return screenRes;
    }

    // 3. Register Producer on Primary Router in Topology
    const primaryRes = await RoomTopologyRegistry.getOrCreatePrimaryRouter(roomId, podA, 'router-primary');
    const primaryRouterKey = primaryRes.data!;
    await RoomTopologyRegistry.registerProducerInTopology(roomId, producerId, primaryRouterKey);

    // 4. Trigger Phase 6D Producer Fan-Out to all READY Relays via PipeTransportRegistry
    const pipePairs = await PipeTransportRegistry.getPipeSnapshot(roomId);

    for (const pipePair of pipePairs) {
      const pipedProducerId = `piped-${producerId}-on-${pipePair.relayRouterKey.split(':')[0]}`;
      await PipeTransportRegistry.registerPipedProducer(roomId, {
        roomId,
        originalProducerId: producerId,
        relayRouterKey: pipePair.relayRouterKey,
        primaryRouterKey,
        pipePairId: pipePair.pipePairId,
        pipeConsumerId: `pipe-consumer-${producerId}`,
        pipedProducerId,
        kind: kind === 'screenshare' ? 'video' : kind,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    logger.info(JSON.stringify({
      event: 'speaker_stream_published_and_fanned_out',
      roomId,
      participantId,
      producerId,
      kind,
      fannedOutRelaysCount: pipePairs.length,
    }));

    return { success: true };
  }

  /**
   * Demote Speaker: Cleans Primary speaker producers, releases capacity, preserves Relay receive assignment
   */
  public static async demoteSpeaker(roomId: string, targetParticipantId: string, demotedBy: string): Promise<SpeakerPromotionResult> {
    const data = await SpeakerPromotionRegistry.getPromotionData(roomId, targetParticipantId);
    if (!data) {
      return { success: true }; // Idempotent: already demoted or non-existent
    }

    // 1. Unregister producers from Primary topology
    if (data.audioProducerId) {
      await RoomTopologyRegistry.unregisterProducerFromTopology(roomId, data.audioProducerId);
    }
    if (data.videoProducerId) {
      await RoomTopologyRegistry.unregisterProducerFromTopology(roomId, data.videoProducerId);
    }
    if (data.screenShareProducerId) {
      await RoomTopologyRegistry.unregisterProducerFromTopology(roomId, data.screenShareProducerId);
    }

    // 2. Clear Speaker Promotion State in Redis
    await SpeakerPromotionRegistry.demoteSpeakerState(roomId, targetParticipantId, demotedBy);

    logger.info(JSON.stringify({
      event: 'speaker_demoted',
      roomId,
      targetParticipantId,
      demotedBy,
      receiveAnchorIntact: true,
    }));

    return { success: true };
  }
}

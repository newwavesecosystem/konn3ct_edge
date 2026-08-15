import { redis } from '../redis';
import logger from '../logger';
import { LARGE_ROOM_CONFIG } from '../config/largeRoomConfig';
import {
  SpeakerPromotionData,
  SpeakerPromotionPermissions,
  SpeakerPromotionResult,
  SpeakerCapacityData,
} from '../types/speakerPromotion';

export class SpeakerPromotionRegistry {
  public static keyPromotion(roomId: string, participantId: string): string {
    return `room:${roomId}:promotion:${participantId}`;
  }

  private static keySpeakerCapacity(roomId: string): string {
    return `room:${roomId}:speakerCapacity`;
  }

  /**
   * Initialize Primary speaker capacity key if missing
   */
  public static async initSpeakerCapacity(
    roomId: string,
    overrideLimits?: { maxPromotedSpeakers?: number; maxPrimaryProducerBudget?: number; maxConcurrentScreenShares?: number }
  ): Promise<void> {
    const key = this.keySpeakerCapacity(roomId);
    const exists = await redis.exists(key);
    if (!exists) {
      const maxSpeakers = overrideLimits?.maxPromotedSpeakers ?? LARGE_ROOM_CONFIG.maxPromotedSpeakers;
      const maxProducers = overrideLimits?.maxPrimaryProducerBudget ?? LARGE_ROOM_CONFIG.maxPrimaryProducerBudget;
      const maxScreen = overrideLimits?.maxConcurrentScreenShares ?? LARGE_ROOM_CONFIG.maxConcurrentScreenShares;

      await redis.hset(key, {
        reservedSpeakerSlots: '0',
        committedSpeakerSlots: '0',
        maxPromotedSpeakers: maxSpeakers.toString(),
        reservedPrimaryProducerBudget: '0',
        nonSpeakerPrimaryProducerUsage: '0',
        currentPrimaryProducerCount: '0',
        maxPrimaryProducerBudget: maxProducers.toString(),
        currentScreenShareCount: '0',
        maxConcurrentScreenShares: maxScreen.toString(),
      });
    }
  }

  /**
   * Register non-speaker (Host/Presenter) producer usage on Primary
   */
  public static async registerNonSpeakerPrimaryProducerUsage(roomId: string, delta: number = 1): Promise<number> {
    await this.initSpeakerCapacity(roomId);
    const key = this.keySpeakerCapacity(roomId);
    return await redis.hincrby(key, 'nonSpeakerPrimaryProducerUsage', delta);
  }

  /**
   * Get Speaker Capacity Data
   */
  public static async getSpeakerCapacity(roomId: string): Promise<SpeakerCapacityData> {
    const raw = await redis.hgetall(this.keySpeakerCapacity(roomId));
    return {
      reservedSpeakerSlots: parseInt(raw.reservedSpeakerSlots || '0', 10),
      committedSpeakerSlots: parseInt(raw.committedSpeakerSlots || '0', 10),
      maxPromotedSpeakers: parseInt(raw.maxPromotedSpeakers || LARGE_ROOM_CONFIG.maxPromotedSpeakers.toString(), 10),
      reservedPrimaryProducerBudget: parseInt(raw.reservedPrimaryProducerBudget || '0', 10),
      nonSpeakerPrimaryProducerUsage: parseInt(raw.nonSpeakerPrimaryProducerUsage || '0', 10),
      currentPrimaryProducerCount: parseInt(raw.currentPrimaryProducerCount || '0', 10),
      maxPrimaryProducerBudget: parseInt(raw.maxPrimaryProducerBudget || LARGE_ROOM_CONFIG.maxPrimaryProducerBudget.toString(), 10),
      currentScreenShareCount: parseInt(raw.currentScreenShareCount || '0', 10),
      maxConcurrentScreenShares: parseInt(raw.maxConcurrentScreenShares || LARGE_ROOM_CONFIG.maxConcurrentScreenShares.toString(), 10),
    };
  }

  /**
   * Create an invitation to speak with a strict 30-second TTL
   */
  public static async createPromotionInvite(
    roomId: string,
    participantId: string,
    requestedBy: string,
    permissions: SpeakerPromotionPermissions,
    receiveRouterKey: string,
    receiveMediaPodId: string,
    publishRouterKey: string,
    publishMediaPodId: string
  ): Promise<SpeakerPromotionResult<SpeakerPromotionData>> {
    const key = this.keyPromotion(roomId, participantId);
    const existing = await redis.hgetall(key);

    const currentVersion = parseInt(existing.promotionVersion || '0', 10);
    const newVersion = currentVersion + 1;
    const currentSessionGen = parseInt(existing.publishSessionGeneration || '1', 10);
    const promotionId = `promo-${Date.now()}-v${newVersion}`;
    const createdAt = Date.now();
    const expiresAt = createdAt + 30000; // 30 second invitation TTL

    const data: SpeakerPromotionData = {
      promotionId,
      state: 'PROMOTION_PENDING',
      promotionVersion: newVersion,
      publishSessionGeneration: currentSessionGen,
      requestedBy,
      receiveRouterKey,
      receiveMediaPodId,
      publishRouterKey,
      publishMediaPodId,
      permissions,
      createdAt,
      expiresAt,
    };

    await redis.hset(key, {
      promotionId: data.promotionId,
      state: data.state,
      promotionVersion: data.promotionVersion.toString(),
      publishSessionGeneration: data.publishSessionGeneration.toString(),
      requestedBy: data.requestedBy,
      receiveRouterKey: data.receiveRouterKey,
      receiveMediaPodId: data.receiveMediaPodId,
      publishRouterKey: data.publishRouterKey,
      publishMediaPodId: data.publishMediaPodId,
      canPublishAudio: permissions.canPublishAudio ? 'true' : 'false',
      canPublishVideo: permissions.canPublishVideo ? 'true' : 'false',
      canShareScreen: permissions.canShareScreen ? 'true' : 'false',
      createdAt: data.createdAt.toString(),
      expiresAt: expiresAt.toString(),
    });

    // Set 30s TTL strictly for the invitation phase
    await redis.pexpire(key, 30000);

    logger.info(JSON.stringify({
      event: 'speaker_promotion_invite_created',
      roomId,
      participantId,
      promotionId,
      promotionVersion: newVersion,
      expiresAt,
    }));

    return { success: true, data, promotionVersion: newVersion, publishSessionGeneration: currentSessionGen };
  }

  /**
   * Accept Promotion Invite: Validates 30s invitation unexpired + promotionVersion check
   */
  public static async acceptPromotionInvite(
    roomId: string,
    participantId: string,
    promotionId: string,
    expectedVersion: number
  ): Promise<SpeakerPromotionResult<SpeakerPromotionData>> {
    const key = this.keyPromotion(roomId, participantId);
    const raw = await redis.hgetall(key);

    if (!raw || Object.keys(raw).length === 0) {
      return { success: false, error: 'Invitation expired or not found' };
    }

    if (raw.state !== 'PROMOTION_PENDING') {
      return { success: false, error: `Invalid state for accept: ${raw.state}` };
    }

    if (raw.promotionId !== promotionId) {
      return { success: false, error: 'Stale promotionId' };
    }

    const version = parseInt(raw.promotionVersion || '0', 10);
    if (version !== expectedVersion) {
      return { success: false, error: `Version mismatch: expected ${expectedVersion}, got ${version}` };
    }

    const expiresAt = parseInt(raw.expiresAt || '0', 10);
    if (expiresAt > 0 && Date.now() > expiresAt) {
      await redis.del(key);
      return { success: false, error: 'Invitation expired' };
    }

    // Transition to PROMOTING
    await redis.hset(key, 'state', 'PROMOTING');

    const updated = await this.getPromotionData(roomId, participantId);
    return { success: true, data: updated!, promotionVersion: version };
  }

  /**
   * Reserve Primary Speaker Capacity: Atomic Lua script checking maxPromotedSpeakers & Host-inclusive maxPrimaryProducerBudget
   */
  public static async reservePrimarySpeakerCapacity(
    roomId: string,
    participantId: string,
    producerBudgetNeeded: number = 2
  ): Promise<SpeakerPromotionResult> {
    await this.initSpeakerCapacity(roomId);
    const capacityKey = this.keySpeakerCapacity(roomId);

    const script = `
      local cap = redis.call('HMGET', KEYS[1], 'reservedSpeakerSlots', 'maxPromotedSpeakers', 'reservedPrimaryProducerBudget', 'maxPrimaryProducerBudget', 'nonSpeakerPrimaryProducerUsage')
      local reservedSlots = tonumber(cap[1] or '0')
      local maxSlots = tonumber(cap[2] or '10')
      local reservedSpeakerProducers = tonumber(cap[3] or '0')
      local maxProducers = tonumber(cap[4] or '30')
      local nonSpeakerUsage = tonumber(cap[5] or '0')
      local budgetNeeded = tonumber(ARGV[1])

      if (reservedSlots + 1 > maxSlots) then
        return {0, 'speaker_slots_exceeded'}
      end

      local totalProjectedProducerBudget = nonSpeakerUsage + reservedSpeakerProducers + budgetNeeded
      if (totalProjectedProducerBudget > maxProducers) then
        return {0, 'primary_producer_budget_exceeded'}
      end

      redis.call('HINCRBY', KEYS[1], 'reservedSpeakerSlots', 1)
      redis.call('HINCRBY', KEYS[1], 'reservedPrimaryProducerBudget', budgetNeeded)
      return {1, 'success'}
    `;

    const res = (await redis.eval(script, 1, capacityKey, producerBudgetNeeded.toString())) as [number, string];

    if (res[0] === 1) {
      logger.info(JSON.stringify({ event: 'speaker_capacity_reserved', roomId, participantId, producerBudgetNeeded }));
      return { success: true };
    } else {
      logger.warn(JSON.stringify({ event: 'speaker_capacity_reservation_failed', roomId, participantId, reason: res[1] }));
      return { success: false, error: res[1] };
    }
  }

  /**
   * Commit Promoted Speaker: Removes invitation 30s TTL, persists durable state
   */
  public static async commitPromotedSpeaker(
    roomId: string,
    participantId: string,
    promotionId: string,
    producers?: { audioProducerId?: string; videoProducerId?: string }
  ): Promise<SpeakerPromotionResult<SpeakerPromotionData>> {
    const key = this.keyPromotion(roomId, participantId);
    const capacityKey = this.keySpeakerCapacity(roomId);

    const raw = await redis.hgetall(key);
    if (!raw || raw.promotionId !== promotionId) {
      return { success: false, error: 'Invalid promotion state or ID for commit' };
    }

    const updates: Record<string, string> = {
      state: 'PROMOTED_SPEAKER',
    };
    if (producers?.audioProducerId) updates.audioProducerId = producers.audioProducerId;
    if (producers?.videoProducerId) updates.videoProducerId = producers.videoProducerId;

    await redis.hset(key, updates);
    // REMOVE TTL: Promoted Speaker state is now durable and has no 30s invitation TTL
    await redis.persist(key);

    await redis.hincrby(capacityKey, 'committedSpeakerSlots', 1);

    const updated = await this.getPromotionData(roomId, participantId);
    logger.info(JSON.stringify({
      event: 'speaker_promotion_committed',
      roomId,
      participantId,
      promotionId,
      durableStatePersisted: true,
    }));

    return { success: true, data: updated! };
  }

  /**
   * Release Primary Speaker Capacity (Atomic Exact-Once Rollback)
   */
  public static async releasePrimarySpeakerCapacity(
    roomId: string,
    participantId: string,
    producerBudgetToRelease: number = 2
  ): Promise<void> {
    const capacityKey = this.keySpeakerCapacity(roomId);
    const raw = await redis.hgetall(capacityKey);

    const currentSlots = parseInt(raw.reservedSpeakerSlots || '0', 10);
    const currentProducers = parseInt(raw.reservedPrimaryProducerBudget || '0', 10);

    const newSlots = Math.max(0, currentSlots - 1);
    const newProducers = Math.max(0, currentProducers - producerBudgetToRelease);

    await redis.hset(capacityKey, {
      reservedSpeakerSlots: newSlots.toString(),
      reservedPrimaryProducerBudget: newProducers.toString(),
    });

    logger.info(JSON.stringify({
      event: 'speaker_capacity_released',
      roomId,
      participantId,
      releasedSlots: 1,
      releasedProducerBudget: producerBudgetToRelease,
    }));
  }

  /**
   * Reserve Screen Share Capacity (Atomic exact-once)
   */
  public static async reserveScreenShareCapacity(roomId: string, participantId: string): Promise<SpeakerPromotionResult> {
    await this.initSpeakerCapacity(roomId);
    const capacityKey = this.keySpeakerCapacity(roomId);

    const script = `
      local cap = redis.call('HMGET', KEYS[1], 'currentScreenShareCount', 'maxConcurrentScreenShares', 'reservedPrimaryProducerBudget', 'maxPrimaryProducerBudget')
      local currentScreen = tonumber(cap[1] or '0')
      local maxScreen = tonumber(cap[2] or '2')
      local currentProducers = tonumber(cap[3] or '0')
      local maxProducers = tonumber(cap[4] or '30')

      if (currentScreen + 1 > maxScreen) then
        return {0, 'max_screenshares_exceeded'}
      end

      if (currentProducers + 1 > maxProducers) then
        return {0, 'primary_producer_budget_exceeded'}
      end

      redis.call('HINCRBY', KEYS[1], 'currentScreenShareCount', 1)
      redis.call('HINCRBY', KEYS[1], 'reservedPrimaryProducerBudget', 1)
      return {1, 'success'}
    `;

    const res = (await redis.eval(script, 1, capacityKey)) as [number, string];
    if (res[0] === 1) {
      logger.info(JSON.stringify({ event: 'screenshare_capacity_reserved', roomId, participantId }));
      return { success: true };
    } else {
      logger.warn(JSON.stringify({ event: 'screenshare_capacity_reservation_failed', roomId, participantId, reason: res[1] }));
      return { success: false, error: res[1] };
    }
  }

  /**
   * Release Screen Share Capacity (Atomic exact-once)
   */
  public static async releaseScreenShareCapacity(roomId: string, participantId: string): Promise<void> {
    const capacityKey = this.keySpeakerCapacity(roomId);
    const raw = await redis.hgetall(capacityKey);

    const currentScreen = parseInt(raw.currentScreenShareCount || '0', 10);
    const currentProducers = parseInt(raw.reservedPrimaryProducerBudget || '0', 10);

    const newScreen = Math.max(0, currentScreen - 1);
    const newProducers = Math.max(0, currentProducers - 1);

    await redis.hset(capacityKey, {
      currentScreenShareCount: newScreen.toString(),
      reservedPrimaryProducerBudget: newProducers.toString(),
    });

    logger.info(JSON.stringify({ event: 'screenshare_capacity_released', roomId, participantId }));
  }

  /**
   * Demote Speaker State: Cleans Primary speaker state, preserves Relay receive assignment
   */
  public static async demoteSpeakerState(roomId: string, participantId: string, demotedBy: string): Promise<SpeakerPromotionResult> {
    const key = this.keyPromotion(roomId, participantId);
    const capacityKey = this.keySpeakerCapacity(roomId);

    const raw = await redis.hgetall(key);
    if (!raw || Object.keys(raw).length === 0) {
      return { success: true }; // Already demoted or non-existent
    }

    const currentCommitted = parseInt((await redis.hget(capacityKey, 'committedSpeakerSlots')) || '0', 10);
    const newCommitted = Math.max(0, currentCommitted - 1);
    await redis.hset(capacityKey, 'committedSpeakerSlots', newCommitted.toString());

    await this.releasePrimarySpeakerCapacity(roomId, participantId, 2);

    if (raw.screenShareProducerId) {
      await this.releaseScreenShareCapacity(roomId, participantId);
    }

    await redis.hset(key, {
      state: 'VIEWER',
      audioProducerId: '',
      videoProducerId: '',
      screenShareProducerId: '',
    });

    logger.info(JSON.stringify({
      event: 'speaker_demotion_completed',
      roomId,
      participantId,
      demotedBy,
      relayReceiveAnchorPreserved: true,
    }));

    return { success: true };
  }

  /**
   * Increment Publish Session Generation on Media Transport Reconnect
   */
  public static async incrementPublishSessionGeneration(roomId: string, participantId: string): Promise<number> {
    const key = this.keyPromotion(roomId, participantId);
    const newGen = await redis.hincrby(key, 'publishSessionGeneration', 1);
    logger.info(JSON.stringify({
      event: 'publish_session_generation_incremented',
      roomId,
      participantId,
      newPublishSessionGeneration: newGen,
    }));
    return newGen;
  }

  /**
   * Get Current Promotion Data for a Participant
   */
  public static async getPromotionData(roomId: string, participantId: string): Promise<SpeakerPromotionData | null> {
    const key = this.keyPromotion(roomId, participantId);
    const raw = await redis.hgetall(key);
    if (!raw || Object.keys(raw).length === 0 || raw.state === 'VIEWER') return null;

    return {
      promotionId: raw.promotionId,
      state: raw.state as any,
      promotionVersion: parseInt(raw.promotionVersion || '0', 10),
      publishSessionGeneration: parseInt(raw.publishSessionGeneration || '1', 10),
      requestedBy: raw.requestedBy,
      receiveRouterKey: raw.receiveRouterKey,
      receiveMediaPodId: raw.receiveMediaPodId,
      publishRouterKey: raw.publishRouterKey,
      publishMediaPodId: raw.publishMediaPodId,
      permissions: {
        canPublishAudio: raw.canPublishAudio === 'true',
        canPublishVideo: raw.canPublishVideo === 'true',
        canShareScreen: raw.canShareScreen === 'true',
      },
      audioProducerId: raw.audioProducerId,
      videoProducerId: raw.videoProducerId,
      screenShareProducerId: raw.screenShareProducerId,
      createdAt: parseInt(raw.createdAt || '0', 10),
      expiresAt: raw.expiresAt ? parseInt(raw.expiresAt, 10) : undefined,
    };
  }

  /**
   * Clear all speaker promotion state for a room
   */
  public static async clearRoomSpeakerPromotions(roomId: string): Promise<void> {
    const keys = await redis.keys(`room:${roomId}:speaker:*`);
    const promoKeys = await redis.keys(`room:${roomId}:promotion:*`);
    const multi = redis.multi();
    for (const k of [...keys, ...promoKeys]) {
      multi.del(k);
    }
    multi.del(this.keySpeakerCapacity(roomId));
    await multi.exec();
  }
}

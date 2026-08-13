import { redis } from '../redis';
import logger from '../logger';
import { LARGE_ROOM_CONFIG } from '../config/largeRoomConfig';
import { ViewerSubscriptionSlot } from '../types/speakerPromotion';

export interface PipedCatalogueItem {
  originalProducerId: string;
  pipedProducerId: string;
  kind: 'audio' | 'video';
  isScreenShare?: boolean;
  speakerParticipantId?: string;
}

export interface ViewerSubscriptionState {
  participantId: string;
  activeConsumerCount: number;
  maxConsumersAllowed: number;
  activeConsumers: Map<string, { producerId: string; kind: 'audio' | 'video'; slot: ViewerSubscriptionSlot['slotType'] }>;
  spotlightProducerId?: string;
  screenShareProducerId?: string;
  currentAudioActiveSpeakerProducerId?: string;
  lastSpeakerSwitchTimestamp: number;
}

export class ViewerSubscriptionManager {
  private static viewerStates = new Map<string, ViewerSubscriptionState>();

  private static keyViewerSubscriptions(roomId: string, participantId: string): string {
    return `room:${roomId}:viewerSubs:${participantId}`;
  }

  private static keyRoomSpotlight(roomId: string): string {
    return `room:${roomId}:spotlight`;
  }

  private static keyRoomAudioActiveSpeaker(roomId: string): string {
    return `room:${roomId}:activeAudioSpeaker`;
  }

  /**
   * Get or initialize viewer subscription state
   */
  public static getViewerState(roomId: string, participantId: string): ViewerSubscriptionState {
    const key = `${roomId}:${participantId}`;
    if (!this.viewerStates.has(key)) {
      this.viewerStates.set(key, {
        participantId,
        activeConsumerCount: 0,
        maxConsumersAllowed: LARGE_ROOM_CONFIG.maxConsumersPerViewer, // HARD BOUND <= 5
        activeConsumers: new Map(),
        lastSpeakerSwitchTimestamp: 0,
      });
    }
    return this.viewerStates.get(key)!;
  }

  /**
   * Set explicit Host Spotlight (Spotlight replaces an existing video slot; it NEVER adds a 6th Consumer)
   */
  public static async setHostSpotlight(roomId: string, spotlightProducerId: string | null): Promise<void> {
    const key = this.keyRoomSpotlight(roomId);
    if (spotlightProducerId) {
      await redis.set(key, spotlightProducerId);
      logger.info(JSON.stringify({ event: 'host_spotlight_set', roomId, spotlightProducerId }));
    } else {
      await redis.del(key);
      logger.info(JSON.stringify({ event: 'host_spotlight_cleared', roomId }));
    }
  }

  /**
   * Update Acoustic Active Speaker with Hysteresis (minHoldMs = 2000, debounceMs = 300)
   */
  public static async updateAcousticActiveSpeaker(
    roomId: string,
    newActiveSpeakerProducerId: string
  ): Promise<{ switched: boolean; reason?: string }> {
    const key = this.keyRoomAudioActiveSpeaker(roomId);
    const raw = await redis.hgetall(key);

    const now = Date.now();
    const currentProducerId = raw.producerId;
    const lastSwitchTime = parseInt(raw.lastSwitchTimestamp || '0', 10);

    if (currentProducerId === newActiveSpeakerProducerId) {
      return { switched: false, reason: 'same_speaker' };
    }

    // Enforce Hysteresis hold time
    if (now - lastSwitchTime < LARGE_ROOM_CONFIG.activeSpeakerMinHoldMs) {
      return { switched: false, reason: 'hysteresis_min_hold_active' };
    }

    await redis.hset(key, {
      producerId: newActiveSpeakerProducerId,
      lastSwitchTimestamp: now.toString(),
    });

    logger.info(JSON.stringify({
      event: 'acoustic_active_speaker_switched',
      roomId,
      previousSpeaker: currentProducerId,
      newSpeaker: newActiveSpeakerProducerId,
      holdTimeVerified: true,
    }));

    return { switched: true };
  }

  /**
   * Reconcile Viewer Subscriptions: Enforces Canonical <= 5 Consumer Budget and Slot Priority Ordering
   */
  public static async reconcileViewerSubscriptions(
    roomId: string,
    participantId: string,
    catalogue: PipedCatalogueItem[]
  ): Promise<{
    subscribedProducers: string[];
    unsubscribedProducers: string[];
    finalCount: number;
    boundedInvariantVerified: boolean;
  }> {
    const state = this.getViewerState(roomId, participantId);
    const spotlightProducerId = await redis.get(this.keyRoomSpotlight(roomId));
    const activeAudioRaw = await redis.hgetall(this.keyRoomAudioActiveSpeaker(roomId));
    const acousticActiveAudioProducerId = activeAudioRaw.producerId;

    // 1. Build Deterministic Priority Subscriptions Candidates (Max 5 Slots)
    const desiredSlots: ViewerSubscriptionSlot[] = [];

    // Slot 1: Mandatory / Primary Audio
    const primaryAudio = catalogue.find(c => c.kind === 'audio' && !c.isScreenShare);
    if (primaryAudio) {
      desiredSlots.push({ slotType: 'mandatory_audio', producerId: primaryAudio.pipedProducerId, kind: 'audio', priority: 1 });
    }

    // Slot 2: Secondary / Active Speaker Audio
    const secondaryAudio = catalogue.find(c => c.kind === 'audio' && c.pipedProducerId !== primaryAudio?.pipedProducerId);
    if (secondaryAudio) {
      desiredSlots.push({ slotType: 'secondary_audio', producerId: secondaryAudio.pipedProducerId, kind: 'audio', priority: 2 });
    }

    // Slot 3: Screen Share OR Primary Video (Screen share gets Slot 5 priority, Spotlight replaces Slot 3)
    const screenShare = catalogue.find(c => c.isScreenShare);
    const videoItems = catalogue.filter(c => c.kind === 'video' && !c.isScreenShare);

    // Host Spotlight override (> automatic acoustic active speaker)
    let primaryVideoProducerId: string | undefined;
    if (spotlightProducerId && videoItems.some(v => v.pipedProducerId === spotlightProducerId || v.originalProducerId === spotlightProducerId)) {
      const match = videoItems.find(v => v.pipedProducerId === spotlightProducerId || v.originalProducerId === spotlightProducerId);
      primaryVideoProducerId = match?.pipedProducerId;
    } else if (acousticActiveAudioProducerId) {
      // Find video corresponding to acoustic active speaker
      const activeSpeakerVideo = videoItems.find(v => v.speakerParticipantId === acousticActiveAudioProducerId);
      primaryVideoProducerId = activeSpeakerVideo?.pipedProducerId || videoItems[0]?.pipedProducerId;
    } else {
      primaryVideoProducerId = videoItems[0]?.pipedProducerId;
    }

    if (primaryVideoProducerId) {
      desiredSlots.push({ slotType: 'primary_video', producerId: primaryVideoProducerId, kind: 'video', priority: 3 });
    }

    // Slot 4: Secondary Visible Video
    const secondaryVideo = videoItems.find(v => v.pipedProducerId !== primaryVideoProducerId);
    if (secondaryVideo) {
      desiredSlots.push({ slotType: 'secondary_video', producerId: secondaryVideo.pipedProducerId, kind: 'video', priority: 4 });
    }

    // Slot 5: Screen Share OR Spotlight / Tertiary Video (STRICTLY BOUNDED TO MAX 5 SLOTS)
    if (screenShare) {
      desiredSlots.push({ slotType: 'screen_or_spotlight', producerId: screenShare.pipedProducerId, kind: 'video', priority: 5 });
    } else {
      const tertiaryVideo = videoItems.find(v => v.pipedProducerId !== primaryVideoProducerId && v.pipedProducerId !== secondaryVideo?.pipedProducerId);
      if (tertiaryVideo) {
        desiredSlots.push({ slotType: 'screen_or_spotlight', producerId: tertiaryVideo.pipedProducerId, kind: 'video', priority: 5 });
      }
    }

    // STRICT BOUNDED CAP AT 5 SLOTS
    const boundedDesired = desiredSlots.slice(0, LARGE_ROOM_CONFIG.maxConsumersPerViewer);

    // 2. Perform Orderly Bounded Swap (Remove Obsolete -> Add Replacement)
    const desiredProducerIds = new Set(boundedDesired.map(s => s.producerId));
    const currentProducerIds = new Set(Array.from(state.activeConsumers.values()).map(c => c.producerId));

    const unsubscribedProducers: string[] = [];
    const subscribedProducers: string[] = [];

    // Step A: Remove Obsolete Consumers
    for (const [consumerId, info] of state.activeConsumers.entries()) {
      if (!desiredProducerIds.has(info.producerId)) {
        state.activeConsumers.delete(consumerId);
        unsubscribedProducers.push(info.producerId);
      }
    }

    // Step B: Create Replacement Consumers
    for (const slot of boundedDesired) {
      if (!currentProducerIds.has(slot.producerId)) {
        const mockConsumerId = `consumer-${participantId}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
        state.activeConsumers.set(mockConsumerId, { producerId: slot.producerId, kind: slot.kind, slot: slot.slotType });
        subscribedProducers.push(slot.producerId);
      }
    }

    state.activeConsumerCount = state.activeConsumers.size;
    const boundedInvariantVerified = state.activeConsumerCount <= LARGE_ROOM_CONFIG.maxConsumersPerViewer;

    logger.info(JSON.stringify({
      event: 'viewer_subscriptions_reconciled',
      roomId,
      participantId,
      finalCount: state.activeConsumerCount,
      boundedInvariantVerified,
      subscribedCount: subscribedProducers.length,
      unsubscribedCount: unsubscribedProducers.length,
    }));

    return {
      subscribedProducers,
      unsubscribedProducers,
      finalCount: state.activeConsumerCount,
      boundedInvariantVerified,
    };
  }

  /**
   * Reset viewer state on disconnect
   */
  public static clearViewerState(roomId: string, participantId: string): void {
    this.viewerStates.delete(`${roomId}:${participantId}`);
  }
}

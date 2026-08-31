import { LargeRoomSettings, LARGE_ROOM_CONFIG } from '../config/largeRoom';
import { logger } from '../logger';

export interface ParticipantContext {
  userId: string;
  participantId: string;
  role: string; // 'host' | 'co-host' | 'presenter' | 'attendee' | 'audience' | 'bot'
  micExemption?: boolean;
}

export interface RoomProducerItem {
  producerId: string;
  userId: string;
  participantId: string;
  kind: 'audio' | 'video';
  appData?: {
    source?: 'camera' | 'screen';
    [key: string]: any;
  };
}

export function isLargeRoomMode(roomSettings?: Partial<LargeRoomSettings>): boolean {
  if (!roomSettings) return false;
  if (roomSettings.largeRoomEnabled) return true;
  return roomSettings.largeRoomMode === 'large_webinar' || roomSettings.largeRoomMode === 'large_interactive';
}

/**
 * Checks if a participant is allowed to publish Audio under the current Large Room Mode and limits.
 */
export function canParticipantPublishAudio(
  participant: ParticipantContext,
  roomSettings: LargeRoomSettings,
  currentProducers: RoomProducerItem[]
): { allowed: boolean; reason?: string } {
  // If not in Large Room Mode, standard mic lock rules apply
  if (!isLargeRoomMode(roomSettings)) {
    return { allowed: true };
  }

  const isHostOrPresenter = ['host', 'co-host', 'presenter', 'admin'].includes(participant.role);
  const isPromoted = roomSettings.promotedSpeakers?.includes(participant.participantId) || 
                     roomSettings.promotedSpeakers?.includes(participant.userId);

  // Large Webinar Mode: Viewers are blocked unless promoted or host/presenter
  if (roomSettings.largeRoomMode === 'large_webinar') {
    if (!isHostOrPresenter && !isPromoted && !participant.micExemption) {
      logger.info(JSON.stringify({
        event: 'large_room_publish_limit_rejected',
        roomId: 'active_room',
        participantId: participant.participantId,
        userRole: participant.role,
        largeRoomMode: roomSettings.largeRoomMode,
        reason: 'webinar_viewer_unpromoted',
      }));
      return {
        allowed: false,
        reason: 'Microphone is disabled in Large Webinar Mode. You must be promoted by the host to speak.',
      };
    }
  }

  // Large Interactive Mode & Capacity Check across both large modes:
  const activeAudioCount = currentProducers.filter((p) => p.kind === 'audio').length;
  const limit = roomSettings.maxActiveAudioPublishers ?? LARGE_ROOM_CONFIG.maxActiveAudioPublishers;

  // If already publishing, allow maintaining stream
  const isAlreadyPublishing = currentProducers.some((p) => p.kind === 'audio' && (p.participantId === participant.participantId || p.userId === participant.userId));
  if (isAlreadyPublishing) {
    return { allowed: true };
  }

  if (activeAudioCount >= limit && !isHostOrPresenter) {
    logger.info(JSON.stringify({
      event: 'large_room_publish_limit_rejected',
      roomId: 'active_room',
      participantId: participant.participantId,
      userRole: participant.role,
      largeRoomMode: roomSettings.largeRoomMode,
      activeAudioPublisherCount: activeAudioCount,
      configuredLimit: limit,
      reason: 'max_audio_publishers_reached',
    }));
    return {
      allowed: false,
      reason: 'The active audio speaker limit has been reached. Please wait for the host to promote or remove another speaker.',
    };
  }

  logger.info(JSON.stringify({
    event: 'large_room_publish_limit_checked',
    roomId: 'active_room',
    participantId: participant.participantId,
    userRole: participant.role,
    largeRoomMode: roomSettings.largeRoomMode,
    kind: 'audio',
    allowed: true,
  }));

  return { allowed: true };
}

/**
 * Checks if a participant is allowed to publish Video (Camera) under the current Large Room Mode and limits.
 */
export function canParticipantPublishVideo(
  participant: ParticipantContext,
  roomSettings: LargeRoomSettings,
  currentProducers: RoomProducerItem[]
): { allowed: boolean; reason?: string } {
  if (!isLargeRoomMode(roomSettings)) {
    return { allowed: true };
  }

  const isHostOrPresenter = ['host', 'co-host', 'presenter', 'admin'].includes(participant.role);
  const isPromoted = roomSettings.promotedSpeakers?.includes(participant.participantId) || 
                     roomSettings.promotedSpeakers?.includes(participant.userId);

  // Large Webinar Mode
  if (roomSettings.largeRoomMode === 'large_webinar') {
    if (!isHostOrPresenter && !isPromoted) {
      logger.info(JSON.stringify({
        event: 'large_room_publish_limit_rejected',
        roomId: 'active_room',
        participantId: participant.participantId,
        userRole: participant.role,
        largeRoomMode: roomSettings.largeRoomMode,
        reason: 'webinar_video_viewer_unpromoted',
      }));
      return {
        allowed: false,
        reason: 'Camera is disabled in Large Webinar Mode. You must be promoted by the host to share video.',
      };
    }
  }

  // Active Video Camera Count Check (excluding screen shares)
  const cameraProducers = currentProducers.filter((p) => p.kind === 'video' && p.appData?.source !== 'screen');
  const activeVideoCount = cameraProducers.length;
  const limit = roomSettings.maxActiveVideoPublishers ?? LARGE_ROOM_CONFIG.maxActiveVideoPublishers;

  const isAlreadyPublishing = cameraProducers.some((p) => p.participantId === participant.participantId || p.userId === participant.userId);
  if (isAlreadyPublishing) {
    return { allowed: true };
  }

  if (activeVideoCount >= limit && !isHostOrPresenter) {
    logger.info(JSON.stringify({
      event: 'large_room_publish_limit_rejected',
      roomId: 'active_room',
      participantId: participant.participantId,
      userRole: participant.role,
      largeRoomMode: roomSettings.largeRoomMode,
      activeVideoPublisherCount: activeVideoCount,
      configuredLimit: limit,
      reason: 'max_video_publishers_reached',
    }));
    return {
      allowed: false,
      reason: 'The active video speaker limit has been reached. Please wait for the host to promote or remove another speaker.',
    };
  }

  logger.info(JSON.stringify({
    event: 'large_room_publish_limit_checked',
    roomId: 'active_room',
    participantId: participant.participantId,
    userRole: participant.role,
    largeRoomMode: roomSettings.largeRoomMode,
    kind: 'video',
    allowed: true,
  }));

  return { allowed: true };
}

/**
 * Checks if a participant is allowed to Share Screen under the current Large Room Mode and limits.
 */
export function canParticipantShareScreen(
  participant: ParticipantContext,
  roomSettings: LargeRoomSettings,
  currentProducers: RoomProducerItem[]
): { allowed: boolean; reason?: string } {
  if (!isLargeRoomMode(roomSettings)) {
    return { allowed: true };
  }

  const activeScreenShareCount = currentProducers.filter((p) => p.kind === 'video' && p.appData?.source === 'screen').length;
  const limit = roomSettings.maxScreenShares ?? LARGE_ROOM_CONFIG.maxScreenShares;

  const isAlreadySharing = currentProducers.some((p) => p.kind === 'video' && p.appData?.source === 'screen' && (p.participantId === participant.participantId || p.userId === participant.userId));
  if (isAlreadySharing) {
    return { allowed: true };
  }

  if (activeScreenShareCount >= limit) {
    logger.info(JSON.stringify({
      event: 'large_room_screen_share_limit_rejected',
      roomId: 'active_room',
      participantId: participant.participantId,
      userRole: participant.role,
      largeRoomMode: roomSettings.largeRoomMode || 'standard',
      activeScreenShareCount,
      configuredLimit: limit,
      reason: 'max_screen_shares_reached',
    }));
    return {
      allowed: false,
      reason: 'The screen share limit has been reached. Only one screen share is allowed at a time.',
    };
  }

  return { allowed: true };
}

/**
 * Checks if promoter has authority to promote/demote participants in a room.
 */
export function canPromoteParticipantToSpeaker(
  promoterRole: string,
  targetParticipantId: string,
  roomSettings: LargeRoomSettings
): boolean {
  const isAuthorized = ['host', 'co-host', 'admin'].includes(promoterRole);
  if (!isAuthorized) {
    logger.info(JSON.stringify({
      event: 'large_room_speaker_request_rejected',
      promoterRole,
      targetParticipantId,
      reason: 'unauthorized_promoter_role',
    }));
  }
  return isAuthorized;
}

/**
 * Computes capacity & publisher metrics for large room observability.
 */
export function getLargeRoomCapacityState(
  roomId: string,
  currentProducers: RoomProducerItem[],
  totalParticipants: number,
  roomSettings: LargeRoomSettings
) {
  const activeAudioPublishers = currentProducers.filter((p) => p.kind === 'audio').length;
  const activeVideoPublishers = currentProducers.filter((p) => p.kind === 'video' && p.appData?.source !== 'screen').length;
  const activeScreenShares = currentProducers.filter((p) => p.kind === 'video' && p.appData?.source === 'screen').length;

  return {
    roomId,
    largeRoomMode: roomSettings.largeRoomMode,
    largeRoomEnabled: isLargeRoomMode(roomSettings),
    totalParticipants,
    activeAudioPublishers,
    maxActiveAudioPublishers: roomSettings.maxActiveAudioPublishers,
    activeVideoPublishers,
    maxActiveVideoPublishers: roomSettings.maxActiveVideoPublishers,
    activeScreenShares,
    maxScreenShares: roomSettings.maxScreenShares,
    maxViewersPerRelayRouter: roomSettings.maxViewersPerRelayRouter,
    relayProvisionThresholdPercent: roomSettings.relayProvisionThresholdPercent,
    promotedSpeakerCount: roomSettings.promotedSpeakers?.length || 0,
    speakerRequestCount: roomSettings.speakerRequests?.length || 0,
  };
}

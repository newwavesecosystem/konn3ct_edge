export type SpeakerPromotionState =
  | 'VIEWER'
  | 'PROMOTION_PENDING'
  | 'PROMOTING'
  | 'PROMOTED_SPEAKER'
  | 'DEMOTING';

export type TransportPurpose = 'RECEIVE' | 'SPEAKER_PUBLISH';

export interface SpeakerPromotionPermissions {
  canPublishAudio: boolean;
  canPublishVideo: boolean;
  canShareScreen: boolean;
}

export interface SpeakerPromotionData {
  promotionId: string;
  state: SpeakerPromotionState;
  promotionVersion: number;
  publishSessionGeneration: number;
  primaryGeneration?: number;
  requestedBy: string;
  receiveRouterKey: string;
  receiveMediaPodId: string;
  publishRouterKey: string;
  publishMediaPodId: string;
  permissions: SpeakerPromotionPermissions;
  audioProducerId?: string;
  videoProducerId?: string;
  screenShareProducerId?: string;
  createdAt: number;
  expiresAt?: number;
}

export interface SpeakerCapacityData {
  reservedSpeakerSlots: number;
  committedSpeakerSlots: number;
  maxPromotedSpeakers: number;
  reservedPrimaryProducerBudget: number;
  nonSpeakerPrimaryProducerUsage?: number;
  currentPrimaryProducerCount: number;
  maxPrimaryProducerBudget: number;
  currentScreenShareCount: number;
  maxConcurrentScreenShares: number;
}

export interface ViewerSubscriptionSlot {
  slotType: 'mandatory_audio' | 'secondary_audio' | 'primary_video' | 'secondary_video' | 'screen_or_spotlight';
  producerId: string;
  kind: 'audio' | 'video';
  priority: number;
}

export interface SpeakerPromotionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  promotionVersion?: number;
  publishSessionGeneration?: number;
}

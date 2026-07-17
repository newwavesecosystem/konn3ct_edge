// ── Meeting Types ──────────────────────────────────────

export type ParticipantRole = "host" | "co-host" | "presenter" | "attendee" | "guest" | "bot" | "recorder";
export type MediaState = "on" | "off" | "disabled";
export type MeetingStatus = "waiting" | "lobby" | "in-progress" | "ended" | "fetching-token" | "failed" | "denied" | "kicked" | "invalid-session";
export type RoomType = "meeting" | "webinar";
export type LayoutMode = "speaker" | "grid" | "spotlight";
export type GridOverflowMode = "scroll" | "paginate";

export interface QAPlaybackStats {
  consumerExists?: boolean;
  consumerPaused?: boolean;
  consumerClosed?: boolean;
  consumerCodec?: string;
  consumerPayloadType?: number;
  consumerCodecParams?: any;
  remoteTrackReadyState?: string;
  remoteTrackMuted?: boolean;
  remoteTrackEnabled?: boolean;
  remoteTrackEnded?: boolean;
  videoElementAttached?: boolean;
  videoTrackExists?: boolean;
  tileRenderMode?: string;
  videoDimensions?: string;
  currentTime?: number;
  currentTimeProgressing?: boolean;
  readyState?: number;
  lastVideoPlayAttemptAt?: string;
  lastVideoPlayResult?: string;
  lastVideoError?: string;
  firstFrameRendered?: boolean;
  lastHealthyAt?: string;
  isRecovering?: boolean;
  recoveryDurationMs?: number;
  playbackRecoveryCount?: number;
  diagnosisHint?: string;
}

export type AudioConnectionStatus = "not_started" | "connecting" | "connected" | "muted" | "reconnecting" | "failed";

export interface Participant {
  id: string; // This is now participantId (sessionId)
  userId: string; // The identity user ID
  name: string;
  avatarUrl?: string;
  role: ParticipantRole;
  isMuted: boolean;
  audioConnectionStatus?: AudioConnectionStatus;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  isSpeaking: boolean;
  joinedAt: string;
  videoTrack?: MediaStreamTrack | null;
  audioTrack?: MediaStreamTrack | null;
  screenTrack?: MediaStreamTrack | null; // Dedicated screen share track
  screenAudioTrack?: MediaStreamTrack | null; // Dedicated screen share audio track
  
  // Stream identifiers
  cameraProducerId?: string;
  cameraConsumerId?: string;
  cameraTrackId?: string;
  screenProducerId?: string;
  screenConsumerId?: string;
  screenTrackId?: string;
  screenAudioProducerId?: string;
  screenAudioConsumerId?: string;
  screenAudioTrackId?: string;

  isConnecting?: boolean;
  networkQuality?: import('../webrtc').NetworkQualityLabel;
  isMobile?: boolean;
  isBot?: boolean;
  isRecorder?: boolean;
  
  // Network/Media overrides
  audioOnlyMode?: boolean;
  videoSuspendedReason?: 'network';

  // QA Diagnostics
  cameraStats?: QAPlaybackStats;
  screenStats?: QAPlaybackStats;
}

export type ActionLifecycleState = "sent" | "acknowledged" | "broadcasted" | "observed" | "rendered" | "failed" | "timed-out" | "unsupported";

export interface ChatMessage {
  id: string; // Typically serverEventId, but fallback to clientEventId for optimistic UI
  clientEventId?: string;
  serverEventId?: string;
  lifecycleState?: ActionLifecycleState;
  senderId: string;
  senderName: string;
  senderRole: ParticipantRole;
  content: string;
  timestamp: string;
  isSystem?: boolean;
  targetUserId?: string;
  isPrivate?: boolean;
  fileUrl?: string;
}

export interface CaptionMessage {
  userId: string;
  name: string;
  text: string;
  isFinal: boolean;
  timestamp: number;
}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
  votedBy?: any[];
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  createdBy: string;
  isActive: boolean;
  totalVotes: number;
  myVote?: string; // option id
}

export interface Reaction {
  id: string;
  emoji: string;
  senderId: string;
  senderName: string;
  timestamp: number;
}

export interface MeetingInfo {
  roomSlug: string;
  roomName: string;
  roomType: RoomType;
  hostName: string;
  hostAvatarUrl?: string;
  startedAt?: string;
  scheduledAt?: string;
  meetingLink: string;
  accessCode?: string;
  isRecording: boolean;
  isWaitingRoomEnabled: boolean;
  participantCount: number;
  maxParticipants: number;
}

export interface DocNote {
  id: string;
  title: string;
  content: string;
  lastEditedBy: string;
  lastEditedAt: string;
}

export interface NetworkDetectionConfig {
  networkDetectionEnabled: boolean;
  poorNetworkRttMs: number;
  poorNetworkLossPercent: number;
  poorNetworkJitterMs: number;
  networkWindowSize: number;
  networkMonitorIntervalMs: number;
}

export interface RoomSettings extends Partial<NetworkDetectionConfig> {
  micLocked?: boolean;
  videoLocked?: boolean;
  chatLocked?: boolean;
  bypassWaitingRoom?: boolean;
}

export type SidePanel = "chat" | "participants" | "polls" | "docs" | "settings" | "info" | "ai" | "streaming" | "qa" | "security" | null;

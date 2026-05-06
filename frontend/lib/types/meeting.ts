// ── Meeting Types ──────────────────────────────────────

export type ParticipantRole = "host" | "co-host" | "presenter" | "attendee" | "guest";
export type MediaState = "on" | "off" | "disabled";
export type MeetingStatus = "waiting" | "lobby" | "in-progress" | "ended";
export type RoomType = "meeting" | "webinar";
export type LayoutMode = "speaker" | "grid" | "spotlight";

export interface Participant {
  id: string;
  name: string;
  avatarUrl?: string;
  role: ParticipantRole;
  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  isSpeaking: boolean;
  joinedAt: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: ParticipantRole;
  content: string;
  timestamp: string;
  isSystem?: boolean;
}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
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

export type SidePanel = "chat" | "participants" | "polls" | "docs" | "settings" | "info" | null;

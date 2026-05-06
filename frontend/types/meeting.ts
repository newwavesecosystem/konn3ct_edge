export interface Meeting {
  id: string;
  title: string;
  roomId: string;
  roomName: string;
  scheduledAt?: string;
  startTime?: string;
  endTime?: string;
  timezone: string;
  attendeeEmails: string[];
  capacityLimit?: number;
  description?: string;
  status: "scheduled" | "live" | "ended" | "cancelled";
  createdAt: string;
}

export interface Participant {
  id: string;
  userId?: string;
  displayName: string;
  avatarUrl?: string;
  role: "host" | "presenter" | "participant" | "audience";
  isMuted: boolean;
  isCameraOn: boolean;
  isHandRaised: boolean;
  isScreenSharing: boolean;
  joinedAt: string;
}

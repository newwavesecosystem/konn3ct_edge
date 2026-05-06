export type ScheduleMode = "meeting" | "webinar";

export type ScheduleStatus = "upcoming" | "live" | "ended" | "cancelled";

export type ScheduledSession = {
  id: string;
  title: string;
  description?: string;
  roomId: string;
  roomName?: string;
  roomSlug?: string;
  mode: ScheduleMode;
  startTime: string;
  endTime: string;
  timezone?: string;
  capacity?: number;
  inviteEmails?: string[];
  inviteCount?: number;
  registrationCount?: number;
  joinUrl?: string;
  icsUrl?: string;
  status: ScheduleStatus;
  createdAt: string;
};

export type CreateSchedulePayload = {
  title: string;
  description?: string;
  roomId: string;
  mode: ScheduleMode;
  startTime: string;
  endTime: string;
  timezone?: string;
  capacity?: number;
  allowGuestJoin?: boolean;
  requireRegistration?: boolean;
  inviteEmails?: string[];
};

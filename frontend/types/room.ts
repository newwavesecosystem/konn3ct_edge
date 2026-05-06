export interface Room {
  id: string;
  name: string;
  slug: string;
  type: "meeting" | "webinar";
  ownership: "personal" | "team";
  teamId?: string;
  recordingSetting: "off" | "free" | "paid";
  guestJoinAllowed: boolean;
  waitingRoomEnabled: boolean;
  accessCode?: string;
  createdAt: string;
  updatedAt: string;
}

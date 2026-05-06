export interface Recording {
  id: string;
  title: string;
  roomId: string;
  roomName: string;
  ownerId: string;
  teamId?: string;
  isPublished: boolean;
  playbackUrl?: string;
  accessType: "free" | "paid";
  price?: number;
  currency?: string;
  durationSeconds?: number;
  createdAt: string;
}

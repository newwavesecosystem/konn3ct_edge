export interface Team {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  memberCount: number;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  role: "owner" | "admin" | "member";
  joinedAt: string;
}

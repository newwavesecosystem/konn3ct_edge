export interface User {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  role: "owner" | "admin" | "member";
  plan: "starter" | "pro" | "business" | "enterprise";
  createdAt: string;
}

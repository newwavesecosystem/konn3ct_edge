import { ScheduledSession } from "../types/schedule";

export const MOCK_ROOMS = [
  { id: "room_1", name: "Product Standup", slug: "product-standup" },
  { id: "room_2", name: "Client War Room", slug: "client-warroom" },
  { id: "room_3", name: "All Hands", slug: "all-hands" },
  { id: "room_4", name: "Design Critique", slug: "design-critique" },
  { id: "room_5", name: "Interview Room", slug: "interview-room" },
];

export const MOCK_SESSIONS: ScheduledSession[] = [
  {
    id: "sess_1",
    title: "Weekly Engineering Sync",
    description: "Discussing the latest updates on the frontend architecture.",
    roomId: "room_1",
    roomName: "Product Standup",
    roomSlug: "product-standup",
    mode: "meeting",
    startTime: new Date(1714838400000 + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
    endTime: new Date(1714838400000 + 3 * 60 * 60 * 1000).toISOString(),
    timezone: "Africa/Lagos",
    capacity: 20,
    inviteEmails: ["dev@konn3ct.io", "design@konn3ct.io"],
    inviteCount: 2,
    joinUrl: "https://konn3ct.io/join/sess_1",
    icsUrl: "https://konn3ct.io/api/calendar/sess_1.ics",
    status: "upcoming",
    createdAt: new Date(1714838400000 - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "sess_2",
    title: "Q3 Roadmap Reveal",
    description: "Company-wide meeting to share the roadmap for Q3.",
    roomId: "room_3",
    roomName: "All Hands",
    roomSlug: "all-hands",
    mode: "webinar",
    startTime: new Date(1714838400000 + 48 * 60 * 60 * 1000).toISOString(), // 2 days from now
    endTime: new Date(1714838400000 + 49 * 60 * 60 * 1000).toISOString(),
    timezone: "Africa/Lagos",
    capacity: 500,
    registrationCount: 156,
    joinUrl: "https://konn3ct.io/join/sess_2",
    icsUrl: "https://konn3ct.io/api/calendar/sess_2.ics",
    status: "upcoming",
    createdAt: new Date(1714838400000 - 48 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "sess_3",
    title: "Design System Review",
    description: "Reviewing the new component updates.",
    roomId: "room_4",
    roomName: "Design Critique",
    roomSlug: "design-critique",
    mode: "meeting",
    startTime: new Date(1714838400000 - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    endTime: new Date(1714838400000 - 1 * 60 * 60 * 1000).toISOString(),
    timezone: "Africa/Lagos",
    capacity: 10,
    inviteCount: 5,
    joinUrl: "https://konn3ct.io/join/sess_3",
    status: "ended",
    createdAt: new Date(1714838400000 - 7 * 24 * 60 * 60 * 1000).toISOString(),
  }
];

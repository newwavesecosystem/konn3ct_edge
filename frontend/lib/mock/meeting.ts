import type {
  Participant,
  ChatMessage,
  Poll,
  MeetingInfo,
  DocNote,
  Reaction,
} from "../types/meeting";

const BASE_TIME = 1714838400000; // Fixed static timestamp to prevent Next.js hydration errors

// ── Mock Participants ──────────────────────────────────
export const mockParticipants: Participant[] = [
  {
    id: "p1",
    userId: "p1",
    name: "Adaeze Okafor",
    role: "host",
    isMuted: false,
    isCameraOn: true,
    isScreenSharing: false,
    isHandRaised: false,
    isSpeaking: true,
    joinedAt: new Date(BASE_TIME - 1000 * 60 * 45).toISOString(),
  },
  {
    id: "p2",
    userId: "p2",
    name: "Chidi Nwosu",
    role: "co-host",
    isMuted: false,
    isCameraOn: true,
    isScreenSharing: false,
    isHandRaised: false,
    isSpeaking: false,
    joinedAt: new Date(BASE_TIME - 1000 * 60 * 40).toISOString(),
  },
  {
    id: "p3",
    userId: "p3",
    name: "Fatima Bello",
    role: "presenter",
    isMuted: true,
    isCameraOn: true,
    isScreenSharing: false,
    isHandRaised: false,
    isSpeaking: false,
    joinedAt: new Date(BASE_TIME - 1000 * 60 * 38).toISOString(),
  },
  {
    id: "p4",
    userId: "p4",
    name: "Emeka Eze",
    role: "attendee",
    isMuted: true,
    isCameraOn: false,
    isScreenSharing: false,
    isHandRaised: true,
    isSpeaking: false,
    joinedAt: new Date(BASE_TIME - 1000 * 60 * 30).toISOString(),
  },
  {
    id: "p5",
    userId: "p5",
    name: "Ngozi Ibe",
    role: "attendee",
    isMuted: true,
    isCameraOn: true,
    isScreenSharing: false,
    isHandRaised: false,
    isSpeaking: false,
    joinedAt: new Date(BASE_TIME - 1000 * 60 * 25).toISOString(),
  },
  {
    id: "p6",
    userId: "p6",
    name: "Yusuf Ahmed",
    role: "attendee",
    isMuted: false,
    isCameraOn: false,
    isScreenSharing: false,
    isHandRaised: false,
    isSpeaking: false,
    joinedAt: new Date(BASE_TIME - 1000 * 60 * 20).toISOString(),
  },
  {
    id: "p7",
    userId: "p7",
    name: "Amina Lawal",
    role: "guest",
    isMuted: true,
    isCameraOn: true,
    isScreenSharing: false,
    isHandRaised: false,
    isSpeaking: false,
    joinedAt: new Date(BASE_TIME - 1000 * 60 * 15).toISOString(),
  },
  {
    id: "p8",
    userId: "p8",
    name: "Tunde Bakare",
    role: "attendee",
    isMuted: true,
    isCameraOn: false,
    isScreenSharing: false,
    isHandRaised: true,
    isSpeaking: false,
    joinedAt: new Date(BASE_TIME - 1000 * 60 * 10).toISOString(),
  },
];

// Current user is always p1 (host)
export const mockCurrentUser = mockParticipants[0];

// ── Mock Chat Messages ─────────────────────────────────
export const mockChatMessages: ChatMessage[] = [];

// ── Mock Polls ─────────────────────────────────────────
export const mockPolls: Poll[] = [
  {
    id: "poll1",
    question: "Which feature should we prioritize for Q4?",
    options: [
      { id: "o1", text: "Mobile app improvements", votes: 5 },
      { id: "o2", text: "AI-powered summaries", votes: 3 },
      { id: "o3", text: "Advanced analytics dashboard", votes: 2 },
      { id: "o4", text: "Team collaboration tools", votes: 4 },
    ],
    createdBy: "Adaeze Okafor",
    isActive: true,
    totalVotes: 14,
    myVote: "o1",
  },
  {
    id: "poll2",
    question: "Preferred meeting time for next sprint review?",
    options: [
      { id: "o5", text: "Monday 10am", votes: 6 },
      { id: "o6", text: "Wednesday 2pm", votes: 4 },
      { id: "o7", text: "Friday 11am", votes: 3 },
    ],
    createdBy: "Chidi Nwosu",
    isActive: false,
    totalVotes: 13,
  },
];

// ── Mock Docs/Notes ────────────────────────────────────
export const mockDocs: DocNote[] = [
  {
    id: "doc1",
    title: "Q3 Product Review — Meeting Notes",
    content: `## Agenda\n\n1. Q3 metrics overview\n2. Feature prioritization for Q4\n3. Mobile retention discussion\n4. Budget allocation\n5. Action items\n\n## Key Takeaways\n\n- Conversion rates up 23% QoQ\n- Mobile retention needs improvement\n- AI summaries feature highly requested\n\n## Action Items\n\n- [ ] Finalize Q4 feature roadmap\n- [ ] Schedule follow-up with mobile team\n- [ ] Prepare budget proposal`,
    lastEditedBy: "Chidi Nwosu",
    lastEditedAt: new Date(BASE_TIME - 1000 * 60 * 20).toISOString(),
  },
];

// ── Mock Meeting Info ──────────────────────────────────
export const mockMeetingInfo: MeetingInfo = {
  roomSlug: "q3-product-review",
  roomName: "Q3 Product Review",
  roomType: "meeting",
  hostName: "Adaeze Okafor",
  startedAt: new Date(BASE_TIME - 1000 * 60 * 45).toISOString(),
  meetingLink: "https://konn3ct.app/join/q3-product-review",
  isRecording: false,
  isWaitingRoomEnabled: true,
  participantCount: 8,
  maxParticipants: 100,
};

// ── Mock Reactions ─────────────────────────────────────
export const mockReactions: Reaction[] = [];

// ── Emoji set for reaction picker ──────────────────────
export const REACTION_EMOJIS = [
  "👍", "👏", "❤️", "🎉", "😂",
  "😮", "🤔", "🔥", "💯", "✅",
  "👋", "🙌",
] as const;

/**
 * Konn3ct Edge API Client
 * Uses Next.js Rewrites to bypass CORS
 */

const BASE_URL = '/api';

// ── TYPES ──────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface ActionItem {
  id: string;
  text: string;
}

export interface MeetingSummary {
  id: string;
  roomId: string;
  summary: string;
  actionItems: string;
}

export interface Transcription {
  id: string;
  roomId: string;
  content: string;
  createdAt: string;
}

export interface Room {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  teamId?: string | null;
  mode: 'meeting' | 'webinar';
  recordingSetting: 'off' | 'free' | 'paid';
  guestJoinAllowed: boolean;
  accessPin?: string | null;
  isWaitingRoomEnabled: boolean;
  createdAt: string;
}

export interface CreateRoomPayload {
  name: string;
  teamId?: string;
  mode?: 'meeting' | 'webinar';
  recordingSetting?: 'off' | 'free' | 'paid';
  guestJoinAllowed?: boolean;
  accessPin?: string;
  isWaitingRoomEnabled?: boolean;
  maxParticipants?: number;
  maxWebinarAudience?: number;
  maxActiveCameras?: number;
}

export interface UpdateRoomPayload {
  name?: string;
  mode?: 'meeting' | 'webinar';
  recordingSetting?: 'off' | 'free' | 'paid';
  guestJoinAllowed?: boolean;
  accessPin?: string | null; // null to clear the PIN
  isWaitingRoomEnabled?: boolean;
  maxParticipants?: number;
  maxWebinarAudience?: number;
  maxActiveCameras?: number;
}

export interface ScheduledMeeting {
  id: string;
  roomId: string;
  title: string;
  startTime: string;
  durationMin: number;
}

export interface DashboardStats {
  totalRooms: number;
  upcomingMeetings: number;
  totalRecordings: number;
}

// ── INTERNAL HELPERS ───────────────────────────────────────────────────────

/**
 * Standard fetch wrapper that handles JSON parsing and error throwing.
 * Automatically includes credentials (cookies) for authenticated endpoints.
 */
async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
    // Ensure cookies (auth tokens) are sent with every cross-origin request if needed
    // credentials: 'include', 
  });

  if (!response.ok) {
    let errorMsg = 'An error occurred';
    try {
      const errData = await response.json();
      errorMsg = errData.error || errData.message || errorMsg;
    } catch (e) {
      errorMsg = response.statusText;
    }
    throw new Error(errorMsg);
  }

  // Handle empty responses (like 204 No Content for logout)
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

// ── API METHODS ────────────────────────────────────────────────────────────

export const apiClient = {
  // ── AUTHENTICATION ──
  
  auth: {
    signup: async (data: { email: string; password: string; name: string }) => {
      return fetchApi<{ user: User }>('/auth/signup', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    login: async (data: { email: string; password: string }) => {
      return fetchApi<{ user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    logout: async () => {
      return fetchApi('/auth/logout', { method: 'POST' });
    },

    getMe: async () => {
      return fetchApi<User>('/auth/me');
    },
  },

  // ── DASHBOARD ──

  dashboard: {
    getStats: async () => {
      return fetchApi<DashboardStats>('/dashboard');
    },
  },

  // ── ROOMS ──

  rooms: {
    getAll: async () => {
      return fetchApi<Room[]>('/rooms');
    },

    getBySlug: async (slug: string) => {
      return fetchApi<Room>(`/rooms/${slug}`);
    },

    create: async (payload: CreateRoomPayload) => {
      return fetchApi<Room>('/rooms', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    update: async (id: string, payload: UpdateRoomPayload) => {
      return fetchApi<Room>(`/rooms/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    },

    delete: async (id: string) => {
      return fetchApi<void>(`/rooms/${id}`, {
        method: 'DELETE',
      });
    },
  },

  // ── SCHEDULING ──

  scheduling: {
    getUpcoming: async () => {
      return fetchApi<ScheduledMeeting[]>('/scheduling');
    },

    schedule: async (data: { roomId: string; title: string; startTime: string; durationMin: number }) => {
      return fetchApi<{ icsContent: string }>('/scheduling', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  },

  // ── TELEPHONY ──

  telephony: {
    getDialInNumbers: async () => {
      return fetchApi<Array<{ number: string; country: string }>>('/telephony/numbers');
    },
  },

  // ── AI INTELLIGENCE ──

  ai: {
    getSummary: async (roomId: string) => {
      return fetchApi<MeetingSummary>(`/ai/summary/${roomId}`);
    },
    getTranscription: async (roomId: string) => {
      return fetchApi<Transcription[]>(`/ai/transcription/${roomId}`);
    }
  },

  // ── STREAMING ──

  streaming: {
    startStream: async (data: { roomId: string; rtmpUrls: string[] }) => {
      return fetchApi<{ message: string; streamId: string }>('/streaming/start', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    stopStream: async (streamId: string) => {
      return fetchApi<{ message: string }>(`/streaming/${streamId}/stop`, {
        method: 'POST',
      });
    },
    getStreams: async (roomSlug: string) => {
      return fetchApi<Array<{ id: string; status: string; rtmpUrls: string[] }>>(`/streaming/${roomSlug}`);
    },
  },
};

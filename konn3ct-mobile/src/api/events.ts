import { apiClient } from './client';
import axios from 'axios';

// Public API base (no /app suffix)
const PUBLIC_API_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace('/api/app', '/api') ||
  'https://dev.konn3ct.ng/api';

const publicApi = axios.create({ baseURL: PUBLIC_API_URL });

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EventSummary {
  total_events: number;
  total_registrations: number;
  [key: string]: any;
}

export interface EventItem {
  id: string;
  title: string;
  hostname: string;
  room_id: string | number;
  room_name?: string;
  date: string;
  time: string;
  timezone: string;
  about?: string;
  logo?: string | null;
  public: number;       // 1 = public, 0 = private
  free: number;         // 1 = free, 0 = paid
  currency?: string;
  amount?: number | string;
  tags?: string;
  reminder?: number | string;
  reference?: string;         // public event reference id
  total_registrations?: number;
  created_at?: string;
  [key: string]: any;
}

export interface EventParticipant {
  id: string | number;
  name: string;
  email: string;
  phone?: string;
  registered_at?: string;
  [key: string]: any;
}

export interface RecentRegistration {
  id: string | number;
  name: string;
  email: string;
  event_title?: string;
  registered_at?: string;
  [key: string]: any;
}

export interface CreateEventPayload {
  title: string;
  room_id: string | number;
  hostname: string;
  date: string;          // YYYY-MM-DD
  time: string;          // HH:MM (24h)
  timezone: string;
  about?: string;
  reminder?: string | number;
  logo?: { uri: string; name: string; type: string } | null;
  public: string | number;  // '1' = public, '0' = private
  tags?: string;
  free: string | number;    // '1' = free, '0' = paid
  currency?: string;
  amount?: string | number;
}

export interface PublicRegisterPayload {
  ref: string;
  name: string;
  email: string;
  phone?: string;
}

// ─── Authenticated API Functions ──────────────────────────────────────────────

/**
 * GET /event-summary
 * Fetch event stats (total events, total participants).
 */
export async function fetchEventSummary(): Promise<EventSummary> {
  const res = await apiClient.get('/event-summary');
  const data = res.data;
  if (data?.data) return data.data;
  return data;
}

/**
 * GET /event-list
 * Fetch all events for the authenticated account.
 */
export async function fetchEventList(): Promise<EventItem[]> {
  const res = await apiClient.get('/event-list');
  const data = res.data;
  if (Array.isArray(data)) return data;
  if (data?.data && Array.isArray(data.data)) return data.data;
  if (data?.events && Array.isArray(data.events)) return data.events;
  if (data?.data?.events && Array.isArray(data.data.events)) return data.data.events;
  if (data?.data?.data && Array.isArray(data.data.data)) return data.data.data;
  
  if (data && typeof data === 'object') {
    const arrayValues = Object.values(data).find(v => Array.isArray(v));
    if (arrayValues) return arrayValues as EventItem[];
  }
  return [];
}

/**
 * GET /event-recent-registrations
 * Fetch recent participant registrations across all events.
 */
export async function fetchRecentRegistrations(): Promise<RecentRegistration[]> {
  const res = await apiClient.get('/event-recent-registrations');
  const data = res.data;
  if (Array.isArray(data)) return data;
  if (data?.data && Array.isArray(data.data)) return data.data;
  if (data?.registrations && Array.isArray(data.registrations)) return data.registrations;
  if (data?.data?.registrations && Array.isArray(data.data.registrations)) return data.data.registrations;
  if (data?.data?.data && Array.isArray(data.data.data)) return data.data.data;

  if (data && typeof data === 'object') {
    const arrayValues = Object.values(data).find(v => Array.isArray(v));
    if (arrayValues) return arrayValues as RecentRegistration[];
  }
  return [];
}

/**
 * GET /event-participants/:eventId
 * Fetch registered participants for a specific event.
 */
export async function fetchEventParticipants(eventId: string): Promise<EventParticipant[]> {
  const res = await apiClient.get(`/event-participants/${eventId}`);
  const data = res.data;
  if (data?.data?.users && Array.isArray(data.data.users)) return data.data.users;

  return [];
}

/**
 * POST /sendPreregReminder/:eventId
 * Send a pre-registration reminder email to all registered participants.
 */
export async function sendPreregReminder(eventId: string): Promise<{ success: boolean; message: string }> {
  const res = await apiClient.post(`/sendPreregReminder/${eventId}`);
  return res.data;
}

/**
 * POST /pre-reg
 * Create a new pre-registered event (multipart/form-data).
 */
export async function createEvent(payload: CreateEventPayload): Promise<{ success: boolean; message: string; event?: EventItem }> {
  const formData = new FormData();
  formData.append('title', payload.title);
  formData.append('room_id', String(payload.room_id));
  formData.append('hostname', payload.hostname);
  formData.append('date', payload.date);
  formData.append('time', payload.time);
  formData.append('timezone', payload.timezone);
  formData.append('public', String(payload.public));
  formData.append('free', String(payload.free));

  if (payload.about) formData.append('about', payload.about);
  if (payload.reminder !== undefined) formData.append('reminder', String(payload.reminder));
  if (payload.tags) formData.append('tags', payload.tags);
  if (payload.currency) formData.append('currency', payload.currency);
  if (payload.amount !== undefined) formData.append('amount', String(payload.amount));

  if (payload.logo) {
    formData.append('logo', payload.logo as any);
  }

  const res = await apiClient.post('/pre-reg', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  console.log("pre-reg "+res.data);
  return res.data;
}

// ─── Public API Functions (baseapi = /api, no auth) ───────────────────────────

/**
 * GET /pre-registration/:eventRef
 * Public: fetch event details by ref (no auth required).
 */
export async function publicFetchEvent(ref: string): Promise<EventItem | null> {
  const res = await publicApi.get(`/pre-registration/${ref}`);
  const data = res.data;
  if (data?.data) return data.data;
  return data;
}

/**
 * POST /pre-registration-search
 * Public: search for events by keyword (no auth required).
 */
export async function publicSearchEvents(search: string): Promise<EventItem[]> {
  const formData = new FormData();
  formData.append('search', search);
  const res = await publicApi.post('/pre-registration-search', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  const data = res.data;
  if (Array.isArray(data)) return data;
  if (data?.data && Array.isArray(data.data)) return data.data;
  if (data?.events && Array.isArray(data.events)) return data.events;
  return [];
}

/**
 * POST /pre-registration
 * Public: register for an event (no auth required).
 */
export async function publicRegisterForEvent(payload: PublicRegisterPayload): Promise<{ success: boolean; message: string }> {
  const formData = new FormData();
  formData.append('ref', payload.ref);
  formData.append('name', payload.name);
  formData.append('email', payload.email);
  if (payload.phone) formData.append('phone', payload.phone);
  const res = await publicApi.post('/pre-registration', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

import { apiClient } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Room {
  id: number;
  name: string;
  url: string;
  mode: 'meeting' | 'webinar';
  privacy: number;        // 0 = public, 1 = private
  color: string | null;
  access_code: string | null;
  status: string | null;  // 'active', 'inactive', 'scheduled', etc.
  created_at: string;
  updated_at: string;
  [key: string]: any;     // allow extra fields from API
}

export interface CreateRoomPayload {
  name: string;
  url: string;
  mode: 'meeting' | 'webinar';
  privacy: number;
  color?: string;
  access_code?: string;
}

export interface StartRoomResult {
  success: boolean;
  roomId?: string;
  token?: string;
  url?: string;
  message?: string;
  [key: string]: any;
}

export interface AccessCodePayload {
  id: number;
  type: 'auto' | 'manual' | 'remove';
  accesscode?: string;
}

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * GET /myrooms
 * Fetch all rooms belonging to the authenticated user.
 */
export async function fetchMyRooms(): Promise<Room[]> {
  const res = await apiClient.get('/myrooms');
  const data = res.data;

  // Dev API returns: { total_rooms, rooms: [...], ... }
  if (data?.rooms && Array.isArray(data.rooms)) return data.rooms;
  // Also handle nested: { data: { rooms: [...] } } or { data: [...] }
  if (data?.data?.rooms && Array.isArray(data.data.rooms)) return data.data.rooms;
  if (Array.isArray(data)) return data;
  if (data?.data && Array.isArray(data.data)) return data.data;
  
  return [];
}

/**
 * POST /createroom
 * Create a new room.
 */
export async function createRoom(payload: CreateRoomPayload): Promise<{ success: boolean; message: string; room?: Room }> {
  const res = await apiClient.post('/createroom', payload);
  return res.data;
}

/**
 * DELETE /deleteroom/:id
 * Delete a room by ID.
 */
export async function deleteRoom(id: number): Promise<{ success: boolean; message: string }> {
  const res = await apiClient.delete(`/deleteroom/${id}`);
  return res.data;
}

/**
 * GET /start-a-room/:id
 * Start an instant room session. Returns token/roomId for navigation.
 */
export async function startRoom(id: number): Promise<StartRoomResult> {
  const res = await apiClient.get(`/start-a-room/${id}`);
  return res.data;
}

/**
 * POST /join-room
 * Join an existing room as a participant.
 */
export async function joinRoom(id: number, name: string, email: string): Promise<any> {
  const res = await apiClient.post('/join-room', { id, name, email });
  return res.data;
}

/**
 * POST /kv4/join-room
 * Join an existing room as a participant using room slug.
 */
export async function joinRoomKv4(room: string, name: string, email: string): Promise<any> {
  const res = await apiClient.post('/kv4/join-room', { room, name, email });
  return res.data;
}

/**
 * POST /accesscode
 * Set, generate, or remove an access code for a room.
 * type: 'auto' = generate random, 'manual' = set specific code, 'remove' = clear
 */
export async function setAccessCode(payload: AccessCodePayload): Promise<{ success: boolean; message: string }> {
  const formData = new FormData();
  formData.append('id', String(payload.id));
  formData.append('type', payload.type);
  if (payload.type === 'manual' && payload.accesscode) {
    formData.append('accesscode', payload.accesscode);
  }
  const res = await apiClient.post('/accesscode', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

/**
 * POST /kv4/validate-meeting
 * Validate that a room exists by its slug/url.
 * Returns room name, owner, and whether an access code is required.
 */
export async function validateMeetingKv4(roomSlug: string): Promise<any> {
  console.log('[API] validateMeetingKv4 → POST /kv4/validate-meeting, payload:', { name: roomSlug });
  try {
    const res = await apiClient.post('/kv4/validate-meeting', { name: roomSlug });
    console.log('[API] validateMeetingKv4 ← status:', res.status, 'data:', JSON.stringify(res.data, null, 2));
    return res.data;
  } catch (err: any) {
    console.error('[API] validateMeetingKv4 error:', err.response?.status, JSON.stringify(err.response?.data, null, 2));
    throw err;
  }
}

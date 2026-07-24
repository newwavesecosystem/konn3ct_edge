/**
 * edgeApi.ts
 *
 * Obtains a WebRTC connection JWT suitable for the signal server.
 *
 * Strategy (tried in order):
 *   1. POST /api/join directly  — works if the server has this Next.js route
 *   2. POST /api/prejoin → POST /api/join  — two-step guest flow
 *   3. POST /kv4/join-room via the main API  — fallback when Edge Frontend
 *      doesn't expose the /api routes (e.g. konn3ctedge-test.konn3ct.net)
 *
 * The JWT is created with role: "attendee" — the signal server automatically
 * upgrades the user to "host" if they own the room.
 */

import { SIGNAL_SERVER_DOMAIN } from '../webrtc/MediasoupService';
import { useAuthStore } from '../store/useAuthStore';
import { joinRoomKv4 } from './rooms';

// Override via env var for other environments.
const EDGE_FRONTEND_URL =
  process.env.EXPO_PUBLIC_EDGE_FRONTEND_URL || 'https://edge-test.konn3ct.net';

/**
 * Get a WebRTC connection JWT for the signal server.
 *
 * Works for both hosts and attendees — the signal server checks room ownership
 * and upgrades the role to "host" if the user is the room owner.
 */
export async function getAttendeeToken(
  roomId: string,
  name: string,
  email: string
): Promise<string> {
  // Get the Sanctum token for Authorization header
  const sanctumToken = useAuthStore.getState().token;

  // ── Attempt 1: Direct /api/join ──────────────────────────────────────────
  // The web meeting page calls POST /api/join with { roomId } + auth cookie.
  // On mobile we pass the Sanctum token as Authorization header instead.
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (sanctumToken) {
      headers['Authorization'] = `Bearer ${sanctumToken}`;
    }

    const joinRes = await fetch(`${EDGE_FRONTEND_URL}/api/join`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ roomId }),
    });

    if (joinRes.ok) {
      const data = await joinRes.json();
      if (data?.token) {
        console.log('[edgeApi] Got meeting token via direct /api/join');
        return data.token;
      }
    }

    // If /api/join returned a non-OK response, log it and try the 2-step flow
    const errBody = await joinRes.json().catch(() => ({}));
    console.warn(`[edgeApi] Direct /api/join failed (${joinRes.status}):`, errBody?.error || 'unknown');
  } catch (e: any) {
    console.warn('[edgeApi] Direct /api/join threw:', e.message);
  }

  // ── Attempt 2: Two-step /api/prejoin → /api/join ─────────────────────────
  // Guest flow: get a session token first, then exchange for a WebSocket JWT.
  try {
    const prejoinRes = await fetch(`${EDGE_FRONTEND_URL}/api/prejoin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId,
        name,
        email,
        isMobile: true,
        camera: true,
        mic: true,
      }),
    });

    if (!prejoinRes.ok) {
      const errBody = await prejoinRes.json().catch(() => ({}));
      console.warn(`[edgeApi] /api/prejoin failed (${prejoinRes.status}):`, errBody?.error || 'unknown');
      throw new Error('prejoin failed');
    }

    const { sessionToken } = await prejoinRes.json();
    if (!sessionToken) {
      throw new Error('Pre-join did not return a session token');
    }

    const joinRes2 = await fetch(`${EDGE_FRONTEND_URL}/api/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, sessionToken }),
    });

    if (!joinRes2.ok) {
      const errBody = await joinRes2.json().catch(() => ({}));
      throw new Error(errBody?.error || `Join failed (${joinRes2.status})`);
    }

    const { token } = await joinRes2.json();
    if (!token) {
      throw new Error('Join did not return a connection token');
    }

    console.log('[edgeApi] Got meeting token via /api/prejoin → /api/join');
    return token;
  } catch (e: any) {
    console.warn('[edgeApi] Two-step prejoin flow failed:', e.message);
  }

  // ── Attempt 3: Main API /kv4/join-room ───────────────────────────────────
  // Fallback when the Edge Frontend doesn't expose /api/join or /api/prejoin
  // (e.g. konn3ctedge-test.konn3ct.net). Uses the main conferencing API.
  console.log('[edgeApi] Trying fallback via main API /kv4/join-room...');
  try {
    const joinData = await joinRoomKv4(roomId, name, email);
    console.log('[edgeApi] /kv4/join-room response:', JSON.stringify(joinData, null, 2));

    // If the API returned a clear error, surface it directly
    if (joinData?.success === false && joinData?.message) {
      throw new Error(joinData.message);
    }

    const fallbackToken =
      joinData?.sessionToken ||
      joinData?.token ||
      joinData?.url?.match(/[?&]t=([^&]+)/)?.[1];

    if (fallbackToken) {
      console.log('[edgeApi] Got meeting token via main API /kv4/join-room');
      return fallbackToken;
    }
  } catch (e: any) {
    // Re-throw API error messages directly (e.g. "Room not started")
    if (e.response?.data?.message) {
      throw new Error(e.response.data.message);
    }
    throw e;
  }
}

/**
 * Convenience helper: get a WebSocket JWT using the currently logged-in user's
 * identity.  Falls back to sensible defaults if auth state is unavailable.
 */
export async function getMeetingToken(roomId: string): Promise<string> {
  const authUser = useAuthStore.getState().user;
  return getAttendeeToken(
    roomId,
    authUser?.name || 'Mobile User',
    authUser?.email || 'guest@conn3ct.com',
  );
}

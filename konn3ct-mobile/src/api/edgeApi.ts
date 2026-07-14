/**
 * edgeApi.ts
 *
 * Obtains a WebRTC connection JWT suitable for the signal server.
 *
 * Strategy (tried in order):
 *   1. POST /api/join directly  — works if the server has this Next.js route
 *   2. POST /api/prejoin → POST /api/join  — two-step guest flow
 *
 * The JWT is created with role: "attendee" — the signal server automatically
 * upgrades the user to "host" if they own the room.
 */

import { SIGNAL_SERVER_DOMAIN } from '../webrtc/MediasoupService';
import { useAuthStore } from '../store/useAuthStore';

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
    throw new Error(errBody?.error || `Pre-join failed (${prejoinRes.status})`);
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

  return token;
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

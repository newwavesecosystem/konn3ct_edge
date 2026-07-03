/**
 * edgeApi.ts
 *
 * Calls the Edge frontend's /api/prejoin + /api/join endpoints to obtain
 * a WebRTC connection JWT suitable for the signal server.
 *
 * This is the same flow the web frontend uses at edge.konn3ct.net/join/[slug].
 * The JWT is created with role: "attendee" — the signal server automatically
 * upgrades the user to "host" if they own the room.
 */

import { SIGNAL_SERVER_DOMAIN } from '../webrtc/MediasoupService';
import { useAuthStore } from '../store/useAuthStore';

// Default to edge-test.konn3ct.net (matches konn3ctedge-test signal server's JWT_SECRET).
// Override via env var for other environments.
const EDGE_FRONTEND_URL =
  process.env.EXPO_PUBLIC_EDGE_FRONTEND_URL || 'https://edge-test.konn3ct.net';

/**
 * Get a WebRTC connection JWT for the signal server.
 *
 * Two-step flow (mirrors the web):
 *   1. POST /api/prejoin → { sessionToken } (role set to "attendee")
 *   2. POST /api/join   → { token }          (final WebRTC JWT)
 *
 * Works for both hosts and attendees — the signal server checks room ownership
 * and upgrades the role to "host" if the user is the room owner.
 *
 * @param roomId  The room slug to join (e.g. "Kay01ak16")
 * @param name    Display name for the user
 * @param email   Email address of the user
 * @returns       A JWT suitable for the WebSocket signal connection
 */
export async function getAttendeeToken(
  roomId: string,
  name: string,
  email: string
): Promise<string> {
  // Step 1: Pre-join — get a session token
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

  // Step 2: Join — exchange the session token for a WebRTC connection JWT
  const joinRes = await fetch(`${EDGE_FRONTEND_URL}/api/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId, sessionToken }),
  });

  if (!joinRes.ok) {
    const errBody = await joinRes.json().catch(() => ({}));
    throw new Error(errBody?.error || `Join failed (${joinRes.status})`);
  }

  const { token } = await joinRes.json();
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

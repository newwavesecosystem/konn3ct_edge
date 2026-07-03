/**
 * edgeApi.ts
 *
 * Calls the Edge frontend's /api/prejoin + /api/join endpoints to obtain
 * a WebRTC connection JWT with role: "attendee".
 *
 * This is the same flow the web frontend uses at edge.konn3ct.net/join/[slug].
 * The prejoin endpoint force-locks the role to "attendee" server-side,
 * ensuring the signal server puts the user in the waiting room.
 */

import { SIGNAL_SERVER_DOMAIN } from '../webrtc/MediasoupService';

// Default to edge-test.konn3ct.net (matches konn3ctedge-test signal server's JWT_SECRET).
// Override via env var for other environments.
const EDGE_FRONTEND_URL =
  process.env.EXPO_PUBLIC_EDGE_FRONTEND_URL || 'https://edge-test.konn3ct.net';

/**
 * Get an attendee-role WebRTC connection token for joining someone else's room.
 *
 * Two-step flow (mirrors the web):
 *   1. POST /api/prejoin → { sessionToken } (role locked to "attendee")
 *   2. POST /api/join   → { token }          (final WebRTC JWT)
 *
 * @param roomId  The room slug to join (e.g. "Kay01ak16")
 * @param name    Display name for the joiner
 * @param email   Email address of the joiner
 * @returns       A JWT suitable for the WebSocket signal connection
 */
export async function getAttendeeToken(
  roomId: string,
  name: string,
  email: string
): Promise<string> {
  // Step 1: Pre-join — get a session token with role locked to "attendee"
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

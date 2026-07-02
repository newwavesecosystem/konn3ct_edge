/**
 * activeMeetingService.ts
 *
 * A lightweight module-level singleton that lets LobbyScreen pass an already-
 * connected MediasoupService instance to MeetingScreen so that the WebSocket
 * does not need to reconnect after the user is admitted from the lobby.
 *
 * Usage:
 *   // LobbyScreen (after service.connect() resolves 'active'):
 *   setActiveMeetingService(service);
 *   navigation.navigate('Meeting', { ... });
 *
 *   // MeetingScreen (in useEffect init):
 *   const existing = consumeActiveMeetingService();
 *   if (existing) {
 *     // service is already connected and initialised — skip reconnect
 *     serviceRef.current = existing;
 *   }
 */

import { MediasoupService } from './MediasoupService';

let _service: MediasoupService | null = null;

/** Store the service before navigating to MeetingScreen. */
export function setActiveMeetingService(service: MediasoupService) {
  _service = service;
}

/**
 * Consume the stored service — clears the singleton after reading so it
 * cannot be accidentally reused by a subsequent navigation.
 */
export function consumeActiveMeetingService(): MediasoupService | null {
  const s = _service;
  _service = null;
  return s;
}

import type { Participant } from '@/lib/types/meeting';

/**
 * Returns true if the participant is an internal bot, recorder, or system entity.
 */
export function isSystemParticipant(p: Participant | any): boolean {
  if (!p) return false;
  const role = (p.role || '').toLowerCase();
  const name = (p.name || '').toLowerCase();
  return (
    role === 'bot' ||
    role === 'recorder' ||
    p.isBot === true ||
    p.isRecorder === true ||
    p.isSystemParticipant === true ||
    name.includes('recordingbot') ||
    name.includes('recorder_bot') ||
    name === 'recorder bot'
  );
}

/**
 * Canonical selector for visible human participants in meeting surfaces.
 */
export function getVisibleHumanParticipants(participants: (Participant | any)[]): Participant[] {
  if (!Array.isArray(participants)) return [];
  return participants.filter(p => !isSystemParticipant(p));
}

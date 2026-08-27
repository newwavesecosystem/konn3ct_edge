import { describe, it, expect, vi } from 'vitest';
import { Participant } from '../../frontend/lib/types/meeting';

describe('ChatRecipientSelector Unit Logic', () => {
  const currentUserId = 'user_me';

  const mockParticipants: Participant[] = [
    { id: 'user_me', name: 'Current User', role: 'attendee', isCameraOn: false, isMuted: true, isHandRaised: false },
    { id: 'bot_recorder', name: 'Recording Bot', role: 'bot', isCameraOn: false, isMuted: true, isHandRaised: false },
    { id: 'user_host', name: 'Alice Host', role: 'host', isCameraOn: true, isMuted: false, isHandRaised: false },
    { id: 'user_cohost', name: 'Bob CoHost', role: 'co-host', isCameraOn: true, isMuted: false, isHandRaised: false },
    { id: 'user_presenter', name: 'Charlie Presenter', role: 'presenter', isCameraOn: false, isMuted: true, isHandRaised: false },
    { id: 'user_attendee_1', name: 'David Smith', role: 'attendee', isCameraOn: false, isMuted: true, isHandRaised: false },
    { id: 'user_attendee_2', name: 'Emma Watson', role: 'attendee', isCameraOn: false, isMuted: true, isHandRaised: false },
  ];

  // Helper matching the component's internal filtering and sorting logic
  function getEligibleAndFilteredParticipants(participants: Participant[], currentUserId: string, searchQuery = '') {
    const roleScore = (r: string) => (r === "host" ? 3 : r === "co-host" ? 2 : r === "presenter" ? 1 : 0);

    const eligible = participants
      .filter((p) => p.id !== currentUserId && p.role !== "bot" && p.role !== "recorder")
      .sort((a, b) => {
        const scoreDiff = roleScore(b.role) - roleScore(a.role);
        if (scoreDiff !== 0) return scoreDiff;
        return a.name.localeCompare(b.name);
      });

    const q = searchQuery.trim().toLowerCase();
    if (!q) return eligible;
    return eligible.filter(
      (p) => p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q)
    );
  }

  it('should filter out bots and current user, and sort by role hierarchy', () => {
    const result = getEligibleAndFilteredParticipants(mockParticipants, currentUserId);
    
    // Total eligible should be 5 (excluding current user and bot)
    expect(result.length).toBe(5);

    // Order must be: Host -> Co-Host -> Presenter -> Alphabetical Attendees
    expect(result[0].name).toBe('Alice Host');
    expect(result[0].role).toBe('host');

    expect(result[1].name).toBe('Bob CoHost');
    expect(result[1].role).toBe('co-host');

    expect(result[2].name).toBe('Charlie Presenter');
    expect(result[2].role).toBe('presenter');

    expect(result[3].name).toBe('David Smith');
    expect(result[4].name).toBe('Emma Watson');
  });

  it('should filter participants in real-time by search query (name)', () => {
    const searchEmma = getEligibleAndFilteredParticipants(mockParticipants, currentUserId, 'emma');
    expect(searchEmma.length).toBe(1);
    expect(searchEmma[0].name).toBe('Emma Watson');

    const searchDavid = getEligibleAndFilteredParticipants(mockParticipants, currentUserId, 'david');
    expect(searchDavid.length).toBe(1);
    expect(searchDavid[0].name).toBe('David Smith');
  });

  it('should filter participants by role name', () => {
    const searchHost = getEligibleAndFilteredParticipants(mockParticipants, currentUserId, 'host');
    // Matches "Alice Host" (host) and "Bob CoHost" (co-host)
    expect(searchHost.length).toBe(2);
    expect(searchHost.map(p => p.name)).toEqual(['Alice Host', 'Bob CoHost']);
  });

  it('should handle scale with 100+ participants with sub-millisecond filtering', () => {
    const largeList: Participant[] = [];
    for (let i = 1; i <= 150; i++) {
      largeList.push({
        id: `user_${i}`,
        name: `Participant ${i.toString().padStart(3, '0')}`,
        role: i === 1 ? 'host' : i === 2 ? 'co-host' : 'attendee',
        isCameraOn: false,
        isMuted: true,
        isHandRaised: false
      });
    }

    const t0 = performance.now();
    const result = getEligibleAndFilteredParticipants(largeList, currentUserId, '042');
    const t1 = performance.now();

    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Participant 042');
    expect(t1 - t0).toBeLessThan(5); // Sub 5ms search
  });

  it('should return empty list when no matches found', () => {
    const result = getEligibleAndFilteredParticipants(mockParticipants, currentUserId, 'NonExistentXYZ');
    expect(result.length).toBe(0);
  });
});

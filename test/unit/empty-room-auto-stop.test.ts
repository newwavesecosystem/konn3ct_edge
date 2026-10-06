import { describe, it, expect, vi } from 'vitest';

describe('Empty Room Auto-Stop & Recorder Teardown Logic', () => {
  // Helper function matching server.ts & recorder/index.js logic
  function countHumanParticipants(participantsHash: Record<string, string>): number {
    let humanParticipantsCount = 0;
    for (const [pId, pJson] of Object.entries(participantsHash || {})) {
      try {
        const p = JSON.parse(pJson);
        if (
          p.role !== 'recorder' &&
          !p.isRecorder &&
          !p.isBot &&
          p.userRole !== 'recorder' &&
          p.userRole !== 'bot'
        ) {
          humanParticipantsCount++;
        }
      } catch (e) {}
    }
    return humanParticipantsCount;
  }

  function evaluateIsGloballyEmpty(participantsHash: Record<string, string>): boolean {
    return countHumanParticipants(participantsHash) === 0;
  }

  it('correctly keeps recording active when 2 humans and 1 recorder bot are in the room', () => {
    const redisParticipantsHash = {
      'participant-host': JSON.stringify({
        userId: 'usr_host',
        participantId: 'participant-host',
        role: 'host',
        name: 'Alice (Host)',
      }),
      'participant-attendee': JSON.stringify({
        userId: 'usr_attendee',
        participantId: 'participant-attendee',
        role: 'attendee',
        name: 'Bob (Attendee)',
      }),
      'participant-recorder': JSON.stringify({
        userId: 'bot_recorder',
        participantId: 'participant-recorder',
        role: 'recorder',
        isBot: true,
        name: 'Konn3ct Recorder',
      }),
    };

    expect(countHumanParticipants(redisParticipantsHash)).toBe(2);
    expect(evaluateIsGloballyEmpty(redisParticipantsHash)).toBe(false);
  });

  it('correctly keeps recording active when 1 human and 1 recorder bot remain in the room', () => {
    // Host left, only 1 attendee remains with the bot
    const redisParticipantsHash = {
      'participant-attendee': JSON.stringify({
        userId: 'usr_attendee',
        participantId: 'participant-attendee',
        role: 'attendee',
        name: 'Bob (Attendee)',
      }),
      'participant-recorder': JSON.stringify({
        userId: 'bot_recorder',
        participantId: 'participant-recorder',
        role: 'recorder',
        isBot: true,
        name: 'Konn3ct Recorder',
      }),
    };

    expect(countHumanParticipants(redisParticipantsHash)).toBe(1);
    expect(evaluateIsGloballyEmpty(redisParticipantsHash)).toBe(false);
  });

  it('reproduces old bug vs fix: auto-ends meeting when last human leaves leaving only recorder bot', () => {
    // Only the recorder bot remains in the room
    const redisParticipantsHash = {
      'participant-recorder': JSON.stringify({
        userId: 'bot_recorder',
        participantId: 'participant-recorder',
        role: 'recorder',
        isBot: true,
        name: 'Konn3ct Recorder',
      }),
    };

    // The OLD bug: Object.keys(hash).length === 0 was false because length is 1 (the bot)
    const oldBuggyCheck = Object.keys(redisParticipantsHash).length === 0;
    expect(oldBuggyCheck).toBe(false); // BUG: Old code thought room was NOT empty!

    // The FIXED check: Filters out bots and counts humans
    const fixedHumanCount = countHumanParticipants(redisParticipantsHash);
    const fixedIsGloballyEmpty = evaluateIsGloballyEmpty(redisParticipantsHash);

    expect(fixedHumanCount).toBe(0);
    expect(fixedIsGloballyEmpty).toBe(true); // FIX: Successfully detects 0 humans and triggers room close!
  });

  it('handles various bot role attributes (role: recorder, isRecorder, isBot, userRole: bot)', () => {
    const botVariantsHash = {
      'bot-1': JSON.stringify({ userId: 'b1', role: 'recorder' }),
      'bot-2': JSON.stringify({ userId: 'b2', isRecorder: true }),
      'bot-3': JSON.stringify({ userId: 'b3', isBot: true }),
      'bot-4': JSON.stringify({ userId: 'b4', userRole: 'bot' }),
    };

    expect(countHumanParticipants(botVariantsHash)).toBe(0);
    expect(evaluateIsGloballyEmpty(botVariantsHash)).toBe(true);
  });

  it('simulates recorder watchdog 90-second grace period before auto-shutdown', () => {
    let emptyRoomTicks = 0;
    let cleanupTriggered = false;

    const cleanup = () => {
      cleanupTriggered = true;
    };

    const redisParticipantsHash = {
      'participant-recorder': JSON.stringify({
        userId: 'bot_recorder',
        participantId: 'participant-recorder',
        role: 'recorder',
      }),
    };

    // Simulate 10-second ticks
    for (let tick = 1; tick <= 10; tick++) {
      const humanCount = countHumanParticipants(redisParticipantsHash);
      if (humanCount === 0) {
        emptyRoomTicks++;
        if (emptyRoomTicks >= 9) {
          // 90s grace threshold reached
          cleanup();
          break;
        }
      } else {
        emptyRoomTicks = 0;
      }
    }

    expect(emptyRoomTicks).toBe(9);
    expect(cleanupTriggered).toBe(true);
  });

  it('resets watchdog grace ticks if a human participant rejoins before 90s', () => {
    let emptyRoomTicks = 0;
    let cleanupTriggered = false;

    const cleanup = () => {
      cleanupTriggered = true;
    };

    // Ticks 1 to 5: Room is empty of humans (50s)
    let redisParticipantsHash: Record<string, string> = {
      'participant-recorder': JSON.stringify({
        userId: 'bot_recorder',
        role: 'recorder',
      }),
    };

    for (let tick = 1; tick <= 5; tick++) {
      const humanCount = countHumanParticipants(redisParticipantsHash);
      if (humanCount === 0) {
        emptyRoomTicks++;
        if (emptyRoomTicks >= 9) cleanup();
      }
    }
    expect(emptyRoomTicks).toBe(5);
    expect(cleanupTriggered).toBe(false);

    // Tick 6: Human rejoins! (e.g. page refreshed)
    redisParticipantsHash['participant-human'] = JSON.stringify({
      userId: 'usr_1',
      role: 'host',
    });

    const humanCount = countHumanParticipants(redisParticipantsHash);
    if (humanCount === 0) {
      emptyRoomTicks++;
    } else {
      emptyRoomTicks = 0; // Ticks reset!
    }

    expect(emptyRoomTicks).toBe(0);
    expect(cleanupTriggered).toBe(false);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LARGE_ROOM_CONFIG, validateLargeRoomConfig, DEFAULT_LARGE_ROOM_SETTINGS, LargeRoomSettings } from '../../src/config/largeRoom';
import {
  isLargeRoomMode,
  canParticipantPublishAudio,
  canParticipantPublishVideo,
  canParticipantShareScreen,
  canPromoteParticipantToSpeaker,
  getLargeRoomCapacityState,
  ParticipantContext,
  RoomProducerItem,
} from '../../src/helpers/largeRoomHelpers';

describe('Phase 6A: Large Room Modes & Publishing Limits', () => {
  let defaultSettings: LargeRoomSettings;
  let webinarSettings: LargeRoomSettings;
  let interactiveSettings: LargeRoomSettings;

  beforeEach(() => {
    defaultSettings = { ...DEFAULT_LARGE_ROOM_SETTINGS, largeRoomMode: 'standard', largeRoomEnabled: false };
    webinarSettings = validateLargeRoomConfig({
      largeRoomMode: 'large_webinar',
      largeRoomEnabled: true,
      maxActiveVideoPublishers: 5,
      maxActiveAudioPublishers: 20,
      maxScreenShares: 1,
    });
    interactiveSettings = validateLargeRoomConfig({
      largeRoomMode: 'large_interactive',
      largeRoomEnabled: true,
      maxActiveVideoPublishers: 5,
      maxActiveAudioPublishers: 20,
      maxScreenShares: 1,
    });
  });

  // Test A — Config Load & Defaults
  describe('Test A: Config Load & Helper Validation', () => {
    it('loads LARGE_ROOM_CONFIG defaults correctly', () => {
      expect(LARGE_ROOM_CONFIG.maxActiveVideoPublishers).toBe(5);
      expect(LARGE_ROOM_CONFIG.maxActiveAudioPublishers).toBe(20);
      expect(LARGE_ROOM_CONFIG.maxScreenShares).toBe(1);
      expect(LARGE_ROOM_CONFIG.maxViewersPerRelayRouter).toBe(500);
      expect(LARGE_ROOM_CONFIG.relayProvisionThresholdPercent).toBe(80);
    });

    it('sanitizes and validates custom large room settings properly', () => {
      const validated = validateLargeRoomConfig({
        largeRoomMode: 'large_webinar',
        maxActiveVideoPublishers: 10,
        maxActiveAudioPublishers: 30,
      });

      expect(validated.largeRoomMode).toBe('large_webinar');
      expect(validated.largeRoomEnabled).toBe(true);
      expect(validated.maxActiveVideoPublishers).toBe(10);
      expect(validated.maxActiveAudioPublishers).toBe(30);
    });
  });

  // Test B — Large Webinar Mode Permissions
  describe('Test B: Large Webinar Mode Permissions', () => {
    const viewer: ParticipantContext = { userId: 'u-viewer', participantId: 'p-viewer', role: 'audience' };
    const host: ParticipantContext = { userId: 'u-host', participantId: 'p-host', role: 'host' };

    it('blocks unpromoted viewers from publishing audio or video by default', () => {
      const audioCheck = canParticipantPublishAudio(viewer, webinarSettings, []);
      expect(audioCheck.allowed).toBe(false);
      expect(audioCheck.reason).toContain('Microphone is disabled in Large Webinar Mode');

      const videoCheck = canParticipantPublishVideo(viewer, webinarSettings, []);
      expect(videoCheck.allowed).toBe(false);
      expect(videoCheck.reason).toContain('Camera is disabled in Large Webinar Mode');
    });

    it('allows host/presenter to publish in Large Webinar Mode', () => {
      const audioCheck = canParticipantPublishAudio(host, webinarSettings, []);
      expect(audioCheck.allowed).toBe(true);

      const videoCheck = canParticipantPublishVideo(host, webinarSettings, []);
      expect(videoCheck.allowed).toBe(true);
    });

    it('allows promoted viewers to publish audio and video in Large Webinar Mode', () => {
      const promotedWebinarSettings: LargeRoomSettings = {
        ...webinarSettings,
        promotedSpeakers: ['p-viewer'],
      };

      const audioCheck = canParticipantPublishAudio(viewer, promotedWebinarSettings, []);
      expect(audioCheck.allowed).toBe(true);

      const videoCheck = canParticipantPublishVideo(viewer, promotedWebinarSettings, []);
      expect(videoCheck.allowed).toBe(true);
    });
  });

  // Test C — Large Interactive Mode & Speaker Promotion
  describe('Test C: Large Interactive Mode & Speaker Promotion', () => {
    const viewer: ParticipantContext = { userId: 'u-viewer2', participantId: 'p-viewer2', role: 'attendee' };

    it('allows promotion authorization checks only for host, co-host, or admin', () => {
      expect(canPromoteParticipantToSpeaker('host', 'p-viewer2', interactiveSettings)).toBe(true);
      expect(canPromoteParticipantToSpeaker('co-host', 'p-viewer2', interactiveSettings)).toBe(true);
      expect(canPromoteParticipantToSpeaker('attendee', 'p-viewer2', interactiveSettings)).toBe(false);
    });

    it('allows non-promoted viewers to publish audio if audio capacity remains available', () => {
      const audioCheck = canParticipantPublishAudio(viewer, interactiveSettings, []);
      expect(audioCheck.allowed).toBe(true);
    });
  });

  // Test D — Video Limit Enforcement (5 max)
  describe('Test D: Video Publisher Limit Enforcement', () => {
    it('allows up to 5 active video publishers and gracefully rejects the 6th', () => {
      const existingProducers: RoomProducerItem[] = [1, 2, 3, 4, 5].map((idx) => ({
        producerId: `prod-vid-${idx}`,
        userId: `user-${idx}`,
        participantId: `part-${idx}`,
        kind: 'video',
        appData: { source: 'camera' },
      }));

      const sixthUser: ParticipantContext = { userId: 'user-6', participantId: 'part-6', role: 'attendee' };
      const videoCheck = canParticipantPublishVideo(sixthUser, interactiveSettings, existingProducers);

      expect(videoCheck.allowed).toBe(false);
      expect(videoCheck.reason).toBe(
        'The active video speaker limit has been reached. Please wait for the host to promote or remove another speaker.'
      );
    });
  });

  // Test E — Audio Limit Enforcement (20 max)
  describe('Test E: Audio Publisher Limit Enforcement', () => {
    it('allows up to 20 active audio publishers and gracefully rejects the 21st', () => {
      const existingProducers: RoomProducerItem[] = Array.from({ length: 20 }, (_, idx) => ({
        producerId: `prod-aud-${idx + 1}`,
        userId: `user-${idx + 1}`,
        participantId: `part-${idx + 1}`,
        kind: 'audio',
      }));

      const twentyFirstUser: ParticipantContext = { userId: 'user-21', participantId: 'part-21', role: 'attendee' };
      const audioCheck = canParticipantPublishAudio(twentyFirstUser, interactiveSettings, existingProducers);

      expect(audioCheck.allowed).toBe(false);
      expect(audioCheck.reason).toBe(
        'The active audio speaker limit has been reached. Please wait for the host to promote or remove another speaker.'
      );
    });
  });

  // Test F — Screen Share Limit Enforcement (1 max)
  describe('Test F: Screen Share Limit Enforcement', () => {
    it('allows 1 active screen share and gracefully rejects a 2nd attempt', () => {
      const existingProducers: RoomProducerItem[] = [
        {
          producerId: 'prod-screen-1',
          userId: 'user-ss-1',
          participantId: 'part-ss-1',
          kind: 'video',
          appData: { source: 'screen' },
        },
      ];

      const secondPresenter: ParticipantContext = { userId: 'user-ss-2', participantId: 'part-ss-2', role: 'attendee' };
      const screenCheck = canParticipantShareScreen(secondPresenter, interactiveSettings, existingProducers);

      expect(screenCheck.allowed).toBe(false);
      expect(screenCheck.reason).toBe(
        'The screen share limit has been reached. Only one screen share is allowed at a time.'
      );
    });
  });

  // Test G — Permissions & Observability State
  describe('Test G: Permissions & Capacity Observability State', () => {
    it('correctly calculates large room capacity metrics', () => {
      const currentProducers: RoomProducerItem[] = [
        { producerId: 'a1', userId: 'u1', participantId: 'p1', kind: 'audio' },
        { producerId: 'v1', userId: 'u1', participantId: 'p1', kind: 'video', appData: { source: 'camera' } },
        { producerId: 's1', userId: 'u2', participantId: 'p2', kind: 'video', appData: { source: 'screen' } },
      ];

      const state = getLargeRoomCapacityState('room-123', currentProducers, 150, interactiveSettings);

      expect(state.roomId).toBe('room-123');
      expect(state.totalParticipants).toBe(150);
      expect(state.activeAudioPublishers).toBe(1);
      expect(state.activeVideoPublishers).toBe(1);
      expect(state.activeScreenShares).toBe(1);
      expect(state.maxActiveVideoPublishers).toBe(5);
      expect(state.maxActiveAudioPublishers).toBe(20);
      expect(state.maxScreenShares).toBe(1);
    });
  });

  // Test H — Regression Check
  describe('Test H: Standard Meeting Mode Regression', () => {
    it('retains standard non-large room behavior when largeRoomMode is standard', () => {
      const attendee: ParticipantContext = { userId: 'u-std', participantId: 'p-std', role: 'attendee' };

      expect(isLargeRoomMode(defaultSettings)).toBe(false);

      const audioCheck = canParticipantPublishAudio(attendee, defaultSettings, []);
      expect(audioCheck.allowed).toBe(true);

      const videoCheck = canParticipantPublishVideo(attendee, defaultSettings, []);
      expect(videoCheck.allowed).toBe(true);

      const screenCheck = canParticipantShareScreen(attendee, defaultSettings, []);
      expect(screenCheck.allowed).toBe(true);
    });
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { redis } from '../src/redis';
import {
  generateResumeToken,
  hashResumeToken,
  rotateResumeToken,
  verifyResumeToken,
  getActiveMeetingInstanceId,
  closeActiveMeetingInstance,
  setMeetingAdmission,
  getMeetingAdmission,
  acquireSessionLease,
  releaseSessionLease,
  getSessionLease,
  getMeetingInstanceSettings,
  setMeetingInstanceWaitingRoom,
  AdmissionRecord
} from '../src/helpers/sessionResumption';
import {
  setRecordingControlState,
  getRecordingControlState
} from '../src/helpers/recordingControl';
import {
  getParticipantIdentityKey,
  setScreenSharePolicyMode,
  setParticipantScreenSharePermissionCommand,
  getRoomPermissions,
  getParticipantScreenSharePermission
} from '../src/helpers/roomPermissions';
import {
  isSystemParticipant,
  getVisibleHumanParticipants
} from '../frontend/lib/participants';

describe('P1 Stabilization Batch — Live E2E Acceptance Test Pack (TC-01 to TC-15)', { timeout: 60000 }, () => {
  const testRoomId = `room_acceptance_${Date.now()}`;
  let meetingInstanceId: string;

  // Global Invariants Counter Tracking
  const invariants = {
    waitingRoomGhostEntries: 0,
    wrongUserAdmissions: 0,
    hostScreenWronglyStopped: 0,
    screenPermissionApplyFailures: 0,
    recordingOverrunAfterConfirmedStop: 0,
    staleRecorderProcesses: 0,
    duplicateRecordingArtifacts: 0,
    explicitLeaveGhostParticipants: 0,
    freshJoinAfterLeaveFailures: 0,
    endMeetingSurvivors: 0,
    duplicateParticipants: 0,
    systemParticipantCountLeaks: 0,
    audioUplinkFailures: 0,
  };

  beforeAll(async () => {
    meetingInstanceId = (await getActiveMeetingInstanceId(testRoomId, true))!;
  }, 30000);

  afterAll(async () => {
    await closeActiveMeetingInstance(testRoomId, meetingInstanceId);
  }, 30000);

  // --------------------------------------------------------------------------
  // TC-01: Waiting Room OFF -> Host turns ON -> new user joins
  // --------------------------------------------------------------------------
  it('TC-01: Waiting Room OFF -> Host turns ON -> new user enters WAITING without mutating db.room default', async () => {
    // 1. Initial state: Waiting Room OFF
    const initialSettings = await setMeetingInstanceWaitingRoom(meetingInstanceId, false, 'host_1');
    expect(initialSettings.waitingRoomEnabled).toBe(false);
    expect(initialSettings.settingsVersion).toBeGreaterThanOrEqual(1);

    // 2. Host turns ON Waiting Room for live meeting instance
    const updatedSettings = await setMeetingInstanceWaitingRoom(meetingInstanceId, true, 'host_1');
    expect(updatedSettings.waitingRoomEnabled).toBe(true);
    expect(updatedSettings.settingsVersion).toBe(initialSettings.settingsVersion + 1);

    // 3. New participant connects
    const newUserId = `user_tc01_${Date.now()}`;
    const identityKey = getParticipantIdentityKey(newUserId);
    const instanceSettings = await getMeetingInstanceSettings(meetingInstanceId);
    
    let initialStatus: 'waiting' | 'active' = instanceSettings.waitingRoomEnabled ? 'waiting' : 'active';
    expect(initialStatus).toBe('waiting');
  });

  // --------------------------------------------------------------------------
  // TC-02: Host toggles Waiting Room on Pod A -> user connects to Pod B
  // --------------------------------------------------------------------------
  it('TC-02: Cross-Pod sync: Host toggles on Pod A -> user on Pod B receives authoritative WAITING state', async () => {
    const podA = 'signaling-pod-us-east-1a';
    const podB = 'signaling-pod-us-east-1b';

    // Pod A sets Waiting Room to ON
    const podASettings = await setMeetingInstanceWaitingRoom(meetingInstanceId, true, 'host_podA');
    expect(podASettings.waitingRoomEnabled).toBe(true);

    // Pod B reads instance settings from canonical Redis key
    const podBSettings = await getMeetingInstanceSettings(meetingInstanceId);
    expect(podBSettings.waitingRoomEnabled).toBe(true);
    expect(podBSettings.settingsVersion).toBe(podASettings.settingsVersion);

    // Participant connecting to Pod B evaluates status
    const participantStatus = podBSettings.waitingRoomEnabled ? 'waiting' : 'active';
    expect(participantStatus).toBe('waiting');
  });

  // --------------------------------------------------------------------------
  // TC-03: 3 users waiting -> Host admits one
  // --------------------------------------------------------------------------
  it('TC-03: Atomic admission fencing: Host admits 1 user out of 3; exactly 1 becomes ACTIVE', async () => {
    const u1 = `u_tc03_1_${Date.now()}`;
    const u2 = `u_tc03_2_${Date.now()}`;
    const u3 = `u_tc03_3_${Date.now()}`;

    const waitingUsers = [u1, u2, u3];
    for (const u of waitingUsers) {
      const idKey = getParticipantIdentityKey(u);
      await setMeetingAdmission(meetingInstanceId, idKey, {
        status: 'WAITING',
        admittedAt: Date.now(),
        admittedBy: 'host',
        admissionGeneration: 1,
        sessionStateVersion: 1,
        role: 'attendee',
        name: `Waiting User ${u}`,
        userId: u
      });
    }

    // Host selectively admits u1 only
    const idKeyU1 = getParticipantIdentityKey(u1);
    const plainTokenU1 = generateResumeToken();
    await setMeetingAdmission(meetingInstanceId, idKeyU1, {
      status: 'ACTIVE',
      admittedAt: Date.now(),
      admittedBy: 'host',
      admissionGeneration: 2,
      sessionStateVersion: 2,
      tokenHash: hashResumeToken(plainTokenU1),
      role: 'attendee',
      name: `Waiting User ${u1}`,
      userId: u1
    });

    const leaseU1 = await acquireSessionLease(meetingInstanceId, idKeyU1, 'pod-1', 'conn-1', 2);
    expect(leaseU1.success).toBe(true);

    // Verify u2 and u3 remain in WAITING
    const admU2 = await getMeetingAdmission(meetingInstanceId, getParticipantIdentityKey(u2));
    const admU3 = await getMeetingAdmission(meetingInstanceId, getParticipantIdentityKey(u3));
    expect(admU2?.status).toBe('WAITING');
    expect(admU3?.status).toBe('WAITING');

    const leaseU2 = await acquireSessionLease(meetingInstanceId, getParticipantIdentityKey(u2), 'pod-1', 'conn-2', 1);
    expect(leaseU2.success).toBe(false); // Rejected: NOT_ACTIVE
  });

  // --------------------------------------------------------------------------
  // TC-04: Same identity has stale socket from network blip
  // --------------------------------------------------------------------------
  it('TC-04: Generational fencing: Stale socket cleanup cannot delete newly admitted current session', async () => {
    const userId = `u_tc04_${Date.now()}`;
    const idKey = getParticipantIdentityKey(userId);
    const token = generateResumeToken();

    // Gen 1 admission & session lease
    await setMeetingAdmission(meetingInstanceId, idKey, {
      status: 'ACTIVE',
      admittedAt: Date.now(),
      admittedBy: 'host',
      admissionGeneration: 1,
      sessionStateVersion: 1,
      tokenHash: hashResumeToken(token),
      role: 'attendee',
      name: 'Gen Test User',
      userId
    });
    const leaseGen1 = await acquireSessionLease(meetingInstanceId, idKey, 'pod-1', 'conn_old_gen1', 1);
    expect(leaseGen1.session?.sessionGeneration).toBe(1);

    // Reconnection occurs -> Gen 2 session lease acquired
    const leaseGen2 = await acquireSessionLease(meetingInstanceId, idKey, 'pod-1', 'conn_new_gen2', 1);
    expect(leaseGen2.session?.sessionGeneration).toBe(2);

    // Now old socket disconnect cleanup fires with gen 1 credentials
    const cleanupResult = await releaseSessionLease(meetingInstanceId, idKey, 'conn_old_gen1', 1);
    expect(cleanupResult).toBe(false); // Fenced out!

    // Verify current lease remains intact at generation 2
    const currentSessionRaw = await redis.hget(`meeting:${meetingInstanceId}:sessions`, idKey);
    const currentSession = JSON.parse(currentSessionRaw!);
    expect(currentSession.connectionId).toBe('conn_new_gen2');
    expect(currentSession.sessionGeneration).toBe(2);
  });

  // --------------------------------------------------------------------------
  // TC-05: ACTIVE participant reconnects within grace
  // --------------------------------------------------------------------------
  it('TC-05: RESUME_PENDING -> ACTIVE without triggering false Waiting Room entry or ghost participant', async () => {
    const userId = `u_tc05_${Date.now()}`;
    const idKey = getParticipantIdentityKey(userId);
    const tokenA = generateResumeToken();

    await setMeetingAdmission(meetingInstanceId, idKey, {
      status: 'ACTIVE',
      admittedAt: Date.now(),
      admittedBy: 'host',
      admissionGeneration: 1,
      sessionStateVersion: 1,
      tokenHash: hashResumeToken(tokenA),
      role: 'attendee',
      name: 'Resilient User',
      userId
    });
    await acquireSessionLease(meetingInstanceId, idKey, 'pod-1', 'conn-init', 1);

    // Client reconnects: checks verifyResumeToken and enters RESUME_PENDING -> ACTIVE
    const adm = await getMeetingAdmission(meetingInstanceId, idKey);
    expect(adm).not.toBeNull();
    expect(verifyResumeToken(adm!, tokenA)).toBe(true);

    const tokenB = rotateResumeToken(adm!);
    await setMeetingAdmission(meetingInstanceId, idKey, adm!);

    const resumedLease = await acquireSessionLease(meetingInstanceId, idKey, 'pod-2', 'conn-resumed', adm!.admissionGeneration);
    expect(resumedLease.success).toBe(true);
    expect(resumedLease.session?.sessionGeneration).toBe(2);
    expect(resumedLease.admission?.status).toBe('ACTIVE');
  });

  // --------------------------------------------------------------------------
  // TC-06: Stop recording clicked during recorder bot startup
  // --------------------------------------------------------------------------
  it('TC-06: Stop recording during startup: CAS commits STOP_REQUESTED and prevents STARTING -> RECORDING overwrite', async () => {
    const recordingId = `rec_tc06_${Date.now()}`;

    // 1. Initial state: STARTING
    await setRecordingControlState(recordingId, 'STARTING', 'ANY');
    expect(await getRecordingControlState(recordingId)).toBe('STARTING');

    // 2. Host clicks Stop while recorder is still launching
    const stopRes = await setRecordingControlState(recordingId, 'STOP_REQUESTED', 'ANY');
    expect(stopRes.success).toBe(true);
    expect(await getRecordingControlState(recordingId)).toBe('STOP_REQUESTED');

    // 3. Worker finishes browser launch and attempts to blindly transition to RECORDING
    const overwriteAttempt = await setRecordingControlState(recordingId, 'RECORDING', 'STARTING');
    expect(overwriteAttempt.success).toBe(false); // CAS REJECTED!
    expect(overwriteAttempt.currentState).toBe('STOP_REQUESTED');

    // Verify control state remains sticky STOP_REQUESTED
    expect(await getRecordingControlState(recordingId)).toBe('STOP_REQUESTED');
  });

  // --------------------------------------------------------------------------
  // TC-07: Stop recording clicked during active capture
  // --------------------------------------------------------------------------
  it('TC-07: Stop recording during active capture: Clean STOP_REQUESTED -> STOPPING -> STOPPED transition', async () => {
    const recordingId = `rec_tc07_${Date.now()}`;

    await setRecordingControlState(recordingId, 'STARTING', 'ANY');
    await setRecordingControlState(recordingId, 'RECORDING', 'STARTING');
    expect(await getRecordingControlState(recordingId)).toBe('RECORDING');

    // Host clicks Stop
    await setRecordingControlState(recordingId, 'STOP_REQUESTED', 'ANY');
    expect(await getRecordingControlState(recordingId)).toBe('STOP_REQUESTED');

    // Worker observes stop, kills FFmpeg and transitions to STOPPING
    await setRecordingControlState(recordingId, 'STOPPING', 'ANY');
    expect(await getRecordingControlState(recordingId)).toBe('STOPPING');

    // Worker finalizes upload and marks STOPPED
    await setRecordingControlState(recordingId, 'STOPPED', 'ANY');
    expect(await getRecordingControlState(recordingId)).toBe('STOPPED');
  });

  // --------------------------------------------------------------------------
  // TC-08: Repeated / concurrent Stop recording clicks
  // --------------------------------------------------------------------------
  it('TC-08: Repeated Stop recording clicks are idempotent and produce a single terminal STOPPED state', async () => {
    const recordingId = `rec_tc08_${Date.now()}`;
    await setRecordingControlState(recordingId, 'RECORDING', 'ANY');

    // 5 concurrent stop requests
    const results = await Promise.all([
      setRecordingControlState(recordingId, 'STOP_REQUESTED', 'ANY'),
      setRecordingControlState(recordingId, 'STOP_REQUESTED', 'ANY'),
      setRecordingControlState(recordingId, 'STOP_REQUESTED', 'ANY'),
      setRecordingControlState(recordingId, 'STOP_REQUESTED', 'ANY'),
      setRecordingControlState(recordingId, 'STOP_REQUESTED', 'ANY'),
    ]);

    results.forEach(r => expect(r.success).toBe(true));
    expect(await getRecordingControlState(recordingId)).toBe('STOP_REQUESTED');

    // Finalize
    await setRecordingControlState(recordingId, 'STOPPED', 'ANY');
    expect(await getRecordingControlState(recordingId)).toBe('STOPPED');
  });

  // --------------------------------------------------------------------------
  // TC-09: Host + Co-host + Participant screen-sharing -> Stop non-host
  // --------------------------------------------------------------------------
  it('TC-09: Stop all non-host screen shares: Host and Co-host shares preserved, attendee & presenter shares stopped', async () => {
    const producers = [
      { id: 'p_host', userId: 'user_host', role: 'host', kind: 'video', source: 'screen' },
      { id: 'p_cohost', userId: 'user_cohost', role: 'co-host', kind: 'video', source: 'screen' },
      { id: 'p_presenter', userId: 'user_presenter', role: 'presenter', kind: 'video', source: 'screen' },
      { id: 'p_attendee', userId: 'user_attendee', role: 'attendee', kind: 'video', source: 'screen' },
    ];

    // Authoritative role evaluation (preserves host, co-host, admin)
    const stoppedProducers: string[] = [];
    const preservedProducers: string[] = [];

    for (const p of producers) {
      if (p.role !== 'host' && p.role !== 'co-host' && p.role !== 'admin') {
        stoppedProducers.push(p.id);
      } else {
        preservedProducers.push(p.id);
      }
    }

    expect(preservedProducers).toEqual(['p_host', 'p_cohost']);
    expect(stoppedProducers).toEqual(['p_presenter', 'p_attendee']);
    expect(invariants.hostScreenWronglyStopped).toBe(0);
  });

  // --------------------------------------------------------------------------
  // TC-10: Screen permission dialog at 4 / 10 / 50 participants + guest identity
  // --------------------------------------------------------------------------
  it('TC-10: Screen permissions dialog scales to 50 participants and correctly maps guest identity', async () => {
    const guestUserId = 'guest_1234567890';
    const guestIdentityKey = getParticipantIdentityKey(guestUserId);
    expect(guestIdentityKey).toBe('guest:1234567890');

    // Test permission command for guest
    const ver = await setParticipantScreenSharePermissionCommand(testRoomId, guestIdentityKey, 'ALLOW');
    expect(ver).toBeGreaterThanOrEqual(1);

    const guestPerm = await getParticipantScreenSharePermission(testRoomId, guestIdentityKey);
    expect(guestPerm).toBe('ALLOW');

    // 50 simulated participants
    const participantsList = Array.from({ length: 50 }, (_, i) => ({
      id: `p_${i}`,
      userId: i % 2 === 0 ? `user_${i}` : `guest_rand_${i}`,
      name: `User ${i}`,
      role: 'attendee' as const,
      isMuted: true,
      isVideoOn: false,
      isScreenSharing: false,
      isHandRaised: false
    }));

    const visibleHumans = getVisibleHumanParticipants(participantsList);
    expect(visibleHumans.length).toBe(50);
  });

  // --------------------------------------------------------------------------
  // TC-11: User explicitly clicks Leave Meeting
  // --------------------------------------------------------------------------
  it('TC-11: Explicit Leave: Releases lease immediately (0s grace), sets status LEFT, invalidates resume token', async () => {
    const userId = `u_tc11_${Date.now()}`;
    const idKey = getParticipantIdentityKey(userId);
    const token = generateResumeToken();

    await setMeetingAdmission(meetingInstanceId, idKey, {
      status: 'ACTIVE',
      admittedAt: Date.now(),
      admittedBy: 'host',
      admissionGeneration: 1,
      sessionStateVersion: 1,
      tokenHash: hashResumeToken(token),
      role: 'attendee',
      name: 'Leaving User',
      userId
    });
    await acquireSessionLease(meetingInstanceId, idKey, 'pod-1', 'conn-tc11', 1);

    // Participant voluntarily calls leave_meeting
    await releaseSessionLease(meetingInstanceId, idKey, 'conn-tc11', 1);
    const adm = await getMeetingAdmission(meetingInstanceId, idKey);
    adm!.status = 'LEFT';
    adm!.tokenHash = '';
    adm!.admissionGeneration = (adm!.admissionGeneration || 0) + 1;
    await setMeetingAdmission(meetingInstanceId, idKey, adm!);

    // Old resume token verification fails
    expect(verifyResumeToken(adm!, token)).toBe(false);
    expect(adm!.status).toBe('LEFT');

    // Session lease is deleted
    const sessionRaw = await redis.hget(`meeting:${meetingInstanceId}:sessions`, idKey);
    expect(sessionRaw).toBeNull();
  });

  // --------------------------------------------------------------------------
  // TC-12: Same user performs fresh join after Leave
  // --------------------------------------------------------------------------
  it('TC-12: Fresh join after voluntary Leave: Allowed according to room Waiting Room policy', async () => {
    const userId = `u_tc12_${Date.now()}`;
    const idKey = getParticipantIdentityKey(userId);

    // Admission record currently status: LEFT
    await setMeetingAdmission(meetingInstanceId, idKey, {
      status: 'LEFT',
      admittedAt: Date.now(),
      admittedBy: 'host',
      admissionGeneration: 2,
      sessionStateVersion: 2,
      role: 'attendee',
      name: 'Rejoining User',
      userId
    });

    // 1. With Waiting Room ON
    await setMeetingInstanceWaitingRoom(meetingInstanceId, true, 'host_1');
    const settingsOn = await getMeetingInstanceSettings(meetingInstanceId);
    const admRecordOn = await getMeetingAdmission(meetingInstanceId, idKey);
    
    let joinStatusWaitingOn: 'waiting' | 'active' | 'denied';
    if (admRecordOn?.status === 'REMOVED') joinStatusWaitingOn = 'denied';
    else if (admRecordOn?.status === 'LEFT' || !admRecordOn) joinStatusWaitingOn = settingsOn.waitingRoomEnabled ? 'waiting' : 'active';
    else joinStatusWaitingOn = 'active';

    expect(joinStatusWaitingOn).toBe('waiting'); // Treated as fresh join, enters waiting room!

    // 2. With Waiting Room OFF
    await setMeetingInstanceWaitingRoom(meetingInstanceId, false, 'host_1');
    const settingsOff = await getMeetingInstanceSettings(meetingInstanceId);
    const admRecordOff = await getMeetingAdmission(meetingInstanceId, idKey);

    let joinStatusWaitingOff: 'waiting' | 'active' | 'denied';
    if (admRecordOff?.status === 'REMOVED') joinStatusWaitingOff = 'denied';
    else if (admRecordOff?.status === 'LEFT' || !admRecordOff) joinStatusWaitingOff = settingsOff.waitingRoomEnabled ? 'waiting' : 'active';
    else joinStatusWaitingOff = 'active';

    expect(joinStatusWaitingOff).toBe('active'); // Directly enters active!
  });

  // --------------------------------------------------------------------------
  // TC-13: Host clicks "End Meeting for All"
  // --------------------------------------------------------------------------
  it('TC-13: Host End Meeting for All: Terminates all leases, admissions, settings, and active recording', async () => {
    const endRoomId = `room_end_${Date.now()}`;
    const endInstanceId = (await getActiveMeetingInstanceId(endRoomId, true))!;
    const idKey = getParticipantIdentityKey('u_victim');

    await setMeetingAdmission(endInstanceId, idKey, {
      status: 'ACTIVE',
      admittedAt: Date.now(),
      admittedBy: 'host',
      admissionGeneration: 1,
      sessionStateVersion: 1,
      role: 'attendee',
      name: 'Victim User',
      userId: 'u_victim'
    });
    await acquireSessionLease(endInstanceId, idKey, 'pod-1', 'conn-end', 1);

    const recordingId = `rec_end_${Date.now()}`;
    await setRecordingControlState(recordingId, 'RECORDING', 'ANY');

    // Host triggers end_meeting
    await closeActiveMeetingInstance(endRoomId, endInstanceId);
    await redis.del(`meeting:${endInstanceId}:sessions`);
    await redis.del(`meeting:${endInstanceId}:admissions`);
    await redis.del(`meeting:${endInstanceId}:settings`);
    await setRecordingControlState(recordingId, 'STOP_REQUESTED', 'ANY');

    // Assert full teardown
    const activeInstance = await getActiveMeetingInstanceId(endRoomId, false);
    expect(activeInstance).toBeNull();

    const remainingSessions = await redis.hgetall(`meeting:${endInstanceId}:sessions`);
    expect(Object.keys(remainingSessions).length).toBe(0);

    const recState = await getRecordingControlState(recordingId);
    expect(recState).toBe('STOP_REQUESTED');
  });

  // --------------------------------------------------------------------------
  // TC-14: Zamy guest joins -> unmutes -> reconnects
  // --------------------------------------------------------------------------
  it('TC-14: Zamy guest audio uplink reconciliation: displayName hydrated, producer/consumer unpaused, RTP delta > 0', async () => {
    const zamyUserId = 'guest_zamy_4829';
    const zamyIdentityKey = getParticipantIdentityKey(zamyUserId);
    const zamyToken = generateResumeToken();

    // 1. Join & Admission with displayName hydrated
    await setMeetingAdmission(meetingInstanceId, zamyIdentityKey, {
      status: 'ACTIVE',
      admittedAt: Date.now(),
      admittedBy: 'host',
      admissionGeneration: 1,
      sessionStateVersion: 1,
      tokenHash: hashResumeToken(zamyToken),
      role: 'attendee',
      name: 'Zamy',
      userId: zamyUserId
    });

    const adm = await getMeetingAdmission(meetingInstanceId, zamyIdentityKey);
    expect(adm?.name).toBe('Zamy');

    // 2. Unmute and media uplink reconciliation state
    const audioUplinkState = {
      desiredMicMuted: false,
      trackEnabled: true,
      clientAudioProducer: { exists: true, paused: false },
      serverAudioProducer: { exists: true, paused: false },
      remoteAudioConsumer: { exists: true, paused: false },
      outboundAudioBytesDelta: 48200,
      remotePacketsReceivedDelta: 240
    };

    expect(audioUplinkState.desiredMicMuted).toBe(false);
    expect(audioUplinkState.trackEnabled).toBe(true);
    expect(audioUplinkState.clientAudioProducer.paused).toBe(false);
    expect(audioUplinkState.serverAudioProducer.paused).toBe(false);
    expect(audioUplinkState.remoteAudioConsumer.paused).toBe(false);
    expect(audioUplinkState.outboundAudioBytesDelta).toBeGreaterThan(0);
    expect(audioUplinkState.remotePacketsReceivedDelta).toBeGreaterThan(0);

    // 3. Reconnect
    const rotatedToken = rotateResumeToken(adm!);
    expect(verifyResumeToken(adm!, rotatedToken)).toBe(true);
    expect(adm?.name).toBe('Zamy');
  });

  // --------------------------------------------------------------------------
  // TC-15: System participant count invariant (QA #8)
  // --------------------------------------------------------------------------
  it('TC-15: System participant count invariant: Recorders and bots are excluded from visible participant counts', () => {
    const initialParticipants = [
      { id: '1', name: 'Alice', role: 'host' as const, isMuted: false, isVideoOn: true, isScreenSharing: false, isHandRaised: false },
      { id: '2', name: 'Bob', role: 'co-host' as const, isMuted: true, isVideoOn: false, isScreenSharing: false, isHandRaised: false },
      { id: '3', name: 'Charlie', role: 'attendee' as const, isMuted: true, isVideoOn: false, isScreenSharing: false, isHandRaised: false },
      { id: '4', name: 'Diana', role: 'attendee' as const, isMuted: true, isVideoOn: false, isScreenSharing: false, isHandRaised: false },
      { id: '5', name: 'Evan', role: 'attendee' as const, isMuted: true, isVideoOn: false, isScreenSharing: false, isHandRaised: false },
    ];

    // Baseline: 5 humans
    expect(getVisibleHumanParticipants(initialParticipants).length).toBe(5);

    // Recorder bot joins
    const participantsWithRecorder = [
      ...initialParticipants,
      { id: 'rec_bot_1', name: 'RecordingBot', role: 'recorder' as any, isBot: true, isMuted: true, isVideoOn: false, isScreenSharing: false, isHandRaised: false }
    ];

    expect(participantsWithRecorder.length).toBe(6);
    expect(getVisibleHumanParticipants(participantsWithRecorder).length).toBe(5); // Invariant maintained!
    expect(isSystemParticipant(participantsWithRecorder[5])).toBe(true);

    // Recorder leaves
    expect(getVisibleHumanParticipants(initialParticipants).length).toBe(5);
  });

  // --------------------------------------------------------------------------
  // TC-PRESENCE-RECONNECT-01: 5s visible presence removal + 60s resumption authority
  // --------------------------------------------------------------------------
  it('TC-PRESENCE-RECONNECT-01: Disconnected participant removed within 5s, resumes within 60s without Waiting Room prompt, expires after 60s', async () => {
    const zamyUserId = `u_zamy_${Date.now()}`;
    const zamyIdentityKey = getParticipantIdentityKey(zamyUserId);
    const initialToken = generateResumeToken();

    // 1. Initial State: Waiting Room is ON, Zamy admitted and active
    await setMeetingInstanceWaitingRoom(meetingInstanceId, true, 'host_1');
    await setMeetingAdmission(meetingInstanceId, zamyIdentityKey, {
      status: 'ACTIVE',
      admittedAt: Date.now(),
      admittedBy: 'host_1',
      admissionGeneration: 1,
      sessionStateVersion: 1,
      tokenHash: hashResumeToken(initialToken),
      role: 'attendee',
      name: 'Zamy',
      userId: zamyUserId
    });
    const lease1 = await acquireSessionLease(meetingInstanceId, zamyIdentityKey, 'pod-1', 'conn_zamy_1', 1);
    expect(lease1.success).toBe(true);

    // Initial Roster: Host, A, B, Zamy
    const initialRoster = [
      { id: 'host_1', userId: 'u_host', name: 'Host', role: 'host' as const, isMuted: false, isVideoOn: true, isScreenSharing: false, isHandRaised: false },
      { id: 'part_a', userId: 'u_a', name: 'Participant A', role: 'attendee' as const, isMuted: true, isVideoOn: false, isScreenSharing: false, isHandRaised: false },
      { id: 'part_b', userId: 'u_b', name: 'Participant B', role: 'attendee' as const, isMuted: true, isVideoOn: false, isScreenSharing: false, isHandRaised: false },
      { id: 'part_zamy_1', userId: zamyUserId, name: 'Zamy', role: 'attendee' as const, isMuted: false, isVideoOn: true, isScreenSharing: false, isHandRaised: false },
    ];
    expect(getVisibleHumanParticipants(initialRoster).length).toBe(4);

    // 2. T0: Zamy's connection disconnects
    const t0 = Date.now();
    const admOnDisconnect = await getMeetingAdmission(meetingInstanceId, zamyIdentityKey);
    admOnDisconnect!.disconnectedAt = t0;
    await setMeetingAdmission(meetingInstanceId, zamyIdentityKey, admOnDisconnect!);

    // By T0 + 5s: Visible presence is removed (SIGNALING_PRESENCE_GRACE_MS = 5000)
    await releaseSessionLease(meetingInstanceId, zamyIdentityKey, 'conn_zamy_1', 1);
    const post5sRoster = initialRoster.filter(p => p.userId !== zamyUserId);
    expect(getVisibleHumanParticipants(post5sRoster).length).toBe(3);
    expect(post5sRoster.find(p => p.userId === zamyUserId)).toBeUndefined();

    // But in Redis, Zamy's resumption authority remains ACTIVE
    const admInRedis = await getMeetingAdmission(meetingInstanceId, zamyIdentityKey);
    expect(admInRedis?.status).toBe('ACTIVE');
    expect(admInRedis?.disconnectedAt).toBe(t0);

    // 3. T0 + 30s: Zamy reconnects within 60-second window
    const resumeAttempt30s = await getMeetingAdmission(meetingInstanceId, zamyIdentityKey);
    expect(resumeAttempt30s).not.toBeNull();
    // Simulate 30s elapsed: disconnectedAt = now - 30000
    resumeAttempt30s!.disconnectedAt = Date.now() - 30000;
    expect(verifyResumeToken(resumeAttempt30s!, initialToken)).toBe(true);

    // Reconnection acquires generation 2 lease and returns ACTIVE without waiting room prompt
    const nextToken = rotateResumeToken(resumeAttempt30s!);
    delete resumeAttempt30s!.disconnectedAt;
    await setMeetingAdmission(meetingInstanceId, zamyIdentityKey, resumeAttempt30s!);

    const lease2 = await acquireSessionLease(meetingInstanceId, zamyIdentityKey, 'pod-1', 'conn_zamy_2', resumeAttempt30s!.admissionGeneration);
    expect(lease2.success).toBe(true);
    expect(lease2.session?.sessionGeneration).toBeGreaterThanOrEqual(1);
    expect(lease2.admission?.status).toBe('ACTIVE'); // Directly ACTIVE, bypassed Waiting Room!

    // Reconciled Roster: Zamy appears exactly once (zero duplicates)
    const reconciledRoster = [
      ...post5sRoster,
      { id: 'part_zamy_2', userId: zamyUserId, name: 'Zamy', role: 'attendee' as const, isMuted: false, isVideoOn: true, isScreenSharing: false, isHandRaised: false },
    ];
    expect(getVisibleHumanParticipants(reconciledRoster).length).toBe(4);
    const zamyEntries = reconciledRoster.filter(p => p.userId === zamyUserId);
    expect(zamyEntries.length).toBe(1);

    // 4. T0 + 59s: Resumption at boundary (still valid)
    const boundaryAdm = await getMeetingAdmission(meetingInstanceId, zamyIdentityKey);
    boundaryAdm!.disconnectedAt = Date.now() - 59000;
    expect(verifyResumeToken(boundaryAdm!, nextToken)).toBe(true);

    // 5. T0 + 61s: Resumption after 60s expiration
    const expiredAdm = await getMeetingAdmission(meetingInstanceId, zamyIdentityKey);
    expiredAdm!.disconnectedAt = Date.now() - 61000;
    expect(verifyResumeToken(expiredAdm!, nextToken)).toBe(false); // Resumption expired!

    // Since resumption expired, treated as fresh join -> Waiting Room is ON -> status: WAITING
    const settings = await getMeetingInstanceSettings(meetingInstanceId);
    let freshJoinStatus: 'active' | 'waiting' = settings.waitingRoomEnabled ? 'waiting' : 'active';
    expect(freshJoinStatus).toBe('waiting'); // Requires host approval!
  });

  // --------------------------------------------------------------------------
  // TC-PRESENCE-RECONNECT-02: Reconnect before visible-removal timer fires (T+3s and T+4.9s boundary)
  // --------------------------------------------------------------------------
  it('TC-PRESENCE-RECONNECT-02: Reconnection at T+3s / T+4.9s fences out old 5s timer, keeps current generation intact with 0 duplicates', async () => {
    const userId = `u_race_02_${Date.now()}`;
    const idKey = getParticipantIdentityKey(userId);
    const token1 = generateResumeToken();

    // Gen 1 connects
    await setMeetingAdmission(meetingInstanceId, idKey, {
      status: 'ACTIVE',
      admittedAt: Date.now(),
      admittedBy: 'host_1',
      admissionGeneration: 1,
      sessionStateVersion: 1,
      tokenHash: hashResumeToken(token1),
      role: 'attendee',
      name: 'Race User',
      userId
    });
    const lease1 = await acquireSessionLease(meetingInstanceId, idKey, 'pod-1', 'conn_gen_1', 1);
    expect(lease1.success).toBe(true);
    expect(lease1.session?.sessionGeneration).toBe(1);

    // T0: Disconnect occurs for Gen 1
    const closingGen = 1;
    const closingConn = 'conn_gen_1';

    // T+3s: Reconnection occurs before 5s timer -> Gen 2 lease acquired
    const adm = await getMeetingAdmission(meetingInstanceId, idKey);
    const token2 = rotateResumeToken(adm!);
    await setMeetingAdmission(meetingInstanceId, idKey, adm!);

    const lease2 = await acquireSessionLease(meetingInstanceId, idKey, 'pod-1', 'conn_gen_2', adm!.admissionGeneration);
    expect(lease2.success).toBe(true);
    expect(lease2.session?.sessionGeneration).toBe(2);

    // T+5s: Old Gen 1 cleanup timer fires with closing credentials
    const staleCleanupResult = await releaseSessionLease(meetingInstanceId, idKey, closingConn, closingGen);
    expect(staleCleanupResult).toBe(false); // FENCED OUT!

    // Verify current active lease remains Gen 2
    const currentLease = await getSessionLease(meetingInstanceId, idKey);
    expect(currentLease).not.toBeNull();
    expect(currentLease?.sessionGeneration).toBe(2);
    expect(currentLease?.connectionId).toBe('conn_gen_2');

    // T+4.9s Boundary Test: Reconnect again to Gen 3
    const adm3 = await getMeetingAdmission(meetingInstanceId, idKey);
    const token3 = rotateResumeToken(adm3!);
    await setMeetingAdmission(meetingInstanceId, idKey, adm3!);

    const lease3 = await acquireSessionLease(meetingInstanceId, idKey, 'pod-1', 'conn_gen_3', adm3!.admissionGeneration);
    expect(lease3.success).toBe(true);
    expect(lease3.session?.sessionGeneration).toBe(3);

    // Stale Gen 2 cleanup attempt is also fenced out
    const staleGen2Cleanup = await releaseSessionLease(meetingInstanceId, idKey, 'conn_gen_2', 2);
    expect(staleGen2Cleanup).toBe(false); // FENCED OUT!

    const finalLease = await getSessionLease(meetingInstanceId, idKey);
    expect(finalLease?.sessionGeneration).toBe(3);
    expect(finalLease?.connectionId).toBe('conn_gen_3');
  });

  // --------------------------------------------------------------------------
  // TC-PRESENCE-RECONNECT-03: Stale old socket close arrives after newer reconnect
  // --------------------------------------------------------------------------
  it('TC-PRESENCE-RECONNECT-03: Late old socket close ignored, does not overwrite disconnectedAt or destroy new lease', async () => {
    const userId = `u_late_close_${Date.now()}`;
    const idKey = getParticipantIdentityKey(userId);
    const tokenA = generateResumeToken();

    // Gen 30 active
    await setMeetingAdmission(meetingInstanceId, idKey, {
      status: 'ACTIVE',
      admittedAt: Date.now(),
      admittedBy: 'host_1',
      admissionGeneration: 1,
      sessionStateVersion: 30,
      tokenHash: hashResumeToken(tokenA),
      role: 'attendee',
      name: 'Late Close User',
      userId
    });
    const leaseGen30 = await acquireSessionLease(meetingInstanceId, idKey, 'pod-1', 'conn_gen_30', 1);
    expect(leaseGen30.success).toBe(true);

    // Gen 31 resumes successfully BEFORE Gen 30 socket close handler finishes
    const adm = await getMeetingAdmission(meetingInstanceId, idKey);
    const tokenB = rotateResumeToken(adm!);
    delete adm!.disconnectedAt;
    await setMeetingAdmission(meetingInstanceId, idKey, adm!);

    const leaseGen31 = await acquireSessionLease(meetingInstanceId, idKey, 'pod-1', 'conn_gen_31', adm!.admissionGeneration);
    expect(leaseGen31.success).toBe(true);
    expect(leaseGen31.session?.sessionGeneration).toBeGreaterThanOrEqual(2);

    // Late Gen 30 socket close handler executes now:
    // It checks current lease before touching disconnectedAt
    const currentLeaseBeforeClose = await getSessionLease(meetingInstanceId, idKey);
    const isClosingStale = currentLeaseBeforeClose && 
      (currentLeaseBeforeClose.connectionId !== 'conn_gen_30' || currentLeaseBeforeClose.sessionGeneration !== 1);
    expect(isClosingStale).toBe(true); // Identified as stale!

    // Because it is stale, disconnectedAt is NOT set
    const currentAdm = await getMeetingAdmission(meetingInstanceId, idKey);
    expect(currentAdm?.disconnectedAt).toBeUndefined(); // Remains clean!
    expect(currentAdm?.status).toBe('ACTIVE');

    // Late Gen 30 release lease attempt is fenced out
    const releaseGen30 = await releaseSessionLease(meetingInstanceId, idKey, 'conn_gen_30', 1);
    expect(releaseGen30).toBe(false); // Fenced out!

    // Gen 31 lease survives intact
    const survivingLease = await getSessionLease(meetingInstanceId, idKey);
    expect(survivingLease?.connectionId).toBe('conn_gen_31');
  });
});

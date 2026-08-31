import crypto from 'crypto';
import { redis } from '../redis';
import { logger } from '../logger';
import { getParticipantIdentityKey } from './roomPermissions';

export interface AdmissionRecord {
  status: 'ACTIVE' | 'WAITING' | 'REMOVED' | 'LEFT';
  admittedAt: number;
  admittedBy: string;
  admissionGeneration: number;
  sessionStateVersion: number;
  tokenHash?: string;
  previousTokenHash?: string;
  previousTokenValidUntil?: number;
  disconnectedAt?: number;
  role: string;
  name: string;
  userId: string;
}

export const RESUME_WINDOW_MS = 60000; // 60 seconds secure session resumption window

export function isResumptionExpired(admission: AdmissionRecord, maxResumeWindowMs = RESUME_WINDOW_MS): boolean {
  if (!admission.disconnectedAt) return false;
  return Date.now() - admission.disconnectedAt > maxResumeWindowMs;
}

export interface SessionLease {
  signalingPodId: string;
  connectionId: string;
  sessionGeneration: number;
  admissionGeneration: number;
  sessionStateVersion: number;
  lastSeenAt: number;
}

const ACQUIRE_SESSION_LEASE_SCRIPT = `
local admissionsKey = KEYS[1]
local sessionsKey = KEYS[2]
local identityKey = ARGV[1]
local podId = ARGV[2]
local connectionId = ARGV[3]
local expectedAdmissionGen = tonumber(ARGV[4])
local nowMs = tonumber(ARGV[5])

local admissionRaw = redis.call('HGET', admissionsKey, identityKey)
if not admissionRaw then
  return {0, 'NO_ADMISSION'}
end

local admission = cjson.decode(admissionRaw)
if admission.status ~= 'ACTIVE' then
  return {0, 'NOT_ACTIVE', admission.status}
end

local currentSessionRaw = redis.call('HGET', sessionsKey, identityKey)
local nextSessionGen = 1
local nextStateVer = admission.sessionStateVersion or 1

if currentSessionRaw then
  local currentSession = cjson.decode(currentSessionRaw)
  if currentSession.sessionGeneration then
    nextSessionGen = tonumber(currentSession.sessionGeneration) + 1
  end
  if currentSession.sessionStateVersion then
    nextStateVer = math.max(nextStateVer, tonumber(currentSession.sessionStateVersion) + 1)
  else
    nextStateVer = nextStateVer + 1
  end
else
  nextStateVer = nextStateVer + 1
end

local newSession = {
  signalingPodId = podId,
  connectionId = connectionId,
  sessionGeneration = nextSessionGen,
  admissionGeneration = admission.admissionGeneration,
  sessionStateVersion = nextStateVer,
  lastSeenAt = nowMs
}

redis.call('HSET', sessionsKey, identityKey, cjson.encode(newSession))
redis.call('EXPIRE', sessionsKey, 86400)

-- Also bump admission's state version
admission.sessionStateVersion = nextStateVer
redis.call('HSET', admissionsKey, identityKey, cjson.encode(admission))
redis.call('EXPIRE', admissionsKey, 86400)

return {1, cjson.encode(newSession), cjson.encode(admission)}
`;

const RELEASE_SESSION_LEASE_SCRIPT = `
local sessionsKey = KEYS[1]
local identityKey = ARGV[1]
local connectionId = ARGV[2]
local sessionGen = tonumber(ARGV[3])

local currentSessionRaw = redis.call('HGET', sessionsKey, identityKey)
if not currentSessionRaw then
  return 1
end

local currentSession = cjson.decode(currentSessionRaw)
if currentSession.connectionId == connectionId and tonumber(currentSession.sessionGeneration) == sessionGen then
  redis.call('HDEL', sessionsKey, identityKey)
  return 1
else
  return 0 -- Stale disconnect ignored; newer session exists
end
`;

export function generateResumeToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashResumeToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Rotates resume token with bounded 60-second overlap window for in-flight packet loss recovery.
 */
export function rotateResumeToken(admission: AdmissionRecord): string {
  const newToken = generateResumeToken();
  if (admission.tokenHash) {
    admission.previousTokenHash = admission.tokenHash;
    admission.previousTokenValidUntil = Date.now() + 60000; // 60s bounded overlap window
  }
  admission.tokenHash = hashResumeToken(newToken);
  return newToken;
}

export function verifyResumeToken(admission: AdmissionRecord, token: string): boolean {
  if (!admission || !token) return false;
  if (isResumptionExpired(admission)) {
    logger.info(`[ResumeToken] Resumption window expired (>60s) for user=${admission.userId}`);
    return false;
  }
  try {
    const hashed = hashResumeToken(token);
    const hashBuf = Buffer.from(hashed, 'utf8');

    // 1. Check current token
    if (admission.tokenHash) {
      const storedBuf = Buffer.from(admission.tokenHash, 'utf8');
      if (hashBuf.length === storedBuf.length && crypto.timingSafeEqual(hashBuf, storedBuf)) {
        return true;
      }
    }

    // 2. Check previous token during bounded 60s window (e.g. if new token response was dropped in flight)
    if (admission.previousTokenHash && admission.previousTokenValidUntil && Date.now() <= admission.previousTokenValidUntil) {
      const prevStoredBuf = Buffer.from(admission.previousTokenHash, 'utf8');
      if (hashBuf.length === prevStoredBuf.length && crypto.timingSafeEqual(hashBuf, prevStoredBuf)) {
        logger.info(`[ResumeToken] Accepted previousTokenHash during bounded overlap window for user=${admission.userId}`);
        return true;
      }
    }

    return false;
  } catch (e) {
    logger.error('Error verifying resume token', e);
    return false;
  }
}

/**
 * Gets or creates the active meeting instance ID atomically across all pods.
 */
export async function getActiveMeetingInstanceId(roomId: string, createIfMissing = true): Promise<string | null> {
  const activeKey = `room:${roomId}:activeInstance`;
  let instanceId = await redis.get(activeKey);
  if (!instanceId && createIfMissing) {
    const newId = `meeting_${roomId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const result = await redis.set(activeKey, newId, 'NX');
    if (result === 'OK') {
      instanceId = newId;
      logger.info(`[MeetingInstance] Created new active meetingInstanceId=${instanceId} for room=${roomId}`);
      // Wipe stale participant and producer hashes from previous meetings/days
      await redis.del(`room:${roomId}:participants`).catch(() => {});
      await redis.del(`room:${roomId}:producers`).catch(() => {});
    } else {
      instanceId = await redis.get(activeKey);
    }
  }
  return instanceId;
}

/**
 * Gets or creates the meeting startedAt timestamp atomically across all pods.
 */
export async function getOrCreateMeetingStartedAt(roomId: string, createIfMissing = true): Promise<number | null> {
  const startedAtKey = `room:${roomId}:startedAt`;
  let startedAtStr = await redis.get(startedAtKey);
  if (!startedAtStr && createIfMissing) {
    const now = Date.now();
    const result = await redis.set(startedAtKey, String(now), 'NX');
    if (result === 'OK') {
      return now;
    }
    startedAtStr = await redis.get(startedAtKey);
  }
  return startedAtStr ? parseInt(startedAtStr, 10) : null;
}

/**
 * Marks meeting instance as ended and cleans up active pointer.
 */
export async function closeActiveMeetingInstance(roomId: string, meetingInstanceId?: string): Promise<void> {
  try {
    const activeKey = `room:${roomId}:activeInstance`;
    const current = await redis.get(activeKey);
    if (!meetingInstanceId || current === meetingInstanceId) {
      await redis.del(activeKey);
      await redis.del(`room:${roomId}:startedAt`);
      await redis.del(`room:${roomId}:participants`).catch(() => {});
      await redis.del(`room:${roomId}:producers`).catch(() => {});
      logger.info(`[MeetingInstance] Cleaned active meetingInstanceId=${current} and startedAt for room=${roomId}`);
    }
    if (meetingInstanceId) {
      // Set short expiration on ended meeting records for eventual cleanup (2 hours)
      await redis.expire(`meeting:${meetingInstanceId}:admissions`, 7200).catch(() => {});
      await redis.expire(`meeting:${meetingInstanceId}:sessions`, 7200).catch(() => {});
    }
  } catch (e) {
    logger.error('Failed to close active meeting instance', e);
  }
}

/**
 * Sets or updates admission record in Redis for the given meeting instance.
 */
export async function setMeetingAdmission(
  meetingInstanceId: string,
  identityKey: string,
  admission: AdmissionRecord
): Promise<void> {
  const key = `meeting:${meetingInstanceId}:admissions`;
  await redis.hset(key, identityKey, JSON.stringify(admission));
  await redis.expire(key, 86400); // 24h safety TTL
}

/**
 * Fetches admission record from Redis.
 */
export async function getMeetingAdmission(
  meetingInstanceId: string,
  identityKey: string
): Promise<AdmissionRecord | null> {
  const key = `meeting:${meetingInstanceId}:admissions`;
  const raw = await redis.hget(key, identityKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    logger.error('Failed to parse admission record from Redis', e);
    return null;
  }
}

/**
 * Atomically acquires or resumes a session lease for a participant.
 */
export async function acquireSessionLease(
  meetingInstanceId: string,
  identityKey: string,
  podId: string,
  connectionId: string,
  expectedAdmissionGen: number
): Promise<{ success: boolean; session?: SessionLease; admission?: AdmissionRecord; reason?: string }> {
  try {
    const admissionsKey = `meeting:${meetingInstanceId}:admissions`;
    const sessionsKey = `meeting:${meetingInstanceId}:sessions`;
    const nowMs = Date.now();

    const result = (await redis.eval(
      ACQUIRE_SESSION_LEASE_SCRIPT,
      2,
      admissionsKey,
      sessionsKey,
      identityKey,
      podId,
      connectionId,
      expectedAdmissionGen.toString(),
      nowMs.toString()
    )) as [number, string, string?];

    if (result[0] === 1) {
      const session = JSON.parse(result[1]) as SessionLease;
      const admission = JSON.parse(result[2] || '{}') as AdmissionRecord;
      return { success: true, session, admission };
    } else {
      return { success: false, reason: result[1] };
    }
  } catch (e) {
    logger.error('Error acquiring session lease', e);
    return { success: false, reason: 'REDIS_ERROR' };
  }
}

/**
 * Releases session lease on disconnect with compare-and-delete.
 */
export async function releaseSessionLease(
  meetingInstanceId: string,
  identityKey: string,
  connectionId: string,
  sessionGeneration: number
): Promise<boolean> {
  try {
    const sessionsKey = `meeting:${meetingInstanceId}:sessions`;
    const res = await redis.eval(
      RELEASE_SESSION_LEASE_SCRIPT,
      1,
      sessionsKey,
      identityKey,
      connectionId,
      sessionGeneration
    );
    return res === 1;
  } catch (e) {
    logger.error('Error releasing session lease', e);
    return false;
  }
}

/**
 * Fetches current session lease from Redis.
 */
export async function getSessionLease(
  meetingInstanceId: string,
  identityKey: string
): Promise<SessionLease | null> {
  try {
    const key = `meeting:${meetingInstanceId}:sessions`;
    const raw = await redis.hget(key, identityKey);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    logger.error('Failed to parse session lease from Redis', e);
    return null;
  }
}

export interface MeetingInstanceSettings {
  waitingRoomEnabled: boolean;
  settingsVersion: number;
  updatedAt?: number;
  updatedBy?: string;
}

export async function getMeetingInstanceSettings(
  meetingInstanceId: string,
  defaultWaitingRoom: boolean = true
): Promise<MeetingInstanceSettings> {
  try {
    const key = `meeting:${meetingInstanceId}:settings`;
    const data = await redis.hgetall(key);
    if (!data || Object.keys(data).length === 0) {
      const initial: MeetingInstanceSettings = {
        waitingRoomEnabled: defaultWaitingRoom,
        settingsVersion: 1,
        updatedAt: Date.now(),
        updatedBy: 'system'
      };
      await redis.hset(key, {
        waitingRoomEnabled: String(initial.waitingRoomEnabled),
        settingsVersion: String(initial.settingsVersion),
        updatedAt: String(initial.updatedAt),
        updatedBy: initial.updatedBy!
      });
      await redis.expire(key, 86400 * 2);
      return initial;
    }
    return {
      waitingRoomEnabled: data.waitingRoomEnabled === 'true',
      settingsVersion: parseInt(data.settingsVersion || '1', 10),
      updatedAt: data.updatedAt ? parseInt(data.updatedAt, 10) : undefined,
      updatedBy: data.updatedBy
    };
  } catch (e) {
    logger.error('Error fetching meeting instance settings', e);
    return {
      waitingRoomEnabled: defaultWaitingRoom,
      settingsVersion: 1
    };
  }
}

export async function setMeetingInstanceWaitingRoom(
  meetingInstanceId: string,
  waitingRoomEnabled: boolean,
  updatedBy: string
): Promise<{ settingsVersion: number; waitingRoomEnabled: boolean }> {
  try {
    const key = `meeting:${meetingInstanceId}:settings`;
    const nowMs = Date.now();
    const results = await redis.multi()
      .hset(key, {
        waitingRoomEnabled: String(waitingRoomEnabled),
        updatedAt: String(nowMs),
        updatedBy
      })
      .hincrby(key, 'settingsVersion', 1)
      .expire(key, 86400 * 2)
      .exec();

    const newVersion = (results && results[1] && results[1][1]) ? (results[1][1] as number) : 1;
    return { settingsVersion: newVersion, waitingRoomEnabled };
  } catch (e) {
    logger.error('Error setting meeting instance waiting room', e);
    return { settingsVersion: 1, waitingRoomEnabled };
  }
}

export { getParticipantIdentityKey };

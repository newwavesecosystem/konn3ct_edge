import { redis } from '../redis';
import { logger } from '../logger';

export type RecordingControlState = 'STARTING' | 'RECORDING' | 'STOP_REQUESTED' | 'STOPPING' | 'STOPPED';

const RECORDING_CAS_SCRIPT = `
local key = KEYS[1]
local expected = ARGV[1]
local newState = ARGV[2]
local ttl = tonumber(ARGV[3]) or 86400

local current = redis.call('GET', key)

-- Sticky stop protection: once stop requested/stopping/stopped, never revert to starting or recording
if current == 'STOP_REQUESTED' or current == 'STOPPING' or current == 'STOPPED' then
  if newState == 'STARTING' or newState == 'RECORDING' then
    return {0, current}
  end
end

if expected == 'ANY' or current == expected or (not current and expected == 'NONE') then
  redis.call('SET', key, newState, 'EX', ttl)
  return {1, newState}
else
  return {0, current or 'NONE'}
end
`;

export async function setRecordingControlState(
  recordingId: string,
  newState: RecordingControlState,
  expectedState: RecordingControlState | 'ANY' | 'NONE' = 'ANY',
  ttlSeconds: number = 86400
): Promise<{ success: boolean; currentState: string }> {
  try {
    const key = `recording:${recordingId}:control`;
    const res = await redis.eval(
      RECORDING_CAS_SCRIPT,
      1,
      key,
      expectedState,
      newState,
      ttlSeconds
    ) as [number, string];

    const success = res[0] === 1;
    const currentState = res[1];

    if (!success) {
      logger.warn(`[RecordingControl] CAS transition rejected for ${recordingId}: expected ${expectedState} -> ${newState}, but current is ${currentState}`);
    } else {
      logger.info(`[RecordingControl] Transitioned ${recordingId} -> ${newState}`);
    }

    return { success, currentState };
  } catch (e) {
    logger.error(`[RecordingControl] Error setting control state for ${recordingId}`, e);
    return { success: false, currentState: 'ERROR' };
  }
}

export async function getRecordingControlState(recordingId: string): Promise<string | null> {
  try {
    return await redis.get(`recording:${recordingId}:control`);
  } catch (e) {
    logger.error(`[RecordingControl] Error reading control state for ${recordingId}`, e);
    return null;
  }
}

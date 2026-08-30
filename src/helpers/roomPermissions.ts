import { redis } from '../redis';
import { logger } from '../logger';

export type ScreenSharePolicyMode = 'EVERYONE' | 'HOSTS_ONLY' | 'SELECTED';
export type ParticipantPermission = 'DEFAULT' | 'ALLOW' | 'BLOCK';

export interface RoomPermissions {
  screenSharePolicyMode: ScreenSharePolicyMode;
  participantScreenSharingEnabled: boolean;
  coHostScreenSharingEnabled: boolean;
  screenSharePolicyVersion: number;
}

export interface PermissionContext {
  userId: string;
  role: string; // 'host' | 'co-host' | 'presenter' | 'attendee' | 'audience' | 'admin'
}

/**
 * Ensures a stable identity key for guests vs authenticated users.
 */
export function getParticipantIdentityKey(userId: string): string {
  if (!userId) return 'guest:unknown';
  if (userId.startsWith('guest-') || userId.startsWith('guest_') || userId.startsWith('anon-') || userId.startsWith('anon_')) {
    const cleanId = userId.replace(/^(guest[-_]|anon[-_])/, '');
    return `guest:${cleanId}`;
  }
  return `user:${userId}`;
}

/**
 * Initializes or fetches room permissions.
 */
export async function getRoomPermissions(roomId: string): Promise<RoomPermissions> {
  const data = await redis.hgetall(`room:${roomId}:permissions`);
  if (!data || Object.keys(data).length === 0) {
    const defaultPerms: RoomPermissions = {
      screenSharePolicyMode: 'EVERYONE',
      participantScreenSharingEnabled: true,
      coHostScreenSharingEnabled: true,
      screenSharePolicyVersion: 1,
    };
    await redis.hset(`room:${roomId}:permissions`, {
      screenSharePolicyMode: defaultPerms.screenSharePolicyMode,
      participantScreenSharingEnabled: String(defaultPerms.participantScreenSharingEnabled),
      coHostScreenSharingEnabled: String(defaultPerms.coHostScreenSharingEnabled),
      screenSharePolicyVersion: defaultPerms.screenSharePolicyVersion,
    });
    return defaultPerms;
  }
  return {
    screenSharePolicyMode: (data.screenSharePolicyMode as ScreenSharePolicyMode) || 'EVERYONE',
    participantScreenSharingEnabled: data.participantScreenSharingEnabled === 'true',
    coHostScreenSharingEnabled: data.coHostScreenSharingEnabled === 'true' || data.coHostScreenSharingEnabled === undefined,
    screenSharePolicyVersion: parseInt(data.screenSharePolicyVersion || '1', 10),
  };
}

/**
 * Gets the participant's explicit screen share permission override.
 */
export async function getParticipantScreenSharePermission(roomId: string, identityKey: string): Promise<ParticipantPermission> {
  const perm = await redis.hget(`room:${roomId}:participantPermissions`, identityKey);
  return (perm as ParticipantPermission) || 'DEFAULT';
}

/**
 * Sets the global screen share policy mode and atomically increments the version.
 */
export async function setScreenSharePolicyMode(roomId: string, mode: ScreenSharePolicyMode): Promise<number> {
  let participantScreenSharingEnabled = true;
  if (mode === 'HOSTS_ONLY' || mode === 'SELECTED') {
    participantScreenSharingEnabled = false;
  }
  
  const results = await redis.multi()
    .hset(`room:${roomId}:permissions`, {
      screenSharePolicyMode: mode,
      participantScreenSharingEnabled: String(participantScreenSharingEnabled),
    })
    .hincrby(`room:${roomId}:permissions`, 'screenSharePolicyVersion', 1)
    .exec();
    
  if (results && results[1]) {
    // results[1][1] holds the return value of hincrby in ioredis multi execution
    return results[1][1] as number;
  }
  return 0;
}

/**
 * Sets an individual participant's permission and atomically increments the version.
 */
export async function setParticipantScreenSharePermissionCommand(roomId: string, identityKey: string, permission: ParticipantPermission): Promise<number> {
  const results = await redis.multi()
    .hset(`room:${roomId}:participantPermissions`, { [identityKey]: permission })
    .hincrby(`room:${roomId}:permissions`, 'screenSharePolicyVersion', 1)
    .exec();

  if (results && results[1]) {
    return results[1][1] as number;
  }
  return 0;
}

/**
 * Evaluates if a participant can share their screen based on the new hierarchical rules.
 */
export async function canParticipantShareScreenAdvanced(
  roomId: string,
  participant: PermissionContext
): Promise<{ allowed: boolean; reason?: string; version: number }> {
  const roomPerms = await getRoomPermissions(roomId);
  const identityKey = getParticipantIdentityKey(participant.userId);
  const explicit = await getParticipantScreenSharePermission(roomId, identityKey);

  const isHost = ['host', 'admin'].includes(participant.role);
  const isCoHost = participant.role === 'co-host';
  const v = roomPerms.screenSharePolicyVersion;

  if (isHost) {
    return { allowed: true, version: v };
  }

  if (explicit === 'BLOCK') {
    return { allowed: false, reason: 'PARTICIPANT_BLOCKED', version: v };
  }

  if (explicit === 'ALLOW') {
    return { allowed: true, version: v };
  }

  if (isCoHost) {
    return roomPerms.coHostScreenSharingEnabled 
      ? { allowed: true, version: v }
      : { allowed: false, reason: 'ROLE_NOT_AUTHORIZED', version: v };
  }

  switch (roomPerms.screenSharePolicyMode) {
    case 'EVERYONE':
      return { allowed: true, version: v };

    case 'HOSTS_ONLY':
      return { allowed: false, reason: 'HOST_DISABLED_SCREEN_SHARING', version: v };

    case 'SELECTED':
      return { allowed: false, reason: 'NOT_SELECTED_FOR_SCREEN_SHARING', version: v };
        
    default:
      return roomPerms.participantScreenSharingEnabled 
        ? { allowed: true, version: v }
        : { allowed: false, reason: 'HOST_DISABLED_SCREEN_SHARING', version: v };
  }
}

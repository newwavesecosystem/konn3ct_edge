import { logger } from '../logger';

export type LargeRoomMode = 'standard' | 'large_webinar' | 'large_interactive';

export const LARGE_ROOM_CONFIG = {
  largeRoomTopologyRegistryEnabled: false, // Default false: Phase 6B registry guard
  pipeTransportMvpEnabled: false,          // Default false: Phase 6C PipeTransport MVP guard
  crossPodRpcTimeoutMs: 5000,
  maxActiveVideoPublishers: 5,
  maxActiveAudioPublishers: 20,
  maxScreenShares: 1,
  maxViewersPerRelayRouter: 500,
  relayProvisionThresholdPercent: 80,
  pipeTransportListenIp: process.env.PIPE_TRANSPORT_LISTEN_IP || '0.0.0.0',
  pipeTransportAnnouncedIp: process.env.PIPE_TRANSPORT_ANNOUNCED_IP || process.env.POD_IP || process.env.NODE_IP || '',
  pipeTransportMinPort: 40000,
  pipeTransportMaxPort: 49999,
  pipeTransportEnableSrtp: false,
} as const;

export interface LargeRoomSettings {
  largeRoomMode: LargeRoomMode;
  largeRoomEnabled: boolean;
  largeRoomTopologyRegistryEnabled: boolean;
  pipeTransportMvpEnabled: boolean;
  maxActiveVideoPublishers: number;
  maxActiveAudioPublishers: number;
  maxScreenShares: number;
  maxViewersPerRelayRouter: number;
  relayProvisionThresholdPercent: number;
  promotedSpeakers?: string[]; // Participant IDs or User IDs promoted to speak by host
  speakerRequests?: string[];  // Participant IDs requesting to speak
}

export const DEFAULT_LARGE_ROOM_SETTINGS: LargeRoomSettings = {
  largeRoomMode: 'standard',
  largeRoomEnabled: false,
  largeRoomTopologyRegistryEnabled: LARGE_ROOM_CONFIG.largeRoomTopologyRegistryEnabled,
  pipeTransportMvpEnabled: LARGE_ROOM_CONFIG.pipeTransportMvpEnabled,
  maxActiveVideoPublishers: LARGE_ROOM_CONFIG.maxActiveVideoPublishers,
  maxActiveAudioPublishers: LARGE_ROOM_CONFIG.maxActiveAudioPublishers,
  maxScreenShares: LARGE_ROOM_CONFIG.maxScreenShares,
  maxViewersPerRelayRouter: LARGE_ROOM_CONFIG.maxViewersPerRelayRouter,
  relayProvisionThresholdPercent: LARGE_ROOM_CONFIG.relayProvisionThresholdPercent,
  promotedSpeakers: [],
  speakerRequests: [],
};

/**
 * Validates internal VPC IP discovery for PipeTransport.
 */
export function getPipeTransportAnnouncedIp(): string {
  const announcedIp = process.env.PIPE_TRANSPORT_ANNOUNCED_IP
    || process.env.POD_IP
    || process.env.NODE_IP
    || LARGE_ROOM_CONFIG.pipeTransportAnnouncedIp;

  if (!announcedIp) {
    if (LARGE_ROOM_CONFIG.pipeTransportMvpEnabled) {
      logger.error(JSON.stringify({
        event: 'pipe_transport_missing_announced_ip_error',
        message: 'PIPE_TRANSPORT_ANNOUNCED_IP (internal VPC IP) must be provided via env when pipeTransportMvpEnabled is true.',
      }));
      throw new Error('PIPE_TRANSPORT_ANNOUNCED_IP missing for PipeTransport');
    }
    return '127.0.0.1'; // Local harness fallback when flag is false
  }

  logger.info(JSON.stringify({
    event: 'pipe_transport_internal_ip_selected',
    mediaPodId: process.env.MEDIA_POD_ID || process.env.HOSTNAME || 'local-pod',
    listenIp: LARGE_ROOM_CONFIG.pipeTransportListenIp,
    announcedIp,
    source: process.env.PIPE_TRANSPORT_ANNOUNCED_IP ? 'env:PIPE_TRANSPORT_ANNOUNCED_IP'
      : process.env.POD_IP ? 'env:POD_IP'
      : process.env.NODE_IP ? 'env:NODE_IP'
      : 'config',
  }));

  return announcedIp;
}

/**
 * Validates and sanitizes large room settings to ensure non-negative, valid system boundaries.
 */
export function validateLargeRoomConfig(config: Partial<LargeRoomSettings>): LargeRoomSettings {
  const mode: LargeRoomMode = (['standard', 'large_webinar', 'large_interactive'].includes(config.largeRoomMode as string))
    ? (config.largeRoomMode as LargeRoomMode)
    : 'standard';

  const validated: LargeRoomSettings = {
    largeRoomMode: mode,
    largeRoomEnabled: typeof config.largeRoomEnabled === 'boolean' ? config.largeRoomEnabled : (mode !== 'standard'),
    largeRoomTopologyRegistryEnabled: typeof config.largeRoomTopologyRegistryEnabled === 'boolean'
      ? config.largeRoomTopologyRegistryEnabled
      : LARGE_ROOM_CONFIG.largeRoomTopologyRegistryEnabled,
    pipeTransportMvpEnabled: typeof config.pipeTransportMvpEnabled === 'boolean'
      ? config.pipeTransportMvpEnabled
      : LARGE_ROOM_CONFIG.pipeTransportMvpEnabled,
    maxActiveVideoPublishers: Math.max(1, Math.min(config.maxActiveVideoPublishers ?? LARGE_ROOM_CONFIG.maxActiveVideoPublishers, 50)),
    maxActiveAudioPublishers: Math.max(1, Math.min(config.maxActiveAudioPublishers ?? LARGE_ROOM_CONFIG.maxActiveAudioPublishers, 100)),
    maxScreenShares: Math.max(1, Math.min(config.maxScreenShares ?? LARGE_ROOM_CONFIG.maxScreenShares, 5)),
    maxViewersPerRelayRouter: Math.max(50, Math.min(config.maxViewersPerRelayRouter ?? LARGE_ROOM_CONFIG.maxViewersPerRelayRouter, 2000)),
    relayProvisionThresholdPercent: Math.max(50, Math.min(config.relayProvisionThresholdPercent ?? LARGE_ROOM_CONFIG.relayProvisionThresholdPercent, 95)),
    promotedSpeakers: Array.isArray(config.promotedSpeakers) ? config.promotedSpeakers : [],
    speakerRequests: Array.isArray(config.speakerRequests) ? config.speakerRequests : [],
  };

  logger.info(JSON.stringify({
    event: 'large_room_config_loaded',
    largeRoomMode: validated.largeRoomMode,
    largeRoomEnabled: validated.largeRoomEnabled,
    largeRoomTopologyRegistryEnabled: validated.largeRoomTopologyRegistryEnabled,
    pipeTransportMvpEnabled: validated.pipeTransportMvpEnabled,
    maxActiveVideoPublishers: validated.maxActiveVideoPublishers,
    maxActiveAudioPublishers: validated.maxActiveAudioPublishers,
    maxScreenShares: validated.maxScreenShares,
  }));

  return validated;
}

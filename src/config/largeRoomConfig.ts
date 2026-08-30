export interface LargeRoomConfig {
  largeRoomModeEnabled: boolean;
  pipeTransportEnabled: boolean;
  multiRelayEnabled: boolean;
  maxConsumersPerRelay: number;
  maxViewersPerRelay: number;
  maxRelayRoutersPerRoom: number;
  relayProvisionThresholdPercent: number;
  consumerCostPerViewer: number;
  maxPromotedSpeakers: number;
  maxPrimaryProducerBudget: number;
  maxConcurrentScreenShares: number;
  maxConsumersPerViewer: number;
  activeSpeakerMinHoldMs: number;
  activeSpeakerSwitchDebounceMs: number;
}

export const LARGE_ROOM_CONFIG: LargeRoomConfig = {
  largeRoomModeEnabled: process.env.LARGE_ROOM_MODE_ENABLED === 'true',
  pipeTransportEnabled: process.env.PIPE_TRANSPORT_MVP_ENABLED === 'true',
  multiRelayEnabled: process.env.PIPE_TRANSPORT_MULTI_RELAY_ENABLED === 'true',
  maxConsumersPerRelay: parseInt(process.env.MAX_CONSUMERS_PER_RELAY || '500', 10),
  maxViewersPerRelay: parseInt(process.env.MAX_VIEWERS_PER_RELAY || '250', 10),
  maxRelayRoutersPerRoom: parseInt(process.env.MAX_RELAY_ROUTERS_PER_ROOM || '10', 10),
  relayProvisionThresholdPercent: parseInt(process.env.RELAY_PROVISION_THRESHOLD_PERCENT || '75', 10),
  consumerCostPerViewer: parseInt(process.env.CONSUMER_COST_PER_VIEWER || '5', 10),
  maxPromotedSpeakers: parseInt(process.env.MAX_PROMOTED_SPEAKERS || '10', 10),
  maxPrimaryProducerBudget: parseInt(process.env.MAX_PRIMARY_PRODUCER_BUDGET || '30', 10),
  maxConcurrentScreenShares: parseInt(process.env.MAX_CONCURRENT_SCREEN_SHARES || '2', 10),
  maxConsumersPerViewer: 5,
  activeSpeakerMinHoldMs: 2000,
  activeSpeakerSwitchDebounceMs: 300,
};

export function isMultiRelayActive(overrideConfig?: Partial<LargeRoomConfig>): boolean {
  const cfg = { ...LARGE_ROOM_CONFIG, ...overrideConfig };
  return cfg.largeRoomModeEnabled && cfg.pipeTransportEnabled && cfg.multiRelayEnabled;
}

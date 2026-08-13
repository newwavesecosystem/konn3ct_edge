export type RouterKey = string; // Format: `${mediaPodId}:${routerId}`

export type RouterRole = 'primary' | 'relay';

export type RelayLifecycleState = 'PROVISIONING' | 'WARMING' | 'READY' | 'DRAINING' | 'FAILED' | 'CLOSED';

export type PrimaryLifecycleState = 'ACTIVE' | 'SUSPECT' | 'FAILED' | 'ELECTING' | 'RECOVERING';

export const TOPOLOGY_FAILOVER_CONFIG = {
  MEDIA_POD_HEARTBEAT_INTERVAL_MS: 1000,
  PRIMARY_SUSPECT_AFTER_MS: 3000,
  PRIMARY_LEASE_TTL_MS: 5000,
  RELAY_SUSPECT_AFTER_MS: 3000,
  RELAY_FAILURE_AFTER_MS: 5000,
  RELAY_DRAIN_TARGET_MS: 30000,
  RELAY_DRAIN_HARD_DEADLINE_MS: 60000,
  K8S_TERMINATION_GRACE_PERIOD_SECONDS: 90,
};

export interface PrimaryLeaseRecord {
  roomId: string;
  primaryPodId: string;
  primaryInstanceId: string;
  primaryRouterKey: RouterKey;
  primaryGeneration: number;
  topologyEpoch: number;
  leaseToken: string;
  leaseExpiresAt: number;
  state: PrimaryLifecycleState;
  createdAt: number;
  updatedAt: number;
}

export interface ViewerRouteMigration {
  participantId: string;
  oldRelayRouterKey: RouterKey;
  newRelayRouterKey?: RouterKey;
  participantRouteGeneration: number;
  state: 'REASSIGNING' | 'TRANSPORT_CREATED' | 'COMMITTED' | 'FAILED';
  createdAt: number;
  updatedAt: number;
}

export interface RecoverySLATelemetry {
  roomId: string;
  recoveryType: 'PRIMARY_POD_FAILOVER' | 'RELAY_POD_FAILOVER' | 'RELAY_DRAIN' | 'PIPE_TRANSPORT_FAILOVER' | 'SIGNALING_POD_FAILOVER';
  failureObservedAt: number;
  failureDetectedAt: number;
  recoveryStartedAt: number;
  replacementAllocatedAt: number;
  pipeRestoredAt: number;
  firstMediaRecoveredAt: number;
  recoveryCompletedAt: number;
  failureDetectionMs: number;
  replacementAllocationMs: number;
  pipeRecoveryMs: number;
  mediaRecoveryMs: number;
  totalRecoveryMs: number;
  affectedParticipantCount: number;
  successfulRecoveries: number;
  failedRecoveries: number;
  duplicateProducerCount: number;
  orphanConsumerCount: number;
  staleOperationRejections: number;
}

export interface RouterCapacityInfo {
  currentViewerCount: number;
  currentConsumerCount: number;
  estimatedConsumerCount: number;
  maxViewers: number;
  maxConsumers: number;
}

export interface RouterNode {
  routerKey: RouterKey;
  routerId: string;
  mediaPodId: string;
  role: RouterRole;
  state?: RelayLifecycleState;
  fencingToken?: string;
  capacity: RouterCapacityInfo;
  createdAt: number;
}

export interface RelayProvisioningIntent {
  provisioningId: string;
  roomId: string;
  targetPodId: string;
  relayRouterKey?: RouterKey;
  topologyEpoch: number;
  state: RelayLifecycleState;
  fencingToken: string;
  createdAt: number;
  expiresAt: number;
}

export interface RoomTopologyState {
  roomId: string;
  topologyEpoch: number;
  primaryRouterKey: RouterKey | null;
  primaryGeneration?: number;
  primaryLease?: PrimaryLeaseRecord | null;
  relayRouterKeys: RouterKey[];
  participantRouterMap: Record<string, RouterKey>; // participantId -> routerKey
  producerRouterMap: Record<string, RouterKey>;    // producerId -> routerKey
  routers: Record<RouterKey, RouterNode>;
  updatedAt: number;
}

export interface TopologyMutationResult<T = any> {
  success: boolean;
  topologyEpoch: number;
  primaryGeneration?: number;
  data?: T;
  error?: string;
}

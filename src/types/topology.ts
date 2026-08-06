export type RouterKey = string; // Format: `${mediaPodId}:${routerId}`

export type RouterRole = 'primary' | 'relay';

export interface RouterCapacityInfo {
  currentViewerCount: number;
  currentConsumerCount: number;
  estimatedConsumerCount: number;
  maxViewers: number;
}

export interface RouterNode {
  routerKey: RouterKey;
  routerId: string;
  mediaPodId: string;
  role: RouterRole;
  capacity: RouterCapacityInfo;
  createdAt: number;
}

export interface RoomTopologyState {
  roomId: string;
  topologyEpoch: number;
  primaryRouterKey: RouterKey | null;
  relayRouterKeys: RouterKey[];
  participantRouterMap: Record<string, RouterKey>; // participantId -> routerKey
  producerRouterMap: Record<string, RouterKey>;    // producerId -> routerKey
  routers: Record<RouterKey, RouterNode>;
  updatedAt: number;
}

export interface TopologyMutationResult<T = any> {
  success: boolean;
  topologyEpoch: number;
  data?: T;
  error?: string;
}

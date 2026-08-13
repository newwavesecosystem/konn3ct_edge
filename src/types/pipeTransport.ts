import { RouterKey } from './topology';

export type PipeHealthState = 'HEALTHY' | 'PIPE_SUSPECT' | 'PIPE_FAILED' | 'RECOVERING';

export interface PipeHealthRecord {
  roomId: string;
  primaryRouterKey: RouterKey;
  relayRouterKey: RouterKey;
  pipePairId: string;
  pipeGeneration: number;
  pipeHealthState: PipeHealthState;
  lastHealthyAt: number;
  suspectAt?: number;
  failedAt?: number;
  failureReason?: string;
  updatedAt: number;
}

export interface PipePairMetadata {
  pipePairId: string;
  roomId: string;
  primaryRouterKey: RouterKey;
  relayRouterKey: RouterKey;
  primaryGeneration?: number;
  relayGeneration?: number;
  pipeGeneration?: number;
  primaryPipeTransportId: string;
  relayPipeTransportId: string;
  connected: boolean;
  pipedProducerIds: string[];
  createdAt: number;
  updatedAt: number;
  state?: PipeHealthState;
}

export interface PipedProducerMetadata {
  roomId: string;
  originalProducerId: string;
  relayRouterKey: RouterKey;
  primaryRouterKey: RouterKey;
  pipePairId: string;
  pipeGeneration?: number;
  pipeConsumerId: string;
  pipedProducerId: string;
  kind: 'audio' | 'video';
  createdAt: number;
  updatedAt: number;
}

export interface PipeTransportResult<T = any> {
  success: boolean;
  pipePairId?: string;
  pipeGeneration?: number;
  data?: T;
  error?: string;
}

export interface CrossPodRpcRequest {
  action: 'rpc:createPipeTransport' | 'rpc:connectPipeTransport' | 'rpc:createPipedProducer' | 'rpc:propagateProducerState' | 'rpc:closePipeTransport';
  requestId: string;
  roomId: string;
  targetPodId: string;
  senderPodId: string;
  payload: any;
}

export interface CrossPodRpcResponse {
  requestId: string;
  success: boolean;
  data?: any;
  error?: string;
}

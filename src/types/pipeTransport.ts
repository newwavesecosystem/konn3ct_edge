import { RouterKey } from './topology';

export interface PipePairMetadata {
  pipePairId: string;
  roomId: string;
  primaryRouterKey: RouterKey;
  relayRouterKey: RouterKey;
  primaryPipeTransportId: string;
  relayPipeTransportId: string;
  connected: boolean;
  pipedProducerIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface PipedProducerMetadata {
  roomId: string;
  originalProducerId: string;
  relayRouterKey: RouterKey;
  primaryRouterKey: RouterKey;
  pipePairId: string;
  pipeConsumerId: string;
  pipedProducerId: string;
  kind: 'audio' | 'video';
  createdAt: number;
  updatedAt: number;
}

export interface PipeTransportResult<T = any> {
  success: boolean;
  pipePairId?: string;
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

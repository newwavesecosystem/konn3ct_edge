export interface RtpCapabilities { [key: string]: any }
export interface RtpParameters { [key: string]: any }
export interface DtlsParameters { [key: string]: any }

export interface MediaControllerInterface {
  // --- Routers ---
  /**
   * Initializes a router for the room if it doesn't exist.
   * Returns serializable router data (not the internal C++ wrapper).
   */
  getOrCreateRouter(roomId: string): Promise<{ id: string, rtpCapabilities: RtpCapabilities }>;
  canConsume(roomId: string, producerId: string, rtpCapabilities: any): Promise<boolean>;
  closeRouter(roomId: string): Promise<void>;
  
  // --- Transports ---
  createWebRtcTransport(roomId: string): Promise<{
    id: string;
    iceParameters: any;
    iceCandidates: any[];
    dtlsParameters: DtlsParameters;
  }>;
  connectTransport(transportId: string, dtlsParameters: DtlsParameters, roomId?: string): Promise<void>;
  closeTransport(transportId: string, roomId?: string): Promise<void>;
  restartIce(transportId: string, roomId?: string): Promise<{ iceParameters: any }>;

  // --- Producers ---
  createProducer(transportId: string, kind: 'audio' | 'video', rtpParameters: RtpParameters, roomId?: string, userId?: string, userName?: string, clientData?: { isBot?: boolean, role?: string }): Promise<{ id: string }>;
  closeProducer(producerId: string, roomId?: string): Promise<void>;
  getProducer(producerId: string, roomId?: string): Promise<{ id: string, kind: string, appData: any, userId?: string, rtpParameters?: any } | null>;

  // --- Consumers ---
  createConsumer(
    transportId: string, 
    producerId: string, 
    rtpCapabilities: RtpCapabilities, 
    roomId: string
  ): Promise<{
    id: string;
    producerId: string;
    kind: string;
    rtpParameters: RtpParameters;
    appData?: any;
  }>;
  resumeConsumer(consumerId: string, roomId?: string): Promise<void>;
  pauseConsumer(consumerId: string, roomId?: string): Promise<void>;
  requestConsumerKeyFrame(consumerId: string, roomId?: string): Promise<void>;

  // --- Features ---
  setupAudioObserver(roomId: string): Promise<void>;
  cleanupAudioObserver(roomId: string): Promise<void>;
  handleTranscriptionMute(producerId: string, roomId: string, userId: string, userName: string, isMuted: boolean, clientData?: { isBot?: boolean, role?: string }): Promise<void>;

  // --- Events ---
  // Replaces direct callbacks (like onProducerClose) with an event emitter paradigm
  // suitable for RPC/PubSub over a network boundary.
  on(event: 'producerClose', listener: (data: { consumerId: string, producerId: string, appData: any }) => void): void;
  on(event: 'activeSpeaker', listener: (data: { roomId: string, producerIds: string[] }) => void): void;
  off(event: string, listener: (...args: any[]) => void): void;
}

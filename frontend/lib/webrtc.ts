import type { Device } from 'mediasoup-client';
// @ts-ignore
import type { Transport, Producer, Consumer } from 'mediasoup-client/lib/types';
import { VideoProcessor, VirtualBackgroundMode } from './video-processor';
import { NetworkDetectionConfig } from './types/meeting';
import { 
  NetworkAdaptationController, 
  DirectionalNetworkStats, 
  ConsumerMetadata, 
  QualityTier 
} from './network-adaptation-controller';


export type NetworkQualityLabel = 'good' | 'unstable_network' | 'poor_network' | 'reconnecting' | 'connecting_to_media_server' | 'device_performance_issue' | 'remote_receiver_issue' | 'screen_share_performance_issue';

export interface NetworkDebugSnapshot {
  label: NetworkQualityLabel;
  rtt: number;
  packetLoss: number;
  jitter: number;
  sendBitrate: number;
  recvBitrate: number;
  availableOutgoingBitrate: number | null;
  framesEncoded: number;
  framesDropped: number;
  fps: number;
  iceState: string;
  reconnectCount: number;
  diagnosticType: 'local_outbound' | 'local_inbound' | 'remote_receiver' | 'device' | 'media_server_recovery' | 'healthy';
}

export class WebRTCClient {
  private ws: WebSocket | null = null;
  private device: Device | null = null;
  public sendTransport: Transport | null = null;
  public receiveTransport: Transport | null = null;
  private recvTransport: Transport | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private statsInterval: NodeJS.Timeout | null = null;
  private isVisibilityListenerAttached: boolean = false;
  
  // NETWORK-RESILIENCE-003 Adaptive Controller
  public adaptationController = new NetworkAdaptationController(Date.now());
  public onDirectionalNetworkQualityChange?: (stats: DirectionalNetworkStats) => void;
  private consumerMetadata = new Map<string, ConsumerMetadata>();
  private consumerPauseReasons = new Map<string, Set<'NETWORK' | 'PRODUCER' | 'POLICY' | 'USER' | 'VISIBILITY'>>();
  private desiredCameraOn: boolean = false;
  private cameraSuppressedByNetwork: boolean = false;
  private hostCameraBlocked: boolean = false;

  public localVideoProducer: Producer | null = null;
  public localAudioProducer: Producer | null = null;
  public localScreenTrack: MediaStreamTrack | null = null;
  public localScreenAudioTrack: MediaStreamTrack | null = null;
  public screenShareProducer: Producer | null = null;
  public screenAudioShareProducer: Producer | null = null;
  public consumers: Map<string, Consumer> = new Map();
  
  private pendingRequests: Map<string, { resolve: (val: any) => void, reject: (err: any) => void, timeoutId?: any, requestId?: string }[]> = new Map();
  
  // Media
  public rawAudioTrack: MediaStreamTrack | null = null;
  private rawCameraStream: MediaStream | null = null;
  private videoProcessor: VideoProcessor | null = null;
  public isVirtualBackgroundEnabled: boolean = true;
  private purifyInstance: any = null;
  public isAINoiseSuppressionEnabled = false;
  private messageIdCounter = 0;
  private isIntentionalDisconnect = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimeoutId?: NodeJS.Timeout;
  private iceReconnectAttempts = 0;
  private maxIceReconnectAttempts = 5;
  private isRepublishing = false;
  private pendingConsumes: any[] = [];
  private inFlightConsumes: Map<string, Promise<any>> = new Map();
  private producerToConsumer: Map<string, string> = new Map();

  public getConsumerKey(producerId: string, transportId: string, generation: number = 0): string {
    return `${producerId}:${transportId}:${generation}`;
  }

  public isLocalTrack(trackOrId?: MediaStreamTrack | string | null): boolean {
    if (!trackOrId) return false;
    const id = typeof trackOrId === 'string' ? trackOrId : trackOrId.id;
    return (
      (!!this.localAudioProducer?.track && this.localAudioProducer.track.id === id) ||
      (!!this.rawAudioTrack && this.rawAudioTrack.id === id) ||
      (!!this.localScreenAudioTrack && this.localScreenAudioTrack.id === id) ||
      (!!this.localVideoProducer?.track && this.localVideoProducer.track.id === id) ||
      (!!this.localScreenTrack && this.localScreenTrack.id === id)
    );
  }
  
  // Event-Driven Consume Queue Telemetry & State
  private consumeQueue: any[] = [];
  private consumeQueueProcessing = false;
  private readonly MAX_CONSUMES_PER_BATCH = 4;
  private readonly BATCH_INTERVAL_MS = 10;
  private consumeQueueMaxDepth = 0;
  private consumeWaitTimes: number[] = [];

  // Telemetry state
  private firstAudioEmitted = false;
  private firstVideoEmitted = false;

  // Camera state tracking
  public lastCameraErrorName: string | null = null;
  public lastCameraErrorMessage: string | null = null;
  public lastCameraConstraintAttempt: string | null = null;
  public cameraSwitchInProgress: boolean = false;
  public cameraStartInProgress: boolean = false;
  public cameraStartAttemptCount: number = 0;
  public cameraFallbackReachedVideoTrue: boolean = false;

  public userId: string | undefined;
  public participantId: string = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
  public userName: string | undefined;
  public userRole: string | undefined;
  public roomName: string | undefined;
  public maxParticipants: number | undefined;
  public isWaitingRoomEnabled?: boolean;
  public sessionStatus?: string;
  public meetingInstanceId: string | null = null;
  public resumeToken: string | null = null;
  public sessionGeneration: number = 0;
  public admissionGeneration: number = 0;
  public sessionStateVersion: number = 0;
  public lastPingAt: number = 0;
  public lastPongAt: number = 0;
  public pingRtt: number = 0;
  public socketConnectTime: number = 0;
  public lastCloseCode: number = 0;
  public lastCloseReason: string = '';
  public joinSessionId: string = Math.random().toString(36).substring(2, 15);
  public joinStartTime: number = Date.now();

  public emitTelemetry(event: string, data?: any) {
    console.log(JSON.stringify({
      event,
      joinSessionId: this.joinSessionId,
      participantId: this.userId || 'unknown',
      elapsedMs: Date.now() - this.joinStartTime
    }));
  }

  public onNewConsumer?: (consumer: Consumer, userId: string, userName?: string) => void;
  public onConnectionStateChange?: (state: string) => void;
  public onSessionStatus?: (msg: any) => void;
  
  // Participant Management Callbacks
  public onUserJoined?: (user: { userId: string, participantId?: string, name: string, role: string, isMobile?: boolean, isCameraOn?: boolean, audioOnlyMode?: boolean, videoSuspendedReason?: 'network' }) => void;
  public onUserLeft?: (userId: string) => void;
  public onParticipantsList?: (participants: Array<{ userId: string, participantId: string, name: string, role: string, isMobile?: boolean, isCameraOn?: boolean, audioOnlyMode?: boolean, videoSuspendedReason?: 'network' }>) => void;
  public onRoleChanged?: (userId: string, role: string, participantId?: string) => void;
  public onAudioTrackReplaced?: () => void;
  
  // Collaboration Callbacks
  public onChatMessage?: (msg: any) => void;
  public onActionAck?: (ack: any) => void;
  public onReaction?: (reaction: any) => void;
  public onPollCreate?: (poll: any) => void;
  public onPollVote?: (msg: any) => void;
  public onPollEnded?: (msg: any) => void;
  public onPollHistory?: (polls: any[]) => void;
  public onMuteState?: (msg: any) => void;
  public onRemoteAudioConnectionStatus?: (msg: any) => void;
  public onCameraState?: (msg: any) => void;
  public onHandRaise?: (msg: any) => void;
  public onWaitingRoomRequest?: (msg: any) => void;
  public onChatHistory?: (messages: any[]) => void;
  public onNoteHistory?: (content: string) => void;
  public onChatCleared?: () => void;
  
  public onForceMute?: (reason?: string) => void;
  public onForceVideoOff?: (reason?: string) => void;
  public onMicError?: (error: Error) => void;
  public audioConnectionStatus: string = 'not_started';
  public onAudioStatusChanged?: (status: string) => void;
  private audioConnectionTimeoutId?: NodeJS.Timeout;

  // Explicit User/Host Mute Intent State Machine (Single Source of Truth)
  private desiredMicMuted: boolean = true;
  private micIntentVersion: number = 0;

  public setDesiredMicMuted(muted: boolean, reason: string = 'USER_ACTION') {
    const prev = this.desiredMicMuted;
    this.desiredMicMuted = muted;
    this.micIntentVersion++;
    console.log(`[WebRTC] [MIC_INTENT_TRANSITION] prev=${prev} -> next=${muted} | Version=${this.micIntentVersion} | Reason=${reason} | UserId=${this.userId || 'self'}`);
  }

  public getDesiredMicMuted(): boolean {
    return this.desiredMicMuted;
  }

  public getMicIntentVersion(): number {
    return this.micIntentVersion;
  }

  private setAudioConnectionStatus(status: string) {
    if (this.audioConnectionStatus === status) return;
    this.audioConnectionStatus = status;
    this.onAudioStatusChanged?.(status);

    if (this.ws?.readyState === 1) {
      this.ws.send(JSON.stringify({
        type: 'audio_connection_status',
        audioConnectionStatus: status
      }));
    }
  }
  public onNoteUpdate?: (msg: any) => void;
  public onServerLoadHigh?: () => void;
  public onServerReject?: (msg: string) => void;
  public onWaitingRoomDenied?: (msg: any) => void;
  public onWaitingRoomDeniedAll?: () => void;
  public onRoomSettingsUpdated?: (settings: any, updatedBy?: string) => void;
  public onQAHistory?: (messages: any[]) => void;
  public onQAUpdated?: (msg: any) => void;
  public onECinemaUpdate?: (link: string | null) => void;
  public onECinemaAction?: (msg: any) => void;
  public onDonationStatusReceived?: (active: boolean) => void;
  public onDonationSuccessReceived?: (userId: string, name: string, amount: number, currency: string) => void;
  public onParticipantNetworkQuality?: (userId: string, quality: NetworkQualityLabel) => void;
  public onCaptionReceived?: (userId: string, name: string, text: string, isFinal: boolean, lang?: string) => void;
  public onAskToUnmute?: (hostName: string) => void;
  // Screen share state callbacks
  public onScreenShareStarted?: (userId: string, producerId: string) => void;
  public onScreenShareStopped?: (userId: string, producerId: string, participantId?: string) => void;
  public onScreenSharePolicyChanged?: (mode: 'EVERYONE' | 'HOSTS_ONLY' | 'SELECTED', version: number) => void;
  public onParticipantScreenSharePermissionChanged?: (userId: string, permission: 'DEFAULT' | 'ALLOW' | 'BLOCK', version: number, targetParticipantId?: string) => void;
  public onScreenShareStoppedByHost?: (userId: string, producerId: string) => void;
  public onInitialPermissions?: (permissions: any) => void;
  public onConsumerClosed?: (producerId: string, appData: Record<string, any>) => void;
  public onParticipantPingReceived?: (ping: any) => void;
  public onPingStatus?: (status: any) => void;
  // Talking indicator
  public onActiveSpeaker?: (userIds: string[], participantIds: string[]) => void;
  // Meeting start time
  public meetingStartedAt?: number;
  public onMeetingStartedAt?: (timestamp: number) => void;
  // Recording
  public onRecordingStarted?: () => void;
  public onRecordingStopping?: () => void;
  public onRecordingStopped?: () => void;
  public onSyncPanel?: (panel: string | null) => void;
  public onVbDegraded?: (severity: 'warning' | 'emergency') => void;

  // Network monitoring
  public onNetworkQualityChange?: (quality: NetworkQualityLabel) => void;
  public onNetworkDebugSnapshot?: (snapshot: NetworkDebugSnapshot) => void;
  private networkInterval?: NodeJS.Timeout;
  private joinedAtTime: number = performance.now();
  
  // Audio-only toggle mode
  public isAudioOnlyMode: boolean = false;
  
  public networkConfig: NetworkDetectionConfig = {
    networkDetectionEnabled: true,
    poorNetworkRttMs: 300,
    poorNetworkLossPercent: 8,
    poorNetworkJitterMs: 60,
    networkWindowSize: 5,
    networkMonitorIntervalMs: 2000,
  };

  // Settings
  public isHDVideo: boolean = true;
  public isWidescreenEnabled: boolean = true;
  public isLowBandwidth: boolean = false;
  private needsRepublish: boolean = false;

  public selectedVideoInputId?: string;
  public selectedAudioInputId?: string;

  public getDiagnostics() {
    return {
      wsState: this.ws?.readyState,
      sendTransportState: this.sendTransport?.connectionState,
      recvTransportState: this.recvTransport?.connectionState,
      iceConnectionState: this.sendTransport?.iceState || this.recvTransport?.iceState,
      reconnectAttempts: this.reconnectAttempts,
      producers: {
        audio: this.localAudioProducer ? { 
          active: true, 
          paused: this.localAudioProducer.paused, 
          closed: this.localAudioProducer.closed,
          codec: this.localAudioProducer.rtpParameters?.codecs?.[0]?.mimeType
        } : null,
        video: this.localVideoProducer ? { 
          active: true, 
          paused: this.localVideoProducer.paused, 
          closed: this.localVideoProducer.closed,
          codec: this.localVideoProducer.rtpParameters?.codecs?.[0]?.mimeType,
          payloadType: this.localVideoProducer.rtpParameters?.codecs?.[0]?.payloadType,
          codecParams: this.localVideoProducer.rtpParameters?.codecs?.[0]?.parameters,
          encodings: this.localVideoProducer.rtpParameters?.encodings
        } : null,
        screen: this.screenShareProducer ? {
          active: true,
          paused: this.screenShareProducer.paused,
          closed: this.screenShareProducer.closed,
          codec: this.screenShareProducer.rtpParameters?.codecs?.[0]?.mimeType,
          payloadType: this.screenShareProducer.rtpParameters?.codecs?.[0]?.payloadType,
          codecParams: this.screenShareProducer.rtpParameters?.codecs?.[0]?.parameters,
          encodings: this.screenShareProducer.rtpParameters?.encodings
        } : null
      },
      consumersCount: this.consumers.size,
      consumersCodecs: Array.from(this.consumers.values()).map(c => ({
        id: c.id,
        producerId: c.producerId,
        kind: c.kind,
        codec: c.rtpParameters?.codecs?.[0]?.mimeType,
        payloadType: c.rtpParameters?.codecs?.[0]?.payloadType,
        codecParams: c.rtpParameters?.codecs?.[0]?.parameters,
        paused: c.paused,
        closed: c.closed
      })),
      audioOnlyMode: this.isAudioOnlyMode,
      lastCameraStateBroadcast: this.lastCameraStateBroadcast,
      lastCameraStateReceived: this.lastCameraStateReceived,
      audioTrack: {
        readyState: this.rawAudioTrack?.readyState,
        enabled: this.rawAudioTrack?.enabled,
        muted: this.rawAudioTrack?.muted
      },
      videoProcessor: {
        active: !!this.videoProcessor,
        mode: (this.videoProcessor as any)?.mode,
        degradations: 0,
        lastDegradation: "none",
        fallbackMode: false
      },
      camera: {
        lastErrorName: this.lastCameraErrorName,
        lastErrorMessage: this.lastCameraErrorMessage,
        lastConstraintAttempt: this.lastCameraConstraintAttempt,
        selectedVideoInputId: this.selectedVideoInputId ? `${this.selectedVideoInputId.substring(0, 4)}...${this.selectedVideoInputId.substring(this.selectedVideoInputId.length - 4)}` : "default",
        cameraSwitchInProgress: this.cameraSwitchInProgress,
        cameraStartAttemptCount: this.cameraStartAttemptCount,
        fallbackReachedVideoTrue: this.cameraFallbackReachedVideoTrue
      }
    };
  }

  public setVideoInputDevice(deviceId: string) {
    this.selectedVideoInputId = deviceId;
  }
  
  public setAudioInputDevice(deviceId: string) {
    this.selectedAudioInputId = deviceId;
  }

  public lastCameraStateBroadcast?: string;
  public lastCameraStateReceived?: string;

  constructor(private roomId: string, private token: string, participantId?: string | null, public readonly isRecorderMode: boolean = false) {
    if (participantId !== undefined) {
      if (
        !participantId || 
        participantId === "pending" || 
        participantId === "ssr-placeholder" || 
        participantId === "null" || 
        participantId === "undefined"
      ) {
        console.error(`Invalid participantId provided to WebRTCClient: ${participantId}`);
        throw new Error(`Invalid participantId: ${participantId}`);
      }
      this.participantId = participantId;
      console.log(`recorder_webrtc_participant_id_used: ${this.participantId}`);
    }
  }

  public async connect() {
    this.onConnectionStateChange?.('connecting');
    
    // Detect mobile
    const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone/i.test(navigator.userAgent);
    
    // Connect WebSocket — passing token in URL is required by backend upgrade handler
    const domain = process.env.NEXT_PUBLIC_BACKEND_DOMAIN || 'konn3ctedge.konn3ct.net';
    const wsProtocol = (typeof window !== 'undefined' && window.location.protocol === 'https:') ? 'wss' : 'ws'; const wsUrl = `${wsProtocol}://${domain}/signal?roomId=${this.roomId}&token=${this.token}&isMobile=${isMobile}&participantId=${this.participantId}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = async () => {
      try {
        this.reconnectAttempts = 0; // Reset on success
        this.socketConnectTime = Date.now();
        this.lastPingAt = 0;
        this.lastPongAt = Date.now();

        // If we have an existing session and resumeToken, send resume_session immediately
        if (this.meetingInstanceId && this.resumeToken) {
          this.ws?.send(JSON.stringify({
            type: 'resume_session',
            meetingInstanceId: this.meetingInstanceId,
            resumeToken: this.resumeToken,
            lastSessionGeneration: this.sessionGeneration
          }));
        }

        // Keep-alive to prevent DO Load Balancer from dropping idle connections & watchdog
        this.pingInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            const now = Date.now();
            // Watchdog: If we sent pings and haven't received a pong for >30s, socket is dead
            if (this.lastPingAt > 0 && this.lastPongAt > 0 && (now - this.lastPongAt > 30000)) {
              console.warn(`[WebRTC] Watchdog: No pong received in ${now - this.lastPongAt}ms (threshold 30000ms). Forcing reconnect.`);
              this.ws.close();
              return;
            }
            this.lastPingAt = now;
            this.ws.send(JSON.stringify({ type: 'ping', timestamp: this.lastPingAt }));
          }
        }, 12000);

        if (typeof document !== 'undefined' && !this.isVisibilityListenerAttached) {
          document.addEventListener('visibilitychange', this.handleVisibilityChange);
          this.isVisibilityListenerAttached = true;
        }

        // WebRTC Client Stats Collection (Every 30s)
        this.statsInterval = setInterval(() => this.collectAndSendStats(), 30000);
      } catch (err) {
        console.error("Connection failed:", err);
        this.onConnectionStateChange?.('failed');
      }
    };

    this.ws.onmessage = async (event) => {
      let msg: any;
      try {
        msg = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString());
      } catch (e) {
        console.warn('Received non-JSON WS message, ignoring');
        return;
      }
      
      // Generic requestId error routing across all pending request queues (P01/R2)
      if ((msg.type === 'error' || msg.type === 'resume_failed' || msg.type === 'consume_failed' || msg.type.endsWith('_failed')) && msg.requestId) {
        for (const [expectType, queue] of this.pendingRequests.entries()) {
          const index = queue.findIndex(req => req.requestId === msg.requestId);
          if (index !== -1) {
            const [resolver] = queue.splice(index, 1);
            clearTimeout(resolver.timeoutId);
            const err = new Error(msg.error || msg.message || msg.reason || `Request failed with ${msg.type}`);
            (err as any).code = msg.code || msg.errorCode || msg.error || msg.reason;
            (err as any).type = msg.type;
            resolver.reject(err);
            if (queue.length === 0) {
              this.pendingRequests.delete(expectType);
            }
            return;
          }
        }
      }

      // Handle Response matching by event type
      if (this.pendingRequests.has(msg.type)) {
        const queue = this.pendingRequests.get(msg.type)!;
        if (queue.length > 0) {
          if (msg.requestId) {
            const index = queue.findIndex(req => req.requestId === msg.requestId);
            if (index !== -1) {
              const [resolver] = queue.splice(index, 1);
              clearTimeout(resolver.timeoutId);
              resolver.resolve(msg);
              if (queue.length === 0) {
                this.pendingRequests.delete(msg.type);
              }
              return;
            } else {
              console.warn('Received response for unknown requestId:', msg.requestId);
            }
          } else {
            // Fallback for requests that don't echo requestId
            const resolver = queue.shift()!;
            clearTimeout(resolver.timeoutId);
            resolver.resolve(msg);
            if (queue.length === 0) {
              this.pendingRequests.delete(msg.type);
            }
            return;
          }
        }
      }

      // Handle server-initiated events
      switch (msg.type) {
        case 'pong':
          this.lastPongAt = Date.now();
          if (msg.timestamp) {
            this.pingRtt = this.lastPongAt - msg.timestamp;
          }
          break;
        case 'consume_failed':
          if (this.pendingRequests.has('consumed')) {
            const queue = this.pendingRequests.get('consumed')!;
            if (msg.requestId) {
              const index = queue.findIndex(req => req.requestId === msg.requestId);
              if (index !== -1) {
                const [resolver] = queue.splice(index, 1);
                clearTimeout(resolver.timeoutId);
                resolver.reject(new Error(`Failed to consume: ${msg.errorCode || msg.reason}`));
                if (queue.length === 0) {
                  this.pendingRequests.delete('consumed');
                }
              }
            } else if (queue.length > 0) {
              const resolver = queue.shift()!;
              clearTimeout(resolver.timeoutId);
              resolver.reject(new Error(`Failed to consume: ${msg.errorCode || msg.reason}`));
              if (queue.length === 0) {
                this.pendingRequests.delete('consumed');
              }
            }
          }
          break;
        case 'produce_failed':
          if (this.pendingRequests.has('produced')) {
            const queue = this.pendingRequests.get('produced')!;
            if (msg.requestId) {
              const index = queue.findIndex(req => req.requestId === msg.requestId);
              if (index !== -1) {
                const [resolver] = queue.splice(index, 1);
                clearTimeout(resolver.timeoutId);
                resolver.reject(new Error(msg.message || msg.errorCode || 'Failed to produce'));
                if (queue.length === 0) {
                  this.pendingRequests.delete('produced');
                }
              }
            } else if (queue.length > 0) {
              const resolver = queue.shift()!;
              clearTimeout(resolver.timeoutId);
              resolver.reject(new Error(msg.message || msg.errorCode || 'Failed to produce'));
              if (queue.length === 0) {
                this.pendingRequests.delete('produced');
              }
            }
          }
          break;
        case 'action:ack':
          this.onActionAck?.(msg);
          break;
        case 'session_status':
          if (typeof msg.sessionStateVersion === 'number') {
            if (msg.sessionStateVersion <= this.sessionStateVersion) {
              console.warn(`[WebRTC] Ignoring stale session_status version ${msg.sessionStateVersion} (current: ${this.sessionStateVersion})`);
              return;
            }
            this.sessionStateVersion = msg.sessionStateVersion;
          }

          this.sessionStatus = msg.status;
          if (msg.userId) this.userId = msg.userId;
          if (msg.participantId) this.participantId = msg.participantId;
          if (msg.name) this.userName = msg.name;
          if (msg.role) this.userRole = msg.role;
          if (msg.roomName) this.roomName = msg.roomName;
          if (msg.meetingInstanceId) this.meetingInstanceId = msg.meetingInstanceId;
          if (msg.resumeToken) this.resumeToken = msg.resumeToken;
          if (typeof msg.sessionGeneration === 'number') this.sessionGeneration = msg.sessionGeneration;
          if (typeof msg.admissionGeneration === 'number') this.admissionGeneration = msg.admissionGeneration;
          if (msg.permissions) {
             this.onInitialPermissions?.(msg.permissions);
          }
          if (msg.maxParticipants) this.maxParticipants = msg.maxParticipants;
          if (typeof msg.isWaitingRoomEnabled === 'boolean') {
            this.isWaitingRoomEnabled = msg.isWaitingRoomEnabled;
          } else if (typeof msg.bypassWaitingRoom === 'boolean') {
            this.isWaitingRoomEnabled = !msg.bypassWaitingRoom;
          }
          if (msg.settings) {
            this.onRoomSettingsUpdated?.(msg.settings, 'Server');
          }
          if (typeof msg.meetingStartedAt === 'number') {
            this.meetingStartedAt = msg.meetingStartedAt;
            this.onMeetingStartedAt?.(msg.meetingStartedAt);
          }
          this.onSessionStatus?.(msg);
          
          if (msg.status === 'denied') {
            if (this.userRole === 'host') {
              console.warn('[WebRTC] Ignoring denied status for host');
              return;
            }
            this.onConnectionStateChange?.('denied');
            this.isIntentionalDisconnect = true;
            this.disconnect();
            return;
          }
          if (msg.status === 'kicked') {
            this.onConnectionStateChange?.('kicked');
            this.isIntentionalDisconnect = true;
            this.disconnect();
            return;
          }
          if (msg.status === 'ended') {
            this.onConnectionStateChange?.('ended');
            this.isIntentionalDisconnect = true;
            this.disconnect();
            return;
          }
          if (msg.status === 'waiting') {
            this.onConnectionStateChange?.('waiting');
            return; // Don't republish yet
          }
          if (msg.status === 'active') {
            if (this.device?.loaded) {
              // Selective reconciliation: Check if existing transports are still healthy
              const sendHealthy = this.sendTransport && (this.sendTransport.connectionState === 'connected' || this.sendTransport.connectionState === 'connecting' || this.sendTransport.connectionState === 'new');
              const recvHealthy = this.recvTransport && (this.recvTransport.connectionState === 'connected' || this.recvTransport.connectionState === 'connecting' || this.recvTransport.connectionState === 'new');

              if (msg.mediaState !== 'reset' && sendHealthy && recvHealthy) {
                console.log("[WebRTC] Session resumed with healthy existing transports. Reconciling remote producers without duplicate republish...");
                this.request('getProducers', 'producersList').then((res) => {
                  if (res?.producers) {
                    for (const p of res.producers) {
                      if (!this.consumers.has(p.producerId) && !this.producerToConsumer.has(p.producerId)) {
                        this.consumeRemoteStream(p.producerId, p.participantId, p.userId, p.name, p.kind, p.appData).catch(console.error);
                      }
                    }
                  }
                }).catch(console.error);
              } else {
                console.log("[WebRTC] Media state reset by server or transports interrupted. Performing selective media recovery...");
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                  this.ws.send(JSON.stringify({ type: 'reset_webrtc_state' }));
                }
                this.republishMedia().catch(console.error);
              }
              this.onConnectionStateChange?.('connected');
            } else {
              // First time active or fresh device load
              this.initializeMediasoup().then(async () => {
                try {
                  const res = await this.request('getProducers', 'producersList');
                  if (res.producers) {
                    for (const p of res.producers) {
                      await this.consumeRemoteStream(p.producerId, p.participantId, p.userId, p.name, p.kind, p.appData);
                    }
                  }
                  this.onConnectionStateChange?.('connected');
                } catch (e) {
                  console.error("Failed to load existing producers:", e);
                }
              }).catch(err => {
                console.error("Failed to initialize mediasoup", err); 
                this.onConnectionStateChange?.('failed');
              });
            }
          }
          break;
        case 'newProducer':
          this.enqueueConsume(msg);
          break;
        case 'user_joined':
          this.onUserJoined?.(msg);
          break;
        case 'participants_list':
          this.onParticipantsList?.(msg.participants);
          break;
        case 'user_left':
          this.onUserLeft?.(msg.participantId || msg.userId);
          // Cleanup consumers for this user
          break;
        case 'role_changed':
          this.onRoleChanged?.(msg.userId, msg.role, msg.participantId);
          if (msg.userId === this.userId || (msg.participantId && msg.participantId === this.userId)) {
            this.userRole = msg.role;
          }
          break;
        case 'chat':
          this.onChatMessage?.(msg);
          break;
        case 'chat_cleared':
          this.onChatCleared?.();
          break;
        case 'reaction':
          this.onReaction?.(msg);
          break;
        case 'poll_create':
          this.onPollCreate?.(msg);
          break;
        case 'poll_vote':
          this.onPollVote?.(msg);
          break;
        case 'poll_ended':
          this.onPollEnded?.(msg);
          break;
        case 'poll_history':
          this.onPollHistory?.(msg.polls);
          break;
        case 'mute_state':
          this.onMuteState?.(msg);
          break;
        case 'audio_connection_status':
          this.onRemoteAudioConnectionStatus?.(msg);
          break;
        case 'camera_state':
        this.lastCameraStateReceived = new Date().toISOString() + ' ' + JSON.stringify(msg);
        this.onCameraState?.(msg);
        break;
        case 'connection_poor':
          // Auto-Degrade to Audio-Only
          if (this.isLowBandwidth) {
            const consumer = this.consumers.get(msg.producerId);
            // DO NOT pause screen shares
            if (consumer && consumer.kind === 'video' && consumer.appData?.source !== 'screen' && !consumer.paused) {
              consumer.pause();
              console.warn("Connection poor: Paused video consumer", msg.producerId);
            }
          }
          break;
        case 'connection_recovered':
          if (this.isLowBandwidth) {
            const consumer = this.consumers.get(msg.producerId);
            if (consumer && consumer.kind === 'video' && consumer.paused) {
              consumer.resume();
              console.log("Connection recovered: Resumed video consumer", msg.producerId);
            }
          }
          break;
        case 'hand_raise':
          this.onHandRaise?.(msg);
          break;
        case 'waiting_room_request':
          this.onWaitingRoomRequest?.(msg);
          break;
        case 'waiting_room_denied':
          this.onWaitingRoomDenied?.(msg);
          break;
        case 'waiting_room_denied_all':
          this.onWaitingRoomDeniedAll?.();
          break;
        case 'chat_history':
          this.onChatHistory?.(msg.messages);
          break;
        case 'chat_cleared':
          this.onChatCleared?.();
          break;
        case 'poll_history':
          this.onPollHistory?.(msg.polls);
          break;
        case 'note_history':
          this.onNoteHistory?.(msg.content);
          break;
        case 'qa_history':
          this.onQAHistory?.(msg.messages);
          break;
        case 'qa_updated':
          this.onQAUpdated?.(msg);
          break;
        case 'note_history':
          this.onNoteHistory?.(msg.content);
          break;
        case 'note_update':
          this.onNoteUpdate?.(msg);
          break;
        case 'ecinema_action':
          this.onECinemaAction?.(msg);
          break;
        case 'screen_share_stopped': {
          const isSelf = (msg.participantId && msg.participantId === this.participantId) || 
                         (msg.userId && msg.userId === this.userId);
          if (isSelf && (this.screenShareProducer || this.localScreenTrack)) {
            this.stopScreenShareProducer({ serverAlreadyClosed: true });
          }
          this.onScreenShareStopped?.(msg.userId, msg.producerId, msg.participantId);
          break;
        }
        case 'producer_closed': {
          // The remote producer was closed — clean up our local consumer
          let closedConsumerId = msg.consumerId;
          this.consumers.forEach((consumer, consumerId) => {
            if (consumerId === msg.consumerId || consumer.producerId === msg.producerId) {
              closedConsumerId = consumerId;
              consumer.close();
              this.consumers.delete(consumerId);
            }
          });
          if (msg.producerId) {
            this.producerToConsumer.delete(msg.producerId);
          }
          this.onConsumerClosed?.(msg.producerId, { ...(msg.appData || {}), consumerId: closedConsumerId });
          break;
        }
        case 'active_speaker':
          this.onActiveSpeaker?.(msg.userIds, msg.participantIds || []);
          break;
        case 'meeting_started_at':
          if (typeof msg.meetingStartedAt === 'number') {
            this.meetingStartedAt = msg.meetingStartedAt;
            this.onMeetingStartedAt?.(msg.meetingStartedAt);
          }
          break;
        case 'server_load_high':
          this.onServerLoadHigh?.();
          break;
        case 'error':
          if (msg.message && msg.message.includes("Maximum number of active cameras")) {
            this.onServerReject?.(msg.message);
          }
          if (msg.message && (msg.message.includes("Microphones are locked") || msg.message.includes("Cameras are locked"))) {
            if (this.pendingRequests.has('produced')) {
              const queue = this.pendingRequests.get('produced')!;
              while (queue.length > 0) {
                const resolver = queue.shift()!;
                clearTimeout(resolver.timeoutId);
                resolver.reject(new Error(msg.message));
              }
              this.pendingRequests.delete('produced');
            }
          }
          break;
        case 'ask_to_unmute':
          this.onAskToUnmute?.(msg.hostName);
          break;
        case 'force_mute':
          this.onForceMute?.(msg.reason);
          break;
        case 'force_video_off':
          this.onForceVideoOff?.(msg.reason);
          break;
        case 'room_settings_updated':
          this.onRoomSettingsUpdated?.(msg.settings, msg.updatedBy);
          break;
        case 'screen_share_policy_changed':
          this.onScreenSharePolicyChanged?.(msg.mode, msg.version);
          break;
        case 'participant_screen_share_permission_changed':
          this.onParticipantScreenSharePermissionChanged?.(msg.targetUserId, msg.permission, msg.version, msg.targetParticipantId);
          break;
        case 'screen_share_stopped':
          // Existing handling might be generic, but we explicitly handle host stops
          this.onScreenShareStoppedByHost?.(msg.userId, msg.producerId);
          break;
        case 'PARTICIPANT_PING':
          this.onParticipantPingReceived?.(msg);
          break;
        case 'PING_STATUS':
          this.onPingStatus?.(msg);
          break;
        case 'ecinema_update':
          this.onECinemaUpdate?.(msg.link);
          break;
        case 'network_quality':
          this.onParticipantNetworkQuality?.(msg.userId, msg.quality);
          break;
        case 'caption':
          console.log('[WebRTCClient] Received caption message from server:', msg);
          this.onCaptionReceived?.(msg.userId, msg.name, msg.text, msg.isFinal, msg.lang);
          break;
        case 'donation_status':
          this.onDonationStatusReceived?.(msg.active);
          break;
        case 'donation_success':
          this.onDonationSuccessReceived?.(msg.userId, msg.name, msg.amount, msg.currency);
          break;
        case 'recording_started':
          this.onRecordingStarted?.();
          break;
        case 'recording_stopping':
          this.onRecordingStopping?.();
          break;
        case 'recording_stopped':
          this.onRecordingStopped?.();
          break;
        case 'sync_panel':
          this.onSyncPanel?.(msg.panel);
          break;
      }
    };

    this.ws.onerror = (err) => {
      console.error('WebSocket Error:', err);
    };

    this.ws.onclose = (event: CloseEvent) => {
      if (this.pingInterval) clearInterval(this.pingInterval);
      if (this.statsInterval) clearInterval(this.statsInterval);
      this.lastCloseCode = event.code;
      this.lastCloseReason = event.reason;
      console.log(`[WebRTC] Signaling socket closed (code=${event.code}, reason="${event.reason}", intentional=${this.isIntentionalDisconnect})`);

      if (!this.isIntentionalDisconnect) {
        this.onConnectionStateChange?.('reconnecting');
        this.attemptReconnect();
      }
    };
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached. Giving up.');
      this.onConnectionStateChange?.('failed');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000); // Max 10s backoff
    console.log(`Reconnecting signaling in ${delay}ms (Attempt ${this.reconnectAttempts})...`);
    
    this.reconnectTimeoutId = setTimeout(() => {
      this.connect();
    }, delay);
  }

  public manualReconnect(): Promise<void> {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = undefined;
    }
    this.reconnectAttempts = 0;
    this.iceReconnectAttempts = 0;
    this.isIntentionalDisconnect = false;
    this.onConnectionStateChange?.('connecting');
    return this.connect();
  }

  private request(sendType: string, expectType: string, payload: any = {}): Promise<any> {
    const requestId = payload.requestId || Math.random().toString(36).substring(2, 15);
    if (!payload.requestId) payload.requestId = requestId;

    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('WebSocket is not connected'));
      }
      
      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(expectType)) {
          const queue = this.pendingRequests.get(expectType)!;
          const index = queue.findIndex(req => req.resolve === resolve);
          if (index !== -1) {
            queue.splice(index, 1);
            reject(new Error(`Timeout waiting for ${expectType}`));
            if (queue.length === 0) {
              this.pendingRequests.delete(expectType);
            }
          }
        }
      }, 10000);

      if (!this.pendingRequests.has(expectType)) {
        this.pendingRequests.set(expectType, []);
      }
      this.pendingRequests.get(expectType)!.push({ resolve, reject, timeoutId, requestId });

      this.ws.send(JSON.stringify({
        type: sendType,
        ...payload
      }));
    });
  }

  // --- Collaboration Methods ---
  
  public sendChatMessage(message: string, targetUserId?: string, fileUrl?: string, clientEventId?: string): string {
    const eventId = clientEventId || crypto.randomUUID();
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'chat', message, targetUserId, fileUrl, clientEventId: eventId }));
    }
    return eventId;
  }

  public sendClearChat() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'clear_chat' }));
    }
  }

  public changeUserRole(userId: string, newRole: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'change_role', userId, newRole }));
    }
  }

  public admitAllUsers() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'admit_all' }));
    }
  }

  public denyAllUsers() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'deny_all' }));
    }
  }

  public updateRoomSettings(settings: { micLocked?: boolean, videoLocked?: boolean, chatLocked?: boolean, bypassWaitingRoom?: boolean }) {
    this.sendUpdateRoomSettings(settings);
  }

  public forceMuteUser(userId?: string, target?: 'all' | 'all_except_presenters' | 'all_except_hosts') {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const finalTarget = target || (userId ? 'specific' : 'all');
      this.ws.send(JSON.stringify({ type: 'force_mute', userId, target: finalTarget }));
    }
  }

  public askToUnmute(userId: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'ask_to_unmute', userId }));
    }
  }

  public forceVideoOffUser(userId?: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'force_video_off', userId }));
    }
  }

  public askQuestion(question: string, isAnonymous: boolean) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'ask_question', question, isAnonymous }));
    }
  }

  public upvoteQuestion(questionId: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'upvote_question', questionId }));
    }
  }

  public answerQuestion(questionId: string, answerText: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'answer_question', questionId, answerText }));
    }
  }

  public deleteQuestion(questionId: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'delete_question', questionId }));
    }
  }

  public sendReaction(reaction: string, clientEventId?: string): string {
    const eventId = clientEventId || crypto.randomUUID();
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'reaction', reaction, clientEventId: eventId }));
    }
    return eventId;
  }

  public sendNoteUpdate(content: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'note_update', content }));
    }
  }

  public sendECinemaAction(action: 'play' | 'pause', time?: number) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'ecinema_action', action, time }));
    }
  }

  public createPoll(pollId: string, question: string, options: any[]) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'poll_create', pollId, question, options }));
    }
  }

  public votePoll(pollId: string, optionId: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'poll_vote', pollId, optionId }));
    }
  }

  public endPoll(pollId: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'end_poll', pollId }));
    }
  }

  public sendMuteState(isMuted: boolean, clientEventId?: string): string {
    const eventId = clientEventId || crypto.randomUUID();
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'mute_state', isMuted, clientEventId: eventId }));
    }
    return eventId;
  }

  public sendCameraState(isCameraOn: boolean, audioOnlyMode: boolean = false, videoSuspendedReason?: 'network', clientEventId?: string): string {
    const eventId = clientEventId || crypto.randomUUID();
    if (this.ws?.readyState === WebSocket.OPEN) {
      const payload = { type: 'camera_state', isCameraOn, audioOnlyMode, videoSuspendedReason, clientEventId: eventId };
      this.lastCameraStateBroadcast = new Date().toISOString() + ' ' + JSON.stringify(payload);
      this.ws.send(JSON.stringify(payload));
    }
    return eventId;
  }

  public sendHandRaise(isHandRaised: boolean, clientEventId?: string): string {
    const eventId = clientEventId || crypto.randomUUID();
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'hand_raise', isHandRaised, clientEventId: eventId }));
    }
    return eventId;
  }

  public admitUser(userId: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'admit_user', userId }));
    }
  }

  public admitAll() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'admit_all' }));
    }
  }

  public denyUser(userId: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'deny_user', userId }));
    }
  }

  public sendLeaveMeeting() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'leave_meeting' }));
    }
  }

  public sendChangeRole(userId: string, newRole: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'change_role', userId, newRole }));
    }
  }

  public async getRouterRtpCapabilities() {
    console.log('[WebRTC] Requesting Router RTP Capabilities from server...');
    const res = await this.request('getRouterRtpCapabilities', 'routerCapabilities');
    console.log('[WebRTC] Received Router RTP Capabilities:', res.rtpCapabilities);
    return res.rtpCapabilities;
  }

  public async createDevice() {
    console.log('[WebRTC] Creating Mediasoup Device...');
    const routerRtpCapabilities = await this.getRouterRtpCapabilities();
    const mediasoupClient = await import('mediasoup-client');
    this.device = new mediasoupClient.Device();
    await this.device.load({ routerRtpCapabilities });
    console.log('[WebRTC] Mediasoup Device loaded successfully. Client RTP Capabilities:', this.device.rtpCapabilities);
  }

  public async initializeMediasoup() {
    console.log('[WebRTC] Initiating WebRTC connection flow...');
    await this.createDevice();

    if (!this.device) throw new Error("Device not initialized");

    if (!this.isRecorderMode) {
      // 1. Create Send Transport
      console.log('[WebRTC] Requesting Send Transport creation...');
      const sendTransportData = await this.request('createWebRtcTransport', 'transportCreated', { direction: 'send' });
      console.log('[WebRTC] Send Transport created on server:', sendTransportData.transportParams.id);
      this.sendTransport = this.device.createSendTransport(sendTransportData.transportParams);

      this.sendTransport.on('connect', async ({ dtlsParameters }: any, callback: any, errback: any) => {
        console.log('[WebRTC] Send Transport connecting with DTLS parameters...');
        try {
          await this.request('connectWebRtcTransport', 'transportConnected', {
            transportId: this.sendTransport!.id,
            dtlsParameters
          });
          console.log('[WebRTC] Send Transport connected successfully!');
          callback();
        } catch (error: any) {
          console.error('[WebRTC] Send Transport connect error:', error);
          errback(error);
        }
      });

      this.sendTransport.on('produce', async ({ kind, rtpParameters, appData }: any, callback: any, errback: any) => {
        const isAudioMic = kind === 'audio' && (appData as any)?.source !== 'screen-audio';
        const shouldStartPaused = isAudioMic ? this.desiredMicMuted : false;
        console.log(`[WebRTC] Producing local media (${kind}, source: ${(appData as any)?.source || 'unknown'}, paused: ${shouldStartPaused})...`);
        try {
          const { id } = await this.request('produce', 'produced', {
            transportId: this.sendTransport!.id,
            kind,
            rtpParameters,
            appData, // Forward source tag ('camera' | 'screen' | 'mic') to server
            paused: shouldStartPaused
          });
          console.log(`[WebRTC] Producer created on server. Producer ID: ${id} (paused: ${shouldStartPaused})`);
          callback({ id });
        } catch (error: any) {
          console.error(`[WebRTC] Produce error (${kind}):`, error);
          errback(error);
        }
      });

      this.sendTransport.on('connectionstatechange', (state: any) => {
        console.log(`[WebRTC] Send Transport ICE State changed to: ${state}`);
        if (state === 'connected') {
          this.iceReconnectAttempts = 0;
        } else if (state === 'disconnected') {
          console.warn('[WebRTC] Send Transport ICE State disconnected. Waiting for auto-recovery...');
        } else if (state === 'failed') {
          console.error('[WebRTC] Send Transport connection failed! (Possible firewall/UDP port issue). Forcing republish...');
          this.restartTransportIce(this.sendTransport);
        }
      });
    }

    // 4. Create Receive Transport
    console.log('[WebRTC] Requesting Receive Transport creation...');
    const recvTransportData = await this.request('createWebRtcTransport', 'transportCreated', { direction: 'recv' });
    console.log('[WebRTC] Receive Transport created on server:', recvTransportData.transportParams.id);
    this.recvTransport = this.device.createRecvTransport(recvTransportData.transportParams);

    this.recvTransport.on('connect', async ({ dtlsParameters }: any, callback: any, errback: any) => {
      console.log('[WebRTC] Receive Transport connecting with DTLS parameters...');
      try {
        await this.request('connectWebRtcTransport', 'transportConnected', {
          transportId: this.recvTransport!.id,
          dtlsParameters
        });
        console.log('[WebRTC] Receive Transport connected successfully!');
        callback();
      } catch (error: any) {
        console.error('[WebRTC] Receive Transport connect error:', error);
        errback(error);
      }
    });

    this.recvTransport.on('connectionstatechange', (state: any) => {
      console.log(`[WebRTC] Receive Transport ICE State changed to: ${state}`);
      if (state === 'connected') {
        this.iceReconnectAttempts = 0;
      } else if (state === 'disconnected') {
        console.warn('[WebRTC] Receive Transport ICE State disconnected. Waiting for auto-recovery...');
      } else if (state === 'failed') {
        console.error('[WebRTC] Receive Transport connection failed! (Possible firewall/UDP port issue). Forcing republish...');
        this.restartTransportIce(this.recvTransport);
      }
    });

    // 5. Drain any queued consume requests that arrived while initializing
    if (this.pendingConsumes.length > 0) {
      console.log(`[WebRTC] Draining ${this.pendingConsumes.length} queued consume requests...`);
      for (const req of this.pendingConsumes) {
        this.consumeRemoteStream(req.producerId, req.producerParticipantId, req.producerUserId, req.userName, req.kind, req.appData).catch(console.error);
      }
      this.pendingConsumes = [];
    }

    this.startNetworkMonitor();
  }

  public stopNetworkMonitor() {
    if (this.networkInterval) {
      clearInterval(this.networkInterval);
      this.networkInterval = undefined;
    }
    // Clear states
    (this as any).pendingCandidate = undefined;
    (this as any).pendingStreak = 0;
    console.log('[WebRTC] network_monitor_stopped');
    console.log('[WebRTC] network_quality_state_cleared');
    this.broadcastNetworkLabelChange('good');
  }

  public updateNetworkConfig(newConfig: NetworkDetectionConfig) {
    const oldConfig = this.networkConfig;
    this.networkConfig = { ...newConfig };
    console.log('[WebRTC] network_detection_config_updated', this.networkConfig);

    if (!this.networkConfig.networkDetectionEnabled) {
      if (oldConfig.networkDetectionEnabled) {
        console.log('[WebRTC] network_detection_disabled');
        this.stopNetworkMonitor();
      }
      return;
    }

    if (!oldConfig.networkDetectionEnabled) {
      console.log('[WebRTC] network_detection_enabled');
    }

    // Restart if intervals or window changed, or if it was just enabled
    if (
      !oldConfig.networkDetectionEnabled ||
      oldConfig.networkMonitorIntervalMs !== this.networkConfig.networkMonitorIntervalMs ||
      oldConfig.networkWindowSize !== this.networkConfig.networkWindowSize ||
      oldConfig.poorNetworkRttMs !== this.networkConfig.poorNetworkRttMs ||
      oldConfig.poorNetworkLossPercent !== this.networkConfig.poorNetworkLossPercent ||
      oldConfig.poorNetworkJitterMs !== this.networkConfig.poorNetworkJitterMs
    ) {
      console.log('[WebRTC] network_monitor_restarted_with_new_config', this.networkConfig);
      this.startNetworkMonitor();
    }
  }

  public setConsumerPauseReason(
    consumerId: string, 
    reason: 'NETWORK' | 'PRODUCER' | 'POLICY' | 'USER' | 'VISIBILITY', 
    isPaused: boolean
  ) {
    let reasons = this.consumerPauseReasons.get(consumerId);
    if (!reasons) {
      reasons = new Set();
      this.consumerPauseReasons.set(consumerId, reasons);
    }

    if (isPaused) {
      reasons.add(reason);
    } else {
      reasons.delete(reason);
    }

    const consumer = this.consumers.get(consumerId);
    if (!consumer || consumer.closed) return;

    const shouldBePaused = reasons.size > 0;
    if (shouldBePaused && !consumer.paused) {
      consumer.pause();
      this.request('pause_consumer', 'consumer_paused', { consumerId }).catch(console.error);
    } else if (!shouldBePaused && consumer.paused) {
      this.request('resume', 'resumed', { consumerId }).then(() => {
        consumer.resume();
      }).catch(console.error);
    }
  }

  public registerConsumerMetadata(meta: ConsumerMetadata) {
    this.consumerMetadata.set(meta.consumerId, meta);
  }

  public unregisterConsumerMetadata(consumerId: string) {
    this.consumerMetadata.delete(consumerId);
    this.consumerPauseReasons.delete(consumerId);
    this.adaptationController.removeConsumer(consumerId);
  }

  public updateConsumerVisibility(consumerId: string, isVisible: boolean) {
    const meta = this.consumerMetadata.get(consumerId);
    if (meta) {
      meta.isVisibleOnScreen = isVisible;
    }
  }

  public updateActiveSpeaker(userId: string) {
    for (const [, meta] of this.consumerMetadata.entries()) {
      meta.isActiveSpeaker = (meta.userId === userId);
    }
  }

  private startNetworkMonitor() {
    this.stopNetworkMonitor();
    
    if (!this.networkConfig.networkDetectionEnabled) {
      console.log('[WebRTC] Network detection is disabled, skipping startNetworkMonitor.');
      return;
    }
    
    console.log('[WebRTC] network_monitor_started_adaptive', this.networkConfig);

    this.networkInterval = setInterval(async () => {
      if (!this.sendTransport && !this.recvTransport) return;
      
      try {
        const now = performance.now();
        let rtt = 0;
        let jitter = 0;
        let bytesSent = 0;
        let bytesRecv = 0;
        let packetsSent = 0;
        let packetsRecv = 0;
        let inboundLoss = 0;
        let outboundLoss = 0;
        let framesDropped = 0;
        let framesEncoded = 0;
        let availableOutgoingBitrate: number | null = null;
        let iceState = this.sendTransport?.connectionState || this.recvTransport?.connectionState || 'new';

        if (this.sendTransport) {
          const sendStats = await this.sendTransport.getStats();
          sendStats.forEach((stat: any) => {
            if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
              rtt = Math.max(rtt, stat.currentRoundTripTime ? stat.currentRoundTripTime * 1000 : 0);
              if (stat.availableOutgoingBitrate) availableOutgoingBitrate = stat.availableOutgoingBitrate;
            }
            if (stat.type === 'remote-inbound-rtp') {
              rtt = Math.max(rtt, stat.roundTripTime ? stat.roundTripTime * 1000 : 0);
              jitter = Math.max(jitter, stat.jitter ? stat.jitter * 1000 : 0);
              outboundLoss += stat.packetsLost || 0;
            }
            if (stat.type === 'outbound-rtp') {
              bytesSent += stat.bytesSent || 0;
              packetsSent += stat.packetsSent || 0;
              if (stat.kind === 'video') {
                framesEncoded += stat.framesEncoded || 0;
              }
            }
            if (stat.type === 'media-source' && stat.kind === 'video') {
              framesDropped += stat.droppedFrames || 0;
            }
          });
        }

        if (this.recvTransport) {
          const recvStats = await this.recvTransport.getStats();
          recvStats.forEach((stat: any) => {
            if (stat.type === 'inbound-rtp') {
              bytesRecv += stat.bytesReceived || 0;
              packetsRecv += stat.packetsReceived || 0;
              inboundLoss += stat.packetsLost || 0;
              jitter = Math.max(jitter, stat.jitter ? stat.jitter * 1000 : 0);
            }
          });
        }

        // 1. Process directional stats snapshot with EWMA & 3-stage classification
        const directionalStats = this.adaptationController.processStatsSnapshot({
          nowMs: now,
          rttMs: rtt,
          jitterMs: jitter,
          totalBytesSent: bytesSent,
          totalBytesRecv: bytesRecv,
          totalPacketsSent: packetsSent,
          totalPacketsRecv: packetsRecv,
          inboundPacketsLost: inboundLoss,
          outboundPacketsLost: outboundLoss,
          framesEncoded,
          framesDropped,
          availableOutgoingBitrate,
          iceState,
          isRepublishing: this.isRepublishing
        });

        // 2. Generate and apply differential adaptation plan
        const consumersList = Array.from(this.consumerMetadata.values());
        const plan = this.adaptationController.generateAdaptationPlan(
          consumersList, 
          directionalStats.availableDownlinkBps
        );

        // 3. Dispatch batched differential layer/pause updates if changes exist
        if (plan.changes.length > 0) {
          // Apply local pause reasons
          for (const change of plan.changes) {
            if (typeof change.pausedByNetwork === 'boolean') {
              this.setConsumerPauseReason(change.consumerId, 'NETWORK', change.pausedByNetwork);
            }
          }

          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
              type: 'set_consumer_adaptation',
              adaptationEpoch: plan.adaptationEpoch,
              changes: plan.changes
            }));
          }
        }

        // 4. Adapt local webcam uplink
        if (this.localVideoProducer && !this.localVideoProducer.closed) {
          if (plan.uplinkPausedByNetwork && !this.cameraSuppressedByNetwork) {
            this.cameraSuppressedByNetwork = true;
            this.localVideoProducer.pause();
            console.log('[ADAPTATION] Camera publication paused by network due to uplink CRITICAL');
          } else if (!plan.uplinkPausedByNetwork && this.cameraSuppressedByNetwork) {
            this.cameraSuppressedByNetwork = false;
            if (this.desiredCameraOn && !this.hostCameraBlocked) {
              this.localVideoProducer.resume();
              console.log('[ADAPTATION] Camera publication resumed after uplink recovery');
            }
          }

          if (typeof (this.localVideoProducer as any).setMaxSpatialLayer === 'function') {
            (this.localVideoProducer as any).setMaxSpatialLayer(plan.uplinkMaxSpatialLayer).catch(() => {});
          }
        }

        // 5. Emit directional telemetry and UI callbacks
        this.onDirectionalNetworkQualityChange?.(directionalStats);

        const mappedLabel: NetworkQualityLabel = 
          directionalStats.overall === 'CRITICAL' ? 'poor_network' :
          directionalStats.overall === 'POOR' ? 'poor_network' :
          directionalStats.overall === 'FAIR' ? 'unstable_network' : 'good';

        this.broadcastNetworkLabelChange(mappedLabel);

        if (this.onNetworkDebugSnapshot) {
          this.onNetworkDebugSnapshot({
            label: mappedLabel,
            rtt: directionalStats.rttMs,
            packetLoss: directionalStats.downlinkLossPercent,
            jitter: directionalStats.jitterMs,
            sendBitrate: directionalStats.sendBitrateBps,
            recvBitrate: directionalStats.recvBitrateBps,
            availableOutgoingBitrate: directionalStats.availableUplinkBps,
            framesEncoded,
            framesDropped,
            fps: framesEncoded > 0 ? framesEncoded / 2 : 0,
            iceState,
            reconnectCount: 0,
            diagnosticType: directionalStats.diagnosticType === 'local_uplink' ? 'local_outbound' :
                            directionalStats.diagnosticType === 'local_downlink' ? 'local_inbound' :
                            directionalStats.diagnosticType === 'device' ? 'device' :
                            directionalStats.diagnosticType === 'server_recovery' ? 'media_server_recovery' : 'healthy'
          });
        }
      } catch (e) {
      }
    }, 2000);
  }
  
  private broadcastNetworkLabelChange(label: NetworkQualityLabel) {
    this.onNetworkQualityChange?.(label);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'network_quality', quality: label }));
    }
  }

  private async restartTransportIce(transport: any) {
    if (!transport) return;
    try {
      console.log(`[WebRTC] Requesting ICE Restart for transport ${transport.id}`);
      const res = await this.request('restart_ice', 'ice_restarted', { transportId: transport.id });
      if (res.iceParameters) {
        await transport.restartIce({ iceParameters: res.iceParameters });
        console.log(`[WebRTC] ICE Restart successful for transport ${transport.id}`);
      }
    } catch (err) {
      console.error(`[WebRTC] ICE Restart failed for transport ${transport.id}:`, err);
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'reset_webrtc_state' }));
      }
      this.republishMedia().catch(console.error);
    }
  }

  private async republishMedia() {
    if (!this.device || this.isRepublishing) return;
    
    if (this.iceReconnectAttempts >= this.maxIceReconnectAttempts) {
      console.error(`[WebRTC] Exceeded max ICE reconnect attempts (${this.maxIceReconnectAttempts}). Halting recovery.`);
      this.onConnectionStateChange?.('failed');
      return;
    }
    this.iceReconnectAttempts++;
    
    this.isRepublishing = true;
    this.emitTelemetry('media_recovery_started');
    try {
    // Save current tracks
    const videoTrack = this.localVideoProducer?.track;
    const audioTrack = this.localAudioProducer?.track;
    const isVideoPaused = this.localVideoProducer?.paused;
    
    // Check screen share track
    const screenTrack = this.localScreenTrack;

    // Clean up old transports
    if (this.sendTransport) this.sendTransport.close();
    if (this.recvTransport) this.recvTransport.close();
    
    // Recreate transports
    const sendTransportData = await this.request('createWebRtcTransport', 'transportCreated', { direction: 'send' });
    this.sendTransport = this.device.createSendTransport(sendTransportData.transportParams);
    
    this.sendTransport.on('connect', async ({ dtlsParameters }: any, callback: any, errback: any) => {
      try {
        await this.request('connectWebRtcTransport', 'transportConnected', {
          transportId: this.sendTransport!.id,
          dtlsParameters
        });
        callback();
      } catch (error: any) { errback(error); }
    });

    this.sendTransport.on('produce', async ({ kind, rtpParameters, appData }: any, callback: any, errback: any) => {
      try {
        const isAudioMic = kind === 'audio' && (appData as any)?.source !== 'screen-audio';
        const shouldStartPaused = isAudioMic ? this.desiredMicMuted : false;
        const { id } = await this.request('produce', 'produced', {
          transportId: this.sendTransport!.id,
          kind,
          rtpParameters,
          appData,
          paused: shouldStartPaused
        });
        callback({ id });
      } catch (error: any) { errback(error); }
    });

    this.sendTransport.on('connectionstatechange', (state: any) => {
      console.log(`[WebRTC] Republish Send Transport ICE State changed to: ${state}`);
      if (state === 'connected') {
        this.iceReconnectAttempts = 0;
      } else if (state === 'disconnected') {
        console.warn('[WebRTC] Republish Send Transport ICE State disconnected. Waiting for auto-recovery...');
      } else if (state === 'failed') {
        console.error('[WebRTC] Send Transport connection failed! Forcing republish...');
        this.restartTransportIce(this.sendTransport);
      }
    });

    const recvTransportData = await this.request('createWebRtcTransport', 'transportCreated', { direction: 'recv' });
    this.recvTransport = this.device.createRecvTransport(recvTransportData.transportParams);

    this.recvTransport.on('connect', async ({ dtlsParameters }: any, callback: any, errback: any) => {
      try {
        await this.request('connectWebRtcTransport', 'transportConnected', {
          transportId: this.recvTransport!.id,
          dtlsParameters
        });
        callback();
      } catch (error: any) { errback(error); }
    });

    this.recvTransport.on('connectionstatechange', (state: any) => {
      console.log(`[WebRTC] Republish Receive Transport ICE State changed to: ${state}`);
      if (state === 'connected') {
        this.iceReconnectAttempts = 0;
      } else if (state === 'disconnected') {
        console.warn('[WebRTC] Republish Receive Transport ICE State disconnected. Waiting for auto-recovery...');
      } else if (state === 'failed') {
        console.error('[WebRTC] Receive Transport connection failed! Forcing republish...');
        this.restartTransportIce(this.recvTransport);
      }
    });

    // Republish saved tracks
    if (videoTrack) {
      if (videoTrack.readyState === 'live') {
        console.log('camera_reconnect_republish_started');
        const firstVideoCodec = this.device.rtpCapabilities.codecs?.find(c => c.kind === 'video');
        const isSVC = firstVideoCodec?.mimeType.toLowerCase().includes('av1') || firstVideoCodec?.mimeType.toLowerCase().includes('vp9');
        
        const encodings = this.isLowBandwidth 
          ? [{ maxBitrate: 150000 }] 
          : isSVC 
            ? [{ scalabilityMode: 'L3T3_KEY', maxBitrate: 1500000 }]
            : [
                { scaleResolutionDownBy: 4, maxBitrate: 150000, maxFramerate: 15 },
                { scaleResolutionDownBy: 2, maxBitrate: 500000, maxFramerate: 30 },
                { scaleResolutionDownBy: 1, maxBitrate: 1500000, maxFramerate: 30 }
              ];

        try {
          const videoCodec = this.device?.rtpCapabilities?.codecs?.find(
            (c: any) => c.mimeType.toLowerCase() === 'video/vp8'
          ) || this.device?.rtpCapabilities?.codecs?.find(
            (c: any) => c.mimeType.toLowerCase() === 'video/h264' && c.parameters?.['profile-level-id'] === '42e01f'
          );

          this.localVideoProducer = await this.sendTransport.produce({ 
            track: videoTrack,
            appData: { source: 'camera' },
            encodings,
            codec: videoCodec,
            codecOptions: { videoGoogleStartBitrate: 1000 }
          });
          if (isVideoPaused) this.localVideoProducer.pause();
          console.log('camera_reconnect_republish_completed');
        } catch (err) {
          console.log('camera_reconnect_republish_failed', err);
        }
      } else {
        console.log('camera_reconnect_republish_failed: track not live');
      }
    } else {
      console.log('camera_reconnect_skipped_camera_was_off');
    }
    
    if (audioTrack) {
      if (audioTrack.readyState === 'live') {
        const opusCodec = this.device?.rtpCapabilities?.codecs?.find(
          (c: any) => c.mimeType.toLowerCase() === 'audio/opus'
        );
        if (this.desiredMicMuted) {
          audioTrack.enabled = false;
          if (this.rawAudioTrack) this.rawAudioTrack.enabled = false;
        }
        this.localAudioProducer = await this.sendTransport.produce({ 
          track: audioTrack, 
          appData: { source: 'mic' },
          codec: opusCodec,
          disableTrackOnPause: true,
          zeroRtpOnPause: true
        });
        this.onAudioTrackReplaced?.();
        if (this.desiredMicMuted || this.audioConnectionStatus === 'muted') {
          this.localAudioProducer.pause();
          if (this.rawAudioTrack) this.rawAudioTrack.enabled = false;
          if (audioTrack) audioTrack.enabled = false;
        }
      } else {
        console.warn("[WebRTC] Mic track is closed during reconnect. Reacquiring hardware with desiredMicMuted=" + this.desiredMicMuted);
        this.emitTelemetry('mic_track_closed_detected');
        this.emitTelemetry('mic_reacquire_started');
        try {
          // Preserve explicit user mute intent during reconnect
          await this.enableMic(true, this.desiredMicMuted);
          this.emitTelemetry('mic_reacquire_success');
          if (this.desiredMicMuted) this.pauseMic();
        } catch (e) {
          console.error("Failed to reacquire mic during reconnect:", e);
          this.emitTelemetry('mic_reacquire_failed');
        }
      }
    }
    
    // SCREEN-002: Screen-share republish
    if (screenTrack) {
      this.emitTelemetry('screen_recovery_started');
      if (screenTrack.readyState === 'live') {
        this.emitTelemetry('screen_track_live_detected');
        
        let screenCodec;
        if (this.device.rtpCapabilities.codecs) {
          screenCodec = this.device.rtpCapabilities.codecs.find(
            (c: any) => c.mimeType.toLowerCase() === 'video/h264' && c.parameters?.['packetization-mode'] === 1
          );
        }

        // Clear screen share producer if exists
        if (this.screenShareProducer) {
          try {
            this.screenShareProducer.close();
          } catch (e) {
            console.warn('[WebRTC] Failed to close previous screen share producer', e);
          }
        }
        if (this.screenAudioShareProducer) {
          try {
            this.screenAudioShareProducer.close();
          } catch (e) {
            console.warn('[WebRTC] Failed to close previous screen audio producer', e);
          }
        }

        try {
          // Republish screen track
          this.screenShareProducer = await this.sendTransport.produce({
            track: screenTrack,
            codec: screenCodec,
            appData: { source: 'screen' },
            encodings: [{ maxBitrate: 1500000, maxFramerate: 15 }],
            codecOptions: { videoGoogleStartBitrate: 1000 }
          });
          this.emitTelemetry('screen_republish_success');
          // No need to manually request keyframe here since the server automatically asks for one on new producer creation,
          // but we can emit a log anyway
          this.emitTelemetry('screen_remote_consumers_recreated');
        } catch (e) {
          console.error("Failed to republish screen share:", e);
          this.emitTelemetry('screen_republish_failed');
          this.localScreenTrack = null;
        }
      } else {
        this.emitTelemetry('screen_track_ended_detected');
        this.localScreenTrack = null;
        if (this.screenShareProducer) {
          this.screenShareProducer.close();
          this.screenShareProducer = null;
        }
      }
      this.emitTelemetry('screen_recovery_completed');
    }
    
    this.emitTelemetry('media_recovery_completed');
    
    // Cleanup old ghosts before re-fetching
    this.consumers.forEach((consumer) => {
      consumer.close();
    });
    this.consumers.clear();

    // Re-fetch consumers
    try {
      const res = await this.request('getProducers', 'producersList');
      for (const p of res.producers || []) {
        try {
          await this.consumeRemoteStream(p.producerId, p.participantId, p.userId, p.name, p.kind, p.appData);
        } catch (err) {
          console.error(`Failed to consume producer ${p.producerId}:`, err);
        }
      }
    } catch (e) {
      console.error("Failed to re-sync producers after republish", e);
      throw e; // Throw so the main catch block can trigger a retry
    }
    
    } catch (err) {
      console.error("republishMedia failed", err);
      this.isRepublishing = false;
      
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        setTimeout(() => {
          console.warn("[WebRTC] Retrying republishMedia after failure...");
          this.republishMedia().catch(console.error);
        }, 2000);
      } else {
        this.onConnectionStateChange?.('failed');
      }
      return;
    } finally {
      this.isRepublishing = false;
    }
  }

  private async acquireCameraStream(deviceId?: string): Promise<MediaStream> {
    if (this.isRecorderMode) {
      throw new Error("Recorder mode cannot acquire camera stream");
    }
    
    this.cameraStartAttemptCount++;
    this.lastCameraErrorName = null;
    this.lastCameraErrorMessage = null;
    this.cameraFallbackReachedVideoTrue = false;

    // A. Selected device with safe ideal constraints
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const targetAspect = this.isWidescreenEnabled ? 16 / 9 : 4 / 3;
    
    // Cap mobile to 720p/960p max, desktop can go up to 1080p in HD
    const idealWidth = this.isHDVideo 
      ? (isMobile ? 1280 : (this.isWidescreenEnabled ? 1920 : 1280)) 
      : (this.isWidescreenEnabled ? 640 : 640);
    const idealHeight = this.isHDVideo 
      ? (isMobile ? 720 : (this.isWidescreenEnabled ? 1080 : 960)) 
      : (this.isWidescreenEnabled ? 360 : 480);

    const constraintsA: MediaStreamConstraints = {
      video: deviceId 
        ? { deviceId: { exact: deviceId }, width: { ideal: idealWidth }, height: { ideal: idealHeight }, aspectRatio: { ideal: targetAspect }, frameRate: { ideal: 24, max: 30 } }
        : { facingMode: "user", width: { ideal: idealWidth }, height: { ideal: idealHeight }, aspectRatio: { ideal: targetAspect }, frameRate: { ideal: 24, max: 30 } },
      audio: false
    };

    // B. Selected device only
    const constraintsB: MediaStreamConstraints = {
      video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "user" },
      audio: false
    };

    // C. General safe camera fallback
    const constraintsC: MediaStreamConstraints = {
      video: { 
        width: { ideal: this.isWidescreenEnabled ? 640 : 640 }, 
        height: { ideal: this.isWidescreenEnabled ? 360 : 480 }, 
        aspectRatio: { ideal: targetAspect },
        frameRate: { ideal: 15, max: 24 } 
      },
      audio: false
    };

    // D. Absolute fallback
    const constraintsD: MediaStreamConstraints = {
      video: true,
      audio: false
    };

    const attempts = [
      { name: 'A (Ideal)', constraints: constraintsA },
      { name: 'B (Device Only)', constraints: constraintsB },
      { name: 'C (Safe)', constraints: constraintsC },
      { name: 'D (Fallback)', constraints: constraintsD }
    ];

    for (const attempt of attempts) {
      this.lastCameraConstraintAttempt = attempt.name;
      if (attempt.name === 'C (Safe)') console.log('camera_fallback_to_safe_profile');
      if (attempt.name === 'D (Fallback)') {
        this.cameraFallbackReachedVideoTrue = true;
        console.log('camera_fallback_to_video_true');
      }

      let retries = 2;
      while (retries > 0) {
        try {
          console.log(`camera_permission_requested`);
          console.log(`camera_constraint_attempt: ${attempt.name}`);
          const stream = await navigator.mediaDevices.getUserMedia(attempt.constraints);
          console.log(`camera_permission_granted`);
          console.log(`camera_constraint_success: ${attempt.name}`);
          return stream;
        } catch (err: any) {
          this.lastCameraErrorName = err.name;
          this.lastCameraErrorMessage = err.message;
          console.log(`camera_constraint_failed: ${attempt.name}`, err.name);
          retries--;
          
          if (err.name === 'NotAllowedError') {
            console.log(`camera_permission_denied`);
            console.log(`camera_permission_error: ${err.name}`);
            throw new Error("Permission denied: Please allow camera access in your browser or system settings.");
          } else if (err.name === 'NotFoundError') {
            console.log(`camera_permission_error: ${err.name}`);
            throw new Error("No camera found: Please connect a camera or continue audio-only.");
          } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
            console.log(`camera_permission_error: ${err.name}`);
            throw new Error("Camera busy: Another app may be using the camera, or the OS blocked it.");
          } else if (err.name === 'SecurityError') {
            console.log(`camera_permission_error: ${err.name}`);
            throw new Error("Security Error: Camera cannot be accessed in this context.");
          }
          
          if (err.name === 'AbortError' && retries > 0) {
            console.warn(`Camera start timeout (${attempt.name}), retrying... (${retries} left)`);
            
            // Release stuck camera hardware before retry only when necessary
            if (this.rawCameraStream) {
              this.rawCameraStream.getTracks().forEach(t => t.stop());
            }
            if (this.videoProcessor) {
              this.videoProcessor.stopProcessing();
            }
            await new Promise(r => setTimeout(r, 400));
          } else if (err.name === 'OverconstrainedError') {
            console.warn(`OverconstrainedError on attempt ${attempt.name}, falling back to next...`);
            break; 
          } else if (retries === 0 || err.name !== 'AbortError') {
             console.warn(`Camera error on attempt ${attempt.name}: ${err.name} - ${err.message}`);
             break;
          }
        }
      }
    }
    
    // Improve user-facing recovery
    throw new Error("Camera could not start. Please close other apps using the camera, check browser permission, and try again.");
  }

  public async enableCamera(): Promise<MediaStreamTrack> {
    if (!this.device || !this.sendTransport) throw new Error("Device not initialized");
    if (this.cameraStartInProgress) throw new Error("Camera start already in progress");
    
    this.cameraStartInProgress = true;
    try {
      this.emitTelemetry('video_permission_requested');
      // Cleanup existing camera producer if replacing
      if (this.localVideoProducer) {
        this.localVideoProducer.close();
        console.log('camera_stale_track_cleared');
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: 'stop_producer',
            producerId: this.localVideoProducer.id,
            appData: { source: 'camera' }
          }));
        }
      }

      this.rawCameraStream = await this.acquireCameraStream(this.selectedVideoInputId);

    if (!this.rawCameraStream) {
      throw new Error("Failed to initialize camera stream");
    }
    this.emitTelemetry('video_track_ready');
    console.log('camera_track_ready');
    let videoTrack = this.rawCameraStream.getVideoTracks()[0];

    // Initialize VideoProcessor
    let activeMode: VirtualBackgroundMode = 'none';
    if (this.isVirtualBackgroundEnabled) {
      if (!this.videoProcessor) {
        this.videoProcessor = new VideoProcessor();
        this.videoProcessor.onDegraded = (severity) => {
          if (this.onVbDegraded) this.onVbDegraded(severity);
        };
        const saved = localStorage.getItem("mtg_vb");
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            activeMode = parsed.mode;
            this.videoProcessor.setMode(parsed.mode, parsed.image);
          } catch (e) {}
        }
      } else {
        activeMode = this.videoProcessor.getMode();
      }
    } else {
      if (this.videoProcessor) {
        this.videoProcessor.stopProcessing();
      }
    }

    // Option 2: Always-On Interceptor. Always pass through VideoProcessor to prevent WebGL initialization crashes.
    if (this.isVirtualBackgroundEnabled && this.videoProcessor) {
      const processedStream = this.videoProcessor.startProcessing(this.rawCameraStream);
      videoTrack = processedStream.getVideoTracks()[0];
    } else {
      if (this.videoProcessor) {
        this.videoProcessor.stopProcessing();
      }
      videoTrack = this.rawCameraStream.getVideoTracks()[0];
    }
    
    // 4. Robust Simulcast/SVC Configuration (Spatial & Temporal Scalability)
    const firstVideoCodec = this.device.rtpCapabilities.codecs?.find(c => c.kind === 'video');
    const isSVC = firstVideoCodec?.mimeType.toLowerCase().includes('av1') || firstVideoCodec?.mimeType.toLowerCase().includes('vp9');
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    if (isIOS) console.log('ios_safari_camera_safeguards_enabled');

    const encodings = this.isLowBandwidth 
      ? [{ maxBitrate: 150000 }] 
      : isMobileDevice
        ? [{ maxBitrate: 600000, maxFramerate: 30 }] // Single layer for mobile (Safari/iOS compatibility)
        : isSVC 
          ? [{ scalabilityMode: 'L3T3_KEY', maxBitrate: this.isHDVideo ? 2500000 : 1200000 }] // SVC for AV1/VP9
          : [ // Simulcast for VP8/H264
              { scaleResolutionDownBy: 4, maxBitrate: 150000, maxFramerate: 15 }, // 180p
              { scaleResolutionDownBy: 2, maxBitrate: 500000, maxFramerate: 30 }, // 360p
              { scaleResolutionDownBy: 1, maxBitrate: this.isHDVideo ? 2500000 : 1500000, maxFramerate: 30 } // 720p/1080p
            ];

    // If a live producer already exists, just swap the track — no second produce()
    if (this.localVideoProducer && !this.localVideoProducer.closed) {
      this.emitTelemetry('video_producer_replacing_track');
      await this.localVideoProducer.replaceTrack({ track: videoTrack }).catch(() => {});
      console.log('camera_producer_track_replaced');
    } else {
      this.emitTelemetry('video_producer_creating');
      this.localVideoProducer = await this.sendTransport.produce({ 
        track: videoTrack, 
        encodings,
        codecOptions: { videoGoogleStartBitrate: 1000 },
        appData: { source: 'camera' } 
      });

      this.localVideoProducer.on('trackended', () => {
        console.warn('camera_track_ended_unexpectedly');
      });

      this.localVideoProducer.on('transportclose', () => {
        this.localVideoProducer = null;
      });
      console.log('camera_producer_created_successfully');
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('camera_producer_id_sent_to_server');
      this.ws.send(JSON.stringify({ 
        type: 'new_producer', 
        producerId: this.localVideoProducer.id,
        appData: { source: 'camera' }
      }));
    }

    this.cameraStartInProgress = false;
    return videoTrack;
    } catch (e) {
      this.cameraStartInProgress = false;
      throw e;
    }
  }

  public async setVirtualBackground(mode: VirtualBackgroundMode, imageUrl?: string): Promise<MediaStreamTrack | null> {
    if (!this.isVirtualBackgroundEnabled && mode !== 'none') {
      console.warn("[webrtc] virtual_background_disabled_for_room: skipping model load");
      console.warn("[webrtc] virtual_background_model_load_skipped");
      return null;
    }

    if (!this.videoProcessor) {
      this.videoProcessor = new VideoProcessor();
      this.videoProcessor.onDegraded = (severity) => {
        if (this.onVbDegraded) this.onVbDegraded(severity);
      };
    }
    this.videoProcessor.setMode(mode, imageUrl);
    
    if (!this.rawCameraStream) return null;

    // Option 2 Always-On Interceptor: We ALWAYS process the stream through the VideoProcessor
    const processedStream = this.videoProcessor.startProcessing(this.rawCameraStream);
    const newTrack = processedStream.getVideoTracks()[0];
    
    if (this.localVideoProducer && !this.localVideoProducer.closed) {
      await this.localVideoProducer.replaceTrack({ track: newTrack }).catch(() => {});
    }
    return newTrack;
  }

  public disableCamera() {
    if (this.videoProcessor) {
      this.videoProcessor.stopProcessing();
    }
    if (this.rawCameraStream) {
      this.rawCameraStream.getTracks().forEach(t => t.stop());
      this.rawCameraStream = null;
    }
    if (this.localVideoProducer) {
      this.localVideoProducer.close();
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ 
          type: 'stop_producer', 
          producerId: this.localVideoProducer.id,
          appData: { source: 'camera' }
        }));
      }
      this.localVideoProducer = null;
    }
  }

  public disableMic() {
    if (this.audioConnectionTimeoutId) {
      clearTimeout(this.audioConnectionTimeoutId);
      this.audioConnectionTimeoutId = undefined;
    }
    this.setAudioConnectionStatus('not_started');
    if (this.rawAudioTrack) {
      this.rawAudioTrack.stop();
      this.rawAudioTrack = null;
    }
    if (this.localAudioProducer) {
      this.localAudioProducer.close();
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'stop_producer',
          producerId: this.localAudioProducer.id,
          appData: { source: 'mic' }
        }));
      }
      this.localAudioProducer = null;
    }
  }

  public async enableMic(isReconnect = false, startMuted?: boolean): Promise<MediaStreamTrack> {
    if (!this.device || !this.sendTransport) throw new Error("Device not initialized");
    if (startMuted !== undefined) {
      this.setDesiredMicMuted(startMuted, isReconnect ? 'RECONNECT_ENABLE_MIC' : 'INITIAL_ENABLE_MIC');
    }
    const snapshotIntentVersion = this.micIntentVersion;

    // Clear any pending timeout
    if (this.audioConnectionTimeoutId) {
      clearTimeout(this.audioConnectionTimeoutId);
      this.audioConnectionTimeoutId = undefined;
    }

    this.setAudioConnectionStatus(isReconnect ? 'reconnecting' : 'connecting');
    this.emitTelemetry('audio_connection_started');
    
    // 15-second timeout for audio connection
    this.audioConnectionTimeoutId = setTimeout(() => {
      this.emitTelemetry('audio_connection_timeout');
      this.setAudioConnectionStatus('failed');
    }, 15000);
    
    if (this.isRecorderMode) {
      throw new Error("Recorder mode cannot acquire microphone");
    }
    
    try {
      this.emitTelemetry('audio_permission_requested');
      let audioConstraints: any = { 
        deviceId: this.selectedAudioInputId ? { exact: this.selectedAudioInputId } : undefined,
        noiseSuppression: !this.isAINoiseSuppressionEnabled, // Turn off native if AI is active
        echoCancellation: true 
      };

      let stream: MediaStream | null = null;
      let retries = 2;
      while (retries > 0) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
          break;
        } catch (err: any) {
          retries--;
          if (err.name === 'OverconstrainedError' && retries > 0) {
            console.warn("OverconstrainedError on mic, falling back to default device...");
            delete audioConstraints.deviceId;
          } else {
            throw err;
          }
        }
      }
      
      if (!stream) throw new Error("Failed to initialize mic");

      // Check intent fencing after async getUserMedia
      if (this.micIntentVersion !== snapshotIntentVersion) {
        console.warn(`[WebRTC] [MIC_FENCING] enableMic getUserMedia completed with stale intent version (started at v${snapshotIntentVersion}, currently v${this.micIntentVersion}). Adopting latest desiredMicMuted=${this.desiredMicMuted}`);
      }
      let currentDesiredMuted = this.desiredMicMuted;

      this.rawAudioTrack = stream.getAudioTracks()[0];
      this.rawAudioTrack.enabled = !currentDesiredMuted;
      this.emitTelemetry('audio_track_ready');
      
      let activeTrack = this.rawAudioTrack;
      
      // Apply AI Noise Suppression if enabled
      if (this.isAINoiseSuppressionEnabled && this.purifyInstance) {
        const rawStream = new MediaStream([this.rawAudioTrack]);
        const denoisedStream = await this.purifyInstance.processStream(rawStream);
        activeTrack = denoisedStream.getAudioTracks()[0];
        activeTrack.enabled = !currentDesiredMuted;
      }
      
      if (!this.localAudioProducer || this.localAudioProducer.closed) {
        this.emitTelemetry('audio_produce_started');
        const opusCodec = this.device?.rtpCapabilities?.codecs?.find(
          (c: any) => c.mimeType.toLowerCase() === 'audio/opus'
        );
        this.localAudioProducer = await this.sendTransport.produce({ 
          track: activeTrack,
          appData: { source: 'mic' },
          codec: opusCodec,
          codecOptions: {
            opusFec: true,
            opusDtx: true,
            opusMaxAverageBitrate: 32000
          },
          disableTrackOnPause: true,
          zeroRtpOnPause: true
        });
        this.emitTelemetry('audio_producer_created');
      } else {
        await this.localAudioProducer.replaceTrack({ track: activeTrack });
      }

      // Final post-produce fencing re-evaluation
      if (this.micIntentVersion !== snapshotIntentVersion) {
        currentDesiredMuted = this.desiredMicMuted;
      }

      // Enforce producer pause and track disabled state immediately if desiredMicMuted
      if (currentDesiredMuted) {
        this.localAudioProducer.pause();
        if (this.rawAudioTrack) this.rawAudioTrack.enabled = false;
        if (activeTrack) activeTrack.enabled = false;
      } else {
        if (this.localAudioProducer.paused) this.localAudioProducer.resume();
        if (this.rawAudioTrack) this.rawAudioTrack.enabled = true;
        if (activeTrack) activeTrack.enabled = true;
      }

      // Handle unexpected track ends (e.g. mic unplugged)
      activeTrack.onended = async () => {
        const onendedSnapshotVersion = this.micIntentVersion;
        console.warn(`[WebRTC] [MIC_INTENT: TRACK_ENDED] Microphone track ended unexpectedly. Re-initializing hardware while preserving desiredMicMuted=${this.desiredMicMuted} (v${onendedSnapshotVersion})`);
        try {
          await this.enableMic(true, this.desiredMicMuted);
          if (this.desiredMicMuted) {
            this.pauseMic();
          }
        } catch (err) {
          console.error("Failed to re-initialize mic:", err);
        }
      };

      this.emitTelemetry('audio_connection_ready');
      if (this.audioConnectionTimeoutId) {
        clearTimeout(this.audioConnectionTimeoutId);
        this.audioConnectionTimeoutId = undefined;
      }
      this.setAudioConnectionStatus(currentDesiredMuted || this.localAudioProducer?.paused ? 'muted' : 'connected');
      return activeTrack;
    } catch (err: any) {
      this.emitTelemetry('audio_connection_failed');
      if (this.audioConnectionTimeoutId) {
        clearTimeout(this.audioConnectionTimeoutId);
        this.audioConnectionTimeoutId = undefined;
      }
      this.setAudioConnectionStatus('failed');
      this.onMicError?.(err);
      throw err;
    }
  }

  public async setAINoiseSuppression(enable: boolean) {
    if (enable && !this.purifyInstance) {
      // Dynamically import to avoid SSR issues
      const { Purify } = await import('purify-voice');
      this.purifyInstance = new Purify();
      await this.purifyInstance.initialize();
    }
    
    this.isAINoiseSuppressionEnabled = enable;
    const noiseSnapshotVersion = this.micIntentVersion;
    
    if (this.localAudioProducer) {
      // Clean up old tracks
      if (this.localAudioProducer.track) {
        this.localAudioProducer.track.stop();
      }
      if (this.rawAudioTrack) {
        this.rawAudioTrack.stop();
      }

      // Re-acquire fresh microphone with correct constraints
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          noiseSuppression: !enable, // Turn off native if AI is active
          echoCancellation: true 
        } 
      });
      
      if (this.micIntentVersion !== noiseSnapshotVersion) {
        console.warn(`[WebRTC] [MIC_FENCING] setAINoiseSuppression completed with stale intent version (started at v${noiseSnapshotVersion}, currently v${this.micIntentVersion}). Adopting latest desiredMicMuted=${this.desiredMicMuted}`);
      }
      const currentDesiredMuted = this.desiredMicMuted;

      this.rawAudioTrack = stream.getAudioTracks()[0];
      this.rawAudioTrack.enabled = !currentDesiredMuted;
      let activeTrack = this.rawAudioTrack;

      if (enable) {
        const rawStream = new MediaStream([this.rawAudioTrack]);
        const denoisedStream = await this.purifyInstance.processStream(rawStream);
        activeTrack = denoisedStream.getAudioTracks()[0];
        activeTrack.enabled = !currentDesiredMuted;
      }

      if (!this.localAudioProducer.closed) {
        await this.localAudioProducer.replaceTrack({ track: activeTrack });
      } else {
        const opusCodec = this.device?.rtpCapabilities?.codecs?.find(
          (c: any) => c.mimeType.toLowerCase() === 'audio/opus'
        );
        this.localAudioProducer = await this.sendTransport.produce({ 
          track: activeTrack, 
          appData: { source: 'mic' }, 
          codec: opusCodec, 
          disableTrackOnPause: true, 
          zeroRtpOnPause: true 
        });
      }
      if (currentDesiredMuted || this.localAudioProducer.paused || this.audioConnectionStatus === 'muted') {
        if (this.rawAudioTrack) this.rawAudioTrack.enabled = false;
        activeTrack.enabled = false;
        this.localAudioProducer.pause();
      } else {
        if (this.rawAudioTrack) this.rawAudioTrack.enabled = true;
        activeTrack.enabled = true;
        if (this.localAudioProducer.paused) this.localAudioProducer.resume();
      }
      this.onAudioTrackReplaced?.();
      return activeTrack;
    }
    return undefined;
  }

  public async switchDevice(kind: 'audio' | 'video', deviceId: string): Promise<MediaStreamTrack> {
    if (!this.device || !this.sendTransport) throw new Error("Device not initialized");

    if (kind === 'video' && this.cameraSwitchInProgress) {
      throw new Error("Camera switch already in progress");
    }

    const switchSnapshotVersion = this.micIntentVersion;
    let stream: MediaStream;
    let newTrack: MediaStreamTrack;

    if (kind === 'audio') {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } } });
      newTrack = stream.getAudioTracks()[0];
      if (this.desiredMicMuted) {
        newTrack.enabled = false;
      }
    } else {
      this.cameraSwitchInProgress = true;
      try {
        stream = await this.acquireCameraStream(deviceId);
        newTrack = stream.getVideoTracks()[0];
      } catch (e) {
        this.cameraSwitchInProgress = false;
        throw e;
      }
    }

    const producer = kind === 'audio' ? this.localAudioProducer : this.localVideoProducer;

    if (producer && !producer.closed) {
      const oldTrack = producer.track;

      if (kind === 'audio') {
        if (this.micIntentVersion !== switchSnapshotVersion) {
          console.warn(`[WebRTC] [MIC_FENCING] switchDevice completed with stale intent version (started at v${switchSnapshotVersion}, currently v${this.micIntentVersion}). Adopting latest desiredMicMuted=${this.desiredMicMuted}`);
        }
        const currentDesiredMuted = this.desiredMicMuted;
        this.rawAudioTrack = newTrack;
        this.rawAudioTrack.enabled = !currentDesiredMuted;
        if (this.isAINoiseSuppressionEnabled && this.purifyInstance) {
          const rawStream = new MediaStream([this.rawAudioTrack]);
          const denoisedStream = await this.purifyInstance.processStream(rawStream);
          newTrack = denoisedStream.getAudioTracks()[0];
          newTrack.enabled = !currentDesiredMuted;
        }
      }

      // Replace the track in the Mediasoup producer
      if (kind === 'video') {
        try {
          this.rawCameraStream = stream;
          if (this.videoProcessor) {
            if (this.videoProcessor.getMode() !== 'none') {
              const processedStream = this.videoProcessor.startProcessing(this.rawCameraStream);
              newTrack = processedStream.getVideoTracks()[0];
            } else {
              this.videoProcessor.stopProcessing();
            }
          }
          await producer.replaceTrack({ track: newTrack });
          // Only stop old track AFTER successful replacement
          if (oldTrack && oldTrack !== newTrack) {
            oldTrack.stop();
          }
        } catch (e) {
          // If replacement fails, keep the old track running
          console.error("Failed to replace video track, restoring old track", e);
          throw e;
        } finally {
          this.cameraSwitchInProgress = false;
        }
      } else {
        await producer.replaceTrack({ track: newTrack });
        const currentDesiredMuted = this.desiredMicMuted;
        if (currentDesiredMuted || producer.paused || this.audioConnectionStatus === 'muted') {
          if (this.rawAudioTrack) this.rawAudioTrack.enabled = false;
          newTrack.enabled = false;
          producer.pause();
        } else {
          if (this.rawAudioTrack) this.rawAudioTrack.enabled = true;
          newTrack.enabled = true;
          if (producer.paused) producer.resume();
        }
        if (oldTrack) {
          oldTrack.stop();
        }
        if (kind === 'audio') this.onAudioTrackReplaced?.();
      }
    } else {
      if (kind === 'audio') {
        if (this.micIntentVersion !== switchSnapshotVersion) {
          console.warn(`[WebRTC] [MIC_FENCING] switchDevice create completed with stale intent version (started at v${switchSnapshotVersion}, currently v${this.micIntentVersion}). Adopting latest desiredMicMuted=${this.desiredMicMuted}`);
        }
        const currentDesiredMuted = this.desiredMicMuted;
        this.rawAudioTrack = newTrack;
        this.rawAudioTrack.enabled = !currentDesiredMuted;
        let activeTrack = newTrack;
        if (this.isAINoiseSuppressionEnabled && this.purifyInstance) {
          const rawStream = new MediaStream([this.rawAudioTrack]);
          const denoisedStream = await this.purifyInstance.processStream(rawStream);
          activeTrack = denoisedStream.getAudioTracks()[0];
          activeTrack.enabled = !currentDesiredMuted;
        }
        const opusCodec = this.device?.rtpCapabilities?.codecs?.find(
          (c: any) => c.mimeType.toLowerCase() === 'audio/opus'
        );
        this.localAudioProducer = await this.sendTransport.produce({ 
          track: activeTrack, 
          appData: { source: 'mic' }, 
          codec: opusCodec, 
          disableTrackOnPause: true, 
          zeroRtpOnPause: true 
        });
        if (currentDesiredMuted || this.localAudioProducer.paused || this.audioConnectionStatus === 'muted') {
          if (this.rawAudioTrack) this.rawAudioTrack.enabled = false;
          activeTrack.enabled = false;
          this.localAudioProducer.pause();
        } else {
          if (this.rawAudioTrack) this.rawAudioTrack.enabled = true;
          activeTrack.enabled = true;
          if (this.localAudioProducer.paused) this.localAudioProducer.resume();
        }
        this.onAudioTrackReplaced?.();
      } else {
        this.rawCameraStream = stream;
        if (this.videoProcessor && this.videoProcessor.getMode() !== 'none') {
           const processedStream = this.videoProcessor.startProcessing(this.rawCameraStream);
           newTrack = processedStream.getVideoTracks()[0];
        }
        const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent);
        const encodings = this.isLowBandwidth 
          ? [{ maxBitrate: 150000 }] 
          : isMobileDevice
            ? [{ maxBitrate: 600000, maxFramerate: 30 }]
            : [
                { scaleResolutionDownBy: 4, maxBitrate: 150000, maxFramerate: 15 },
                { scaleResolutionDownBy: 2, maxBitrate: 500000, maxFramerate: 30 },
                { scaleResolutionDownBy: 1, maxBitrate: 1500000, maxFramerate: 30 }
              ];
          
        const videoCodec = this.device?.rtpCapabilities?.codecs?.find(
          (c: any) => c.mimeType.toLowerCase() === 'video/vp8'
        ) || this.device?.rtpCapabilities?.codecs?.find(
          (c: any) => c.mimeType.toLowerCase() === 'video/h264' && c.parameters?.['profile-level-id'] === '42e01f'
        );

        this.localVideoProducer = await this.sendTransport.produce({ 
          track: newTrack, 
          appData: { source: 'camera' },
          encodings,
          codec: videoCodec,
          codecOptions: { videoGoogleStartBitrate: this.isLowBandwidth ? 50 : 1000 }
        });
        this.cameraSwitchInProgress = false;
      }
    }

    return newTrack;
  }

  // --- Media Controls ---
  
  public pauseMic() {
    this.setDesiredMicMuted(true, 'USER_PAUSE_MIC');
    if (this.localAudioProducer && !this.localAudioProducer.paused) {
      this.localAudioProducer.pause();
    }
    if (this.rawAudioTrack) {
      this.rawAudioTrack.enabled = false;
    }
    if (this.localAudioProducer?.track) {
      this.localAudioProducer.track.enabled = false;
    }
    if (this.audioConnectionTimeoutId) {
      clearTimeout(this.audioConnectionTimeoutId);
      this.audioConnectionTimeoutId = undefined;
      this.emitTelemetry('audio_connection_status_reset_on_mute');
    }
    this.setAudioConnectionStatus('muted');
  }

  public async resumeMic() {
    this.setDesiredMicMuted(false, 'USER_RESUME_MIC');
    if (!this.localAudioProducer || this.localAudioProducer.closed || this.localAudioProducer.track?.readyState === 'ended' || this.rawAudioTrack?.readyState === 'ended') {
      console.warn("[WebRTC] Microphone track is ended or producer is closed. Re-initializing hardware.");
      try {
        await this.enableMic(true, false);
      } catch (e) {
        console.error("[WebRTC] Failed to re-initialize mic during resume:", e);
      }
    } else if (this.localAudioProducer.paused) {
      this.localAudioProducer.resume();
      this.setAudioConnectionStatus('connected');
    }
    if (this.rawAudioTrack) {
      this.rawAudioTrack.enabled = true;
    }
    if (this.localAudioProducer?.track) {
      this.localAudioProducer.track.enabled = true;
    }
  }

  public pauseCamera() {
    if (this.localVideoProducer && !this.localVideoProducer.paused) {
      this.localVideoProducer.pause();
    }
  }

  public requestScreenKeyframe(consumerId: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'request_screen_keyframe', consumerId }));
    }
  }

  public resumeCamera() {
    if (this.localVideoProducer && this.localVideoProducer.paused) {
      this.localVideoProducer.resume();
    }
  }

  public async enableScreenShare(): Promise<MediaStreamTrack> {
    if (!this.device || !this.sendTransport) throw new Error("Device not initialized");
    if (this.screenShareProducer && !this.screenShareProducer.closed) {
      throw new Error("Screen share already active");
    }
    if (!navigator.mediaDevices?.getDisplayMedia || /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|samsungbrowser/i.test(navigator.userAgent)) {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'action_unsupported', reason: 'SCREEN_SHARE_UNSUPPORTED' }));
      }
      throw new Error("SCREEN_SHARE_UNSUPPORTED");
    }

    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 15, max: 30 } }, // Lower framerate = less CPU, still crisp
      audio: true
    });
    const screenTrack = stream.getVideoTracks()[0];
    this.localScreenTrack = screenTrack;
    
    // Prioritize VP8, fallback to H264 Baseline for Safari/iOS compatibility
    const screenCodec = this.device.rtpCapabilities.codecs?.find(
      (c: any) => c.mimeType.toLowerCase() === 'video/vp8'
    ) || this.device.rtpCapabilities.codecs?.find(
      (c: any) => c.mimeType.toLowerCase() === 'video/h264' && c.parameters?.['profile-level-id'] === '42e01f'
    );
    
    // Create a SEPARATE producer — camera producer stays untouched
    this.screenShareProducer = await this.sendTransport.produce({
      track: screenTrack,
      codec: screenCodec, // Force H264 if available
      appData: { source: 'screen' }, // Tag so remote peers render in screen overlay, not tile
      encodings: [
        { maxBitrate: 1500000, maxFramerate: 15 } // Single high-quality encoding, conservative framerate for MVP
      ],
      codecOptions: { videoGoogleStartBitrate: 1000 }
    });

    // Check for audio track and produce it
    const screenAudioTrack = stream.getAudioTracks()[0];
    if (screenAudioTrack) {
      this.localScreenAudioTrack = screenAudioTrack;
      this.screenAudioShareProducer = await this.sendTransport.produce({
        track: screenAudioTrack,
        appData: { source: 'screen-audio' }
      });
      // Optionally stop sharing when audio track ends (unlikely unless video track ends too)
      screenAudioTrack.onended = () => {
        this.stopScreenShareProducer();
      };
    }

    // Auto-stop when user clicks browser's native "Stop sharing" button
    screenTrack.onended = () => {
      this.stopScreenShareProducer();
    };
    
    return screenTrack;
  }

  public async disableScreenShare(options?: { serverAlreadyClosed?: boolean }): Promise<void> {
    this.stopScreenShareProducer(options);
  }

  private stopScreenShareProducer(options?: { serverAlreadyClosed?: boolean }) {
    if (this.screenShareProducer) {
      const producerId = this.screenShareProducer.id;
      // Tell the server FIRST so it can broadcast screen_share_stopped to all peers
      // and trigger producerclose on all remote consumers
      if (!options?.serverAlreadyClosed && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'stop_producer',
          producerId,
          appData: { source: 'screen' }
        }));
      }
      // Stop the track so the OS browser sharing indicator disappears
      try {
        this.screenShareProducer.track?.stop();
      } catch (e) {}
      try {
        this.screenShareProducer.close();
      } catch (e) {}
      this.screenShareProducer = null;
      
      if (!options?.serverAlreadyClosed) {
        this.onScreenShareStopped?.(this.userId || '', producerId, this.participantId);
      }
    }

    if (this.localScreenTrack) {
      try {
        this.localScreenTrack.stop();
      } catch (e) {}
      this.localScreenTrack = null;
    }
    
    if (this.screenAudioShareProducer) {
      const audioProducerId = this.screenAudioShareProducer.id;
      if (!options?.serverAlreadyClosed && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'stop_producer',
          producerId: audioProducerId,
          appData: { source: 'screen-audio' }
        }));
      }
      try {
        this.screenAudioShareProducer.track?.stop();
      } catch (e) {}
      try {
        this.screenAudioShareProducer.close();
      } catch (e) {}
      this.screenAudioShareProducer = null;
    }

    if (this.localScreenAudioTrack) {
      try {
        this.localScreenAudioTrack.stop();
      } catch (e) {}
      this.localScreenAudioTrack = null;
    }
  }

  private enqueueConsume(msg: any) {
    // Priority: Audio (1) > Screenshare (2) > Camera (3) > Other (4)
    let priority = 4;
    if (msg.kind === 'audio') priority = 1;
    else if (msg.kind === 'video' && msg.appData?.source === 'screen') priority = 2;
    else if (msg.kind === 'video') priority = 3;

    this.consumeQueue.push({ ...msg, priority, enqueuedAt: Date.now() });
    if (this.consumeQueue.length > this.consumeQueueMaxDepth) {
      this.consumeQueueMaxDepth = this.consumeQueue.length;
    }

    // Sort by priority (lower number first)
    this.consumeQueue.sort((a, b) => a.priority - b.priority);

    if (!this.consumeQueueProcessing) {
      this.processConsumeQueue();
    }
  }

  private async processConsumeQueue() {
    this.consumeQueueProcessing = true;
    
    while (this.consumeQueue.length > 0) {
      const batch = this.consumeQueue.splice(0, this.MAX_CONSUMES_PER_BATCH);
      const promises = batch.map(async (msg) => {
        const waitTime = Date.now() - msg.enqueuedAt;
        this.consumeWaitTimes.push(waitTime);
        if (this.consumeWaitTimes.length > 100) this.consumeWaitTimes.shift(); // Keep recent 100
        
        try {
          await this.consumeRemoteStream(msg.producerId, msg.participantId, msg.userId, msg.name, msg.kind, msg.appData);
        } catch (error) {
          console.error(`[WebRTC] Error consuming queued stream for ${msg.producerId}:`, error);
        }
      });
      
      await Promise.allSettled(promises);
      
      // Log telemetry periodically
      if (this.consumeWaitTimes.length >= 10 && this.consumeWaitTimes.length % 10 === 0) {
        const avg = this.consumeWaitTimes.reduce((a, b) => a + b, 0) / this.consumeWaitTimes.length;
        const max = Math.max(...this.consumeWaitTimes);
        console.log(`[WebRTC] Consume Queue Stats: Size=${this.consumeQueue.length}, MaxDepth=${this.consumeQueueMaxDepth}, AvgWait=${avg.toFixed(1)}ms, MaxWait=${max}ms`);
      }
      
      if (this.consumeQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, this.BATCH_INTERVAL_MS));
      }
    }
    
    this.consumeQueueProcessing = false;
  }

  private async consumeRemoteStream(producerId: string, producerParticipantId: string | undefined, producerUserId: string, userName: string | undefined, kind: string, appData?: Record<string, any>) {
    if (this.participantId && producerParticipantId === this.participantId) {
      console.log(`[WebRTC] consume_request_skipped_self_producer for ${kind} (producer: ${producerId})`);
      return;
    }
    if (!this.device || !this.recvTransport) {
      console.log(`[WebRTC] Queuing consume request for ${kind} (producer: ${producerId}) until transport is ready`);
      this.pendingConsumes.push({ producerId, producerParticipantId, producerUserId, userName, kind, appData });
      return;
    }

    const transportId = this.recvTransport.id;
    const generation = this.sessionGeneration || 0;
    const canonicalKey = this.getConsumerKey(producerId, transportId, generation);

    if (this.inFlightConsumes.has(canonicalKey)) {
      console.log(`[WebRTC] Consume already in flight for ${canonicalKey}`);
      return this.inFlightConsumes.get(canonicalKey);
    }

    const existingConsumerId = this.producerToConsumer.get(producerId);
    if (existingConsumerId) {
      const existingConsumer = this.consumers.get(existingConsumerId);
      if (existingConsumer && !existingConsumer.closed) {
        console.log(`[WebRTC] Existing active consumer ${existingConsumerId} already present for producer ${producerId}`);
        return;
      }
    }

    const source = appData?.source || (kind === 'audio' ? 'audio' : 'camera');
    console.log(`[WebRTC] Requesting to consume ${kind} (source: ${source}) from user ${producerParticipantId || producerUserId} (Producer ID: ${producerId})...`);

    const consumePromise = (async () => {
      let consumer: Consumer | null = null;
      try {
        const { id, kind: consumerKind, rtpParameters } = await this.request('consume', 'consumed', {
          transportId: this.recvTransport!.id,
          producerId,
          rtpCapabilities: this.device!.rtpCapabilities
        });

        console.log(`[WebRTC] Creating local consumer for ${kind} (source: ${source})... (Consumer ID: ${id})`);
        consumer = await this.recvTransport!.consume({
          id,
          producerId,
          kind: consumerKind,
          rtpParameters,
          appData: { source } // Carry source tag forward to onNewConsumer callback
        });

        this.consumers.set(consumer.id, consumer);
        this.producerToConsumer.set(producerId, consumer.id);

        this.registerConsumerMetadata({
          consumerId: consumer.id,
          producerId,
          participantId: producerParticipantId,
          userId: producerUserId,
          kind: consumerKind as 'audio' | 'video',
          source: source as 'camera' | 'screen' | 'mic' | 'screen-audio',
          isScreenShare: source === 'screen',
          isActiveSpeaker: false,
          isPinned: false,
          isVisibleOnScreen: true,
          maxSpatialLayers: source === 'screen' ? 1 : 3
        });

        consumer.on('transportclose', () => {
          this.unregisterConsumerMetadata(consumer!.id);
          this.producerToConsumer.delete(producerId);
        });
        
        consumer.on('pause', () => {
          console.log(`[WebRTC] Consumer ${id} paused by SFU`);
        });

        consumer.on('resume', () => {
          console.log(`[WebRTC] Consumer ${id} resumed by SFU`);
        });

        if (consumerKind === 'audio' && !this.firstAudioEmitted) {
          this.firstAudioEmitted = true;
          this.emitTelemetry('time_to_first_audio');
        }
        if (consumerKind === 'video' && !this.firstVideoEmitted) {
          this.firstVideoEmitted = true;
          this.emitTelemetry('time_to_first_video');
        }

        this.onNewConsumer?.(consumer, producerParticipantId || producerUserId, userName);
        
        // Tell the backend to resume sending media (unpause the consumer)
        if (this.isAudioOnlyMode && consumerKind === 'video' && source !== 'screen') {
          console.log(`[WebRTC] Audio-only mode active. Keeping video consumer ${id} paused.`);
        } else {
          console.log(`[WebRTC] Resuming consumer ${id} on server...`);
          try {
            await this.request('resume', 'resumed', { consumerId: consumer.id });
            console.log(`[WebRTC] Consumer ${id} successfully resumed! Media should flow now.`);
          } catch (resumeErr) {
            console.error(`[WebRTC] Failed to resume consumer ${id}, closing consumer only (R1):`, resumeErr);
            // Targeted cleanup of failed consumer ONLY — NEVER close shared recvTransport (R1)
            try {
              consumer.close();
            } catch (_) {}
            this.consumers.delete(consumer.id);
            this.producerToConsumer.delete(producerId);
            this.unregisterConsumerMetadata(consumer.id);
            throw resumeErr;
          }
        }
      } catch (e) {
        console.warn(`[WebRTC] Failed to consume stream (it may have been closed):`, e);
      } finally {
        this.inFlightConsumes.delete(canonicalKey);
      }
    })();

    this.inFlightConsumes.set(canonicalKey, consumePromise);
    return consumePromise;
  }

  public enableAudioOnlyMode() {
    this.isAudioOnlyMode = true;
    this.disableCamera();
    
    // Pause all existing video consumers locally and on server, EXCEPT screenshares
    for (const [id, consumer] of this.consumers.entries()) {
      if (consumer.kind === 'video' && consumer.appData?.source !== 'screen') {
        consumer.pause();
        this.request('pause_consumer', 'consumer_paused', { consumerId: id }).catch(console.error);
      }
    }
  }

  public disableAudioOnlyMode() {
    this.isAudioOnlyMode = false;
    
    // Resume all existing video consumers, EXCEPT screenshares (which never paused)
    for (const [id, consumer] of this.consumers.entries()) {
      if (consumer.kind === 'video' && consumer.appData?.source !== 'screen') {
        this.request('resume', 'resumed', { consumerId: id }).catch(console.error);
        consumer.resume();
      }
    }
  }

  public async pauseRemoteVideoByTrack(trackId: string) {
    const consumer = Array.from(this.consumers.values()).find(c => c.track.id === trackId && c.kind === 'video');
    if (consumer && !consumer.paused && consumer.appData?.source !== 'screen') {
      consumer.pause();
      this.request('pause_consumer', 'consumer_paused', { consumerId: consumer.id }).catch(console.error);
    }
  }

  public async resumeRemoteVideoByTrack(trackId: string) {
    if (this.isAudioOnlyMode) return;
    const consumer = Array.from(this.consumers.values()).find(c => c.track.id === trackId && c.kind === 'video');
    if (consumer && consumer.paused) {
      await this.request('resume', 'resumed', { consumerId: consumer.id }).catch(console.error);
      consumer.resume();
    }
  }

  public disconnect() {
    console.log('[WebRTC] Disconnecting gracefully...');
    this.isIntentionalDisconnect = true;
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = undefined;
    }
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.networkInterval) clearInterval(this.networkInterval);
    if (this.statsInterval) clearInterval(this.statsInterval);
    if (typeof document !== 'undefined' && this.isVisibilityListenerAttached) {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      this.isVisibilityListenerAttached = false;
    }
    this.ws?.close();
    
    // Clear all pending requests and timeouts
    this.pendingRequests.forEach((queue, expectType) => {
      queue.forEach(req => {
        clearTimeout(req.timeoutId);
        req.reject(new Error(`Disconnected before receiving ${expectType}`));
      });
    });
    this.pendingRequests.clear();
    this.pendingConsumes = [];
    this.inFlightConsumes.clear();
    this.producerToConsumer.clear();
    this.sessionGeneration = (this.sessionGeneration || 0) + 1;
    
    this.disableCamera();
    this.disableMic();
    this.stopScreenShareProducer();
    
    if (this.sendTransport) this.sendTransport.close();
    if (this.recvTransport) this.recvTransport.close();
    this.sendTransport = null;
    this.recvTransport = null;
    this.ws = null;
    this.device = null;
  }

  private handleVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      console.log('[WebRTC] Tab became visible. Checking signaling connection health...');
      if (!this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
        console.warn('[WebRTC] Socket dead or closed while backgrounded. Triggering reconnect.');
        this.attemptReconnect();
      } else if (this.ws.readyState === WebSocket.OPEN) {
        this.lastPingAt = Date.now();
        this.ws.send(JSON.stringify({ type: 'ping', timestamp: this.lastPingAt }));
      }
    }
  };

  private async collectAndSendStats() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    for (const [consumerId, consumer] of this.consumers.entries()) {
      try {
        const stats = await consumer.getStats();
        let jitter = 0, packetsLost = 0, concealedSamples = 0, roundTripTime = 0, jitterBufferDelay = 0;
        
        stats.forEach((report: any) => {
          if (report.type === 'inbound-rtp') {
            jitter = report.jitter || 0;
            packetsLost = report.packetsLost || 0;
            concealedSamples = report.concealedSamples || 0;
            jitterBufferDelay = report.jitterBufferDelay || 0;
          }
          if (report.type === 'remote-inbound-rtp') {
            roundTripTime = report.roundTripTime || 0;
          }
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            if (!roundTripTime) roundTripTime = report.currentRoundTripTime || 0;
          }
        });
        
        const payload = {
          type: 'webrtc_client_stats',
          roomId: this.roomId,
          participantId: this.participantId,
          consumerId,
          timestamp: Date.now(),
          jitter,
          packetsLost,
          concealedSamples,
          roundTripTime,
          jitterBufferDelay
        };
        
        this.ws.send(JSON.stringify(payload));
      } catch (err) {
        console.warn(`[WebRTC] Failed to collect stats for consumer ${consumerId}`, err);
      }
    }
  }

  // --- Host Controls ---
  public sendAdmitUser(userId: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'admit_user', userId }));
    }
  }

  public sendAdmitAll() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'admit_all' }));
    }
  }

  public sendDenyUser(userId: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'deny_user', userId }));
    }
  }

  public sendKickUser(userId: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'kick_user', userId }));
    }
  }

  public pingParticipant(targetUserId: string, clientPingId?: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'ping_participant', targetUserId, clientPingId }));
    }
  }

  public pingDeliveryAck(pingId: string, stats: { visualShown: boolean, audioAttempted: boolean, audioPlayed: boolean, audioBlocked: boolean, hapticAttempted: boolean }) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'ping_delivery_ack', pingId, ...stats }));
    }
  }

  public setScreenSharePolicy(mode: 'EVERYONE' | 'HOSTS_ONLY' | 'SELECTED', stopExistingShares: boolean) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'set_screen_share_policy', mode, stopExistingShares }));
    }
  }

  public setParticipantScreenSharePermission(targetParticipantId: string, permission: 'DEFAULT' | 'ALLOW' | 'BLOCK') {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'set_participant_screen_share_permission', targetParticipantId, permission }));
    }
  }

  public stopParticipantScreenShare(targetParticipantId: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'stop_participant_screen_share', targetParticipantId }));
    }
  }

  public stopAllParticipantScreenShares() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'stop_all_participant_screen_shares' }));
    }
  }

  public sendForceMute(targetUserId?: string, target?: 'all' | 'all_except_presenters' | 'all_except_hosts') {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'force_mute', userId: targetUserId, target }));
    }
  }

  public sendForceVideoOff(targetUserId?: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'force_video_off', userId: targetUserId }));
    }
  }

  public sendUpdateRoomSettings(settings: { micLocked?: boolean, videoLocked?: boolean, chatLocked?: boolean, bypassWaitingRoom?: boolean }) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'update_room_settings', settings }));
    }
  }

  public sendEndMeeting() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'end_meeting' }));
    }
  }

  public sendECinemaUpdate(link: string | null) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'ecinema_update', link }));
    }
  }

  public sendCaption(text: string, isFinal: boolean, lang: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'caption', text, isFinal, lang }));
    }
  }

  public sendDonationStatus(active: boolean) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'donation_status', active }));
    }
  }

  public sendDonationSuccess(amount: number, currency: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'donation_success', amount, currency }));
    }
  }

  public sendStartRecording() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'start_recording' }));
    }
  }

  public sendStopRecording() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'stop_recording' }));
    }
  }

  public sendSyncPanel(panel: string | null) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'sync_panel', panel }));
    }
  }
}

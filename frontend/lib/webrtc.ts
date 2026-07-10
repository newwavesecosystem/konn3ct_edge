import type { Device } from 'mediasoup-client';
// @ts-ignore
import type { Transport, Producer, Consumer } from 'mediasoup-client/lib/types';
import { VideoProcessor, VirtualBackgroundMode } from './video-processor';
import { NetworkDetectionConfig } from './types/meeting';


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
  private sendTransport: Transport | null = null;
  private recvTransport: Transport | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  
  public localVideoProducer: Producer | null = null;
  public localAudioProducer: Producer | null = null;
  public screenShareProducer: Producer | null = null;
  public localScreenTrack: MediaStreamTrack | null = null;
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
  private maxIceReconnectAttempts = 3;
  private isRepublishing = false;
  private pendingConsumes: any[] = [];

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
  public sessionStatus?: string;
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
  public onScreenShareStopped?: (userId: string, producerId: string) => void;
  public onConsumerClosed?: (producerId: string, appData: Record<string, any>) => void;
  // Talking indicator
  public onActiveSpeaker?: (userIds: string[], participantIds: string[]) => void;
  // Recording
  public onRecordingStarted?: () => void;
  public onRecordingStopped?: () => void;
  public onSyncPanel?: (panel: string | null) => void;
  public onVbDegraded?: (severity: 'warning' | 'emergency') => void;

  // Network monitoring
  public onNetworkQualityChange?: (quality: NetworkQualityLabel) => void;
  public onNetworkDebugSnapshot?: (snapshot: NetworkDebugSnapshot) => void;
  private networkInterval?: NodeJS.Timeout;
  
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
    const wsUrl = `wss://${domain}/signal?roomId=${this.roomId}&token=${this.token}&isMobile=${isMobile}&participantId=${this.participantId}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = async () => {
      try {
        this.reconnectAttempts = 0; // Reset on success

        // Keep-alive to prevent DO Load Balancer from dropping idle connections
        this.pingInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 25000);
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
        case 'action:ack':
          this.onActionAck?.(msg);
          break;
        case 'session_status':
          this.sessionStatus = msg.status;
          if (msg.userId) this.userId = msg.userId;
          if (msg.name) this.userName = msg.name;
          if (msg.role) this.userRole = msg.role;
          if (msg.roomName) this.roomName = msg.roomName;
          if (msg.maxParticipants) this.maxParticipants = msg.maxParticipants;
          
          if (msg.status === 'denied') {
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
          if (this.device?.loaded) {
            console.log(`WebSocket reconnected (recovered=${msg.recovered}). Executing Client-Side Auto-Republish because server transports were destroyed...`);
            if (msg.recovered && this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify({ type: 'reset_webrtc_state' }));
            }
            this.republishMedia().catch(console.error);
            this.onConnectionStateChange?.('connected');
          } else if (!this.device?.loaded && msg.status === 'active') {
            // First time active or recovered after a full page refresh
            if (msg.recovered) {
              console.log("Session recovered after a page refresh. Resetting server WebRTC state...");
              if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'reset_webrtc_state' }));
              }
            }
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
          } else if (msg.recovered && msg.status === 'active') {
            // Session recovered without page refresh (e.g. WiFi -> 4G switch)
            console.log("Session recovered by server. Forcing WebRTC auto-republish to handle potential IP changes...");
            this.needsRepublish = false;
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify({ type: 'reset_webrtc_state' }));
            }
            this.republishMedia().catch(console.error);
            this.onConnectionStateChange?.('connected');
          } else if (msg.status === 'active') {
            this.onConnectionStateChange?.('connected');
          }
          break;
        case 'newProducer':
          await this.consumeRemoteStream(msg.producerId, msg.participantId, msg.userId, msg.name, msg.kind, msg.appData);
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
          if (msg.userId === this.userId) this.userRole = msg.role;
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
        case 'screen_share_started':
          this.onScreenShareStarted?.(msg.userId, msg.producerId);
          break;
        case 'screen_share_stopped':
          this.onScreenShareStopped?.(msg.userId, msg.producerId);
          break;
        case 'producer_closed':
          // The remote producer was closed — clean up our local consumer
          this.consumers.forEach((consumer, consumerId) => {
            if (consumerId === msg.consumerId) {
              consumer.close();
              this.consumers.delete(consumerId);
            }
          });
          this.onConsumerClosed?.(msg.producerId, msg.appData || {});
          break;
        case 'active_speaker':
          this.onActiveSpeaker?.(msg.userIds, msg.participantIds || []);
          break;
        case 'server_load_high':
          this.onServerLoadHigh?.();
          break;
        case 'error':
          if (msg.message && msg.message.includes("Maximum number of active cameras")) {
            this.onServerReject?.(msg.message);
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

    this.ws.onclose = () => {
      if (this.pingInterval) clearInterval(this.pingInterval);
      if (!this.isIntentionalDisconnect) {
        this.onConnectionStateChange?.('disconnected');
        this.needsRepublish = true;
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
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'update_room_settings', settings }));
    }
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
        console.log(`[WebRTC] Producing local media (${kind}, source: ${(appData as any)?.source || 'unknown'})...`);
        try {
          const { id } = await this.request('produce', 'produced', {
            transportId: this.sendTransport!.id,
            kind,
            rtpParameters,
            appData // Forward source tag ('camera' | 'screen') to server
          });
          console.log(`[WebRTC] Producer created on server. Producer ID: ${id}`);
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
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'reset_webrtc_state' }));
          }
          this.republishMedia().catch(console.error);
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
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'reset_webrtc_state' }));
        }
        this.republishMedia().catch(console.error);
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

  private startNetworkMonitor() {
    this.stopNetworkMonitor();
    
    if (!this.networkConfig.networkDetectionEnabled) {
      console.log('[WebRTC] Network detection is disabled, skipping startNetworkMonitor.');
      return;
    }
    
    console.log('[WebRTC] network_monitor_started', this.networkConfig);

    const WINDOW_SIZE = this.networkConfig.networkWindowSize;
    const history: Array<{
      rtt: number;
      packetLoss: number;
      jitter: number;
      sendBitrate: number;
      recvBitrate: number;
      framesDropped: number;
      framesEncoded: number;
    }> = [];

    let lastBytesSent = 0;
    let lastBytesRecv = 0;
    let lastPacketsSent = 0;
    let lastPacketsLost = 0;
    let lastFramesDropped = 0;
    let lastFramesEncoded = 0;
    let lastTime = performance.now();
    
    let currentLabel: NetworkQualityLabel = 'good';
    let labelStreak = 0;
    let reconnectCount = 0;

    this.networkInterval = setInterval(async () => {
      if (!this.sendTransport && !this.recvTransport) return;
      
      try {
        const now = performance.now();
        const dt = (now - lastTime) / 1000;
        if (dt <= 0) return;

        let rtt = 0;
        let jitter = 0;
        let bytesSent = 0;
        let bytesRecv = 0;
        let packetsSent = 0;
        let packetsLost = 0;
        let framesDropped = 0;
        let framesEncoded = 0;
        let availableOutgoingBitrate: number | null = null;
        let iceState = this.sendTransport?.connectionState || 'new';

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
              packetsLost += stat.packetsLost || 0;
              jitter = Math.max(jitter, stat.jitter ? stat.jitter * 1000 : 0);
            }
          });
        }

        // Calculate deltas
        const dBytesSent = Math.max(0, bytesSent - lastBytesSent);
        const dBytesRecv = Math.max(0, bytesRecv - lastBytesRecv);
        const dPacketsSent = Math.max(0, packetsSent - lastPacketsSent);
        const dPacketsLost = Math.max(0, packetsLost - lastPacketsLost);
        const dFramesDropped = Math.max(0, framesDropped - lastFramesDropped);
        const dFramesEncoded = Math.max(0, framesEncoded - lastFramesEncoded);

        lastBytesSent = bytesSent;
        lastBytesRecv = bytesRecv;
        lastPacketsSent = packetsSent;
        lastPacketsLost = packetsLost;
        lastFramesDropped = framesDropped;
        lastFramesEncoded = framesEncoded;
        lastTime = now;

        const sendBitrate = (dBytesSent * 8) / dt;
        const recvBitrate = (dBytesRecv * 8) / dt;
        const packetLoss = dPacketsSent > 0 ? (dPacketsLost / (dPacketsSent + dPacketsLost)) * 100 : 0;
        const fps = dFramesEncoded / dt;

        history.push({ rtt, packetLoss, jitter, sendBitrate, recvBitrate, framesDropped: dFramesDropped, framesEncoded: dFramesEncoded });
        if (history.length > WINDOW_SIZE) history.shift();

        // Averages over window
        const avgRtt = history.reduce((sum, h) => sum + h.rtt, 0) / history.length;
        const avgLoss = history.reduce((sum, h) => sum + h.packetLoss, 0) / history.length;
        const avgJitter = history.reduce((sum, h) => sum + h.jitter, 0) / history.length;
        const totalFramesDropped = history.reduce((sum, h) => sum + h.framesDropped, 0);
        const totalFramesEncoded = history.reduce((sum, h) => sum + h.framesEncoded, 0);
        const frameDropRate = totalFramesEncoded > 0 ? (totalFramesDropped / (totalFramesEncoded + totalFramesDropped)) : 0;

        let candidateLabel: NetworkQualityLabel = 'good';
        let diag: NetworkDebugSnapshot['diagnosticType'] = 'healthy';

        if (iceState === 'connecting' || iceState === 'checking') {
          candidateLabel = 'connecting_to_media_server';
          diag = 'media_server_recovery';
        } else if (iceState === 'disconnected' || this.isRepublishing) {
          candidateLabel = 'reconnecting';
          diag = 'media_server_recovery';
          reconnectCount++;
        } else if (frameDropRate > 0.15 && avgLoss < 2 && avgRtt < 150) {
          candidateLabel = 'device_performance_issue';
          diag = 'device';
        } else {
          const POOR_RTT = this.networkConfig.poorNetworkRttMs;
          const POOR_LOSS = this.networkConfig.poorNetworkLossPercent;
          const POOR_JITTER = this.networkConfig.poorNetworkJitterMs;

          // For unstable, we use slightly lower thresholds based on the poor thresholds
          const UNSTABLE_RTT = Math.max(100, Math.floor(POOR_RTT * 0.7));
          const UNSTABLE_LOSS = Math.max(1, Math.floor(POOR_LOSS * 0.5));
          const UNSTABLE_JITTER = Math.max(20, Math.floor(POOR_JITTER * 0.6));

          if (avgRtt > POOR_RTT || avgLoss > POOR_LOSS || avgJitter > POOR_JITTER) {
            candidateLabel = 'poor_network';
            diag = 'local_outbound';
          } else if (avgRtt >= UNSTABLE_RTT || avgLoss >= UNSTABLE_LOSS || avgJitter >= UNSTABLE_JITTER) {
            candidateLabel = 'unstable_network';
            diag = 'local_outbound';
          }
        }

        // Clean Hysteresis Logic
        if (candidateLabel === currentLabel) {
          labelStreak++;
        } else {
          if ((this as any).pendingCandidate !== candidateLabel) {
             (this as any).pendingCandidate = candidateLabel;
             (this as any).pendingStreak = 1;
          } else {
             (this as any).pendingStreak++;
          }
        }

        let nextLabel = currentLabel;
        const isNetworkLabel = (l: NetworkQualityLabel) => ['good', 'unstable_network', 'poor_network'].includes(l);
        
        if (!isNetworkLabel(candidateLabel)) {
           nextLabel = candidateLabel;
        } else {
           if ((this as any).pendingCandidate === candidateLabel && (this as any).pendingStreak >= 3) {
             nextLabel = candidateLabel;
           }
        }

        if (nextLabel !== currentLabel) {
          const oldLabel = currentLabel;
          currentLabel = nextLabel;
          labelStreak = 1;
          (this as any).pendingCandidate = null;
          (this as any).pendingStreak = 0;
          
          this.broadcastNetworkLabelChange(currentLabel);
          
          this.emitTelemetry('network_quality_label_changed', { old: oldLabel, new: currentLabel, avgRtt, avgLoss });
          
          if (currentLabel === 'device_performance_issue') this.emitTelemetry('device_performance_issue_detected');
          if (currentLabel === 'reconnecting' || currentLabel === 'connecting_to_media_server') this.emitTelemetry('media_connecting_not_network_poor');
          
          if (oldLabel === 'poor_network' && currentLabel === 'good' && labelStreak === 1) {
             this.emitTelemetry('network_quality_false_positive_suspected');
          }
        }

        if (this.onNetworkDebugSnapshot) {
          this.onNetworkDebugSnapshot({
            label: currentLabel,
            rtt: avgRtt,
            packetLoss: avgLoss,
            jitter: avgJitter,
            sendBitrate,
            recvBitrate,
            availableOutgoingBitrate,
            framesEncoded: dFramesEncoded,
            framesDropped: dFramesDropped,
            fps,
            iceState,
            reconnectCount,
            diagnosticType: diag
          });
        }

      } catch (e) {
      }
    }, this.networkConfig.networkMonitorIntervalMs);
  }
  
  private broadcastNetworkLabelChange(label: NetworkQualityLabel) {
    this.onNetworkQualityChange?.(label);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'network_quality', quality: label }));
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
    const isAudioPaused = this.localAudioProducer?.paused;
    
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
        const { id } = await this.request('produce', 'produced', {
          transportId: this.sendTransport!.id,
          kind,
          rtpParameters,
          appData
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
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'reset_webrtc_state' }));
        }
        this.republishMedia().catch(console.error);
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
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'reset_webrtc_state' }));
        }
        this.republishMedia().catch(console.error);
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
          const videoCodec = this.device.rtpCapabilities.codecs?.find(
            (c: any) => c.mimeType.toLowerCase() === 'video/vp8'
          ) || this.device.rtpCapabilities.codecs?.find(
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
        this.localAudioProducer = await this.sendTransport.produce({ 
          track: audioTrack, 
          appData: { source: 'mic' } 
        });
        this.onAudioTrackReplaced?.();
        if (isAudioPaused) this.localAudioProducer.pause();
      } else {
        console.warn("[WebRTC] Mic track is closed during reconnect. Reacquiring hardware...");
        this.emitTelemetry('mic_track_closed_detected');
        this.emitTelemetry('mic_reacquire_started');
        try {
          // This creates a new producer internally
          await this.enableMic();
          this.emitTelemetry('mic_reacquire_success');
          if (isAudioPaused) this.pauseMic();
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

        try {
          if (this.screenShareProducer) {
            this.emitTelemetry('screen_old_producer_closed');
            this.screenShareProducer.close();
          }
          this.emitTelemetry('screen_republish_started');
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
    }
    
    } catch (err) {
      console.error("republishMedia failed", err);
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
    const constraintsA: MediaStreamConstraints = {
      video: deviceId 
        ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 } }
        : { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 } },
      audio: false
    };

    // B. Selected device only
    const constraintsB: MediaStreamConstraints = {
      video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "user" },
      audio: false
    };

    // C. General safe camera
    const constraintsC: MediaStreamConstraints = {
      video: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 15, max: 24 } },
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

    // Initialize VideoProcessor if not exists
    let activeMode: VirtualBackgroundMode = 'none';
    if (this.isVirtualBackgroundEnabled) {
      if (!this.videoProcessor) {
        this.videoProcessor = new VideoProcessor();
        const saved = sessionStorage.getItem("mtg_vb");
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

    // Pass the stream through the VideoProcessor to apply Virtual Background only if needed
    if (this.isVirtualBackgroundEnabled && activeMode !== 'none') {
      const processedStream = this.videoProcessor!.startProcessing(this.rawCameraStream);
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
          ? [{ scalabilityMode: 'L3T3_KEY', maxBitrate: 1500000 }] // SVC for AV1/VP9
          : [ // Simulcast for VP8/H264
              { scaleResolutionDownBy: 4, maxBitrate: 150000, maxFramerate: 15 }, // 180p
              { scaleResolutionDownBy: 2, maxBitrate: 500000, maxFramerate: 30 }, // 360p
              { scaleResolutionDownBy: 1, maxBitrate: 1500000, maxFramerate: 30 } // 720p
            ];

    // If a live producer already exists, just swap the track — no second produce()
    if (this.localVideoProducer && !this.localVideoProducer.closed) {
      try {
        console.log('camera_producer_replace_track_started');
        await this.localVideoProducer.replaceTrack({ track: videoTrack });
        this.localVideoProducer.resume();
        console.log('camera_producer_replace_track_completed');
      } catch (err) {
        console.log('camera_producer_replace_track_failed');
        console.error("Track replacement failed, will recreate producer:", err);
        this.localVideoProducer.close();
        this.localVideoProducer = null;
        // Fall back to creating a new producer below
      }
    }

    if (!this.localVideoProducer || this.localVideoProducer.closed) {
      // First time or after producer was closed — create with full simulcast encodings
      this.emitTelemetry('video_produce_started');
      console.log('camera_producer_creating');
      try {
        const videoCodec = this.device.rtpCapabilities.codecs?.find(
          (c: any) => c.mimeType.toLowerCase() === 'video/vp8'
        ) || this.device.rtpCapabilities.codecs?.find(
          (c: any) => c.mimeType.toLowerCase() === 'video/h264' && c.parameters?.['profile-level-id'] === '42e01f'
        );

        this.localVideoProducer = await this.sendTransport.produce({
          track: videoTrack,
          appData: { source: 'camera' },
          encodings,
          codec: videoCodec,
          codecOptions: { videoGoogleStartBitrate: this.isLowBandwidth ? 50 : 1000 },
        });
        this.emitTelemetry('video_producer_created');
        console.log('camera_producer_created');
      } catch (err) {
        console.log('camera_producer_failed');
        throw err;
      }
    }
    
    this.emitTelemetry('video_ready');
    return videoTrack;
    } catch (e) {
      this.cameraStartInProgress = false;
      throw e;
    } finally {
      this.cameraStartInProgress = false;
    }
  }

  public async setVirtualBackground(mode: VirtualBackgroundMode, imageUrl?: string): Promise<MediaStreamTrack | null> {
    if (mode === 'none' || !this.isVirtualBackgroundEnabled) {
      if (!this.isVirtualBackgroundEnabled && mode !== 'none') {
        console.warn("[webrtc] virtual_background_disabled_for_room: skipping model load");
        console.warn("[webrtc] virtual_background_model_load_skipped");
      }
      if (this.videoProcessor) {
        this.videoProcessor.stopProcessing();
      }
      if (this.rawCameraStream && this.localVideoProducer && !this.localVideoProducer.closed) {
        const nativeTrack = this.rawCameraStream.getVideoTracks()[0];
        await this.localVideoProducer.replaceTrack({ track: nativeTrack });
        return nativeTrack;
      }
      return null;
    }

    if (!this.videoProcessor) {
      this.videoProcessor = new VideoProcessor();
      this.videoProcessor.onDegraded = (severity) => {
        if (this.onVbDegraded) this.onVbDegraded(severity);
      };
    }
    this.videoProcessor.setMode(mode, imageUrl);
    
    if (this.rawCameraStream && this.localVideoProducer && !this.localVideoProducer.closed) {
      const processedStream = this.videoProcessor.startProcessing(this.rawCameraStream);
      const newTrack = processedStream.getVideoTracks()[0];
      await this.localVideoProducer.replaceTrack({ track: newTrack });
      return newTrack;
    }
    return null;
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

  public async enableMic(isReconnect = false): Promise<MediaStreamTrack> {
    if (!this.device || !this.sendTransport) throw new Error("Device not initialized");
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
      this.rawAudioTrack = stream.getAudioTracks()[0];
      this.emitTelemetry('audio_track_ready');
      
      let activeTrack = this.rawAudioTrack;
      
      // Apply AI Noise Suppression if enabled
      if (this.isAINoiseSuppressionEnabled && this.purifyInstance) {
        const rawStream = new MediaStream([this.rawAudioTrack]);
        const denoisedStream = await this.purifyInstance.processStream(rawStream);
        activeTrack = denoisedStream.getAudioTracks()[0];
      }
      
      if (!this.localAudioProducer || this.localAudioProducer.closed) {
        this.emitTelemetry('audio_produce_started');
        this.localAudioProducer = await this.sendTransport.produce({ 
          track: activeTrack,
          appData: { source: 'mic' }
        });
        this.emitTelemetry('audio_producer_created');
      } else {
        await this.localAudioProducer.replaceTrack({ track: activeTrack });
      }

      // Handle unexpected track ends (e.g. mic unplugged)
      activeTrack.onended = async () => {
        console.warn("[WebRTC] Microphone track ended unexpectedly. Re-initializing hardware.");
        try {
          const wasPaused = this.localAudioProducer?.paused;
          await this.enableMic();
          if (wasPaused) {
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
      this.setAudioConnectionStatus(this.localAudioProducer?.paused ? 'muted' : 'connected');
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
      
      this.rawAudioTrack = stream.getAudioTracks()[0];
      let activeTrack = this.rawAudioTrack;

      if (enable) {
        const rawStream = new MediaStream([this.rawAudioTrack]);
        const denoisedStream = await this.purifyInstance.processStream(rawStream);
        activeTrack = denoisedStream.getAudioTracks()[0];
      }

      if (!this.localAudioProducer.closed) {
        await this.localAudioProducer.replaceTrack({ track: activeTrack });
      } else {
        this.localAudioProducer = await this.sendTransport.produce({ track: activeTrack, appData: { source: 'mic' } });
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

    let stream: MediaStream;
    let newTrack: MediaStreamTrack;

    if (kind === 'audio') {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } } });
      newTrack = stream.getAudioTracks()[0];
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
        this.rawAudioTrack = newTrack;
        if (this.isAINoiseSuppressionEnabled && this.purifyInstance) {
          const rawStream = new MediaStream([this.rawAudioTrack]);
          const denoisedStream = await this.purifyInstance.processStream(rawStream);
          newTrack = denoisedStream.getAudioTracks()[0];
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
        if (oldTrack) {
          oldTrack.stop();
        }
        if (kind === 'audio') this.onAudioTrackReplaced?.();
      }
    } else {
      if (kind === 'audio') {
        this.rawAudioTrack = newTrack;
        let activeTrack = newTrack;
        if (this.isAINoiseSuppressionEnabled && this.purifyInstance) {
          const rawStream = new MediaStream([this.rawAudioTrack]);
          const denoisedStream = await this.purifyInstance.processStream(rawStream);
          activeTrack = denoisedStream.getAudioTracks()[0];
        }
        this.localAudioProducer = await this.sendTransport.produce({ track: activeTrack, appData: { source: 'mic' } });
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
          
        const videoCodec = this.device.rtpCapabilities.codecs?.find(
          (c: any) => c.mimeType.toLowerCase() === 'video/vp8'
        ) || this.device.rtpCapabilities.codecs?.find(
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
    if (this.localAudioProducer && !this.localAudioProducer.paused) {
      this.localAudioProducer.pause();
    }
    if (this.audioConnectionTimeoutId) {
      clearTimeout(this.audioConnectionTimeoutId);
      this.audioConnectionTimeoutId = undefined;
      this.emitTelemetry('audio_connection_status_reset_on_mute');
    }
    this.setAudioConnectionStatus('muted');
  }

  public async resumeMic() {
    if (!this.localAudioProducer || this.localAudioProducer.closed || this.localAudioProducer.track?.readyState === 'ended' || this.rawAudioTrack?.readyState === 'ended') {
      console.warn("[WebRTC] Microphone track is ended or producer is closed. Re-initializing hardware.");
      try {
        await this.enableMic(true);
      } catch (e) {
        console.error("[WebRTC] Failed to re-initialize mic during resume:", e);
      }
    } else if (this.localAudioProducer.paused) {
      this.localAudioProducer.resume();
      this.setAudioConnectionStatus('connected');
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
      video: { frameRate: { ideal: 15, max: 30 } } // Lower framerate = less CPU, still crisp
    });
    const screenTrack = stream.getVideoTracks()[0];
    this.localScreenTrack = screenTrack;
    
    // Force H264 for screen share to ensure iPhone Safari compatibility
    let screenCodec;
    if (this.device.rtpCapabilities.codecs) {
      screenCodec = this.device.rtpCapabilities.codecs.find(
        (c) => c.mimeType.toLowerCase() === 'video/h264' && c.parameters?.['packetization-mode'] === 1
      );
    }
    
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

    // Auto-stop when user clicks browser's native "Stop sharing" button
    screenTrack.onended = () => {
      this.stopScreenShareProducer();
    };
    
    return screenTrack;
  }

  public async disableScreenShare(): Promise<void> {
    this.stopScreenShareProducer();
  }

  private stopScreenShareProducer() {
    if (this.screenShareProducer) {
      const producerId = this.screenShareProducer.id;
      // Tell the server FIRST so it can broadcast screen_share_stopped to all peers
      // and trigger producerclose on all remote consumers
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'stop_producer',
          producerId,
          appData: { source: 'screen' }
        }));
      }
      // Stop the track so the OS browser sharing indicator disappears
      this.screenShareProducer.track?.stop();
      this.screenShareProducer.close();
      this.screenShareProducer = null;
      this.localScreenTrack = null;
    }
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

    const source = appData?.source || (kind === 'audio' ? 'audio' : 'camera');
    console.log(`[WebRTC] Requesting to consume ${kind} (source: ${source}) from user ${producerParticipantId || producerUserId} (Producer ID: ${producerId})...`);

    try {
      const { id, kind: consumerKind, rtpParameters } = await this.request('consume', 'consumed', {
        transportId: this.recvTransport.id,
        producerId,
        rtpCapabilities: this.device.rtpCapabilities
      });

      console.log(`[WebRTC] Creating local consumer for ${kind} (source: ${source})... (Consumer ID: ${id})`);
      const consumer = await this.recvTransport.consume({
        id,
        producerId,
        kind: consumerKind,
        rtpParameters,
        appData: { source } // Carry source tag forward to onNewConsumer callback
      });

      this.consumers.set(consumer.id, consumer);
      
      // Handle automatic pausing/resuming from the Mediasoup SFU (e.g., due to bandwidth degradation)
      consumer.on('pause', () => {
        if (consumerKind === 'video' && source !== 'screen') {
          this.onCameraState?.({ userId: producerParticipantId || producerUserId, isCameraOn: false });
        } else if (consumerKind === 'audio') {
          this.onMuteState?.({ userId: producerParticipantId || producerUserId, isMuted: true });
        }
      });

      consumer.on('resume', () => {
        if (consumerKind === 'video' && source !== 'screen') {
          this.onCameraState?.({ userId: producerParticipantId || producerUserId, isCameraOn: true });
        } else if (consumerKind === 'audio') {
          this.onMuteState?.({ userId: producerParticipantId || producerUserId, isMuted: false });
        }
      });

      this.onNewConsumer?.(consumer, producerParticipantId || producerUserId, userName);
      
      // Tell the backend to resume sending media (unpause the consumer)
      if (this.isAudioOnlyMode && consumerKind === 'video' && source !== 'screen') {
        console.log(`[WebRTC] Audio-only mode active. Keeping video consumer ${id} paused.`);
      } else {
        console.log(`[WebRTC] Resuming consumer ${id} on server...`);
        this.request('resume', 'resumed', { consumerId: consumer.id }).then(() => {
          console.log(`[WebRTC] Consumer ${id} successfully resumed! Media should flow now.`);
        }).catch(err => {
          console.error(`[WebRTC] Failed to resume consumer ${id}:`, err);
        });
      }
    } catch (e) {
      console.warn(`[WebRTC] Failed to consume stream (it may have been closed):`, e);
    }
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
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.networkInterval) clearInterval(this.networkInterval);
    this.ws?.close();
    
    // Clear all pending requests and timeouts
    this.pendingRequests.forEach((queue, expectType) => {
      queue.forEach(req => {
        clearTimeout(req.timeoutId);
        req.reject(new Error(`Disconnected before receiving ${expectType}`));
      });
    });
    this.pendingRequests.clear();
    
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

  public sendUpdateRoomSettings(settings: { micLocked?: boolean, videoLocked?: boolean, chatLocked?: boolean }) {
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

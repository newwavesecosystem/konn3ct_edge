import type { Device } from 'mediasoup-client';
// @ts-ignore
import type { Transport, Producer, Consumer } from 'mediasoup-client/lib/types';

export class WebRTCClient {
  private ws: WebSocket | null = null;
  private device: Device | null = null;
  private sendTransport: Transport | null = null;
  private recvTransport: Transport | null = null;
  
  private localVideoProducer: Producer | null = null;
  private localAudioProducer: Producer | null = null;
  private consumers: Map<string, Consumer> = new Map();
  
  private pendingRequests: Map<string, Array<{ resolve: (val: any) => void, reject: (err: Error) => void, timeoutId: ReturnType<typeof setTimeout> }>> = new Map();
  private screenShareProducer: Producer | null = null;
  
  // Media
  public rawAudioTrack: MediaStreamTrack | null = null;
  private purifyInstance: any = null;
  public isAINoiseSuppressionEnabled = false;
  private messageIdCounter = 0;
  private isIntentionalDisconnect = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimeoutId?: NodeJS.Timeout;

  public userId: string | undefined;
  public userName: string | undefined;
  public userRole: string | undefined;
  public roomName: string | undefined;
  public sessionStatus?: string;

  public onNewConsumer?: (consumer: Consumer, userId: string) => void;
  public onConnectionStateChange?: (state: string) => void;
  
  // Participant Management Callbacks
  public onUserJoined?: (user: { userId: string, name: string, role: string, isMobile?: boolean }) => void;
  public onUserLeft?: (userId: string) => void;
  public onParticipantsList?: (participants: Array<{ userId: string, name: string, role: string, isMobile?: boolean }>) => void;
  
  // Collaboration Callbacks
  public onChatMessage?: (msg: any) => void;
  public onReaction?: (reaction: any) => void;
  public onPollCreate?: (poll: any) => void;
  public onPollVote?: (vote: any) => void;
  public onMuteState?: (msg: any) => void;
  public onCameraState?: (msg: any) => void;
  public onHandRaise?: (msg: any) => void;
  public onWaitingRoomRequest?: (msg: any) => void;
  public onChatHistory?: (messages: any[]) => void;
  public onPollHistory?: (polls: any[]) => void;
  public onNoteHistory?: (content: string) => void;
  public onNoteUpdate?: (msg: any) => void;
  public onServerLoadHigh?: () => void;
  public onServerReject?: (msg: string) => void;
  public onForceMute?: () => void;
  public onECinemaUpdate?: (link: string | null) => void;
  public onECinemaAction?: (msg: any) => void;
  public onDonationStatusReceived?: (active: boolean) => void;
  public onDonationSuccessReceived?: (userId: string, name: string, amount: number, currency: string) => void;
  public onParticipantNetworkQuality?: (userId: string, quality: 'good' | 'poor' | 'bad') => void;
  public onCaptionReceived?: (userId: string, text: string, isFinal: boolean, lang: string) => void;
  // Screen share state callbacks
  public onScreenShareStarted?: (userId: string, producerId: string) => void;
  public onScreenShareStopped?: (userId: string, producerId: string) => void;
  public onConsumerClosed?: (producerId: string, appData: Record<string, any>) => void;
  // Talking indicator
  public onActiveSpeaker?: (userIds: string[]) => void;
  // Recording
  public onRecordingStarted?: () => void;
  public onRecordingStopped?: () => void;
  public onSyncPanel?: (panel: string | null) => void;

  // Network monitoring
  public onNetworkQualityChange?: (quality: 'good' | 'poor' | 'bad') => void;
  private networkInterval?: NodeJS.Timeout;
  public isAudioOnlyMode = false;

  // Settings
  public isHDVideo: boolean = true;
  public isLowBandwidth: boolean = false;
  private needsRepublish: boolean = false;

  constructor(private roomId: string, private token: string) {}

  public async connect() {
    this.onConnectionStateChange?.('connecting');
    
    // Detect mobile
    const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone/i.test(navigator.userAgent);
    
    // Connect WebSocket
    const domain = process.env.NEXT_PUBLIC_BACKEND_DOMAIN || 'konn3ctedge.konn3ct.net';
    const wsUrl = `wss://${domain}/signal?roomId=${this.roomId}&token=${this.token}&isMobile=${isMobile}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = async () => {
      try {
        this.reconnectAttempts = 0; // Reset on success
        // Device init moved to session_status handling to respect waiting room
      } catch (err) {
        console.error("Connection failed:", err);
        this.onConnectionStateChange?.('failed');
      }
    };

    this.ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);
      
      // Handle Response matching by event type
      if (this.pendingRequests.has(msg.type)) {
        const queue = this.pendingRequests.get(msg.type)!;
        if (queue.length > 0) {
          const resolver = queue.shift()!;
          resolver.resolve(msg);
          if (queue.length === 0) {
            this.pendingRequests.delete(msg.type);
          }
          return;
        }
      }

      // Handle server-initiated events
      switch (msg.type) {
        case 'session_status':
          this.sessionStatus = msg.status;
          this.userId = msg.userId;
          this.userName = msg.name;
          this.userRole = msg.role;
          this.roomName = msg.roomName;
          
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
          if (!msg.recovered && this.device?.loaded) {
            console.log("Session lost by server. Executing Client-Side Auto-Republish...");
            this.republishMedia().catch(console.error);
            this.onConnectionStateChange?.('connected');
          } else if (msg.recovered && msg.status === 'active') {
            console.log("Session recovered by server. Forcing WebRTC auto-republish to handle potential IP changes (e.g. WiFi to Mobile)...");
            this.needsRepublish = false;
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify({ type: 'reset_webrtc_state' }));
            }
            this.republishMedia().catch(console.error);
            this.onConnectionStateChange?.('connected');
          } else if (!this.device?.loaded && msg.status === 'active') {
            // First time active
            this.initializeMediasoup().then(async () => {
              try {
                const res = await this.request('getProducers', 'producersList');
                for (const p of res.producers || []) {
                  try {
                    await this.consumeRemoteStream(p.producerId, p.userId, p.kind, p.appData);
                  } catch (err) {
                    console.error(`Failed to consume producer ${p.producerId}:`, err);
                  }
                }
                // Only broadcast connected AFTER Mediasoup is fully loaded
                this.onConnectionStateChange?.('connected');
              } catch (e) {
                console.error("Failed to load existing producers:", e);
              }
            }).catch(err => {
              console.error("Failed to initialize mediasoup", err); 
              this.onConnectionStateChange?.('failed');
            });
          } else if (msg.status === 'active') {
            this.onConnectionStateChange?.('connected');
          }
          break;
        case 'newProducer':
          this.consumeRemoteStream(msg.producerId, msg.userId, msg.kind, msg.appData).catch(console.error);
          break;
        case 'user_joined':
          this.onUserJoined?.(msg);
          break;
        case 'participants_list':
          this.onParticipantsList?.(msg.participants);
          break;
        case 'user_left':
          this.onUserLeft?.(msg.userId);
          // Cleanup consumers for this user
          break;
        case 'chat':
          this.onChatMessage?.(msg);
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
        case 'mute_state':
          this.onMuteState?.(msg);
          break;
        case 'camera_state':
          this.onCameraState?.(msg);
          break;
        case 'hand_raise':
          this.onHandRaise?.(msg);
          break;
        case 'waiting_room_request':
          this.onWaitingRoomRequest?.(msg);
          break;
        case 'chat_history':
          this.onChatHistory?.(msg.messages);
          break;
        case 'poll_history':
          this.onPollHistory?.(msg.polls);
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
          this.onActiveSpeaker?.(msg.userIds);
          break;
        case 'server_load_high':
          this.onServerLoadHigh?.();
          break;
        case 'error':
          if (msg.message && msg.message.includes("Maximum number of active cameras")) {
            this.onServerReject?.(msg.message);
          }
          break;
        case 'force_mute':
          this.onForceMute?.();
          break;
        case 'ecinema_update':
          this.onECinemaUpdate?.(msg.link);
          break;
        case 'network_quality':
          this.onParticipantNetworkQuality?.(msg.userId, msg.quality);
          break;
        case 'caption':
          this.onCaptionReceived?.(msg.userId, msg.text, msg.isFinal, msg.lang);
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
      this.pendingRequests.get(expectType)!.push({ resolve, reject, timeoutId });

      this.ws.send(JSON.stringify({
        type: sendType,
        ...payload
      }));
    });
  }

  // --- Collaboration Methods ---
  
  public sendChatMessage(message: string, targetUserId?: string, fileUrl?: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'chat', message, targetUserId, fileUrl }));
    }
  }

  public sendReaction(reaction: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'reaction', reaction }));
    }
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

  public sendMuteState(isMuted: boolean) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'mute_state', isMuted }));
    }
  }

  public sendCameraState(isCameraOn: boolean) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'camera_state', isCameraOn }));
    }
  }

  public sendHandRaise(isHandRaised: boolean) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'hand_raise', isHandRaised }));
    }
  }

  public admitUser(userId: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'admit_user', userId }));
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
      if (state === 'failed' || state === 'disconnected') {
        console.error('[WebRTC] Send Transport connection failed! (Possible firewall/UDP port issue)');
      }
    });

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
      if (state === 'failed' || state === 'disconnected') {
        console.error('[WebRTC] Receive Transport connection failed! (Possible firewall/UDP port issue)');
      }
    });

    this.startNetworkMonitor();
  }

  private startNetworkMonitor() {
    if (this.networkInterval) clearInterval(this.networkInterval);
    
    this.networkInterval = setInterval(async () => {
      if (!this.sendTransport) return;
      try {
        const stats = await this.sendTransport.getStats();
        let maxRtt = 0;
        let maxPacketLoss = 0;

        stats.forEach((stat: any) => {
          if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
            const rtt = stat.currentRoundTripTime ? stat.currentRoundTripTime * 1000 : 0;
            if (rtt > maxRtt) maxRtt = rtt;
          }
          if (stat.type === 'remote-inbound-rtp') {
            const rtt = stat.roundTripTime ? stat.roundTripTime * 1000 : 0;
            if (rtt > maxRtt) maxRtt = rtt;
            const loss = stat.fractionLost ? stat.fractionLost * 100 : 0;
            if (loss > maxPacketLoss) maxPacketLoss = loss;
          }
        });

        let quality: 'good' | 'poor' | 'bad' = 'good';
        // Zoom and modern platforms are highly tolerant due to FEC.
        // We relax the thresholds so users don't get unnecessary warnings.
        if (maxRtt > 1500 || maxPacketLoss > 25) {
          quality = 'bad';
        } else if (maxRtt > 800 || maxPacketLoss > 15) {
          quality = 'poor';
        }

        this.onNetworkQualityChange?.(quality);
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'network_quality', quality }));
        }
      } catch (e) {
        // Ignore stats errors
      }
    }, 15000);
  }

  private async republishMedia() {
    if (!this.device) return;
    
    // Save current tracks
    const videoTrack = this.localVideoProducer?.track;
    const audioTrack = this.localAudioProducer?.track;
    const isVideoPaused = this.localVideoProducer?.paused;
    const isAudioPaused = this.localAudioProducer?.paused;

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

    this.sendTransport.on('produce', async ({ kind, rtpParameters }: any, callback: any, errback: any) => {
      try {
        const { id } = await this.request('produce', 'produced', {
          transportId: this.sendTransport!.id,
          kind,
          rtpParameters
        });
        callback({ id });
      } catch (error: any) { errback(error); }
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

    // Republish saved tracks
    if (videoTrack && videoTrack.readyState === 'live') {
      this.localVideoProducer = await this.sendTransport.produce({ 
        track: videoTrack,
        appData: { source: 'camera' },
        encodings: [
          { scaleResolutionDownBy: 4, maxBitrate: 100000 },
          { scaleResolutionDownBy: 2, maxBitrate: 300000 },
          { scaleResolutionDownBy: 1, maxBitrate: 900000 },
        ],
        codecOptions: { videoGoogleStartBitrate: 1000 }
      });
      if (isVideoPaused) this.localVideoProducer.pause();
    }
    
    if (audioTrack && audioTrack.readyState === 'live') {
      this.localAudioProducer = await this.sendTransport.produce({ track: audioTrack });
      if (isAudioPaused) this.localAudioProducer.pause();
    }
    
    // Re-fetch consumers
    try {
      const res = await this.request('getProducers', 'producersList');
      for (const p of res.producers || []) {
        try {
          await this.consumeRemoteStream(p.producerId, p.userId, p.kind, p.appData);
        } catch (err) {
          console.error(`Failed to consume producer ${p.producerId}:`, err);
        }
      }
    } catch (e) {
      console.error("Failed to re-sync producers after republish", e);
    }
  }

  public async enableCamera(): Promise<MediaStreamTrack> {
    if (!this.device || !this.sendTransport) throw new Error("Device not initialized");
    
    // Cleanup existing camera producer if replacing
    if (this.localVideoProducer) {
      this.localVideoProducer.close();
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'stop_producer',
          producerId: this.localVideoProducer.id,
          appData: { source: 'camera' }
        }));
      }
    }

    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        width: this.isHDVideo ? { ideal: 1280 } : { ideal: 640 }, 
        height: this.isHDVideo ? { ideal: 720 } : { ideal: 480 } 
      } 
    });
    const videoTrack = stream.getVideoTracks()[0];
    
    const encodings = this.isLowBandwidth ? [
      // Aggressively limit resolution and bitrate for bad networks
      { scaleResolutionDownBy: 2, maxBitrate: 50000 },
      { scaleResolutionDownBy: 1, maxBitrate: 150000 }
    ] : [
      // Standard HQ simulcast
      { scaleResolutionDownBy: 4, maxBitrate: 100000 },
      { scaleResolutionDownBy: 2, maxBitrate: 300000 },
      { scaleResolutionDownBy: 1, maxBitrate: 900000 },
    ];

    this.localVideoProducer = await this.sendTransport.produce({ 
      track: videoTrack,
      appData: { source: 'camera' }, // Tag so remote peers know this is a camera feed
      encodings,
      codecOptions: { videoGoogleStartBitrate: this.isLowBandwidth ? 50 : 1000 }
    });
    if (this.localVideoProducer && !this.localVideoProducer.closed) {
      await this.localVideoProducer.replaceTrack({ track: videoTrack });
      this.localVideoProducer.resume();
    } else {
      this.localVideoProducer = await this.sendTransport.produce({ 
        track: videoTrack,
        encodings: [
          { scaleResolutionDownBy: 4, maxBitrate: 100000 },
          { scaleResolutionDownBy: 2, maxBitrate: 300000 },
          { scaleResolutionDownBy: 1, maxBitrate: 900000 },
        ],
        codecOptions: { videoGoogleStartBitrate: 1000 }
      });
    }
    return videoTrack;
  }

  public disableCamera() {
    if (this.localVideoProducer) {
      if (this.localVideoProducer.track) {
        this.localVideoProducer.track.stop();
      }
      this.localVideoProducer.pause();
    }
  }

  public async enableMic(): Promise<MediaStreamTrack> {
    if (!this.device || !this.sendTransport) throw new Error("Device not initialized");
    
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: { 
        noiseSuppression: !this.isAINoiseSuppressionEnabled, // Turn off native if AI is active
        echoCancellation: true 
      } 
    });
    this.rawAudioTrack = stream.getAudioTracks()[0];
    
    let activeTrack = this.rawAudioTrack;
    
    // Apply AI Noise Suppression if enabled
    if (this.isAINoiseSuppressionEnabled && this.purifyInstance) {
      const rawStream = new MediaStream([this.rawAudioTrack]);
      const denoisedStream = await this.purifyInstance.processStream(rawStream);
      activeTrack = denoisedStream.getAudioTracks()[0];
    }
    
    // Only produce if we haven't already produced, otherwise replace track
    if (!this.localAudioProducer) {
      this.localAudioProducer = await this.sendTransport.produce({ track: activeTrack });
    } else {
      await this.localAudioProducer.replaceTrack({ track: activeTrack });
    }
    return activeTrack;
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

      await this.localAudioProducer.replaceTrack({ track: activeTrack });
      return activeTrack;
    }
    return undefined;
  }

  public async switchDevice(kind: 'audio' | 'video', deviceId: string): Promise<MediaStreamTrack> {
    if (!this.device || !this.sendTransport) throw new Error("Device not initialized");

    const constraints: MediaStreamConstraints = {};
    if (kind === 'audio') {
      constraints.audio = { deviceId: { exact: deviceId } };
    } else {
      constraints.video = { 
        deviceId: { exact: deviceId }, 
        width: this.isHDVideo ? { ideal: 1280 } : { ideal: 640 }, 
        height: this.isHDVideo ? { ideal: 720 } : { ideal: 480 } 
      };
    }

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    let newTrack = kind === 'audio' ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0];

    const producer = kind === 'audio' ? this.localAudioProducer : this.localVideoProducer;

    if (producer) {
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
      await producer.replaceTrack({ track: newTrack });
      // Stop the old track to release the hardware
      if (oldTrack) {
        oldTrack.stop();
      }
    }

    return newTrack;
  }

  // --- Media Controls ---
  
  public pauseMic() {
    if (this.localAudioProducer && !this.localAudioProducer.paused) {
      this.localAudioProducer.pause();
    }
  }

  public resumeMic() {
    if (this.localAudioProducer && this.localAudioProducer.paused) {
      this.localAudioProducer.resume();
    }
  }

  public pauseCamera() {
    if (this.localVideoProducer && !this.localVideoProducer.paused) {
      this.localVideoProducer.pause();
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
    
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 15, max: 30 } } // Lower framerate = less CPU, still crisp
    });
    const screenTrack = stream.getVideoTracks()[0];
    
    // Create a SEPARATE producer — camera producer stays untouched
    this.screenShareProducer = await this.sendTransport.produce({
      track: screenTrack,
      appData: { source: 'screen' }, // Tag so remote peers render in screen overlay, not tile
      encodings: [
        { maxBitrate: 1500000 } // Single high-quality encoding — no simulcast needed for screen
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
    }
  }

  private async consumeRemoteStream(producerId: string, userId: string, kind: string, appData?: Record<string, any>) {
    if (!this.device || !this.recvTransport) return;

    const source = appData?.source || (kind === 'audio' ? 'audio' : 'camera');
    console.log(`[WebRTC] Requesting to consume ${kind} (source: ${source}) from user ${userId} (Producer ID: ${producerId})...`);

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
      this.onNewConsumer?.(consumer, userId);
      
      // Tell the backend to resume sending media (unpause the consumer)
      if (this.isAudioOnlyMode && consumerKind === 'video') {
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
    this.pauseCamera();
    
    // Pause all existing video consumers locally and on server
    for (const [id, consumer] of this.consumers.entries()) {
      if (consumer.kind === 'video') {
        this.request('pause_consumer', 'consumer_paused', { consumerId: id }).catch(console.error);
        consumer.pause();
      }
    }
  }

  public disableAudioOnlyMode() {
    this.isAudioOnlyMode = false;
    
    // Resume all existing video consumers
    for (const [id, consumer] of this.consumers.entries()) {
      if (consumer.kind === 'video') {
        this.request('resume', 'resumed', { consumerId: id }).catch(console.error);
        consumer.resume();
      }
    }
  }

  public disconnect() {
    console.log('[WebRTC] Disconnecting gracefully...');
    this.isIntentionalDisconnect = true;
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
    
    this.stopScreenShareProducer();
    if (this.sendTransport) this.sendTransport.close();
    if (this.recvTransport) this.recvTransport.close();
  }

  // --- Host Controls ---
  public sendAdmitUser(userId: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'admit_user', userId }));
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

  public sendForceMute(userId?: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'force_mute', userId }));
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

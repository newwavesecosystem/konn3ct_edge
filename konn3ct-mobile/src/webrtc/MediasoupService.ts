import { Device, types } from 'mediasoup-client';
import { MediaStream } from 'react-native-webrtc';
import { useAuthStore } from '../store/useAuthStore';
import { useMeetingStore } from '../store/useMeetingStore';

// Signal server domain — as specified by the team:
// https://konn3ctedge.konn3ct.net/signal
export const SIGNAL_SERVER_DOMAIN = process.env.EXPO_PUBLIC_BACKEND_DOMAIN || 'konn3ctedge.konn3ct.net';
const BACKEND_DOMAIN = SIGNAL_SERVER_DOMAIN;

export interface RemoteParticipant {
  id: string;
  name: string;
  stream: MediaStream;
  screenStream?: MediaStream;
}

export class MediasoupService {
  public participantId: string = Math.random().toString(36).substring(2, 15);
  private ws: WebSocket | null = null;
  private device: Device | null = null;
  
  private sendTransport: types.Transport | null = null;
  private recvTransport: types.Transport | null = null;
  
  private localVideoProducer: types.Producer | null = null;
  private localAudioProducer: types.Producer | null = null;
  private consumers: Map<string, types.Consumer> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map();
  private remoteScreenStreams = new Map<string, MediaStream>();
  private screenConsumerIds = new Set<string>();  // consumer IDs that belong to screen shares
  private consumerPeerIds = new Map<string, string>(); // consumerId → peerId
  private peerNames = new Map<string, string>();  // userId → display name cache
  private pendingRequests = new Map<string, {resolve: Function, reject: Function, timeoutId: any}[]>();
  private pingInterval: NodeJS.Timeout | null = null;

  // Reconnection state
  private _reconnectAttempts = 0;
  private _maxReconnectAttempts = 5;
  private _isReconnecting = false;
  private _intentionalDisconnect = false;
  private _lastMeetingToken?: string;
  private _lastLocalStream?: MediaStream;

  // Buffered one-shot events — cached during lobby handoff so MeetingScreen
  // can replay them after setting up its callbacks.
  private _cachedParticipantsList: any[] | null = null;
  private _cachedChatHistory: any[] | null = null;
  private _cachedPollHistory: any[] | null = null;

  // Connection State
  
  // Callbacks
  private onStreamUpdateCallback: ((streams: RemoteParticipant[]) => void) | null = null;
  public onParticipantsList?: (participants: any[]) => void;
  public onUserJoined?: (user: any) => void;
  public onUserLeft?: (userId: string) => void;
  public onChatMessage?: (msg: any) => void;
  public onChatHistory?: (messages: any[]) => void;
  public onReaction?: (reaction: any) => void;
  public onPollCreate?: (poll: any) => void;
  public onPollVote?: (vote: any) => void;
  public onPollEnd?: (data: { pollId: string }) => void;
  public onPollHistory?: (polls: any[]) => void;
  public onWaitingRoomRequest?: (user: any) => void;
  public onForceMute?: () => void;
  public onHandRaise?: (msg: any) => void;
  public onActiveSpeaker?: (userIds: string[]) => void;
  public onRecordingStarted?: () => void;
  public onRecordingStopped?: () => void;
  public onCaptionReceived?: (userId: string, text: string, isFinal: boolean, lang: string) => void;
  public onSessionStatusChange?: (status: string) => void;
  public onReconnecting?: (attempt: number) => void;
  public onReconnected?: () => void;
  public onReconnectFailed?: () => void;
  
  public roomId: string;
  public sessionStatus?: string;
  public currentUserId?: string;
  public currentUserRole?: string;
  
  constructor(roomId: string) {
    this.roomId = roomId;
  }

  // --- Collaboration Methods ---
  public sendChatMessage(message: string, targetUserId?: string, fileUrl?: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'chat', message, targetUserId, fileUrl }));
    }
  }

  public sendReaction(reaction: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'reaction', reaction }));
    }
  }

  public sendHandRaise(isRaised: boolean) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'hand_raise', isHandRaised: isRaised }));
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

  public createPoll(pollId: string, question: string, options: any[]) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'poll_create', pollId, question, options }));
    }
  }

  public votePoll(pollId: string, optionId: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'poll_vote', pollId, optionId }));
    }
  }

  public endPoll(pollId: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'end_poll', pollId }));
    }
  }

  public admitUser(userId: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'admit_user', userId }));
    }
  }

  public denyUser(userId: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'deny_user', userId }));
    }
  }

  public endMeetingForAll() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'end_meeting' }));
    }
  }

  public forceMute(userId?: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'force_mute', userId }));
    }
  }

  public onStreamUpdate(callback: (streams: RemoteParticipant[]) => void) {
    this.onStreamUpdateCallback = callback;
    // If streams were already consumed (e.g. during lobby handoff), fire immediately
    if (this.remoteStreams.size > 0 || this.remoteScreenStreams.size > 0) {
      this.notifyStreamUpdate();
    }
  }

  /**
   * Replay one-shot events that were cached during the lobby handoff.
   * Call this after setting up all callbacks (onParticipantsList, onChatHistory, etc.)
   * so the MeetingScreen receives events that fired before its callbacks were registered.
   */
  public replayCachedEvents() {
    if (this._cachedParticipantsList && this.onParticipantsList) {
      this.onParticipantsList(this._cachedParticipantsList);
      this._cachedParticipantsList = null;
    }
    if (this._cachedChatHistory && this.onChatHistory) {
      this.onChatHistory(this._cachedChatHistory);
      this._cachedChatHistory = null;
    }
    if (this._cachedPollHistory && this.onPollHistory) {
      this.onPollHistory(this._cachedPollHistory);
      this._cachedPollHistory = null;
    }
  }

  private notifyStreamUpdate() {
    if (!this.onStreamUpdateCallback) return;
    const participants: RemoteParticipant[] = [];
    const allIds = new Set([...this.remoteStreams.keys(), ...this.remoteScreenStreams.keys()]);
    
    // Look up real names from the meeting store
    const storeParticipants = useMeetingStore.getState().participants;
    
    allIds.forEach((id) => {
      const stream = this.remoteStreams.get(id);
      const screenStream = this.remoteScreenStreams.get(id);
      
      if (stream || screenStream) {
        // Name resolution priority:
        // 1. Cached name from newProducer/producersList (always available)
        // 2. Zustand store lookup (may be empty due to race condition)
        // 3. Fallback generic
        const cachedName = this.peerNames.get(id);
        const storeP = storeParticipants.find(p => p.userId === id);
        participants.push({
          id,
          name: storeP?.name || cachedName || `User ${id.substring(0, 4)}`,
          stream: stream || new MediaStream(),
          screenStream
        });
      }
    });
    this.onStreamUpdateCallback([...participants]);
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
          }
        }
      }, 10000);

      if (!this.pendingRequests.has(expectType)) {
        this.pendingRequests.set(expectType, []);
      }
      this.pendingRequests.get(expectType)!.push({ resolve, reject, timeoutId });

      this.ws.send(JSON.stringify({ type: sendType, ...payload }));
    });
  }

  public async connect(meetingToken?: string) {
    if (!meetingToken) {
      throw new Error(
        'No meeting JWT provided – the signal server requires a JWT, not a Sanctum token. '
        + 'Obtain one via getAttendeeToken() or startRoom() before calling connect().'
      );
    }
    const token = meetingToken;
    this._lastMeetingToken = meetingToken;

    // Only URL-encode the name (may contain spaces). The token must be passed
    // raw — the signal server validates it as-is before the WebSocket upgrade,
    // and encoding the pipe character (| → %7C) causes a 401 Unauthorized.
    const encodedName = encodeURIComponent(useAuthStore.getState().user?.name || 'Mobile User');
    const wsUrl = `wss://${BACKEND_DOMAIN}/signal?roomId=${this.roomId}&isMobile=true&token=${token}&name=${encodedName}&participantId=${this.participantId}`;
    
    console.log('--- WEBSOCKET CONNECTION INFO ---');
    console.log('Connecting to Domain:', BACKEND_DOMAIN);
    console.log('Room ID:', this.roomId);
    console.log('Token Length:', token ? token.length : 'NO TOKEN');
    console.log('Full WS URL (first 100 chars):', wsUrl.substring(0, 100) + '...');
    console.log('---------------------------------');
    
    this.ws = new WebSocket(wsUrl);

    return new Promise<string>((resolve, reject) => {
      this.ws!.onopen = () => {
        console.log('Native WebSocket connected successfully!');
        const userName = useAuthStore.getState().user?.name || 'Mobile User';
        this.ws!.send(JSON.stringify({ type: 'auth', token, name: userName }));

        // Keep-alive to prevent DO Load Balancer from dropping idle connections
        this.pingInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 25000);
      };

      this.ws!.onerror = (err) => {
        // Log as warn instead of error to prevent React Native red box during normal disconnection
        console.warn('WebSocket connection warning:', err);
        // Don't reject here - onclose fires right after with the actual reason
      };
      
      this.ws!.onclose = (e) => {
        console.log(`WebSocket closed: ${e.code} ${e.reason}`);
        if (this.pingInterval) clearInterval(this.pingInterval);

        // If this was an intentional disconnect (user left), don't reconnect
        if (this._intentionalDisconnect) {
          reject(new Error(e.reason || `WebSocket closed with code ${e.code}`));
          return;
        }

        // If already connected (mid-session drop), attempt reconnection
        if (this.device?.loaded && !this._isReconnecting) {
          console.log('Mid-session WebSocket drop detected, attempting reconnection...');
          this.attemptReconnect();
          return;
        }

        // Reject with the close reason so callers can detect 404 vs other errors
        reject(new Error(e.reason || `WebSocket closed with code ${e.code}`));
      };

      this.ws!.onmessage = async (event) => {
        let msg: any;
        try {
          msg = JSON.parse(event.data);
        } catch (e) { return; }

        if (this.pendingRequests.has(msg.type)) {
          const queue = this.pendingRequests.get(msg.type)!;
          if (queue.length > 0) {
            const resolver = queue.shift()!;
            clearTimeout(resolver.timeoutId);
            resolver.resolve(msg);
            if (queue.length === 0) this.pendingRequests.delete(msg.type);
            return;
          }
        }
        
        // Handle failure cases to prevent timeouts
        if (msg.type === 'consume_failed' && this.pendingRequests.has('consumed')) {
          const queue = this.pendingRequests.get('consumed')!;
          if (queue.length > 0) {
            const resolver = queue.shift()!;
            clearTimeout(resolver.timeoutId);
            resolver.reject(new Error(`Consume failed: ${msg.errorCode} - ${msg.reason}`));
            if (queue.length === 0) this.pendingRequests.delete('consumed');
            return;
          }
        }
        
        if (msg.type === 'produce_failed' && this.pendingRequests.has('produced')) {
          const queue = this.pendingRequests.get('produced')!;
          if (queue.length > 0) {
            const resolver = queue.shift()!;
            clearTimeout(resolver.timeoutId);
            resolver.reject(new Error(`Produce failed: ${msg.errorCode} - ${msg.reason}`));
            if (queue.length === 0) this.pendingRequests.delete('produced');
            return;
          }
        }

        switch (msg.type) {
          case 'session_status':
            this.sessionStatus = msg.status;
            if (msg.userId && msg.role) {
              this.currentUserId = msg.userId;
              this.currentUserRole = msg.role;
              useMeetingStore.getState().setCurrentUser(msg.userId, msg.role);
            }
            
            if (msg.status === 'active' && !this.device?.loaded) {
              try {
                await this.initializeMediasoup();
                if (this.onSessionStatusChange) this.onSessionStatusChange('active');
                resolve('active');
              } catch (e) {
                console.error('Failed to init mediasoup:', e);
                reject(e);
              }
            } else if (msg.status === 'waiting') {
              console.log('Waiting for host to admit...');
              if (this.onSessionStatusChange) this.onSessionStatusChange('waiting');
              resolve('waiting');
            } else if (msg.status === 'ended') {
              console.log('Meeting ended by host');
              if (this.onSessionStatusChange) this.onSessionStatusChange('ended');
              this.disconnect();
            } else if (msg.status === 'kicked') {
              console.log('Kicked from meeting by host');
              if (this.onSessionStatusChange) this.onSessionStatusChange('kicked');
              this.disconnect();
            } else if (msg.status === 'denied') {
              console.log('Entry denied by host');
              if (this.onSessionStatusChange) this.onSessionStatusChange('denied');
              this.disconnect();
            }
            break;

          case 'participants_list':
            if (this.onParticipantsList) {
              this.onParticipantsList(msg.participants || []);
              setTimeout(() => this.notifyStreamUpdate(), 100);
            } else {
              // Cache for replay when callback is set (lobby handoff)
              this._cachedParticipantsList = msg.participants || [];
            }
            break;

          case 'user_joined':
            if (this.onUserJoined) {
              this.onUserJoined(msg);
              setTimeout(() => this.notifyStreamUpdate(), 100);
            }
            break;

          case 'user_left':
            if (this.onUserLeft) this.onUserLeft(msg.userId);
            const leftStream = this.remoteStreams.get(msg.userId);
            const leftScreenStream = this.remoteScreenStreams.get(msg.userId);
            if (leftStream || leftScreenStream) {
              this.remoteStreams.delete(msg.userId);
              this.remoteScreenStreams.delete(msg.userId);
              this.notifyStreamUpdate();
            }
            break;

          case 'chat_history':
            if (this.onChatHistory) {
              this.onChatHistory(msg.messages || []);
            } else {
              this._cachedChatHistory = msg.messages || [];
            }
            break;

          case 'chat':
            if (this.onChatMessage) this.onChatMessage(msg);
            break;

          case 'reaction':
            if (this.onReaction) this.onReaction(msg);
            break;

          case 'poll_history':
            if (this.onPollHistory) {
              this.onPollHistory(msg.polls || []);
            } else {
              this._cachedPollHistory = msg.polls || [];
            }
            break;

          case 'poll_create':
            if (this.onPollCreate) this.onPollCreate(msg);
            break;

          case 'poll_vote':
            if (this.onPollVote) this.onPollVote(msg);
            break;

          case 'poll_ended':
            if (this.onPollEnd) this.onPollEnd(msg);
            break;

          case 'waiting_room_request':
            if (this.onWaitingRoomRequest) this.onWaitingRoomRequest(msg);
            break;

          case 'caption':
            if (this.onCaptionReceived) this.onCaptionReceived(msg.userId, msg.text, msg.isFinal, msg.lang);
            break;

          case 'force_mute':
            if (this.onForceMute) this.onForceMute();
            break;

          case 'hand_raise':
            if (this.onHandRaise) this.onHandRaise(msg);
            break;
            
          case 'active_speaker':
            if (this.onActiveSpeaker) this.onActiveSpeaker(msg.userIds);
            break;

          case 'recording_started':
            if (this.onRecordingStarted) this.onRecordingStarted();
            break;

          case 'recording_stopped':
            if (this.onRecordingStopped) this.onRecordingStopped();
            break;

          case 'newProducer':
            if (msg.userId === this.currentUserId || msg.participantId === this.participantId) {
              console.log('Ignoring own producer broadcast');
              break;
            }
            // Cache the participant name from the server (resolves race condition)
            if (msg.name && msg.userId) {
              this.peerNames.set(msg.userId, msg.name);
            }
            this.consumeRemote(msg.producerId, msg.userId, msg.kind, msg.appData).catch(console.error);
            break;

          case 'producer_closed':
            // Match by producerId — server sends the producerId that was closed,
            // and consumers track which producerId they correspond to.
            this.consumers.forEach((consumer, consumerId) => {
              if (consumer.producerId === msg.producerId) {
                const isScreen = this.screenConsumerIds.has(consumerId);
                console.log(`[MediasoupService] producer_closed received. Closing consumer ${consumerId} (kind: ${consumer.kind}, isScreen: ${isScreen})`);
                
                // Remove the track from the correct map BEFORE closing the consumer
                const peerId = msg.userId || this.consumerPeerIds.get(consumerId);
                if (peerId) {
                  const targetMap = isScreen ? this.remoteScreenStreams : this.remoteStreams;
                  const stream = targetMap.get(peerId);
                  if (stream) {
                    const newTracks = stream.getTracks().filter(t => t.id !== consumer.track.id);
                    if (newTracks.length > 0) {
                      const newStream = new MediaStream(newTracks as any);
                      targetMap.set(peerId, newStream);
                      console.log(`[MediasoupService] Removed track from ${isScreen ? 'screen' : 'media'} stream for peer ${peerId}. Tracks left: ${newTracks.length}`);
                    } else {
                      targetMap.delete(peerId);
                      console.log(`[MediasoupService] Removed empty ${isScreen ? 'screen' : 'media'} stream for peer ${peerId}`);
                    }
                  }
                }
                
                if (isScreen) this.screenConsumerIds.delete(consumerId);
                this.consumerPeerIds.delete(consumerId);
                consumer.close();
                this.consumers.delete(consumerId);
              }
            });
            this.notifyStreamUpdate();
            break;
        }
      };
    });
  }

  private async initializeMediasoup() {
    console.log('Requesting Router Capabilities...');
    const res = await this.request('getRouterRtpCapabilities', 'routerCapabilities');
    
    this.device = new Device();
    await this.device.load({ routerRtpCapabilities: res.rtpCapabilities });
    console.log('Mediasoup Device loaded!');

    // Send Transport
    const sendRes = await this.request('createWebRtcTransport', 'transportCreated', { direction: 'send' });
    this.sendTransport = this.device.createSendTransport(sendRes.transportParams);
    
    this.sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        console.log('[sendTransport] DTLS connect requested...');
        await this.request('connectWebRtcTransport', 'transportConnected', {
          transportId: this.sendTransport!.id,
          dtlsParameters
        });
        console.log('[sendTransport] DTLS connected successfully!');
        callback();
      } catch (err) {
        console.error('[sendTransport] DTLS connect FAILED:', err);
        errback(err as Error);
      }
    });

    this.sendTransport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
      try {
        const { id } = await this.request('produce', 'produced', {
          transportId: this.sendTransport!.id,
          kind,
          rtpParameters,
          appData
        });
        callback({ id });
      } catch (err) { errback(err as Error); }
    });

    // Monitor Send Transport ICE connection state (log-only)
    // NOTE: Do NOT trigger full reconnect on transport 'failed' — ICE failures
    // are often transient (TURN/STUN negotiation, network switching) and
    // mediasoup handles ICE restarts internally. Full reconnection should only
    // be triggered by WebSocket close (signaling channel lost).
    this.sendTransport.on('connectionstatechange', (state: string) => {
      console.log(`Send transport connection state: ${state}`);
    });

    // Recv Transport
    const recvRes = await this.request('createWebRtcTransport', 'transportCreated', { direction: 'recv' });
    this.recvTransport = this.device.createRecvTransport(recvRes.transportParams);
    
    this.recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        await this.request('connectWebRtcTransport', 'transportConnected', {
          transportId: this.recvTransport!.id,
          dtlsParameters
        });
        callback();
      } catch (err) { errback(err as Error); }
    });

    // Monitor Recv Transport ICE connection state (log-only)
    this.recvTransport.on('connectionstatechange', (state: string) => {
      console.log(`Recv transport connection state: ${state}`);
    });

    // Fetch existing producers
    try {
      const prodRes = await this.request('getProducers', 'producersList');
      for (const p of prodRes.producers || []) {
        if (p.userId === this.currentUserId || p.participantId === this.participantId) continue;
        // Cache the participant name from the producer list
        if (p.name && p.userId) {
          this.peerNames.set(p.userId, p.name);
        }
        await this.consumeRemote(p.producerId, p.userId, p.kind, p.appData);
      }
    } catch (e) { console.error('Failed to get existing producers', e); }
  }

  public async enableCamera(videoTrack: MediaStreamTrack) {
    if (!this.sendTransport) {
      console.error('[enableCamera] sendTransport is NULL — cannot produce.');
      return;
    }
    if (this.localVideoProducer && !this.localVideoProducer.closed) {
      console.log('[enableCamera] Camera is already producing');
      return;
    }
    
    console.log(`[enableCamera] Producing video track... readyState=${videoTrack.readyState}, enabled=${videoTrack.enabled}`);
    try {
      this.localVideoProducer = await this.sendTransport.produce({ 
        track: videoTrack as any, 
        appData: { source: 'camera' },
        encodings: [{ maxBitrate: 600000, maxFramerate: 30 }],
        codecOptions: { videoGoogleStartBitrate: 1000 }
      });
      console.log(`[enableCamera] Video producer created: id=${this.localVideoProducer.id}`);
      // Notify all other participants that our camera is now on.
      // The web frontend gates video tile display on this signal.
      this.sendCameraState(true);
    } catch (err) {
      console.error('[enableCamera] FAILED to produce video:', err);
    }
  }

  public disableCamera() {
    if (this.localVideoProducer) {
      console.log(`[disableCamera] Closing video producer id=${this.localVideoProducer.id}`);
      // Notify all other participants that our camera is now off BEFORE closing.
      this.sendCameraState(false);
      this.localVideoProducer.close();
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ 
          type: 'stop_producer', 
          producerId: this.localVideoProducer.id,
          appData: { source: 'camera' }
        }));
      }
      this.localVideoProducer = undefined;
    }
  }

  public async enableMic(audioTrack: MediaStreamTrack) {
    if (!this.sendTransport) {
      console.error('[enableMic] sendTransport is NULL — cannot produce.');
      return;
    }
    if (this.localAudioProducer && !this.localAudioProducer.closed) {
      console.log('[enableMic] Mic is already producing');
      return;
    }
    
    console.log(`[enableMic] Producing audio track... readyState=${audioTrack.readyState}, enabled=${audioTrack.enabled}`);
    try {
      this.localAudioProducer = await this.sendTransport.produce({
        track: audioTrack as any,
        appData: { source: 'mic' }
      });
      console.log(`[enableMic] Audio producer created: id=${this.localAudioProducer.id}`);
    } catch (err) {
      console.error('[enableMic] FAILED to produce audio:', err);
    }
  }

  public disableMic() {
    if (this.localAudioProducer) {
      console.log(`[disableMic] Closing audio producer id=${this.localAudioProducer.id}`);
      this.localAudioProducer.close();
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'stop_producer',
          producerId: this.localAudioProducer.id,
          appData: { source: 'mic' }
        }));
      }
      this.localAudioProducer = undefined;
    }
  }

  /**
   * Broadcast the local camera on/off state to all other participants.
   * The web frontend uses this signal to show or hide the video tile for
   * this participant — without it, mobile video will never be displayed
   * on the web even though the media stream is flowing.
   */
  public sendCameraState(isCameraOn: boolean) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'camera_state', isCameraOn }));
    }
  }

  public switchCamera(localStream?: any) {
    try {
      // Prefer the original stream track over the producer's internal reference.
      // The producer track can become stale after RTC renegotiation, causing crashes.
      const track = localStream
        ? localStream.getVideoTracks()[0]
        : this.localVideoProducer?.track;
      if (track && typeof (track as any)._switchCamera === 'function') {
        (track as any)._switchCamera();
      }
    } catch (e) {
      console.warn('switchCamera failed:', e);
    }
  }

  /**
   * Returns the underlying mediasoup send transport, or `null` if not yet
   * created.  Used by {@link useNetworkQuality} to reach the
   * `RTCPeerConnection` for stats polling.
   */
  public getSendTransport(): types.Transport | null {
    return this.sendTransport;
  }

  private async consumeRemote(producerId: string, peerId: string, kind: string, appData: any) {
    if (!this.device || !this.recvTransport) return;

    try {
      const data = await this.request('consume', 'consumed', {
        producerId,
        transportId: this.recvTransport.id,
        rtpCapabilities: this.device.rtpCapabilities
      });

      const consumer = await this.recvTransport.consume({
        id: data.id,
        producerId: data.producerId,
        kind: data.kind,
        rtpParameters: data.rtpParameters
      });

      const isScreen = appData?.source === 'screen';
      this.consumers.set(consumer.id, consumer);
      this.consumerPeerIds.set(consumer.id, peerId);
      if (isScreen) this.screenConsumerIds.add(consumer.id);
      const targetMap = isScreen ? this.remoteScreenStreams : this.remoteStreams;
      
      const oldStream = targetMap.get(peerId);
      const existingTracks = oldStream ? oldStream.getTracks() : [];
      // Always create a NEW MediaStream instance in React Native! 
      // Using .addTrack() on an existing stream fails to trigger UI re-renders on RTCView.
      const newTracks = [...existingTracks, consumer.track];
      
      const newStream = new MediaStream(newTracks as any);
      targetMap.set(peerId, newStream);
      
      // Resume the consumer natively (Mobile requires explicit resume)
      consumer.resume();
      
      try {
        // The server does NOT send a 'resumed' response for this, so using this.request()
        // causes a 10-second timeout that crashes the consume operation!
        // We must use fire-and-forget this.ws.send() instead.
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'resume', consumerId: consumer.id }));
        }
      } catch (err) {
        console.error('Failed to notify server of consumer resume', err);
      }
      
      this.notifyStreamUpdate();
    } catch (err) {
      console.error('Failed to consume', err);
    }
  }

  public disconnect() {
    this._intentionalDisconnect = true;
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.sendTransport) this.sendTransport.close();
    if (this.recvTransport) this.recvTransport.close();
    if (this.ws) this.ws.close();
    this.remoteStreams.clear();
    this.remoteScreenStreams.clear();
    this.screenConsumerIds.clear();
    this.consumerPeerIds.clear();
    this.peerNames.clear();
    this.consumers.clear();
    this.notifyStreamUpdate();
  }

  // ── Reconnection Logic ────────────────────────────────────────────────────

  /**
   * Attempt WebSocket reconnection with exponential backoff.
   * On success, re-initialises mediasoup transports and re-produces local tracks.
   */
  private async attemptReconnect() {
    if (this._isReconnecting || this._intentionalDisconnect) return;
    this._isReconnecting = true;

    while (this._reconnectAttempts < this._maxReconnectAttempts) {
      this._reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this._reconnectAttempts - 1), 10000);
      console.log(`Reconnect attempt ${this._reconnectAttempts}/${this._maxReconnectAttempts} in ${delay}ms...`);
      
      if (this.onReconnecting) this.onReconnecting(this._reconnectAttempts);

      await new Promise(r => setTimeout(r, delay));

      if (this._intentionalDisconnect) {
        this._isReconnecting = false;
        return;
      }

      try {
        // Clean up old transports (silently)
        try { this.sendTransport?.close(); } catch (_) {}
        try { this.recvTransport?.close(); } catch (_) {}
        this.sendTransport = null;
        this.recvTransport = null;
        this.consumers.clear();
        this.remoteStreams.clear();
        this.remoteScreenStreams.clear();
        this.screenConsumerIds.clear();
        this.consumerPeerIds.clear();

        // Reconnect WebSocket
        if (this._lastMeetingToken) {
          await this.connect(this._lastMeetingToken);
        }

        // Re-broadcast local stream if we had one
        if (this._lastLocalStream) {
          await this.broadcast(this._lastLocalStream);
          // Also re-announce camera state after reconnect
          if (this._lastLocalStream.getVideoTracks().some(t => t.enabled)) {
            this.sendCameraState(true);
          }
        }

        console.log('Reconnected successfully!');
        this._reconnectAttempts = 0;
        this._isReconnecting = false;
        if (this.onReconnected) this.onReconnected();
        return;
      } catch (err) {
        console.warn(`Reconnect attempt ${this._reconnectAttempts} failed:`, err);
      }
    }

    // All attempts exhausted
    console.error('All reconnection attempts failed');
    this._isReconnecting = false;
    if (this.onReconnectFailed) this.onReconnectFailed();
  }

  /**
   * Re-publish local audio and video tracks after a WebSocket reconnection.
   * Called by attemptReconnect() once a new transport pair has been created.
   * Previously missing — caused silent failure on every reconnect attempt.
   */
  public async broadcast(localStream: MediaStream) {
    const videoTrack = localStream.getVideoTracks()[0];
    const audioTrack = localStream.getAudioTracks()[0];
    if (videoTrack && videoTrack.enabled && videoTrack.readyState === 'live') {
      await this.enableCamera(videoTrack);
    }
    if (audioTrack && audioTrack.enabled && audioTrack.readyState === 'live') {
      await this.enableMic(audioTrack);
    }
  }

  // ── Transport Stats (for network quality monitoring) ───────────────────────

  /**
   * Get RTCPeerConnection stats from the send transport.
   * Used by the useNetworkQuality hook to calculate RTT and packet loss.
   */
  public async getSendTransportStats(): Promise<RTCStatsReport | null> {
    try {
      const pc = (this.sendTransport as any)?.handler?._pc 
                || (this.sendTransport as any)?.handler?.pc;
      if (pc && typeof pc.getStats === 'function') {
        return await pc.getStats();
      }
    } catch (e) {
      console.warn('Failed to get send transport stats:', e);
    }
    return null;
  }

  // ── Consumer Pause / Resume (for visibility optimisation) ──────────────────

  /**
   * Pause a remote consumer by its consumer ID.
   * Used to save bandwidth for off-screen participants.
   */
  public async pauseRemoteConsumer(consumerId: string) {
    const consumer = this.consumers.get(consumerId);
    if (consumer && !consumer.paused) {
      consumer.pause();
      try {
        await this.request('pauseConsumer', 'consumerPaused', { consumerId });
      } catch (e) {
        // Server may not support this message — pause locally anyway
        console.warn('Server pauseConsumer not acknowledged:', e);
      }
    }
  }

  /**
   * Resume a remote consumer by its consumer ID.
   */
  public async resumeRemoteConsumer(consumerId: string) {
    const consumer = this.consumers.get(consumerId);
    if (consumer && consumer.paused) {
      consumer.resume();
      try {
        await this.request('resume', 'resumed', { consumerId });
      } catch (e) {
        console.warn('Server resumeConsumer not acknowledged:', e);
      }
    }
  }

  /**
   * Get all consumer IDs for a given peer (for visibility optimisation).
   */
  public getConsumerIdsForPeer(peerId: string): string[] {
    const ids: string[] = [];
    this.consumers.forEach((consumer, consumerId) => {
      // Match consumers whose appData or peerId relates to this peer
      if ((consumer as any).appData?.peerId === peerId) {
        ids.push(consumerId);
      }
    });
    return ids;
  }
}

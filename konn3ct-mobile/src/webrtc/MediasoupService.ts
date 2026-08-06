import { Device, types } from 'mediasoup-client';
import { MediaStream, mediaDevices } from 'react-native-webrtc';
import { useAuthStore } from '../store/useAuthStore';
import { useMeetingStore, type ConnectionState } from '../store/useMeetingStore';

// Signal server domain — read from EXPO_PUBLIC_BACKEND_DOMAIN.
// Falls back to extracting the hostname from EXPO_PUBLIC_EDGE_FRONTEND_URL.
const EDGE_URL = process.env.EXPO_PUBLIC_EDGE_FRONTEND_URL || 'https://edge-test.konn3ct.net';
export const SIGNAL_SERVER_DOMAIN =
  process.env.EXPO_PUBLIC_BACKEND_DOMAIN ||
  EDGE_URL.replace(/^https?:\/\//, '').split('/')[0];
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
  private screenShareProducer: types.Producer | null = null;
  private screenAudioShareProducer: types.Producer | null = null;
  public localScreenTrack: MediaStreamTrack | null = null;
  public localScreenAudioTrack: MediaStreamTrack | null = null;
  private consumers: Map<string, types.Consumer> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map();
  private remoteScreenStreams = new Map<string, MediaStream>();
  private screenConsumerIds = new Set<string>();  // consumer IDs that belong to screen shares
  private consumerPeerIds = new Map<string, string>(); // consumerId → peerId
  private peerNames = new Map<string, string>();  // userId → display name cache
  private pendingRequests = new Map<string, {resolve: Function, reject: Function, timeoutId: any}[]>();
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private _lastPongTime: number = Date.now();

  // Reconnection state machine
  private _reconnectAttempts = 0;
  private _maxReconnectAttempts = 5;
  private _maxReconnectDuration = 60000; // 60 seconds total timeout
  private _reconnectStartTime = 0;
  private _isReconnecting = false;
  private _intentionalDisconnect = false;
  private _lastMeetingToken?: string;
  private _lastSignalUrl?: string;
  private _connectionState: ConnectionState = 'connected';
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _inCallManagerStarted = false;
  private _recoveryGeneration = 0;
  private _activeRecoveryId: string | null = null;

  // Generation IDs — stale events from old sockets/transports are ignored
  private _socketGeneration = 0;
  private _sendTransportGeneration = 0;
  // (Note: _recvTransportGeneration exists at line 75)

  // PiP lifecycle state — prevents false reconnects on PiP entry/exit
  private _isInPiP = false;
  private _wasInPiP = false;
  private _pipTransitionUntil = 0;
  private _foregroundHealthTimer: ReturnType<typeof setTimeout> | null = null;

  // Receive-media restoration guard (idempotency)
  private _isRestoringReceiveMedia = false;

  // PiP-deferred reconnection: set when WS drops during PiP,
  // so we can reconnect with full retry budget when the user returns.
  private _needsReconnectOnForeground = false;

  // Transport generation — incremented each time recvTransport is recreated;
  // consumers from older generations are considered stale.
  private _recvTransportGeneration = 0;

  // Authoritative snapshot of remote producers (updated on every getProducers response)
  private _remoteProducerSnapshot: Array<{producerId: string; userId: string; kind: string; appData: any}> = [];

  // Authoritative desired media state — retained across reconnection.
  // Updated by enableMic/disableMic/enableCamera/disableCamera.
  // Recovery reads these to decide what to republish.
  private _desiredMicEnabled = false;
  private _desiredCameraEnabled = false;
  private _lastAudioTrack: MediaStreamTrack | null = null;
  private _lastVideoTrack: MediaStreamTrack | null = null;
  // Legacy compat fields — preserveMediaState() writes these for MeetingScreen
  private _wasMicEnabled = false;
  private _wasCameraEnabled = false;
  private _lastAudioRoute: string | null = null;

  // Mutex: only one rebuildMediaSession may run at a time
  private _isRebuildingMedia = false;
  // Handshake timeout for connect()
  private _handshakeTimer: ReturnType<typeof setTimeout> | null = null;

  // Buffered one-shot events — cached during lobby handoff so MeetingScreen
  // can replay them after setting up its callbacks.
  private _cachedParticipantsList: any[] | null = null;
  private _cachedChatHistory: any[] | null = null;
  private _cachedPollHistory: any[] | null = null;
  private _cachedUserJoined: any[] = [];

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
  public onMuteStateChange?: (userId: string, isMuted: boolean) => void;
  public onHandRaise?: (msg: any) => void;
  public onActiveSpeaker?: (userIds: string[]) => void;
  public onRecordingStarted?: () => void;
  public onRecordingStopped?: () => void;
  public onCaptionReceived?: (userId: string, text: string, isFinal: boolean, lang: string) => void;
  public onSessionStatusChange?: (status: string) => void;
  public onReconnecting?: (attempt: number) => void;
  public onReconnected?: () => void;
  public onReconnectFailed?: () => void;
  public onConnectionStateChanged?: (state: ConnectionState) => void;
  public onMediaRestored?: (replacementStream?: MediaStream) => void;
  public onRoomSettingsUpdated?: (settings: any) => void;
  public onMuteAllResult?: (success: boolean, message?: string) => void;
  public onRoomSettingsResult?: (success: boolean, message?: string) => void;
  public onScreenShareStarted?: (userId: string, producerId: string) => void;
  public onScreenShareStopped?: (userId: string, producerId: string) => void;
  public onRoleChanged?: (userId: string, newRole: string) => void;
  
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

  /**
   * Mute all participants. Uses the backend's existing force_mute handler
   * with a target group instead of a specific userId.
   * @param target - 'all_except_hosts' (default) or 'all'
   */
  public muteAll(target: 'all' | 'all_except_hosts' = 'all_except_hosts') {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log(`[MediasoupService] Sending muteAll with target: ${target}`);
      this.ws.send(JSON.stringify({ type: 'force_mute', target }));
    }
  }

  /**
   * Update room settings. Uses the backend's existing update_room_settings handler.
   * @param settings - Partial room settings to update (e.g. { chatLocked: true })
   */
  public updateRoomSettings(settings: { chatLocked?: boolean; micLocked?: boolean; videoLocked?: boolean }) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log(`[MediasoupService] Sending updateRoomSettings:`, settings);
      this.ws.send(JSON.stringify({ type: 'update_room_settings', ...settings }));
    }
  }

  // --- Connection state machine ---

  /** Get current connection state */
  public getConnectionState(): ConnectionState {
    return this._connectionState;
  }

  /** Transition to a new connection state with logging */
  private _setConnectionState(newState: ConnectionState) {
    if (this._connectionState === newState) return;
    const prev = this._connectionState;
    this._connectionState = newState;
    console.log(`[Reconnect] State transition: ${prev} → ${newState}`);
    useMeetingStore.getState().setConnectionState(newState);
    if (this.onConnectionStateChanged) this.onConnectionStateChanged(newState);
  }

  // --- Media state getters (for UI to check actual track/producer state) ---

  /** Returns true only if the audio producer exists and is not closed */
  public get isMicProducerActive(): boolean {
    return this.localAudioProducer != null && !this.localAudioProducer.closed;
  }

  /** Returns true only if the video producer exists and is not closed */
  public get isCameraProducerActive(): boolean {
    return this.localVideoProducer != null && !this.localVideoProducer.closed;
  }

  /** Preserve the current media state before backgrounding or disconnection.
   * Uses actual producer track state — not UI booleans.
   * Also captures track references for recovery reuse. */
  public preserveMediaState() {
    // Authoritative desired state already tracked by enableMic/disableMic etc.
    // Sync legacy _was* fields for MeetingScreen compat
    this._wasMicEnabled = this._desiredMicEnabled;
    this._wasCameraEnabled = this._desiredCameraEnabled;

    // Ensure track references are captured from producers if not already set
    if (!this._lastAudioTrack && this.localAudioProducer?.track) {
      this._lastAudioTrack = this.localAudioProducer.track as unknown as MediaStreamTrack;
    }
    if (!this._lastVideoTrack && this.localVideoProducer?.track) {
      this._lastVideoTrack = this.localVideoProducer.track as unknown as MediaStreamTrack;
    }

    console.log(`[MediaState] Preserved: mic=${this._desiredMicEnabled}, camera=${this._desiredCameraEnabled}, audioTrack=${!!this._lastAudioTrack}, videoTrack=${!!this._lastVideoTrack}`);
  }

  /** Get the preserved mic state (whether mic was active before disconnect) */
  public get wasMicEnabled(): boolean { return this._wasMicEnabled; }
  /** Get the preserved camera state (whether camera was active before disconnect) */
  public get wasCameraEnabled(): boolean { return this._wasCameraEnabled; }

  /** Track whether InCallManager has been started (for idempotent calls) */
  public get isInCallManagerStarted(): boolean { return this._inCallManagerStarted; }
  public set isInCallManagerStarted(v: boolean) { this._inCallManagerStarted = v; }

  // ── PiP Lifecycle Notifications ────────────────────────────────────────────

  /**
   * Called by MeetingScreen when PiP mode is entered.
   * Marks the PiP transition window so foreground health checks are not
   * misclassified as genuine background disconnections.
   */
  public notifyPipEntered(): void {
    console.log('[PiP] notifyPipEntered — marking PiP transition window');
    this._isInPiP = true;
    this._wasInPiP = true;
    this._pipTransitionUntil = Date.now() + 1500;
    // Cancel any pending deferred foreground health check
    this._cancelDeferredForegroundHealthCheck();
  }

  /**
   * Called by MeetingScreen when PiP mode is exited.
   * Does NOT clear _wasInPiP — that is cleared only after the PiP-return
   * health check completes successfully.
   */
  public notifyPipExited(): void {
    console.log('[PiP] notifyPipExited — setting PiP exit transition window');
    this._isInPiP = false;
    this._pipTransitionUntil = Date.now() + 1500;
  }

  /** Returns true while Android lifecycle events related to PiP are still settling. */
  public isPipTransitionActive(): boolean {
    return Date.now() < this._pipTransitionUntil;
  }

  /** Cancel any pending deferred foreground health check timer. */
  private _cancelDeferredForegroundHealthCheck(): void {
    if (this._foregroundHealthTimer) {
      clearTimeout(this._foregroundHealthTimer);
      this._foregroundHealthTimer = null;
    }
  }

  // ── Meeting Health Check ───────────────────────────────────────────────────

  /**
   * Authoritative meeting health snapshot.
   * Does NOT mutate any state — safe to call at any time.
   */
  private _getMeetingHealth(): {
    signallingHealthy: boolean;
    sendTransportHealthy: boolean;
    recvTransportHealthy: boolean;
    expectedAudioProducerCount: number;
    audioConsumerCount: number;
    audioConsumersHealthy: boolean;
    mediaHealthy: boolean;
  } {
    const wsOpen = this.ws?.readyState === WebSocket.OPEN;
    const wsAlive = this.isAlive();
    const sendState = this._getSendTransportState();
    const recvState = this._getRecvTransportState();

    // Transport is healthy only when ICE has fully connected.
    const sendTransportHealthy = sendState === 'connected';
    const recvTransportHealthy = recvState === 'connected';

    // Expected audio consumers: producers currently in the remote snapshot that are not local.
    const expectedAudioProducers = this._remoteProducerSnapshot.filter(
      p => p.kind === 'audio' && p.userId !== this.currentUserId
    );
    const expectedAudioProducerCount = expectedAudioProducers.length;

    const audioConsumers = Array.from(this.consumers.values()).filter(
      c => c.kind === 'audio' && !c.closed
    );

    // Consumer is healthy when:
    //   • not closed / paused
    //   • track exists and is enabled
    //   • producer ID is still in the current snapshot (not stale)
    //   • consumer belongs to the current recv transport generation
    const expectedProducerIds = new Set(expectedAudioProducers.map(p => p.producerId));
    const audioConsumersHealthy =
      expectedAudioProducerCount === 0 ||
      (audioConsumers.length > 0 &&
        expectedAudioProducers.every(ep =>
          audioConsumers.some(c =>
            c.producerId === ep.producerId &&
            !c.closed &&
            !c.paused &&
            c.track != null &&
            (c.track as any).enabled === true &&
            expectedProducerIds.has(c.producerId) &&
            (c as any)._transportGeneration === this._recvTransportGeneration
          )
        )
      );

    return {
      signallingHealthy: wsOpen && wsAlive,
      sendTransportHealthy,
      recvTransportHealthy,
      expectedAudioProducerCount,
      audioConsumerCount: audioConsumers.length,
      audioConsumersHealthy,
      mediaHealthy: sendTransportHealthy && recvTransportHealthy && audioConsumersHealthy,
    };
  }

  /** Classify a transport ICE connection state into healthy/transitional/unhealthy. */
  private _classifyTransportState(state: string): 'healthy' | 'transitional' | 'unhealthy' {
    if (state === 'connected') return 'healthy';
    if (state === 'connecting' || state === 'new') return 'transitional';
    return 'unhealthy'; // failed, closed, disconnected, unknown
  }

  // ── Clear Recovery State ───────────────────────────────────────────────────

  /**
   * Clear all reconnection timers and flags.
   * Does NOT set the connection state — callers must first verify health
   * via _completeRecoveryIfHealthy before calling this.
   */
  private _clearRecoveryState(reason: string): void {
    const prev = this._connectionState;
    this._isReconnecting = false;
    this._activeRecoveryId = null;
    this._reconnectAttempts = 0;
    this._isRestoringReceiveMedia = false;

    this._cancelDeferredForegroundHealthCheck();

    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }

    console.log(`[Recovery] State cleared (reason: ${reason}, prev: ${prev})`);
  }

  /**
   * Verify meeting health, then clear recovery state and mark connected.
   * Returns true only when health check passes AND recovery ID is still current.
   */
  private async _completeRecoveryIfHealthy(recoveryId: string, reason: string): Promise<boolean> {
    if (this._activeRecoveryId !== recoveryId) {
      console.log(`[Recovery] _completeRecoveryIfHealthy: stale recoveryId (${recoveryId})`);
      return false;
    }
    const health = this._getMeetingHealth();
    console.log(`[Recovery] Health check (${reason}):`, JSON.stringify(health));

    if (!health.signallingHealthy) {
      console.log(`[Recovery] Signalling not yet healthy — deferring clearRecoveryState`);
      return false;
    }

    if (health.expectedAudioProducerCount > 0 && !health.audioConsumersHealthy) {
      console.log(`[Recovery] Audio consumers not yet healthy — deferring clearRecoveryState`);
      return false;
    }

    this._clearRecoveryState(reason);
    this._setConnectionState('connected');
    return true;
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
    // Replay any user_joined events that arrived before MeetingScreen registered callbacks
    if (this._cachedUserJoined.length > 0 && this.onUserJoined) {
      for (const user of this._cachedUserJoined) {
        this.onUserJoined(user);
      }
      this._cachedUserJoined = [];
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

  /** Reject and remove all pending requests — called on socket generation change. */
  private _rejectAllPendingRequests(reason: string): void {
    for (const [type, queue] of this.pendingRequests.entries()) {
      for (const req of queue) {
        clearTimeout(req.timeoutId);
        req.reject(new Error(`${reason} (pending: ${type})`));
      }
    }
    this.pendingRequests.clear();
  }

  public async connect(meetingToken?: string, customSignalUrl?: string) {
    if (!meetingToken) {
      throw new Error(
        'No meeting JWT provided \u2013 the signal server requires a JWT, not a Sanctum token. '
        + 'Obtain one via getAttendeeToken() or startRoom() before calling connect().'
      );
    }
    const token = meetingToken;
    this._lastMeetingToken = meetingToken;
    this._lastSignalUrl = customSignalUrl;

    let wsUrl = '';
    const encodedName = encodeURIComponent(useAuthStore.getState().user?.name || 'Mobile User');

    if (customSignalUrl && customSignalUrl.trim()) {
      let formattedUrl = customSignalUrl.trim();

      if (!formattedUrl.startsWith('ws://') && !formattedUrl.startsWith('wss://')) {
        formattedUrl = `wss://${formattedUrl.replace(/^https?:\/\//, '')}`;
      }

      // Remove trailing slash if present
      formattedUrl = formattedUrl.replace(/\/+$/, '');

      // Ensure /signal endpoint path is present
      if (!formattedUrl.includes('/signal')) {
        formattedUrl = `${formattedUrl}/signal`;
      }

      const separator = formattedUrl.includes('?') ? '&' : '?';
      wsUrl = `${formattedUrl}${separator}roomId=${this.roomId}&isMobile=true&token=${token}&name=${encodedName}&participantId=${this.participantId}`;
    } else {
      wsUrl = `wss://${BACKEND_DOMAIN}/signal?roomId=${this.roomId}&isMobile=true&token=${token}&name=${encodedName}&participantId=${this.participantId}`;
    }
    
    // Log masked connection info \u2014 never expose the JWT
    const maskedHost = customSignalUrl ? new URL(customSignalUrl.startsWith('ws') ? customSignalUrl.replace(/^ws/, 'http') : customSignalUrl).hostname : BACKEND_DOMAIN;
    console.log(`[WS] Connecting: host=${maskedHost}, room=${this.roomId}, participantId=${this.participantId}, socketGen=${this._socketGeneration + 1}`);
    
    // Bump socket generation \u2014 stale events from old sockets will be ignored
    const socketGen = ++this._socketGeneration;
    this._rejectAllPendingRequests('Socket generation changed');

    const newWs = new WebSocket(wsUrl);
    this.ws = newWs;

    return new Promise<string>((resolve, reject) => {
      let settled = false;
      const settle = (value: string | Error) => {
        if (settled) return;
        settled = true;
        if (this._handshakeTimer) { clearTimeout(this._handshakeTimer); this._handshakeTimer = null; }
        if (value instanceof Error) reject(value);
        else resolve(value);
      };

      // 15-second handshake timeout
      this._handshakeTimer = setTimeout(() => {
        if (settled || socketGen !== this._socketGeneration) return;
        console.error(`[WS] Handshake timeout (15s) for socketGen=${socketGen}`);
        try { newWs.close(); } catch (_) {}
        settle(new Error('Signalling handshake timeout (15s)'));
      }, 15000);

      newWs.onopen = () => {
        if (socketGen !== this._socketGeneration) return;
        console.log(`[WS] Connected (socketGen=${socketGen})`);
        const userName = useAuthStore.getState().user?.name || 'Mobile User';
        newWs.send(JSON.stringify({ type: 'auth', token, name: userName }));

        this._lastPongTime = Date.now();

        // Keep-alive to prevent DO Load Balancer from dropping idle connections
        this.pingInterval = setInterval(() => {
          if (newWs.readyState === WebSocket.OPEN && socketGen === this._socketGeneration) {
            newWs.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
          }
        }, 15000); // Reduced from 25s to 15s for better background survival
      };

      newWs.onerror = (err) => {
        if (socketGen !== this._socketGeneration) return;
        // Log as warn instead of error to prevent React Native red box during normal disconnection
        console.warn('WebSocket connection warning:', err);
        // Don't reject here - onclose fires right after with the actual reason
      };
      
      newWs.onclose = (e) => {
        if (socketGen !== this._socketGeneration) {
          console.log(`[WS] Ignoring onclose from stale socketGen=${socketGen} (current=${this._socketGeneration})`);
          return;
        }
        console.log(`WebSocket closed: ${e.code} ${e.reason}`);
        if (this.pingInterval) clearInterval(this.pingInterval);

        // If this was an intentional disconnect (user left), don't reconnect
        if (this._intentionalDisconnect) {
          settle(new Error(e.reason || `WebSocket closed with code ${e.code}`));
          return;
        }

        // If already connected (mid-session drop), attempt reconnection
        if (this.device?.loaded && !this._isReconnecting) {
          // If in PiP mode, DON\u2019T burn reconnect attempts \u2014 the OS throttles
          // network for PiP apps and attempts will likely fail.
          // Instead, set a flag so the user returns with full retry budget.
          if (this._isInPiP) {
            console.log('[WS onclose] Mid-session drop while in PiP \u2014 deferring reconnect until foreground return');
            this._needsReconnectOnForeground = true;
            this.preserveMediaState();
            this._setConnectionState('temporarily_disconnected');
            return;
          }
          console.log('Mid-session WebSocket drop detected, attempting reconnection...');
          this.attemptReconnect();
          return;
        }

        // Reject with the close reason so callers can detect 404 vs other errors
        settle(new Error(e.reason || `WebSocket closed with code ${e.code}`));
      };

      newWs.onmessage = async (event) => {
        // Ignore messages from stale sockets
        if (socketGen !== this._socketGeneration) return;

        let msg: any;
        try {
          msg = JSON.parse(event.data);
        } catch (e) { return; }

        // Any message from the server proves the connection is alive
        this._lastPongTime = Date.now();

        // Silently consume pong responses
        if (msg.type === 'pong') return;

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

            // Clear handshake timer immediately \u2014 server responded
            if (this._handshakeTimer) { clearTimeout(this._handshakeTimer); this._handshakeTimer = null; }
            
            if (msg.status === 'active') {
              try {
                if (!this.device?.loaded) {
                  // Initial connection \u2014 full device + transport init
                  await this.initializeMediasoup();
                } else {
                  // Reconnection \u2014 Device already loaded, rebuild media transports only
                  console.log('[session_status] Device already loaded \u2014 rebuilding media session');
                  const recoveryId = `${Date.now()}-${++this._recoveryGeneration}`;
                  this._activeRecoveryId = recoveryId;
                  await this.rebuildMediaSession('reconnect_session_status', recoveryId);
                }
                if (this.onSessionStatusChange) this.onSessionStatusChange('active');
                settle('active');
              } catch (e) {
                console.error('Failed to init/rebuild mediasoup:', e);
                settle(e as Error);
              }
            } else if (msg.status === 'waiting') {
              console.log('Waiting for host to admit...');
              if (this.onSessionStatusChange) this.onSessionStatusChange('waiting');
              settle('waiting');
            } else if (msg.status === 'ended') {
              console.log('Meeting ended by host');
              if (this.onSessionStatusChange) this.onSessionStatusChange('ended');
              this.disconnect();
              settle('ended');
            } else if (msg.status === 'kicked') {
              console.log('Kicked from meeting by host');
              if (this.onSessionStatusChange) this.onSessionStatusChange('kicked');
              this.disconnect();
              settle('kicked');
            } else if (msg.status === 'denied') {
              console.log('Entry denied by host');
              if (this.onSessionStatusChange) this.onSessionStatusChange('denied');
              this.disconnect();
              settle('denied');
            }
            break;

          case 'participants_list': {
            const list = msg.participants || [];
            if (this.onParticipantsList) {
              this.onParticipantsList(list);
              this._cachedParticipantsList = null;
            } else {
              this._cachedParticipantsList = list;
            }
            break;
          }

          case 'mute_state':
            if (msg.userId && msg.userId !== this.currentUserId) {
              useMeetingStore.getState().updateParticipantMuteState(msg.userId, msg.isMuted);
              if (this.onMuteStateChange) this.onMuteStateChange(msg.userId, msg.isMuted);
            }
            break;

          case 'user_joined': {
            const joinPayload = { userId: msg.userId, name: msg.name, role: msg.role, isMuted: true, isCameraOn: false };
            if (msg.userId && msg.name) {
              this.peerNames.set(msg.userId, msg.name);
            }
            if (this.onUserJoined) {
              this.onUserJoined(joinPayload);
              this._cachedUserJoined = [];
            } else {
              this._cachedUserJoined.push(joinPayload);
            }
            break;
          }

          case 'user_left':
            // Clean up streams for the departed user
            this.remoteStreams.delete(msg.userId);
            this.remoteScreenStreams.delete(msg.userId);
            this.notifyStreamUpdate();
            if (this.onUserLeft) this.onUserLeft(msg.userId);
            break;

          case 'role_changed':
            useMeetingStore.getState().updateParticipantRole(msg.userId, msg.newRole);
            if (msg.userId === this.currentUserId) {
              this.currentUserRole = msg.newRole;
              useMeetingStore.getState().setCurrentUser(this.currentUserId!, msg.newRole);
            }
            if (this.onRoleChanged) this.onRoleChanged(msg.userId, msg.newRole);
            break;

          case 'chat_history':
            if (this.onChatHistory) {
              this.onChatHistory(msg.messages || []);
              this._cachedChatHistory = null;
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
              this._cachedPollHistory = null;
            } else {
              this._cachedPollHistory = msg.polls || [];
            }
            break;
          case 'poll_create':
            if (this.onPollCreate) this.onPollCreate(msg.poll);
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

          case 'mute_all_result':
            if (this.onMuteAllResult) this.onMuteAllResult(msg.success, msg.message);
            break;
          case 'room_settings_updated':
            if (this.onRoomSettingsUpdated) this.onRoomSettingsUpdated(msg);
            break;
          case 'room_settings_result':
            if (this.onRoomSettingsResult) this.onRoomSettingsResult(msg.success, msg.message);
            break;

          case 'hand_raise':
            if (this.onHandRaise) this.onHandRaise(msg);
            break;
          case 'active_speaker':
            if (this.onActiveSpeaker) this.onActiveSpeaker(msg.userIds || []);
            break;

          case 'recording_started':
            if (this.onRecordingStarted) this.onRecordingStarted();
            break;
          case 'recording_stopped':
            if (this.onRecordingStopped) this.onRecordingStopped();
            break;

          case 'screen_share_started':
            if (this.onScreenShareStarted) {
              this.onScreenShareStarted(msg.userId, msg.producerId);
            }
            break;
          case 'screen_share_stopped':
            if (this.onScreenShareStopped) {
              this.onScreenShareStopped(msg.userId, msg.producerId);
            }
            break;

          case 'newProducer': {
            // Cache the producer name for stream labelling
            if (msg.name && msg.userId) {
              this.peerNames.set(msg.userId, msg.name);
            }
            // Update authoritative snapshot
            const existing = this._remoteProducerSnapshot.find(p => p.producerId === msg.producerId);
            if (!existing) {
              this._remoteProducerSnapshot.push({
                producerId: msg.producerId,
                userId: msg.userId,
                kind: msg.kind,
                appData: msg.appData || {}
              });
            }
            // Create consumer for this new producer
            await this.consumeRemote(msg.producerId, msg.userId, msg.kind, msg.appData);
            break;
          }

          case 'producer_closed': {
            // Find consumers associated with this producer
            this.consumers.forEach((consumer, consumerId) => {
              if (consumer.producerId === msg.producerId) {
                const peerId = this.consumerPeerIds.get(consumerId) || 'unknown';
                const isScreen = this.screenConsumerIds.has(consumerId);
                console.log(`[producer_closed] Removing consumer ${consumerId} (producer ${msg.producerId}, peer ${peerId}, isScreen=${isScreen})`);

                // Remove from stream maps
                if (isScreen) {
                  this.remoteScreenStreams.delete(peerId);
                } else {
                  // Only remove from remote stream if this was the last consumer for this peer
                  const hasOtherConsumers = Array.from(this.consumers.entries()).some(
                    ([cid, c]) => cid !== consumerId && this.consumerPeerIds.get(cid) === peerId && !this.screenConsumerIds.has(cid)
                  );
                  if (!hasOtherConsumers) {
                    this.remoteStreams.delete(peerId);
                  } else {
                    const stream = this.remoteStreams.get(peerId);
                    if (stream && consumer.track) {
                      try { stream.removeTrack(consumer.track as any); } catch (_) {}
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
            // Remove from snapshot so health checks don't expect a consumer for closed producers
            this._remoteProducerSnapshot = this._remoteProducerSnapshot.filter(
              p => p.producerId !== msg.producerId
            );
            break;
          }

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

    // Monitor Send Transport ICE connection state
    // Log all transitions. If transport reaches 'failed' while WS is open,
    // mark as temporarily disconnected — the WS close handler owns full reconnection.
    this.sendTransport.on('connectionstatechange', (state: string) => {
      console.log(`[Transport] Send transport ICE state: ${state}`);
      // Suppress state changes during PiP — banner is hidden anyway,
      // and state changes here can corrupt the recovery flow.
      if (this._isInPiP) return;
      if (state === 'disconnected' && this._connectionState === 'connected') {
        this._setConnectionState('temporarily_disconnected');
      } else if (state === 'failed' && !this._isReconnecting) {
        console.warn('[Transport] Send transport ICE failed — will wait for WS close or foreground check');
        this._setConnectionState('temporarily_disconnected');
      } else if (state === 'connected' && this._connectionState === 'temporarily_disconnected') {
        // ICE recovered on its own
        this._setConnectionState('connected');
      }
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

    // Monitor Recv Transport ICE connection state
    this.recvTransport.on('connectionstatechange', (state: string) => {
      console.log(`[Transport] Recv transport ICE state: ${state}`);
      // Suppress state changes during PiP — banner is hidden anyway,
      // and state changes here can corrupt the recovery flow.
      if (this._isInPiP) return;
      if (state === 'disconnected' && this._connectionState === 'connected') {
        this._setConnectionState('temporarily_disconnected');
      } else if (state === 'failed' && !this._isReconnecting) {
        console.warn('[Transport] Recv transport ICE failed — will wait for WS close or foreground check');
        this._setConnectionState('temporarily_disconnected');
      } else if (state === 'connected' && this._connectionState === 'temporarily_disconnected') {
        this._setConnectionState('connected');
      }
    });

    // Fetch existing producers and populate authoritative remote snapshot
    try {
      const prodRes = await this.request('getProducers', 'producersList');
      const producers: any[] = prodRes.producers || [];
      // Update authoritative snapshot (used by health checks)
      this._remoteProducerSnapshot = producers
        .filter(p => p.userId !== this.currentUserId && p.participantId !== this.participantId)
        .map(p => ({ producerId: p.producerId, userId: p.userId, kind: p.kind, appData: p.appData }));

      // Bump transport generation — new transport, new generation of consumers
      this._recvTransportGeneration++;

      for (const p of producers) {
        if (p.userId === this.currentUserId || p.participantId === this.participantId) continue;
        // Cache the participant name from the producer list
        if (p.name && p.userId) {
          this.peerNames.set(p.userId, p.name);
        }
        await this.consumeRemote(p.producerId, p.userId, p.kind, p.appData);
      }
    } catch (e) { console.error('Failed to get existing producers', e); }
  }

  /**
   * Rebuild media transports on an already-loaded Device.
   * Called during reconnection when the WebSocket is fresh but the Device
   * is still loaded from the previous session.
   *
   * Sequence:
   * 1. Request server-side cleanup of stale transports/producers
   * 2. Close old local transports without stopping healthy tracks
   * 3. Create new send + recv transports
   * 4. Fetch current producers and recreate consumers
   * 5. Republish local mic/camera based on desired state
   */
  public async rebuildMediaSession(reason: string, recoveryId: string): Promise<void> {
    if (this._isRebuildingMedia) {
      console.log(`[RebuildMedia] Already rebuilding, skipping (reason=${reason})`);
      return;
    }
    this._isRebuildingMedia = true;
    const socketGen = this._socketGeneration;

    console.log(`[RebuildMedia] Starting: reason=${reason}, recoveryId=${recoveryId}, socketGen=${socketGen}`);
    this._setConnectionState('recovering_media');

    try {
      // ── 1. Request server-side cleanup of old media state ────────────────
      try {
        console.log('[RebuildMedia] Requesting server-side media cleanup...');
        await this.request('reset_webrtc_state', 'webrtc_state_reset');
        console.log('[RebuildMedia] Server acknowledged media state reset');
      } catch (e) {
        // Server may not support this yet during staggered rollout — continue
        console.warn('[RebuildMedia] Server reset_webrtc_state failed (may not be supported):', e);
      }
      if (socketGen !== this._socketGeneration || this._activeRecoveryId !== recoveryId) return;

      // ── 2. Close old transports without stopping tracks ─────────────────
      // Close producers without calling public disableMic/disableCamera
      // (which would change desired state and stop tracks)
      if (this.localVideoProducer) {
        try { this.localVideoProducer.close(); } catch (_) {}
        this.localVideoProducer = null;
      }
      if (this.localAudioProducer) {
        try { this.localAudioProducer.close(); } catch (_) {}
        this.localAudioProducer = null;
      }
      if (this.screenShareProducer) {
        try { this.screenShareProducer.close(); } catch (_) {}
        this.screenShareProducer = null;
      }
      if (this.screenAudioShareProducer) {
        try { this.screenAudioShareProducer.close(); } catch (_) {}
        this.screenAudioShareProducer = null;
      }

      // Close consumers
      this.consumers.forEach(c => { try { c.close(); } catch (_) {} });
      this.consumers.clear();
      this.remoteStreams.clear();
      this.remoteScreenStreams.clear();
      this.screenConsumerIds.clear();
      this.consumerPeerIds.clear();

      // Close old transports
      if (this.sendTransport) {
        try { this.sendTransport.close(); } catch (_) {}
        this.sendTransport = null;
      }
      if (this.recvTransport) {
        try { this.recvTransport.close(); } catch (_) {}
        this.recvTransport = null;
      }

      this.notifyStreamUpdate();
      if (socketGen !== this._socketGeneration || this._activeRecoveryId !== recoveryId) return;

      // ── 3. Create new send transport ────────────────────────────────────
      const sendTransportGen = ++this._sendTransportGeneration;
      const sendRes = await this.request('createWebRtcTransport', 'transportCreated', { direction: 'send' });
      if (socketGen !== this._socketGeneration || this._activeRecoveryId !== recoveryId) return;

      this.sendTransport = this.device!.createSendTransport(sendRes.transportParams);

      this.sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        if (this._sendTransportGeneration !== sendTransportGen) return;
        try {
          await this.request('connectWebRtcTransport', 'transportConnected', {
            transportId: this.sendTransport!.id,
            dtlsParameters
          });
          callback();
        } catch (err) { errback(err as Error); }
      });

      this.sendTransport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
        if (this._sendTransportGeneration !== sendTransportGen) return;
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

      // Send transport ICE monitoring
      this.sendTransport.on('connectionstatechange', (state: string) => {
        if (this._sendTransportGeneration !== sendTransportGen) return;
        console.log(`[Transport] Send transport ICE state: ${state} (gen=${sendTransportGen})`);
        if (this._isInPiP) return;
        if (state === 'disconnected' && this._connectionState === 'connected') {
          this._setConnectionState('temporarily_disconnected');
        } else if (state === 'failed' && !this._isReconnecting) {
          this._setConnectionState('temporarily_disconnected');
        } else if (state === 'connected' && this._connectionState === 'temporarily_disconnected') {
          this._setConnectionState('connected');
        }
      });

      // ── 4. Create new recv transport ────────────────────────────────────
      this._recvTransportGeneration++;
      const recvTransportGen = this._recvTransportGeneration;
      const recvRes = await this.request('createWebRtcTransport', 'transportCreated', { direction: 'recv' });
      if (socketGen !== this._socketGeneration || this._activeRecoveryId !== recoveryId) return;

      this.recvTransport = this.device!.createRecvTransport(recvRes.transportParams);

      this.recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        if (this._recvTransportGeneration !== recvTransportGen) return;
        try {
          await this.request('connectWebRtcTransport', 'transportConnected', {
            transportId: this.recvTransport!.id,
            dtlsParameters
          });
          callback();
        } catch (err) { errback(err as Error); }
      });

      // Recv transport ICE monitoring
      this.recvTransport.on('connectionstatechange', (state: string) => {
        if (this._recvTransportGeneration !== recvTransportGen) return;
        console.log(`[Transport] Recv transport ICE state: ${state} (gen=${recvTransportGen})`);
        if (this._isInPiP) return;
        if (state === 'disconnected' && this._connectionState === 'connected') {
          this._setConnectionState('temporarily_disconnected');
        } else if (state === 'failed' && !this._isReconnecting) {
          this._setConnectionState('temporarily_disconnected');
        } else if (state === 'connected' && this._connectionState === 'temporarily_disconnected') {
          this._setConnectionState('connected');
        }
      });

      // ── 5. Fetch current producers and consume them ─────────────────────
      try {
        const prodRes = await this.request('getProducers', 'producersList');
        if (socketGen !== this._socketGeneration || this._activeRecoveryId !== recoveryId) return;

        const producers: any[] = prodRes.producers || [];
        this._remoteProducerSnapshot = producers
          .filter(p => p.userId !== this.currentUserId && p.participantId !== this.participantId)
          .map(p => ({ producerId: p.producerId, userId: p.userId, kind: p.kind, appData: p.appData }));

        for (const p of producers) {
          if (p.userId === this.currentUserId || p.participantId === this.participantId) continue;
          if (p.name && p.userId) this.peerNames.set(p.userId, p.name);
          await this.consumeRemote(p.producerId, p.userId, p.kind, p.appData);
        }
      } catch (e) { console.error('[RebuildMedia] Failed to get existing producers:', e); }

      if (socketGen !== this._socketGeneration || this._activeRecoveryId !== recoveryId) return;

      // ── 6. Republish local media based on authoritative desired state ───
      let replacementStream: MediaStream | undefined;

      // Mic: republish only if desired and track is usable
      if (this._desiredMicEnabled) {
        let audioTrack = this._lastAudioTrack;
        if (!audioTrack || audioTrack.readyState !== 'live') {
          // Track ended during background — reacquire
          console.log('[RebuildMedia] Audio track ended, reacquiring...');
          try {
            const stream = await (mediaDevices as any).getUserMedia({ audio: true });
            audioTrack = stream.getAudioTracks()[0];
            this._lastAudioTrack = audioTrack;
            if (!replacementStream) replacementStream = new MediaStream();
            replacementStream.addTrack(audioTrack);
          } catch (e) {
            console.error('[RebuildMedia] Failed to reacquire audio track:', e);
            audioTrack = null;
          }
        }
        if (audioTrack && audioTrack.readyState === 'live') {
          await this.enableMic(audioTrack);
        }
      }

      // Camera: republish only if desired and track is usable
      if (this._desiredCameraEnabled) {
        let videoTrack = this._lastVideoTrack;
        if (!videoTrack || videoTrack.readyState !== 'live') {
          // Track ended during background — reacquire
          console.log('[RebuildMedia] Video track ended, reacquiring...');
          try {
            const stream = await (mediaDevices as any).getUserMedia({
              video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            videoTrack = stream.getVideoTracks()[0];
            this._lastVideoTrack = videoTrack;
            if (!replacementStream) replacementStream = new MediaStream();
            replacementStream.addTrack(videoTrack);
          } catch (e) {
            console.error('[RebuildMedia] Failed to reacquire video track:', e);
            videoTrack = null;
          }
        }
        if (videoTrack && videoTrack.readyState === 'live') {
          await this.enableCamera(videoTrack);
        }
      }

      // Screen share: republish only if existing track is still live
      if (this.localScreenTrack && this.localScreenTrack.readyState === 'live') {
        console.log('[RebuildMedia] Re-publishing screen share...');
        try {
          const screenCodec = this.device?.rtpCapabilities.codecs?.find(
            (c: any) => c.mimeType.toLowerCase() === 'video/vp8'
          ) || this.device?.rtpCapabilities.codecs?.find(
            (c: any) => c.mimeType.toLowerCase() === 'video/h264' && c.parameters?.['profile-level-id'] === '42e01f'
          );
          this.screenShareProducer = await this.sendTransport!.produce({
            track: this.localScreenTrack as any,
            codec: screenCodec,
            appData: { source: 'screen' },
            encodings: [{ maxBitrate: 1500000, maxFramerate: 15 }],
            codecOptions: { videoGoogleStartBitrate: 1000 },
            stopTracks: false
          });

          if (this.localScreenAudioTrack && this.localScreenAudioTrack.readyState === 'live') {
            this.screenAudioShareProducer = await this.sendTransport!.produce({
              track: this.localScreenAudioTrack as any,
              appData: { source: 'screen-audio' },
              stopTracks: false
            });
          }
        } catch (e) {
          console.error('[RebuildMedia] Failed to re-publish screen share:', e);
          this.localScreenTrack = null;
          this.localScreenAudioTrack = null;
        }
      } else if (this.localScreenTrack) {
        // Track ended during background
        this.localScreenTrack = null;
        this.localScreenAudioTrack = null;
      }

      console.log(`[RebuildMedia] Complete: reason=${reason}, replacementStream=${!!replacementStream}`);

      // Notify MeetingScreen with any replacement stream
      if (this.onMediaRestored) this.onMediaRestored(replacementStream);

    } finally {
      this._isRebuildingMedia = false;
    }
  }

  public async enableCamera(videoTrack: MediaStreamTrack) {
    if (!this.sendTransport) {
      console.error('[enableCamera] sendTransport is NULL — cannot produce.');
      return;
    }

    // Update authoritative desired state
    this._desiredCameraEnabled = true;
    this._lastVideoTrack = videoTrack;

    if (this.localVideoProducer && !this.localVideoProducer.closed) {
      console.log('[enableCamera] Replacing track on existing video producer...');
      try {
        await this.localVideoProducer.replaceTrack({ track: videoTrack as any });
        this.sendCameraState(true);
      } catch (err) {
        console.error('[enableCamera] Failed to replace video track:', err);
      }
      return;
    }
    
    console.log(`[enableCamera] Producing video track... readyState=${videoTrack.readyState}, enabled=${videoTrack.enabled}`);
    const videoCodec = this.device?.rtpCapabilities.codecs?.find(
      (c: any) => c.kind === 'video' && c.mimeType.toLowerCase() === 'video/vp8'
    ) || this.device?.rtpCapabilities.codecs?.find(
      (c: any) => c.kind === 'video' && c.mimeType.toLowerCase() === 'video/h264'
    );

    try {
      this.localVideoProducer = await this.sendTransport.produce({ 
        track: videoTrack as any, 
        codec: videoCodec,
        appData: { source: 'camera' },
        encodings: [{ maxBitrate: 600000, maxFramerate: 30 }],
        codecOptions: { videoGoogleStartBitrate: 1000 },
        stopTracks: false  // Preserve track for reuse across recovery
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
    // Update authoritative desired state
    this._desiredCameraEnabled = false;

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
      this.localVideoProducer = null;
    }
    // User-initiated disable: stop the track to release the camera
    if (this._lastVideoTrack && this._lastVideoTrack.readyState === 'live') {
      this._lastVideoTrack.stop();
    }
    this._lastVideoTrack = null;
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

    // Update authoritative desired state
    this._desiredMicEnabled = true;
    this._lastAudioTrack = audioTrack;
    
    console.log(`[enableMic] Producing audio track... readyState=${audioTrack.readyState}, enabled=${audioTrack.enabled}`);
    try {
      this.localAudioProducer = await this.sendTransport.produce({
        track: audioTrack as any,
        appData: { source: 'mic' },
        stopTracks: false  // Preserve track for reuse across recovery
      });
      console.log(`[enableMic] Audio producer created: id=${this.localAudioProducer.id}`);
      // Notify all other participants that we are now unmuted.
      // The web frontend uses this signal to update the mic icon on participant cards.
      this.sendMuteState(false);
    } catch (err) {
      console.error('[enableMic] FAILED to produce audio:', err);
    }
  }

  public disableMic() {
    // Update authoritative desired state
    this._desiredMicEnabled = false;

    if (this.localAudioProducer) {
      console.log(`[disableMic] Closing audio producer id=${this.localAudioProducer.id}`);
      // Notify all other participants that we are now muted BEFORE closing.
      this.sendMuteState(true);
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
    // User-initiated disable: stop the track to release the microphone
    if (this._lastAudioTrack && this._lastAudioTrack.readyState === 'live') {
      this._lastAudioTrack.stop();
    }
    this._lastAudioTrack = null;
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

  /**
   * Broadcast the local mic mute state to all other participants.
   * The web frontend uses this signal to update the mic icon on participant
   * cards — without it, all mobile users appear permanently unmuted.
   */
  public sendMuteState(isMuted: boolean) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'mute_state', isMuted }));
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

    // Deduplication: Skip if already consuming this producerId
    const existingConsumer = Array.from(this.consumers.values()).find(
      c => c.producerId === producerId
    );
    if (existingConsumer) {
      console.log(`[MediasoupService] Already consuming producerId ${producerId}, skipping duplicate consume`);
      return;
    }

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
      // Stamp the transport generation so health checks can detect stale consumers
      (consumer as any)._transportGeneration = this._recvTransportGeneration;
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
    // Stop local screen share if active
    this.disableScreenShare();
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

  /**
   * Check whether the WebSocket connection is alive.
   * Returns true if the WS is open and has received a pong within the last 45s.
   */
  public isAlive(): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    // If we haven't heard a pong in 45s, consider it dead
    return (Date.now() - this._lastPongTime) < 45000;
  }

  /**
   * Selective media recovery for receive transport and audio consumers.
   * Repairs ONLY the broken components without rebuilding healthy connections.
   * Includes recovery generation verification to ensure stale callbacks do not mutate state.
   */
  public async restoreReceiveMedia(providedRecoveryId?: string): Promise<boolean> {
    if (this._intentionalDisconnect) return false;

    // Idempotency guard — only one restoration at a time
    if (this._isRestoringReceiveMedia) {
      console.log('[MediaRecovery] Already restoring receive media, skipping concurrent call');
      return false;
    }
    this._isRestoringReceiveMedia = true;

    const recoveryId = providedRecoveryId || `${Date.now()}-${++this._recoveryGeneration}`;
    this._activeRecoveryId = recoveryId;
    console.log(`[MediaRecovery] Starting restoreReceiveMedia (recoveryId: ${recoveryId})...`);

    // NOTE: Do NOT set 'recovering_media' banner here immediately.
    // We first verify whether recovery is actually needed.

    try {
      if (this._activeRecoveryId !== recoveryId) { this._isRestoringReceiveMedia = false; return false; }

      // 1. Check if recv transport is missing or unhealthy
      const recvState = this._getRecvTransportState();
      const recvClass = this._classifyTransportState(recvState);

      if (!this.recvTransport || recvClass === 'unhealthy') {
        // Banner is now justified — genuine transport recovery needed
        this._setConnectionState('recovering_media');
        console.log(`[MediaRecovery] Recv transport is ${recvState}, creating new receive transport...`);

        // Invalidate old transport generation — stale consumers from here will fail health checks
        // Close stale consumers belonging to broken transport
        this.consumers.forEach(c => { try { c.close(); } catch (_) {} });
        this.consumers.clear();
        this.remoteStreams.clear();
        this.remoteScreenStreams.clear();
        this.screenConsumerIds.clear();
        this.consumerPeerIds.clear();

        if (this.recvTransport) {
          try { this.recvTransport.close(); } catch (_) {}
          this.recvTransport = null;
        }

        const recvRes = await this.request('createWebRtcTransport', 'transportCreated', {
          direction: 'recv'
        });
        if (this._activeRecoveryId !== recoveryId) { this._isRestoringReceiveMedia = false; return false; }

        // Bump transport generation — old consumer health checks will now fail correctly
        this._recvTransportGeneration++;

        this.recvTransport = this.device!.createRecvTransport(recvRes.transportParams);
        this.recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
          try {
            await this.request('connectWebRtcTransport', 'transportConnected', {
              transportId: this.recvTransport!.id,
              dtlsParameters
            });
            callback();
          } catch (e) {
            errback(e as Error);
          }
        });
      } else {
        // Transport is present and transitional/connected — show banner only for actual consumer repair
        const health = this._getMeetingHealth();
        if (!health.audioConsumersHealthy && health.expectedAudioProducerCount > 0) {
          this._setConnectionState('recovering_media');
        }
      }

      if (this._activeRecoveryId !== recoveryId) { this._isRestoringReceiveMedia = false; return false; }

      // 2. Fetch authoritative snapshot of current active producers on server
      console.log('[MediaRecovery] Fetching producer snapshot from server...');
      const prodRes = await this.request('getProducers', 'producersList');
      if (this._activeRecoveryId !== recoveryId) { this._isRestoringReceiveMedia = false; return false; }

      const producers: any[] = prodRes.producers || [];
      console.log(`[MediaRecovery] Server returned ${producers.length} active producers`);

      // Update authoritative snapshot
      this._remoteProducerSnapshot = producers
        .filter(p => p.userId !== this.currentUserId && p.participantId !== this.participantId)
        .map(p => ({ producerId: p.producerId, userId: p.userId, kind: p.kind, appData: p.appData }));

      // 3. Recreate missing consumers (consumeRemote handles deduplication)
      for (const p of producers) {
        if (this._activeRecoveryId !== recoveryId) { this._isRestoringReceiveMedia = false; return false; }
        if (p.userId === this.currentUserId || p.participantId === this.participantId) continue;
        await this.consumeRemote(p.producerId, p.userId, p.kind, p.appData);
      }

      // 4. Resume all remote audio consumers
      this.consumers.forEach((consumer) => {
        if (consumer.kind === 'audio') {
          try {
            consumer.resume();
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify({ type: 'resume', consumerId: consumer.id }));
            }
          } catch (err) {
            console.warn(`[MediaRecovery] Error resuming consumer ${consumer.id}:`, err);
          }
        }
      });

      this.notifyStreamUpdate();

      if (this._activeRecoveryId !== recoveryId) { this._isRestoringReceiveMedia = false; return false; }

      // 5. Final health verification before marking recovered
      const finalHealth = this._getMeetingHealth();
      console.log(`[MediaRecovery] Final health check:`, JSON.stringify(finalHealth));

      console.log('[MediaRecovery] Receive media restoration completed successfully!');
      this._setConnectionState('reconnected');
      if (this.onMediaRestored) this.onMediaRestored();

      setTimeout(() => {
        if (this._activeRecoveryId === recoveryId && this._connectionState === 'reconnected') {
          this._setConnectionState('connected');
        }
      }, 2000);

      this._isRestoringReceiveMedia = false;
      return true;
    } catch (err) {
      console.error(`[MediaRecovery] Error during restoreReceiveMedia (recoveryId: ${recoveryId}):`, err);
      if (this._activeRecoveryId === recoveryId) {
        this._setConnectionState('failed');
      }
      this._isRestoringReceiveMedia = false;
      return false;
    }
  }


  /**
   * Component-based health check on foreground return.
   * Independently checks each connection component and recovers only what's broken.
   * Runs an automatic 3-step retry sequence before setting state to failed.
   */
  public async handleAppForeground() {
    if (this._intentionalDisconnect) return;

    // Cancel any stale deferred check that might have been queued previously
    this._cancelDeferredForegroundHealthCheck();

    // ── PiP path ────────────────────────────────────────────────────────────
    if (this._wasInPiP) {
      // If the PiP transition window is still settling, defer by a small amount
      // but do NOT stack multiple timers.
      if (this.isPipTransitionActive()) {
        const deferMs = this._pipTransitionUntil - Date.now() + 100;
        console.log(`[AppState] PiP transition active — deferring PiP-return health check by ${deferMs}ms`);
        this._foregroundHealthTimer = setTimeout(() => {
          this._foregroundHealthTimer = null;
          void this.handleAppForeground();
        }, deferMs);
        return;
      }

      // PiP is settled — perform lightweight check, never force-reconnect blindly
      console.log('[AppState] Returning from PiP — running PiP-return health check');
      void this._handlePipReturn();
      return;
    }

    // ── Real background return path ─────────────────────────────────────────
    // Clear deferred PiP reconnect flag if set — the background path handles all recovery.
    this._needsReconnectOnForeground = false;
    const recoveryId = `${Date.now()}-${++this._recoveryGeneration}`;
    this._activeRecoveryId = recoveryId;

    console.log(
      `[FOREGROUND_RECOVERY_DECISION] source=real_background_return recoveryId=${recoveryId} ` +
      `ws=${this.ws?.readyState} heartbeatAge=${Date.now() - this._lastPongTime} ` +
      `sendTransport=${this._getSendTransportState()} recvTransport=${this._getRecvTransportState()} ` +
      `activeRecoveryId=${this._activeRecoveryId}`
    );

    // 1. Probe WebSocket health — send ping and wait for response
    const wsOpen = this.ws?.readyState === WebSocket.OPEN;
    if (!wsOpen) {
      if (!this._isReconnecting) {
        console.log(`[FOREGROUND_RECOVERY_DECISION] decision=full_recovery reason=websocket_closed`);
        this.preserveMediaState();
        this._forceReconnect();
      }
      return;
    }

    // Send ping and wait 3s for pong proof-of-life (timers may have paused in background)
    const preProbeTime = this._lastPongTime;
    try {
      this.ws!.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
    } catch (e) {
      console.warn('[AppState] Failed to send ping on foreground, triggering full reconnect');
      this.preserveMediaState();
      this._forceReconnect();
      return;
    }
    await new Promise(r => setTimeout(r, 3000));
    if (this._activeRecoveryId !== recoveryId) return;

    if (this._lastPongTime <= preProbeTime) {
      // No pong received in 3s — signal is dead
      console.warn('[AppState] No pong received after 3s probe, triggering full reconnect');
      console.log(`[FOREGROUND_RECOVERY_DECISION] decision=full_recovery reason=no_pong_after_probe`);
      this.preserveMediaState();
      this._forceReconnect();
      return;
    }

    // 2. Check Send Transport — but only if we have media to send
    const sendState = this._getSendTransportState();
    const sendClass = this._classifyTransportState(sendState);
    const hasMediaToSend = this._desiredMicEnabled || this._desiredCameraEnabled ||
      (this.localScreenTrack && this.localScreenTrack.readyState === 'live');

    if (hasMediaToSend && sendClass === 'unhealthy') {
      // Try ICE restart first
      console.warn(`[AppState] Send transport unhealthy (${sendState}), attempting ICE restart...`);
      try {
        const iceRes = await this.request('restart_ice', 'ice_restarted', {
          transportId: this.sendTransport!.id
        });
        await this.sendTransport!.restartIce({ iceParameters: iceRes.iceParameters });
        console.log('[AppState] ICE restart succeeded for send transport');
        await new Promise(r => setTimeout(r, 2000));
        if (this._activeRecoveryId !== recoveryId) return;
        const sendState2 = this._getSendTransportState();
        if (this._classifyTransportState(sendState2) !== 'healthy') {
          // ICE restart failed — acknowledged server reset + full rebuild
          console.warn(`[AppState] Send transport still unhealthy after ICE restart, rebuilding...`);
          const rebuildRecoveryId = `${Date.now()}-${++this._recoveryGeneration}`;
          this._activeRecoveryId = rebuildRecoveryId;
          await this.rebuildMediaSession('foreground_send_failed', rebuildRecoveryId);
          return;
        }
      } catch (iceErr) {
        console.warn('[AppState] ICE restart failed, triggering full reconnect:', iceErr);
        this.preserveMediaState();
        this._forceReconnect();
        return;
      }
    } else if (hasMediaToSend && sendClass === 'transitional') {
      // Brief grace: wait up to 2s for it to settle before deciding
      console.log(`[AppState] Send transport transitional (${sendState}) — waiting 2s for ICE to settle`);
      await new Promise(r => setTimeout(r, 2000));
      if (this._activeRecoveryId !== recoveryId) return;
      const sendState2 = this._getSendTransportState();
      if (this._classifyTransportState(sendState2) !== 'healthy') {
        console.warn(`[AppState] Send transport still not connected (${sendState2}), full reconnect`);
        this.preserveMediaState();
        this._forceReconnect();
        return;
      }
    }
    // If !hasMediaToSend and transport is new/null, that's expected — don't fail

    // 3. Check Recv Transport and audio consumer health using authoritative snapshot
    const recvState = this._getRecvTransportState();
    const recvClass = this._classifyTransportState(recvState);
    const health = this._getMeetingHealth();

    console.log(
      `[AppState] recv=${recvState} expectedAudio=${health.expectedAudioProducerCount} ` +
      `audioConsumers=${health.audioConsumerCount} audioHealthy=${health.audioConsumersHealthy}`
    );

    const needsMediaRecovery =
      recvClass === 'unhealthy' ||
      (!health.audioConsumersHealthy && health.expectedAudioProducerCount > 0);

    if (needsMediaRecovery) {
      console.log('[AppState] Recv transport or audio consumers unhealthy — starting 3-step media recovery');
      console.log(`[FOREGROUND_RECOVERY_DECISION] decision=receive_media_only reason=remote_audio_unhealthy`);

      const attempts = [0, 5000, 10000];
      let restored = false;

      for (let i = 0; i < attempts.length; i++) {
        if (this._activeRecoveryId !== recoveryId) return;
        if (attempts[i] > 0) {
          console.log(`[AppState] Waiting ${attempts[i] / 1000}s before media recovery attempt ${i + 1}...`);
          await new Promise(r => setTimeout(r, attempts[i]));
        }
        if (this._activeRecoveryId !== recoveryId) return;
        console.log(`[AppState] Media recovery attempt ${i + 1}/3...`);
        restored = await this.restoreReceiveMedia(recoveryId);
        if (restored) break;
      }

      if (!restored && this._activeRecoveryId === recoveryId) {
        console.error('[AppState] All 3 media recovery attempts failed');
        this._setConnectionState('failed');
      }
    } else {
      console.log(`[FOREGROUND_RECOVERY_DECISION] decision=no_action`);
      // Everything healthy — ensure banner is cleared
      if (this._connectionState !== 'connected') {
        await this._completeRecoveryIfHealthy(recoveryId, 'real_background_healthy');
      }
    }
  }

  /**
   * Lightweight health check performed on PiP return.
   * Uses a bounded stabilisation sequence before deciding to repair.
   * Never calls _forceReconnect() unless signalling is genuinely unhealthy.
   */
  private async _handlePipReturn(): Promise<void> {
    console.log(
      `[PiP Return] Entering PiP-return check — ` +
      `_isReconnecting=${this._isReconnecting} connectionState=${this._connectionState} ` +
      `_needsReconnectOnForeground=${this._needsReconnectOnForeground} ` +
      `ws=${this.ws?.readyState}`
    );

    // ── GUARD 1: An existing reconnect is already in progress ──────────────
    if (this._isReconnecting) {
      console.log('[PiP Return] Reconnect already in progress — not interfering.');
      this._wasInPiP = false;
      this._needsReconnectOnForeground = false; // Already handled
      return;
    }

    // ── GUARD 2: Service state already reports healthy ─────────────────────
    if (
      this._connectionState === 'connected' ||
      this._connectionState === 'reconnected'
    ) {
      console.log(`[FOREGROUND_RECOVERY_DECISION] source=pip_return decision=no_action (service_state=${this._connectionState})`);
      this._wasInPiP = false;
      this._needsReconnectOnForeground = false;
      return;
    }

    // ── GUARD 3: Already in a media-recovery cycle ─────────────────────────
    if (this._isRestoringReceiveMedia) {
      console.log('[PiP Return] Media restoration already running — not interfering.');
      this._wasInPiP = false;
      return;
    }

    // ── PRIMARY PATH: WS dropped during PiP, reconnect was deferred ────────
    // This is the most common PiP-return scenario: the OS killed the WebSocket
    // while the app was in PiP. We deferred reconnection to preserve retry budget.
    // Now the user is back in the foreground with full network access.
    if (this._needsReconnectOnForeground) {
      console.log(`[FOREGROUND_RECOVERY_DECISION] source=pip_return decision=deferred_reconnect`);
      this._needsReconnectOnForeground = false;
      this._wasInPiP = false;

      // Small settle delay for Android lifecycle events
      await new Promise(r => setTimeout(r, 500));

      // Re-check: maybe another path already started reconnecting
      if (this._isReconnecting || this._connectionState === 'connected' || this._connectionState === 'reconnected') {
        console.log(`[PiP Return] State changed during settle — ${this._connectionState}, no action needed`);
        return;
      }

      // Start fresh reconnect with full retry budget
      this._forceReconnect();
      return;
    }

    // ── FALLBACK: No deferred flag, but state is not connected ──────────────
    // This can happen if the WS dropped before notifyPipEntered() ran (race),
    // or if transport ICE changed state for a non-WS reason.
    // Wait briefly and re-check — the state may self-resolve.
    console.log(`[PiP Return] No deferred reconnect flag, but state=${this._connectionState}. Waiting 1s for self-resolution.`);
    this._wasInPiP = false;

    await new Promise(r => setTimeout(r, 1000));

    // If state recovered on its own (ICE restart, etc.), do nothing
    if (this._connectionState === 'connected' || this._connectionState === 'reconnected') {
      console.log(`[PiP Return] State self-resolved to ${this._connectionState}`);
      return;
    }

    // If WS is still open and state is just 'temporarily_disconnected',
    // give ICE more time rather than forcing a full reconnect
    if (
      this._connectionState === 'temporarily_disconnected' &&
      this.ws?.readyState === WebSocket.OPEN
    ) {
      console.log('[PiP Return] WS open but transport temporarily disconnected — clearing state, no reconnect');
      this._setConnectionState('connected');
      return;
    }

    // WS is dead and we somehow missed setting the flag — do a fresh reconnect
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log(`[FOREGROUND_RECOVERY_DECISION] source=pip_return_fallback decision=full_recovery`);
      this.preserveMediaState();
      this._forceReconnect();
      return;
    }

    // WS open, state is something unexpected (recovering_media, failed, etc.)
    // Try targeted media recovery
    console.log(`[FOREGROUND_RECOVERY_DECISION] source=pip_return_fallback decision=receive_media_only`);
    const recoveryId = `${Date.now()}-${++this._recoveryGeneration}`;
    this._activeRecoveryId = recoveryId;
    await this.restoreReceiveMedia(recoveryId);
  }




  /** Get the ICE connection state of the send transport, or 'closed' if null */
  private _getSendTransportState(): string {
    if (!this.sendTransport) return 'closed';
    try {
      return (this.sendTransport as any).connectionState || 'unknown';
    } catch { return 'unknown'; }
  }

  /** Get the ICE connection state of the recv transport, or 'closed' if null */
  private _getRecvTransportState(): string {
    if (!this.recvTransport) return 'closed';
    try {
      return (this.recvTransport as any).connectionState || 'unknown';
    } catch { return 'unknown'; }
  }

  /**
   * Force a clean reconnection by resetting attempt counters first.
   * Preserves media state if not already preserved.
   */
  private _forceReconnect() {
    if (this._isReconnecting) {
      console.log('[Reconnect] Already reconnecting, skip _forceReconnect');
      return;
    }
    this._reconnectAttempts = 0;
    this._isReconnecting = false;
    // Close stale socket if it's lingering in CLOSING state
    try { this.ws?.close(); } catch (_) {}
    this.ws = null;
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this._reconnectTimer) { clearTimeout(this._reconnectTimer); this._reconnectTimer = null; }
    this.attemptReconnect();
  }

  // ── Reconnection Logic ────────────────────────────────────────────────────

  /**
   * Attempt WebSocket reconnection with exponential backoff.
   * Uses the reconnection state machine: reconnecting → recovering_media → reconnected | failed.
   * Prevents multiple simultaneous reconnect attempts via _isReconnecting mutex.
   * Has a maximum total duration timeout (60s) and maximum retry count (5).
   * Cancels if the meeting has ended (_intentionalDisconnect).
   */
  private async attemptReconnect() {
    // Mutex guard: prevent concurrent reconnection
    if (this._isReconnecting || this._intentionalDisconnect) {
      console.log(`[Reconnect] Skipped: isReconnecting=${this._isReconnecting}, intentional=${this._intentionalDisconnect}`);
      return;
    }
    this._isReconnecting = true;
    this._reconnectStartTime = Date.now();
    this._setConnectionState('reconnecting');

    // Absolute 60-second deadline — fires regardless of attempt state
    let deadlineExceeded = false;
    const deadlineTimer = setTimeout(() => {
      deadlineExceeded = true;
      console.error('[Reconnect] Absolute 60s deadline exceeded');
    }, this._maxReconnectDuration);

    try {
      while (this._reconnectAttempts < this._maxReconnectAttempts && !deadlineExceeded) {
        this._reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this._reconnectAttempts - 1), 10000);
        console.log(`[Reconnect] Attempt ${this._reconnectAttempts}/${this._maxReconnectAttempts} in ${delay}ms...`);
        
        if (this.onReconnecting) this.onReconnecting(this._reconnectAttempts);

        await new Promise(r => { this._reconnectTimer = setTimeout(r, delay); });
        this._reconnectTimer = null;

        // Check termination conditions after delay
        if (this._intentionalDisconnect) {
          console.log('[Reconnect] Meeting ended during reconnect, aborting');
          return;
        }
        if (deadlineExceeded) break;

        try {
          // Try ICE restart first if transports still exist and signal is healthy
          if (this.ws?.readyState === WebSocket.OPEN && this.sendTransport) {
            console.log('[Reconnect] Attempting ICE restart before full reconnect...');
            try {
              const iceRes = await this.request('restart_ice', 'ice_restarted', {
                transportId: this.sendTransport.id
              });
              if (iceRes && !deadlineExceeded) {
                await this.sendTransport.restartIce({ iceParameters: iceRes.iceParameters });
                console.log('[Reconnect] ICE restart succeeded');
                this._reconnectAttempts = 0;
                this._setConnectionState('reconnected');
                if (this.onReconnected) this.onReconnected();
                setTimeout(() => {
                  if (this._connectionState === 'reconnected') {
                    this._setConnectionState('connected');
                  }
                }, 3000);
                return;
              }
            } catch (iceErr) {
              console.warn('[Reconnect] ICE restart failed, proceeding with full reconnect:', iceErr);
            }
          }

          if (deadlineExceeded || this._intentionalDisconnect) break;

          // Full reconnect: connect() will open new WS, and session_status 'active'
          // handler will call rebuildMediaSession() (since device is already loaded)
          if (this._lastMeetingToken) {
            const result = await this.connect(this._lastMeetingToken, this._lastSignalUrl);
            
            if (result === 'active') {
              // rebuildMediaSession was called inside connect's session_status handler
              console.log('[Reconnect] Successfully reconnected!');
              this._reconnectAttempts = 0;
              this._setConnectionState('reconnected');
              if (this.onReconnected) this.onReconnected();

              // After brief UI feedback, transition to fully connected
              setTimeout(() => {
                if (this._connectionState === 'reconnected') {
                  this._setConnectionState('connected');
                }
              }, 3000);
              return;
            } else if (result === 'ended' || result === 'kicked' || result === 'denied') {
              console.log(`[Reconnect] Server returned ${result}, stopping reconnection`);
              return;
            }
            // 'waiting' — keep trying
          }
        } catch (err) {
          console.warn(`[Reconnect] Attempt ${this._reconnectAttempts} failed:`, err);
        }
      }

      // All attempts exhausted or deadline exceeded
      console.error('[Reconnect] All reconnection attempts failed');
      this._setConnectionState('failed');
      if (this.onReconnectFailed) this.onReconnectFailed();
    } finally {
      // GUARANTEED cleanup — _isReconnecting is always cleared
      clearTimeout(deadlineTimer);
      this._isReconnecting = false;
      this._reconnectAttempts = 0;
      if (this._reconnectTimer) {
        clearTimeout(this._reconnectTimer);
        this._reconnectTimer = null;
      }
    }
  }

  /**
   * Re-publish local audio and video tracks after a WebSocket reconnection.
   * Called by attemptReconnect() once a new transport pair has been created.
   */
  public async broadcast(localStream: MediaStream) {
    const videoTrack = localStream.getVideoTracks()[0];
    const audioTrack = localStream.getAudioTracks()[0];

    // Ensure stale producer references are cleared before re-publishing on new transport
    this.localVideoProducer = null;
    this.localAudioProducer = null;

    if (videoTrack && videoTrack.readyState === 'live' && videoTrack.enabled) {
      await this.enableCamera(videoTrack);
    }
    if (audioTrack && audioTrack.readyState === 'live') {
      const wasEnabled = audioTrack.enabled;
      await this.enableMic(audioTrack);
      if (!wasEnabled && this.localAudioProducer) {
        // Retain muted state if user was muted before reconnect
        audioTrack.enabled = false;
        try { this.localAudioProducer.pause(); } catch (_) {}
        this.sendMuteState(true);
      }
    }
  }

  // ── Screen Share ────────────────────────────────────────────────────────────

  /**
   * Start sharing the device screen.
   * Calls getDisplayMedia() which triggers the Android MediaProjection permission
   * dialog. Creates a separate mediasoup producer with `appData: { source: 'screen' }`
   * so the server and remote peers identify it as a screen share (not camera).
   *
   * Uses conservative encoding (500 Kbps, 10 fps) to preserve mobile data.
   */
  public async enableScreenShare(): Promise<MediaStreamTrack> {
    if (!this.device || !this.sendTransport) {
      throw new Error('Device not initialized — cannot start screen share');
    }
    if (this.screenShareProducer && !this.screenShareProducer.closed) {
      throw new Error('Screen share already active');
    }

    console.log('[ScreenShare] Requesting getDisplayMedia...');
    const stream = await (mediaDevices as any).getDisplayMedia({
      video: { frameRate: { ideal: 15, max: 30 } },
      audio: true
    });
    const screenTrack = stream.getVideoTracks()[0];
    if (!screenTrack) {
      throw new Error('No video track from getDisplayMedia');
    }
    this.localScreenTrack = screenTrack;
    console.log(`[ScreenShare] Got screen track: id=${screenTrack.id}, readyState=${screenTrack.readyState}`);

    // Prioritize VP8, fallback to H264 Baseline for cross-platform compatibility
    const screenCodec = this.device.rtpCapabilities.codecs?.find(
      (c: any) => c.mimeType.toLowerCase() === 'video/vp8'
    ) || this.device.rtpCapabilities.codecs?.find(
      (c: any) => c.mimeType.toLowerCase() === 'video/h264' && c.parameters?.['profile-level-id'] === '42e01f'
    );

    // Create a SEPARATE producer — camera producer stays untouched
    this.screenShareProducer = await this.sendTransport.produce({
      track: screenTrack as any,
      codec: screenCodec,
      appData: { source: 'screen' },
      encodings: [{ maxBitrate: 1500000, maxFramerate: 15 }],
      codecOptions: { videoGoogleStartBitrate: 1000 }
    });
    console.log(`[ScreenShare] Screen producer created: id=${this.screenShareProducer.id}`);

    // Check for system audio track from display media and produce if available
    const screenAudioTrack = stream.getAudioTracks()[0];
    if (screenAudioTrack) {
      this.localScreenAudioTrack = screenAudioTrack;
      this.screenAudioShareProducer = await this.sendTransport.produce({
        track: screenAudioTrack as any,
        appData: { source: 'screen-audio' }
      });
      console.log(`[ScreenShare] Screen audio producer created: id=${this.screenAudioShareProducer.id}`);
      screenAudioTrack.onended = () => {
        this.disableScreenShare();
      };
    }

    // Auto-stop when the OS stops the screen capture (e.g. notification bar "Stop")
    screenTrack.onended = () => {
      console.log('[ScreenShare] Screen track ended by OS — stopping producer');
      this.disableScreenShare();
    };

    return screenTrack;
  }

  /**
   * Stop sharing the device screen.
   * Sends `stop_producer` to the server, stops the track, and closes the producer.
   */
  public disableScreenShare() {
    if (this.screenShareProducer) {
      const producerId = this.screenShareProducer.id;
      console.log(`[ScreenShare] Stopping screen share producer: id=${producerId}`);

      // Tell the server FIRST so it can broadcast screen_share_stopped
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'stop_producer',
          producerId,
          appData: { source: 'screen' }
        }));
      }

      // Stop the track so the OS screen capture indicator disappears
      if (this.localScreenTrack) {
        this.localScreenTrack.stop();
        this.localScreenTrack = null;
      }

      this.screenShareProducer.close();
      this.screenShareProducer = null;
    }

    if (this.screenAudioShareProducer) {
      const audioProducerId = this.screenAudioShareProducer.id;
      console.log(`[ScreenShare] Stopping screen audio producer: id=${audioProducerId}`);

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'stop_producer',
          producerId: audioProducerId,
          appData: { source: 'screen-audio' }
        }));
      }

      if (this.localScreenAudioTrack) {
        this.localScreenAudioTrack.stop();
        this.localScreenAudioTrack = null;
      }

      this.screenAudioShareProducer.close();
      this.screenAudioShareProducer = null;
    }
  }

  /**
   * Returns true if the local user is currently sharing their screen.
   */
  public get isScreenSharing(): boolean {
    return this.screenShareProducer != null && !this.screenShareProducer.closed;
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

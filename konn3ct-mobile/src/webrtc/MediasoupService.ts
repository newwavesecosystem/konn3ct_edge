import { Device, types } from 'mediasoup-client';
import { MediaStream } from 'react-native-webrtc';
import { useAuthStore } from '../store/useAuthStore';
import { useMeetingStore } from '../store/useMeetingStore';

// Connected to Kubernetes Backend Ingress Domain
const BACKEND_DOMAIN = process.env.EXPO_PUBLIC_BACKEND_DOMAIN || 'konn3ctedge.konn3ct.net';

export interface RemoteParticipant {
  id: string;
  name: string;
  stream: MediaStream;
}

export class MediasoupService {
  private ws: WebSocket | null = null;
  private device: Device | null = null;
  
  private sendTransport: types.Transport | null = null;
  private recvTransport: types.Transport | null = null;
  
  private localVideoProducer: types.Producer | null = null;
  private localAudioProducer: types.Producer | null = null;
  private consumers: Map<string, types.Consumer> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map();

  private pendingRequests = new Map<string, Array<{ resolve: (val: any) => void, reject: (err: Error) => void, timeoutId: NodeJS.Timeout }>>();
  
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
  public onPollHistory?: (polls: any[]) => void;
  public onWaitingRoomRequest?: (user: any) => void;
  public onForceMute?: () => void;
  public onSessionStatusChange?: (status: string) => void;
  
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

  public forceMute(userId?: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'force_mute', userId }));
    }
  }

  public onStreamUpdate(callback: (streams: RemoteParticipant[]) => void) {
    this.onStreamUpdateCallback = callback;
  }

  private notifyStreamUpdate() {
    if (!this.onStreamUpdateCallback) return;
    const participants: RemoteParticipant[] = [];
    this.remoteStreams.forEach((stream, id) => {
      participants.push({
        id,
        name: `User ${id.substring(0, 4)}`,
        stream
      });
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

  public async connect() {
    const token = useAuthStore.getState().token;
    if (!token) throw new Error('No auth token found');

    const wsUrl = `wss://${BACKEND_DOMAIN}/signal?roomId=${this.roomId}&isMobile=true&token=${token}`;
    console.log(`Connecting native WebSocket to: ${wsUrl.replace(token, '[REDACTED]')}`);
    
    this.ws = new WebSocket(wsUrl);

    return new Promise<string>((resolve, reject) => {
      this.ws!.onopen = () => {
        console.log('Native WebSocket connected successfully!');
        this.ws!.send(JSON.stringify({ type: 'auth', token }));
      };

      this.ws!.onerror = (err) => {
        console.error('WebSocket connection error:', err);
        reject(err);
      };
      
      this.ws!.onclose = (e) => {
        console.log(`WebSocket closed: ${e.code} ${e.reason}`);
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
            }
            break;

          case 'participants_list':
            if (this.onParticipantsList) this.onParticipantsList(msg.participants || []);
            break;

          case 'user_joined':
            if (this.onUserJoined) this.onUserJoined(msg);
            break;

          case 'user_left':
            if (this.onUserLeft) this.onUserLeft(msg.userId);
            const stream = this.remoteStreams.get(msg.userId);
            if (stream) {
              this.remoteStreams.delete(msg.userId);
              this.notifyStreamUpdate();
            }
            break;

          case 'chat_history':
            if (this.onChatHistory) this.onChatHistory(msg.messages || []);
            break;

          case 'chat':
            if (this.onChatMessage) this.onChatMessage(msg);
            break;

          case 'reaction':
            if (this.onReaction) this.onReaction(msg);
            break;

          case 'poll_history':
            if (this.onPollHistory) this.onPollHistory(msg.polls || []);
            break;

          case 'poll_create':
            if (this.onPollCreate) this.onPollCreate(msg);
            break;

          case 'poll_vote':
            if (this.onPollVote) this.onPollVote(msg);
            break;

          case 'waiting_room_request':
            if (this.onWaitingRoomRequest) this.onWaitingRoomRequest(msg);
            break;

          case 'force_mute':
            if (this.onForceMute) this.onForceMute();
            break;

          case 'newProducer':
            this.consumeRemote(msg.producerId, msg.userId, msg.kind, msg.appData).catch(console.error);
            break;

          case 'producer_closed':
            this.consumers.forEach((consumer, consumerId) => {
              if (consumerId === msg.consumerId) {
                consumer.close();
                this.consumers.delete(consumerId);
              }
            });
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
        await this.request('connectWebRtcTransport', 'transportConnected', {
          transportId: this.sendTransport!.id,
          dtlsParameters
        });
        callback();
      } catch (err) { errback(err as Error); }
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

    // Fetch existing producers
    try {
      const prodRes = await this.request('getProducers', 'producersList');
      for (const p of prodRes.producers || []) {
        await this.consumeRemote(p.producerId, p.userId, p.kind, p.appData);
      }
    } catch (e) { console.error('Failed to get existing producers', e); }
  }

  public async broadcast(stream: MediaStream) {
    if (!this.sendTransport) return;
    
    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];
    
    if (videoTrack) {
      this.localVideoProducer = await this.sendTransport.produce({ 
        track: videoTrack as any, 
        appData: { source: 'camera' },
        encodings: [{ scaleResolutionDownBy: 1, maxBitrate: 900000 }] 
      });
    }
    if (audioTrack) {
      this.localAudioProducer = await this.sendTransport.produce({ track: audioTrack as any });
    }
  }

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

      this.consumers.set(consumer.id, consumer);

      const oldStream = this.remoteStreams.get(peerId);
      const existingTracks = oldStream ? oldStream.getTracks() : [];
      const newTracks = [...existingTracks, consumer.track];
      
      const newStream = new MediaStream(newTracks as any);
      this.remoteStreams.set(peerId, newStream);
      
      // Resume the consumer natively (Mobile requires explicit resume)
      consumer.resume();
      await this.request('resumeConsumer', 'consumerResumed', { consumerId: consumer.id });
      
      this.notifyStreamUpdate();
    } catch (e) {
      console.error('Failed to consume', e);
    }
  }

  public disconnect() {
    if (this.sendTransport) this.sendTransport.close();
    if (this.recvTransport) this.recvTransport.close();
    if (this.ws) this.ws.close();
    this.remoteStreams.clear();
    this.consumers.clear();
    this.notifyStreamUpdate();
  }
}

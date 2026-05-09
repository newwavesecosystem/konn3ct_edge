import { Device } from 'mediasoup-client';
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
  
  private pendingRequests: Map<string, { resolve: Function, reject: Function }> = new Map();
  private messageIdCounter = 0;

  public onNewConsumer?: (consumer: Consumer, userId: string) => void;
  public onConnectionStateChange?: (state: string) => void;
  
  // Collaboration Callbacks
  public onChatMessage?: (msg: any) => void;
  public onReaction?: (reaction: any) => void;
  public onPollCreate?: (poll: any) => void;
  public onPollVote?: (vote: any) => void;
  public onMuteState?: (msg: any) => void;
  public onHandRaise?: (msg: any) => void;

  constructor(private roomId: string, private token: string) {}

  public async connect() {
    this.onConnectionStateChange?.('connecting');
    
    // Connect WebSocket
    const domain = process.env.NEXT_PUBLIC_BACKEND_DOMAIN || 'konn3ctedge.konn3ct.net';
    const wsUrl = `wss://${domain}/signal?roomId=${this.roomId}&token=${this.token}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = async () => {
      try {
        await this.initializeMediasoup();
        this.onConnectionStateChange?.('connected');
        
        // Fetch any existing producers from users already in the room
        try {
          const res = await this.request('getProducers', 'producersList');
          for (const p of res.producers || []) {
            await this.consumeRemoteStream(p.producerId, p.userId, p.kind);
          }
        } catch (syncErr) {
          console.error("Failed to sync existing producers:", syncErr);
        }
      } catch (err) {
        console.error("Mediasoup initialization failed:", err);
        this.onConnectionStateChange?.('failed');
      }
    };

    this.ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);
      
      // Handle Response matching by event type
      if (this.pendingRequests.has(msg.type)) {
        this.pendingRequests.get(msg.type)!.resolve(msg);
        this.pendingRequests.delete(msg.type);
        return;
      }

      // Handle server-initiated events
      switch (msg.type) {
        case 'newProducer':
          await this.consumeRemoteStream(msg.producerId, msg.userId, msg.kind);
          break;
        case 'user_left':
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
        case 'hand_raise':
          this.onHandRaise?.(msg);
          break;
      }
    };

    this.ws.onerror = (err) => {
      console.error('WebSocket Error:', err);
      this.onConnectionStateChange?.('failed');
    };
  }

  private request(sendType: string, expectType: string, payload: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('WebSocket is not connected'));
      }
      
      this.pendingRequests.set(expectType, { resolve, reject });
      
      this.ws.send(JSON.stringify({
        type: sendType,
        ...payload
      }));

      // Timeout
      setTimeout(() => {
        if (this.pendingRequests.has(expectType)) {
          this.pendingRequests.get(expectType)!.reject(new Error(`Timeout waiting for ${expectType}`));
          this.pendingRequests.delete(expectType);
        }
      }, 10000);
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

  public sendHandRaise(isHandRaised: boolean) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'hand_raise', isHandRaised }));
    }
  }

  private async initializeMediasoup() {
    // 1. Get Router Capabilities
    const { rtpCapabilities } = await this.request('getRouterRtpCapabilities', 'routerCapabilities');
    
    // 2. Initialize Device
    this.device = new Device();
    await this.device.load({ routerRtpCapabilities: rtpCapabilities });

    // 3. Create Send Transport
    const sendTransportData = await this.request('createWebRtcTransport', 'transportCreated', { direction: 'send' });
    this.sendTransport = this.device.createSendTransport(sendTransportData.transportParams);

    this.sendTransport.on('connect', async ({ dtlsParameters }: any, callback: any, errback: any) => {
      try {
        await this.request('connectWebRtcTransport', 'transportConnected', {
          transportId: this.sendTransport!.id,
          dtlsParameters
        });
        callback();
      } catch (error: any) {
        errback(error);
      }
    });

    this.sendTransport.on('produce', async ({ kind, rtpParameters }: any, callback: any, errback: any) => {
      try {
        const { id } = await this.request('produce', 'produced', {
          transportId: this.sendTransport!.id,
          kind,
          rtpParameters
        });
        callback({ id });
      } catch (error: any) {
        errback(error);
      }
    });

    // 4. Create Receive Transport
    const recvTransportData = await this.request('createWebRtcTransport', 'transportCreated', { direction: 'recv' });
    this.recvTransport = this.device.createRecvTransport(recvTransportData.transportParams);

    this.recvTransport.on('connect', async ({ dtlsParameters }: any, callback: any, errback: any) => {
      try {
        await this.request('connectWebRtcTransport', 'transportConnected', {
          transportId: this.recvTransport!.id,
          dtlsParameters
        });
        callback();
      } catch (error: any) {
        errback(error);
      }
    });
  }

  public async enableCamera(): Promise<MediaStreamTrack> {
    if (!this.device || !this.sendTransport) throw new Error("Device not initialized");
    
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const videoTrack = stream.getVideoTracks()[0];
    
    this.localVideoProducer = await this.sendTransport.produce({ track: videoTrack });
    return videoTrack;
  }

  public async enableMic(): Promise<MediaStreamTrack> {
    if (!this.device || !this.sendTransport) throw new Error("Device not initialized");
    
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioTrack = stream.getAudioTracks()[0];
    
    this.localAudioProducer = await this.sendTransport.produce({ track: audioTrack });
    return audioTrack;
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
    
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const screenTrack = stream.getVideoTracks()[0];
    
    // Replace the camera track with the screen track
    if (this.localVideoProducer) {
      await this.localVideoProducer.replaceTrack({ track: screenTrack });
    } else {
      this.localVideoProducer = await this.sendTransport.produce({ track: screenTrack });
    }
    
    return screenTrack;
  }

  public async disableScreenShare(cameraTrack?: MediaStreamTrack): Promise<MediaStreamTrack | undefined> {
    if (!this.localVideoProducer) return undefined;
    
    if (cameraTrack && cameraTrack.readyState === 'live') {
      await this.localVideoProducer.replaceTrack({ track: cameraTrack });
      return cameraTrack;
    } else {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const newTrack = stream.getVideoTracks()[0];
      await this.localVideoProducer.replaceTrack({ track: newTrack });
      return newTrack;
    }
  }

  private async consumeRemoteStream(producerId: string, userId: string, kind: string) {
    if (!this.device || !this.recvTransport) return;

    const { id, kind: consumerKind, rtpParameters } = await this.request('consume', 'consumed', {
      transportId: this.recvTransport.id,
      producerId,
      rtpCapabilities: this.device.rtpCapabilities
    });

    const consumer = await this.recvTransport.consume({
      id,
      producerId,
      kind: consumerKind,
      rtpParameters
    });

    this.consumers.set(consumer.id, consumer);
    this.onNewConsumer?.(consumer, userId);
    
    // Tell the backend to resume sending media (unpause the consumer)
    this.request('resume', 'resumed', { consumerId: consumer.id }).catch(err => {
      console.error("Failed to resume consumer:", err);
    });
  }

  public disconnect() {
    this.ws?.close();
    this.sendTransport?.close();
    this.recvTransport?.close();
  }
}

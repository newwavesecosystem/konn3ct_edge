import { EventEmitter } from 'events';
import { MediaControllerInterface, RtpCapabilities, RtpParameters, DtlsParameters } from '../interfaces/MediaControllerInterface';
import * as sfu from '../media/sfu';

export class LocalMediaController extends EventEmitter implements MediaControllerInterface {
  
  async getOrCreateRouter(roomId: string): Promise<{ id: string, rtpCapabilities: RtpCapabilities }> {
    const router = await sfu.getOrCreateRouter(roomId);
    return {
      id: router.id,
      rtpCapabilities: router.rtpCapabilities
    };
  }

  async canConsume(roomId: string, producerId: string, rtpCapabilities: any): Promise<boolean> {
    const router = await sfu.getOrCreateRouter(roomId);
    return router.canConsume({ producerId, rtpCapabilities });
  }

  async closeRouter(roomId: string): Promise<void> {
    await sfu.closeRouter(roomId);
  }

  async createWebRtcTransport(roomId: string): Promise<{ id: string; iceParameters: any; iceCandidates: any[]; dtlsParameters: DtlsParameters; }> {
    const transport = await sfu.createWebRtcTransport(roomId);
    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters
    };
  }

  async connectTransport(transportId: string, dtlsParameters: DtlsParameters): Promise<void> {
    await sfu.connectTransport(transportId, dtlsParameters);
  }

  async closeTransport(transportId: string): Promise<void> {
    await sfu.closeTransport(transportId);
  }

  async restartIce(transportId: string): Promise<{ iceParameters: any; }> {
    const iceParameters = await sfu.restartIce(transportId);
    return { iceParameters };
  }

  async createProducer(transportId: string, kind: 'audio' | 'video', rtpParameters: RtpParameters, roomId?: string, userId?: string, userName?: string, clientData?: { isBot?: boolean, role?: string }): Promise<{ id: string; }> {
    const producerId = await sfu.createProducer(transportId, kind, rtpParameters, roomId, userId, userName, clientData);
    return { id: producerId };
  }

  async closeProducer(producerId: string): Promise<void> {
    await sfu.closeProducer(producerId);
  }

  async getProducer(producerId: string): Promise<{ id: string; kind: string; appData: any; userId?: string; rtpParameters?: any } | null> {
    const producer = sfu.getProducer(producerId);
    if (!producer) return null;
    return {
      id: producer.id,
      kind: producer.kind,
      appData: producer.appData,
      userId: (producer as any).userId,
      rtpParameters: producer.rtpParameters
    };
  }

  async createConsumer(transportId: string, producerId: string, rtpCapabilities: RtpCapabilities, roomId: string): Promise<{ id: string; producerId: string; kind: string; rtpParameters: RtpParameters; appData?: any; }> {
    const router = await sfu.getOrCreateRouter(roomId);
    
    // Instead of passing a callback directly over the boundary, we intercept the callback
    // and emit it as an event on the LocalMediaController instance.
    return new Promise((resolve, reject) => {
      sfu.createConsumerWithCallback(
        transportId,
        producerId,
        rtpCapabilities,
        router,
        (consumerId) => {
          this.emit('producerClose', { 
            consumerId, 
            producerId, 
            appData: sfu.getProducer(producerId)?.appData || {} 
          });
        },
        (score) => {
          // optional score handling can be emitted if needed
        }
      ).then(consumer => {
        resolve({
          id: consumer.id,
          producerId: consumer.producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
          appData: (consumer as any).appData || {}
        });
      }).catch(reject);
    });
  }

  async resumeConsumer(consumerId: string): Promise<void> {
    await sfu.resumeConsumer(consumerId);
  }

  async pauseConsumer(consumerId: string): Promise<void> {
    await sfu.pauseConsumer(consumerId);
  }

  async requestConsumerKeyFrame(consumerId: string): Promise<void> {
    await sfu.requestConsumerKeyFrame(consumerId);
  }

  async setupAudioObserver(roomId: string): Promise<void> {
    await sfu.setupAudioObserver(roomId, (producerIds: string[]) => {
      // In the original sfu.ts, this emits an array of active producer IDs.
      this.emit('activeSpeaker', { roomId, producerIds });
    });
  }

  async cleanupAudioObserver(roomId: string): Promise<void> {
    await sfu.cleanupAudioObserver(roomId);
  }

  async handleTranscriptionMute(producerId: string, roomId: string, userId: string, userName: string, isMuted: boolean, clientData?: { isBot?: boolean, role?: string }): Promise<void> {
    await sfu.handleTranscriptionMute(producerId, roomId, userId, userName, isMuted, clientData);
  }
}

export const localMediaController = new LocalMediaController();

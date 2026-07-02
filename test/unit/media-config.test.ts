import { describe, it, expect } from 'vitest';
import { config } from '../../src/media/config';

describe('Media Config (QA-004)', () => {
  it('should have H.264 as the first video codec', () => {
    const videoCodecs = config.mediasoup.router.mediaCodecs.filter(c => c.kind === 'video');
    expect(videoCodecs[0].mimeType).toBe('video/H264');
  });

  it('should include specific Safari-compatible parameters for H.264', () => {
    const h264Codec = config.mediasoup.router.mediaCodecs.find(c => c.mimeType === 'video/H264');
    expect(h264Codec).toBeDefined();
    expect(h264Codec!.parameters).toMatchObject({
      'packetization-mode': 1,
      'profile-level-id': '42e01f',
      'level-asymmetry-allowed': 1
    });
  });

  it('should not have AV1 or VP9 before H.264', () => {
    const videoCodecs = config.mediasoup.router.mediaCodecs.filter(c => c.kind === 'video');
    const h264Index = videoCodecs.findIndex(c => c.mimeType === 'video/H264');
    const av1Index = videoCodecs.findIndex(c => c.mimeType === 'video/AV1');
    const vp9Index = videoCodecs.findIndex(c => c.mimeType === 'video/VP9');
    
    expect(h264Index).toBeLessThan(av1Index);
    expect(h264Index).toBeLessThan(vp9Index);
  });
});

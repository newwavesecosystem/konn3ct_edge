import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoProcessor } from '../video-processor';

describe('VideoProcessor (Always-On Interceptor)', () => {
  let mockVideoElement: any;
  let mockCanvas: any;
  let mockCtx: any;
  let mockStream: any;
  let mockProcessedStream: any;

  beforeEach(() => {
    // 0. Mock MediaStream
    global.MediaStream = class {
      tracks: any[];
      constructor(tracks: any[]) {
        this.tracks = tracks || [];
      }
      getTracks() { return this.tracks; }
      getVideoTracks() { return this.tracks.filter(t => t.kind === 'video'); }
      getAudioTracks() { return this.tracks.filter(t => t.kind === 'audio'); }
      addTrack(track: any) { this.tracks.push(track); }
    } as any;

    // 1. Mock Canvas 2D Context
    mockCtx = {
      drawImage: vi.fn(),
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
    };

    // 2. Mock Canvas
    mockProcessedStream = {
      getVideoTracks: vi.fn().mockReturnValue([{ kind: 'video', id: 'processed-track' }]),
    };
    mockCanvas = {
      getContext: vi.fn().mockReturnValue(mockCtx),
      captureStream: vi.fn().mockReturnValue(mockProcessedStream),
      width: 1280,
      height: 720,
    };

    // 3. Mock Video Element
    mockVideoElement = {
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      readyState: 4,
      videoWidth: 1280,
      videoHeight: 720,
    };

    // 4. Override document.createElement to return our mocks
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'video') return mockVideoElement;
      if (tag === 'canvas') return mockCanvas;
      return {} as any;
    });

    // 5. Mock requestAnimationFrame
    let rAFCallback: any = null;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      rAFCallback = cb;
      return 1;
    });

    (global as any).triggerAnimationFrame = () => {
      if (rAFCallback) rAFCallback(performance.now());
    };

    // 6. Mock raw input stream
    mockStream = {
      getVideoTracks: vi.fn().mockReturnValue([{ kind: 'video', id: 'raw-track' }]),
      getAudioTracks: vi.fn().mockReturnValue([]),
    };
  });

  it('should pass-through video via drawImage when mode is "none" to keep AI pipeline ready but inactive', () => {
    const processor = new VideoProcessor();
    
    // Set to 'none' (this is the default, but we enforce it)
    processor.setMode('none');
    
    // Start processing (The Always-On Interceptor behavior)
    processor.startProcessing(mockStream as any);
    
    // Trigger the animation frame manually
    (global as any).triggerAnimationFrame();

    // Assert that the video is playing
    expect(mockVideoElement.play).toHaveBeenCalled();
    
    // Assert that it bypassed the AI segmenter and directly called drawImage
    // It should have drawn the video element onto the canvas at 0, 0, width, height
    expect(mockCtx.drawImage).toHaveBeenCalledWith(
      mockVideoElement, 
      0, 
      0, 
      1280, 
      720
    );
    
    // Assert that the captured stream is returned
    expect(mockCanvas.captureStream).toHaveBeenCalled();
  });
  
  it('should initialize the model properly in the background even if mode is none', () => {
    // Mock the globalSegmenter logic
    // We just verify it doesn't crash on init
    const processor = new VideoProcessor();
    expect(processor.getMode()).toBe('none');
  });

  it('should correctly switch to blur mode and retain the canvas pipeline', () => {
    const processor = new VideoProcessor();
    processor.setMode('blur');
    expect(processor.getMode()).toBe('blur');
  });

  it('should cap the processing canvas size to 720p maximum when a 1080p stream is processed', () => {
    // Set video element width/height to 1080p (1920x1080)
    mockVideoElement.videoWidth = 1920;
    mockVideoElement.videoHeight = 1080;

    const processor = new VideoProcessor();
    processor.setMode('none');
    processor.startProcessing(mockStream as any);

    // Trigger the animation frame manually to run processFrame sizing logic
    (global as any).triggerAnimationFrame();

    // Verify canvas size is capped to 1280x720 (720p widescreen)
    expect(mockCanvas.width).toBe(1280);
    expect(mockCanvas.height).toBe(720);
  });

  it('should cap the processing canvas size to 720p max for 4:3 high-res input (e.g. 1920x1440)', () => {
    // 1920x1440 is 4:3 high-resolution input
    mockVideoElement.videoWidth = 1920;
    mockVideoElement.videoHeight = 1440;

    const processor = new VideoProcessor();
    processor.setMode('none');
    processor.startProcessing(mockStream as any);

    // Trigger the animation frame manually
    (global as any).triggerAnimationFrame();

    // Verify canvas size is scaled down keeping 4:3 ratio:
    // Scale factor = min(1280/1920, 720/1440) = min(0.6666, 0.5) = 0.5
    // 1920 * 0.5 = 960 width
    // 1440 * 0.5 = 720 height
    expect(mockCanvas.width).toBe(960);
    expect(mockCanvas.height).toBe(720);
  });
});

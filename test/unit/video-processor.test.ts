// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoProcessor } from '../../frontend/lib/video-processor';

// Mock mediapipe is not needed since we mock initModel

describe('VideoProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock initModel directly on prototype
    (VideoProcessor.prototype as any).initModel = vi.fn().mockImplementation(async function() {
      this.segmenter = {
        segmentForVideo: vi.fn((video, time, cb) => {
          cb({
            categoryMask: {
              width: 640,
              height: 480,
              getAsUint8Array: () => new Uint8Array(640 * 480).fill(1)
            }
          });
        })
      };
    });
    // Setup Canvas and Video mocks
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      drawImage: vi.fn(),
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      putImageData: vi.fn(),
      createImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(640 * 480 * 4).buffer }),
      globalCompositeOperation: ''
    } as any);

    (HTMLCanvasElement.prototype as any).captureStream = vi.fn().mockReturnValue({
      getVideoTracks: () => [{ kind: 'video' }]
    });

    HTMLVideoElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLVideoElement.prototype, 'readyState', { value: 2, writable: true });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { value: 640, writable: true });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { value: 480, writable: true });

    global.requestAnimationFrame = vi.fn().mockReturnValue(1);
    global.cancelAnimationFrame = vi.fn();

    global.MediaStream = class {
      private tracks: any[];
      constructor(tracks?: any[]) {
        this.tracks = tracks || [];
      }
      addTrack(track: any) {
        this.tracks.push(track);
      }
      getTracks() {
        return this.tracks;
      }
      getVideoTracks() {
        return this.tracks.filter(t => t.kind === 'video');
      }
      getAudioTracks() {
        return this.tracks.filter(t => t.kind === 'audio');
      }
    } as any;
  });

  it('initializes and sets mode properly', async () => {
    const processor = new VideoProcessor();
    await (processor as any).initModel();
    expect(processor.getMode()).toBe('none');
    
    processor.setMode('blur');
    expect(processor.getMode()).toBe('blur');
    
    processor.setMode('image', 'https://example.com/img.jpg');
    expect(processor.getMode()).toBe('image');
  });

  it('starts processing and returns a new stream', async () => {
    const processor = new VideoProcessor();
    await (processor as any).initModel();
    
    const mockTrack = { kind: 'video' };
    const mockAudioTrack = { kind: 'audio' };
    const mockStream = {
      getAudioTracks: () => [mockAudioTrack],
      getVideoTracks: () => [mockTrack],
      addTrack: vi.fn()
    } as any;

    const processedStream = processor.startProcessing(mockStream);
    
    expect(processedStream).toBeDefined();
    expect(HTMLVideoElement.prototype.play).toHaveBeenCalled();
  });

  it('triggers onDegraded on poor performance', async () => {
    console.log("Test 3: Start");
    const processor = new VideoProcessor();
    processor.setMode('blur');
    
    let degradedWarningCalled = 0;
    let degradedEmergencyCalled = 0;
    processor.onDegraded = (severity) => {
      if (severity === 'warning') degradedWarningCalled++;
      if (severity === 'emergency') degradedEmergencyCalled++;
    };

    const mockTrack = { kind: 'video' };
    const mockStream = new (global as any).MediaStream([mockTrack]);
    
    // Wait for model to load first
    console.log("Test 3: Awaiting initModel");
    await (processor as any).initModel();
    console.log("Test 3: initModel done");
    
    processor.startProcessing(mockStream);
    console.log("Test 3: startProcessing done");
    
    // The processor uses requestAnimationFrame, we will manually call the processFrame method
    // to simulate a slow render
    
    // Mock performance.now to simulate long processing times
    const originalPerformanceNow = global.performance.now;
    let time = 0;
    global.performance.now = vi.fn(() => {
      const current = time;
      time += 90; // Add 90ms every time now() is called, making processing time = 90ms (Warning threshold)
      return current;
    });

    console.log("Test 3: running processFrame warning loop");
    // Run processFrame enough times to trigger a warning (16 times)
    for (let i = 0; i < 17; i++) {
      (processor as any).processFrame();
    }
    console.log("Test 3: warning loop done");

    expect(degradedWarningCalled).toBe(1);
    expect(degradedEmergencyCalled).toBe(0);

    // Now test emergency (time > 120ms)
    time = 0;
    global.performance.now = vi.fn(() => {
      const current = time;
      time += 130; 
      return current;
    });

    for (let i = 0; i < 6; i++) {
      (processor as any).processFrame();
    }

    expect(degradedEmergencyCalled).toBe(1);

    global.performance.now = originalPerformanceNow;
    console.log("Test 3: End");
  });

  it('handles image background mode', async () => {
    const processor = new VideoProcessor();
    processor.setMode('image', 'https://example.com/bg.jpg');
    await (processor as any).initModel();

    const mockTrack = { kind: 'video' };
    const mockStream = new (global as any).MediaStream([mockTrack]);
    processor.startProcessing(mockStream);
    
    // Process frame with image background
    (processor as any).processFrame();
    
    // Mode should be image
    expect(processor.getMode()).toBe('image');
  });

  it('handles blur background mode', async () => {
    const processor = new VideoProcessor();
    processor.setMode('blur');
    await (processor as any).initModel();

    const mockTrack = { kind: 'video' };
    const mockStream = new (global as any).MediaStream([mockTrack]);
    processor.startProcessing(mockStream);
    
    // Process frame with blur background
    (processor as any).processFrame();
    
    // Mode should be blur
    expect(processor.getMode()).toBe('blur');
  });
});

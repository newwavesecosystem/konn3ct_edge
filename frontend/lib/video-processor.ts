import { ImageSegmenter, FilesetResolver } from '@mediapipe/tasks-vision';

export type VirtualBackgroundMode = 'none' | 'blur' | 'image';

let globalSegmenter: ImageSegmenter | null = null;
let globalVision: any = null;
let isInitializingModel = false;
let modelInitPromise: Promise<void> | null = null;

export class VideoProcessor {
  private mode: VirtualBackgroundMode = 'none';
  private imageUrl: string | null = null;
  private backgroundImage: HTMLImageElement | null = null;
  
  private segmenter: ImageSegmenter | null = null;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  
  private maskCanvas?: HTMLCanvasElement;
  private maskCtx?: CanvasRenderingContext2D;
  private maskImageData?: ImageData;
  
  private blurCanvas?: HTMLCanvasElement;
  private blurCtx?: CanvasRenderingContext2D;

  private rawStream: MediaStream | null = null;
  private processedStream: MediaStream | null = null;
  private videoElement: HTMLVideoElement;
  private animationFrameId: number = 0;
  private backgroundTimerId: any = null;
  private isProcessing: boolean = false;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 640;
    this.canvas.height = 480;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
    
    this.videoElement = document.createElement('video');
    this.videoElement.autoplay = true;
    this.videoElement.playsInline = true;
    this.videoElement.muted = true;

    this.initModel();
  }

  private async initModel() {
    if (globalSegmenter) {
      this.segmenter = globalSegmenter;
      return;
    }
    
    if (isInitializingModel && modelInitPromise) {
      await modelInitPromise;
      this.segmenter = globalSegmenter;
      return;
    }

    isInitializingModel = true;
    modelInitPromise = (async () => {
      try {
        globalVision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        globalSegmenter = await ImageSegmenter.createFromOptions(globalVision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          outputCategoryMask: true,
          outputConfidenceMasks: false
        });
        console.log("[VideoProcessor] Canvas 2D MediaPipe Engine Initialized Globally");
      } catch (e) {
        console.error("[VideoProcessor] Failed to initialize MediaPipe model:", e);
      } finally {
        isInitializingModel = false;
      }
    })();
    
    await modelInitPromise;
    this.segmenter = globalSegmenter;
  }

  public setMode(mode: VirtualBackgroundMode, imageUrl?: string) {
    this.mode = mode;
    this.imageUrl = imageUrl || null;
    
    if (mode === 'image' && imageUrl) {
      const img = new Image();
      img.onload = () => {
        this.backgroundImage = img;
      };
      img.src = imageUrl;
    } else {
      this.backgroundImage = null;
    }
  }

  public getMode() {
    return this.mode;
  }

  public startProcessing(rawStream: MediaStream): MediaStream {
    if (this.rawStream === rawStream && this.processedStream) {
      return this.processedStream;
    }

    this.rawStream = rawStream;
    this.videoElement.srcObject = rawStream;
    this.videoElement.play();

    // Fix aspect ratio distortion: set canvas size from stream settings BEFORE captureStream
    const track = rawStream.getVideoTracks()[0];
    if (track) {
      const settings = typeof track.getSettings === 'function' ? track.getSettings() : (track as any)._settings || {};
      if (settings.width && settings.height) {
        let targetWidth = settings.width;
        let targetHeight = settings.height;
        if (targetWidth > 1280 || targetHeight > 720) {
          const scale = Math.min(1280 / targetWidth, 720 / targetHeight);
          targetWidth = Math.round(targetWidth * scale);
          targetHeight = Math.round(targetHeight * scale);
        }
        this.canvas.width = targetWidth;
        this.canvas.height = targetHeight;
      }
    }

    // Use Canvas.captureStream to get the processed video track
    const processedVideoTrack = this.canvas.captureStream(30).getVideoTracks()[0];
    this.processedStream = new MediaStream([processedVideoTrack]);
    
    // Pass through audio tracks
    if (rawStream && typeof rawStream.getAudioTracks === 'function') {
      rawStream.getAudioTracks().forEach(track => {
        this.processedStream?.addTrack(track);
      });
    }

    this.isProcessing = true;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
    this.scheduleNextFrame();

    return this.processedStream;
  }

  private scheduleNextFrame = () => {
    if (!this.isProcessing || !this.rawStream) return;

    if (this.backgroundTimerId) {
      clearTimeout(this.backgroundTimerId);
      this.backgroundTimerId = null;
    }

    if (typeof document !== 'undefined' && document.hidden) {
      // Tab is backgrounded/minimized: requestAnimationFrame is paused by browsers,
      // so fallback to setTimeout (~30fps) to keep camera video streaming to remote participants.
      this.backgroundTimerId = setTimeout(this.processFrame, 33);
    } else if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      this.animationFrameId = requestAnimationFrame(this.processFrame);
    } else {
      this.backgroundTimerId = setTimeout(this.processFrame, 33);
    }
  };

  private handleVisibilityChange = () => {
    if (!this.isProcessing || !this.rawStream) return;

    if (this.backgroundTimerId) {
      clearTimeout(this.backgroundTimerId);
      this.backgroundTimerId = null;
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }

    this.processFrame();
  };

  public onDegraded?: (severity: 'warning' | 'emergency') => void;
  private warningFrameCount = 0;
  private emergencyFrameCount = 0;

  private processFrame = () => {
    if (!this.isProcessing || !this.rawStream) return;

    if (this.videoElement.readyState >= 2) {
      if (this.videoElement.videoWidth > 0) {
        let targetWidth = this.videoElement.videoWidth;
        let targetHeight = this.videoElement.videoHeight;
        
        // Cap dimensions to 720p max to protect CPU
        if (targetWidth > 1280 || targetHeight > 720) {
          const scale = Math.min(1280 / targetWidth, 720 / targetHeight);
          targetWidth = Math.round(targetWidth * scale);
          targetHeight = Math.round(targetHeight * scale);
        }
        
        if (this.canvas.width !== targetWidth) {
          this.canvas.width = targetWidth;
          this.canvas.height = targetHeight;
        }
      }
      
      const { width, height } = this.canvas;

      // Pass-through if mode is none OR if segmenter isn't loaded yet (fallback so we don't show a black screen)
      if (this.mode === 'none' || !this.segmenter) {
        this.ctx.drawImage(this.videoElement, 0, 0, width, height);
        this.scheduleNextFrame();
      } else {
        const startTimeMs = performance.now();
        this.segmenter.segmentForVideo(this.videoElement, startTimeMs, (result) => {
          const processTime = performance.now() - startTimeMs;
          
          if (processTime > 120) {
            this.emergencyFrameCount++;
            this.warningFrameCount++;
            if (this.emergencyFrameCount > 5) {
              console.warn("[VideoProcessor] Auto-degrading VB due to severe performance (emergency)");
              this.emergencyFrameCount = 0;
              this.warningFrameCount = 0;
              if (this.onDegraded) this.onDegraded('emergency');
            }
          } else if (processTime > 80) {
            this.warningFrameCount++;
            this.emergencyFrameCount = Math.max(0, this.emergencyFrameCount - 1);
            if (this.warningFrameCount > 15) {
              console.warn("[VideoProcessor] Auto-degrading VB due to poor performance (warning)");
              this.warningFrameCount = 0;
              if (this.onDegraded) this.onDegraded('warning');
            }
          } else {
            this.warningFrameCount = Math.max(0, this.warningFrameCount - 1);
            this.emergencyFrameCount = Math.max(0, this.emergencyFrameCount - 1);
          }

          this.ctx.save();
          this.ctx.clearRect(0, 0, width, height);

          // Apply mask
          if (result.categoryMask) {
            const mask = result.categoryMask;
            
            // Lazy initialize mask canvas
            if (!this.maskCanvas) {
              this.maskCanvas = document.createElement('canvas');
              this.maskCtx = this.maskCanvas.getContext('2d')!;
            }
            
            if (this.maskCanvas.width !== mask.width || this.maskCanvas.height !== mask.height) {
              this.maskCanvas.width = mask.width;
              this.maskCanvas.height = mask.height;
              this.maskImageData = this.maskCtx!.createImageData(mask.width, mask.height);
            }

            const maskArray = mask.getAsUint8Array(); 
            const data32 = new Uint32Array(this.maskImageData!.data.buffer);
            const len = maskArray.length;

            // Convert 1-channel mask to 4-channel ImageData using 32-bit writes for 4x performance
            for (let i = 0; i < len; i++) {
              // Write 0xFF000000 (Alpha 255) for background, 0x00000000 for person.
              // Assuming Little Endian (which practically all modern devices are).
              data32[i] = maskArray[i] === 0 ? 0xFF000000 : 0x00000000;
            }
            this.maskCtx!.putImageData(this.maskImageData!, 0, 0);

            // 1. Draw the person mask
            this.ctx.drawImage(this.maskCanvas, 0, 0, width, height);
            
            // 2. Draw the video ON TOP of the mask, keeping only pixels where mask exists
            this.ctx.globalCompositeOperation = 'source-in';
            this.ctx.drawImage(this.videoElement, 0, 0, width, height);

            // 3. Draw Background UNDERNEATH
            this.ctx.globalCompositeOperation = 'destination-over';
            if (this.mode === 'image' && this.backgroundImage) {
              this.ctx.drawImage(this.backgroundImage, 0, 0, width, height);
            } else if (this.mode === 'blur') {
              // Fast Blur Optimization: downscale 4x, blur 4px, upscale back
              if (!this.blurCanvas) {
                this.blurCanvas = document.createElement('canvas');
                this.blurCtx = this.blurCanvas.getContext('2d')!;
              }
              const bw = Math.max(1, Math.floor(width / 4));
              const bh = Math.max(1, Math.floor(height / 4));
              
              if (this.blurCanvas.width !== bw || this.blurCanvas.height !== bh) {
                this.blurCanvas.width = bw;
                this.blurCanvas.height = bh;
              }
              
              this.blurCtx!.filter = 'blur(4px)';
              this.blurCtx!.drawImage(this.videoElement, 0, 0, bw, bh);
              
              this.ctx.drawImage(this.blurCanvas, 0, 0, width, height);
            }
          } else {
             // Fallback if no mask
             this.ctx.drawImage(this.videoElement, 0, 0, width, height);
          }
          this.ctx.restore();
          
          if (this.isProcessing) {
            this.scheduleNextFrame();
          }
        });
      }
    } else {
      // If video isn't ready or segmenter isn't loaded yet, try again next frame
      this.scheduleNextFrame();
    }
  };

  public stopProcessing() {
    this.isProcessing = false;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }
    if (this.backgroundTimerId) {
      clearTimeout(this.backgroundTimerId);
      this.backgroundTimerId = null;
    }
    
    if (this.videoElement) {
      if (typeof this.videoElement.pause === 'function') this.videoElement.pause();
      this.videoElement.srcObject = null;
      if (typeof this.videoElement.removeAttribute === 'function') this.videoElement.removeAttribute('src');
      if (typeof this.videoElement.load === 'function') this.videoElement.load();
    }

    if (this.processedStream) {
      if (typeof this.processedStream.getTracks === 'function') {
        this.processedStream.getTracks().forEach(t => {
          if (typeof t.stop === 'function') t.stop();
          if (typeof this.processedStream?.removeTrack === 'function') {
            this.processedStream.removeTrack(t);
          }
        });
      }
    }
    
    // Recreate the canvas to prevent Chrome "ended track" bug on subsequent captureStream calls
    this.canvas = document.createElement('canvas');
    this.canvas.width = 640;
    this.canvas.height = 480;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
    
    this.rawStream = null;
    this.processedStream = null;
  }
}

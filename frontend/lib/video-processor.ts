import { ImageSegmenter, FilesetResolver } from '@mediapipe/tasks-vision';

export type VirtualBackgroundMode = 'none' | 'blur' | 'image';

export class VideoProcessor {
  private mode: VirtualBackgroundMode = 'none';
  private imageUrl: string | null = null;
  private backgroundImage: HTMLImageElement | null = null;
  
  private segmenter: ImageSegmenter | null = null;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  
  private rawStream: MediaStream | null = null;
  private processedStream: MediaStream | null = null;
  private videoElement: HTMLVideoElement;
  private animationFrameId: number = 0;
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
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );
      this.segmenter = await ImageSegmenter.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite",
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        outputCategoryMask: true,
        outputConfidenceMasks: false
      });
      console.log("[VideoProcessor] Canvas 2D MediaPipe Engine Initialized");
    } catch (e) {
      console.error("[VideoProcessor] Failed to initialize MediaPipe model:", e);
    }
  }

  public setMode(mode: VirtualBackgroundMode, imageUrl?: string) {
    this.mode = mode;
    this.imageUrl = imageUrl || null;
    
    if (mode === 'image' && imageUrl) {
      this.backgroundImage = new Image();
      this.backgroundImage.src = imageUrl;
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

    // Use Canvas.captureStream to get the processed video track
    const processedVideoTrack = this.canvas.captureStream(30).getVideoTracks()[0];
    this.processedStream = new MediaStream([processedVideoTrack]);
    
    // Pass through audio tracks
    rawStream.getAudioTracks().forEach(track => {
      this.processedStream?.addTrack(track);
    });

    this.isProcessing = true;
    this.processFrame();

    return this.processedStream;
  }

  private processFrame = () => {
    if (!this.isProcessing || !this.rawStream) return;

    if (this.videoElement.readyState >= 2 && this.segmenter) {
      const { width, height } = this.canvas;

      // Pass-through if mode is none
      if (this.mode === 'none') {
        this.ctx.drawImage(this.videoElement, 0, 0, width, height);
        this.animationFrameId = requestAnimationFrame(this.processFrame);
      } else {
        const startTimeMs = performance.now();
        this.segmenter.segmentForVideo(this.videoElement, startTimeMs, (result) => {
          this.ctx.save();
          this.ctx.clearRect(0, 0, width, height);

          // Draw the original video
          this.ctx.drawImage(this.videoElement, 0, 0, width, height);

          // Apply mask
          if (result.categoryMask) {
            const mask = result.categoryMask;
            const imageData = this.ctx.getImageData(0, 0, width, height);
            const data32 = new Uint32Array(imageData.data.buffer);
            const maskArray = mask.getAsUint8Array(); 

            // High-performance 32-bit pixel loop
            for (let i = 0; i < maskArray.length; i++) {
              if (maskArray[i] > 0) {
                data32[i] = 0; // Set background pixels to completely transparent (0x00000000)
              }
            }
            this.ctx.putImageData(imageData, 0, 0);

            // Draw Background underneath
            this.ctx.globalCompositeOperation = 'destination-over';
            if (this.mode === 'image' && this.backgroundImage) {
              this.ctx.drawImage(this.backgroundImage, 0, 0, width, height);
            } else if (this.mode === 'blur') {
              // Native canvas blur effect
              this.ctx.filter = 'blur(15px)';
              this.ctx.drawImage(this.videoElement, 0, 0, width, height);
              this.ctx.filter = 'none';
            }
          }
          this.ctx.restore();
          
          if (this.isProcessing) {
            this.animationFrameId = requestAnimationFrame(this.processFrame);
          }
        });
      }
    } else {
      // If video isn't ready or segmenter isn't loaded yet, try again next frame
      this.animationFrameId = requestAnimationFrame(this.processFrame);
    }
  };

  public stopProcessing() {
    this.isProcessing = false;
    cancelAnimationFrame(this.animationFrameId);
    
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.srcObject = null;
    }

    if (this.processedStream) {
      this.processedStream.getTracks().forEach(t => t.stop());
    }
    
    this.rawStream = null;
    this.processedStream = null;
  }
}

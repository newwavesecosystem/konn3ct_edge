import { ImageSegmenter, FilesetResolver } from '@mediapipe/tasks-vision';

export type VirtualBackgroundMode = 'none' | 'blur' | 'image';

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

    if (this.videoElement.readyState >= 2) {
      if (this.videoElement.videoWidth > 0 && this.canvas.width !== this.videoElement.videoWidth) {
        this.canvas.width = this.videoElement.videoWidth;
        this.canvas.height = this.videoElement.videoHeight;
      }
      
      const { width, height } = this.canvas;

      // Pass-through if mode is none OR if segmenter isn't loaded yet (fallback so we don't show a black screen)
      if (this.mode === 'none' || !this.segmenter) {
        this.ctx.drawImage(this.videoElement, 0, 0, width, height);
        this.animationFrameId = requestAnimationFrame(this.processFrame);
      } else {
        const startTimeMs = performance.now();
        this.segmenter.segmentForVideo(this.videoElement, startTimeMs, (result) => {
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
              this.maskImageData = this.maskCtx.createImageData(mask.width, mask.height);
            }

            const maskArray = mask.getAsUint8Array(); 
            const data = this.maskImageData!.data;

            // Convert 1-channel mask to 4-channel ImageData (Alpha channel for destination-in)
            for (let i = 0; i < maskArray.length; i++) {
              // Selfie segmenter usually outputs >0 for person, 0 for background
              const alpha = maskArray[i] === 0 ? 0 : 255;
              data[i * 4 + 3] = alpha; 
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
              this.ctx.filter = 'blur(15px)';
              this.ctx.drawImage(this.videoElement, 0, 0, width, height);
              this.ctx.filter = 'none';
            }
          } else {
             // Fallback if no mask
             this.ctx.drawImage(this.videoElement, 0, 0, width, height);
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

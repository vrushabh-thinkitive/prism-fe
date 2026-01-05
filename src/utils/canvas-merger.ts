export type WebcamPosition = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function webcamPositionToApiFormat(position: WebcamPosition): number {
  const { x, y } = position;

  // Map webcam positions to API format:
  // Top-left: 0
  // Top-right: 25
  // Bottom-left: 50
  // Bottom-right: 100

  if (x < 50 && y < 50) {
    return 0; // Top-left
  } else if (x >= 50 && y < 50) {
    return 25; // Top-right
  } else if (x < 50 && y >= 50) {
    return 50; // Bottom-left (FIXED: was returning 25)
  } else {
    return 100; // Bottom-right
  }
}

export type CanvasMergerOptions = {
  width: number;
  height: number;
  webcamPosition?: WebcamPosition;
  webcamBorderRadius?: number;
  webcamBorderWidth?: number;
  webcamBorderColor?: string;
};

export class CanvasMerger {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private screenVideo: HTMLVideoElement;
  private webcamVideo: HTMLVideoElement | null = null;
  private timeoutId: NodeJS.Timeout | null = null;
  private options: CanvasMergerOptions;
  private isDrawing: boolean = false;
  private readonly FPS = 30; // Target frames per second
  private readonly FRAME_INTERVAL = 1000 / 30; // ~33ms per frame

  constructor(options: CanvasMergerOptions) {
    this.options = {
      webcamPosition: { x: 80, y: 5, width: 18, height: 24 }, // Top-right corner by default
      webcamBorderRadius: 8,
      webcamBorderWidth: 3,
      webcamBorderColor: "#ffffff",
      ...options,
    };

    // Create canvas
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.options.width;
    this.canvas.height = this.options.height;
    this.ctx = this.canvas.getContext("2d", { alpha: false })!;

    // Create video elements for streams
    this.screenVideo = document.createElement("video");
    this.screenVideo.autoplay = true;
    this.screenVideo.playsInline = true;
    this.screenVideo.muted = true;
    // Ensure video continues playing even when tab is hidden
    this.screenVideo.setAttribute("playsinline", "true");
    this.screenVideo.setAttribute("webkit-playsinline", "true");

    this.webcamVideo = document.createElement("video");
    this.webcamVideo.autoplay = true;
    this.webcamVideo.playsInline = true;
    this.webcamVideo.muted = true;
    // Ensure video continues playing even when tab is hidden
    this.webcamVideo.setAttribute("playsinline", "true");
    this.webcamVideo.setAttribute("webkit-playsinline", "true");
  }

  /**
   * Set screen stream
   */
  setScreenStream(stream: MediaStream): void {
    this.screenVideo.srcObject = stream;
    this.screenVideo.onloadedmetadata = async () => {
      try {
        // Ensure video plays - it will continue providing frames even when tab is hidden
        await this.screenVideo.play();
        this.startDrawing();
      } catch (error) {
        console.error("Failed to play screen video:", error);
        // Start drawing anyway - MediaStream frames are still available
        this.startDrawing();
      }
    };
  }

  /**
   * Set webcam stream
   */
  setWebcamStream(stream: MediaStream | null): void {
    if (!this.webcamVideo) return;

    if (stream) {
      this.webcamVideo.srcObject = stream;
      this.webcamVideo.onloadedmetadata = async () => {
        try {
          // Ensure video plays - it will continue providing frames even when tab is hidden
          await this.webcamVideo!.play();
          if (!this.isDrawing) {
            this.startDrawing();
          }
        } catch (error) {
          console.error("Failed to play webcam video:", error);
          // Start drawing anyway - MediaStream frames are still available
          if (!this.isDrawing) {
            this.startDrawing();
          }
        }
      };
    } else {
      this.webcamVideo.srcObject = null;
    }
  }

  /**
   * Update webcam position
   */
  setWebcamPosition(position: WebcamPosition): void {
    if (this.options.webcamPosition) {
      this.options.webcamPosition = position;
    }
  }

  /**
   * Start drawing frames to canvas
   */
  private startDrawing(): void {
    if (this.isDrawing) return;
    this.isDrawing = true;
    this.draw();
  }

  /**
   * Draw frame
   */
  private draw(): void {
    if (!this.isDrawing) return;

    const { width, height } = this.canvas;

    // Always clear canvas first
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 0, width, height);

    // Draw screen (background)
    if (
      this.screenVideo.readyState >= 2 &&
      this.screenVideo.videoWidth > 0 &&
      this.screenVideo.videoHeight > 0 &&
      this.screenVideo.srcObject
    ) {
      // Calculate aspect ratio and center
      const screenAspect =
        this.screenVideo.videoWidth / this.screenVideo.videoHeight;
      const canvasAspect = width / height;

      let drawWidth = width;
      let drawHeight = height;
      let offsetX = 0;
      let offsetY = 0;

      if (screenAspect > canvasAspect) {
        // Screen is wider - fit to height
        drawHeight = height;
        drawWidth = height * screenAspect;
        offsetX = (width - drawWidth) / 2;
      } else {
        // Screen is taller - fit to width
        drawWidth = width;
        drawHeight = width / screenAspect;
        offsetY = (height - drawHeight) / 2;
      }

      // Draw screen video
      this.ctx.drawImage(
        this.screenVideo,
        offsetX,
        offsetY,
        drawWidth,
        drawHeight
      );
    }

    // Draw webcam overlay (Picture-in-Picture)
    if (
      this.webcamVideo &&
      this.webcamVideo.srcObject &&
      this.webcamVideo.readyState >= 2 &&
      this.webcamVideo.videoWidth > 0 &&
      this.webcamVideo.videoHeight > 0 &&
      this.options.webcamPosition
    ) {
      const pos = this.options.webcamPosition;
      const webcamWidth = (width * pos.width) / 100;
      const webcamHeight = (height * pos.height) / 100;
      const webcamX = (width * pos.x) / 100;
      const webcamY = (height * pos.y) / 100;

      // For circular webcam, use the smaller dimension as diameter
      const webcamSize = Math.min(webcamWidth, webcamHeight);
      const radius = webcamSize / 2;

      // Center the circle within the position bounds
      const centerX = webcamX + webcamWidth / 2;
      const centerY = webcamY + webcamHeight / 2;

      // Calculate square bounds for drawing the video (to fill the circle)
      const drawWebcamSize = webcamSize;
      const drawWebcamX = centerX - radius;
      const drawWebcamY = centerY - radius;

      // Draw border/background circle for webcam
      const borderWidth = this.options.webcamBorderWidth || 3;
      const borderColor = this.options.webcamBorderColor || "#ffffff";

      // Draw border circle
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, radius + borderWidth, 0, 2 * Math.PI);
      this.ctx.fillStyle = borderColor;
      this.ctx.fill();

      // Clip to circle
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      this.ctx.clip();

      // Draw webcam video (square to fill the circle)
      this.ctx.drawImage(
        this.webcamVideo,
        drawWebcamX,
        drawWebcamY,
        drawWebcamSize,
        drawWebcamSize
      );

      this.ctx.restore();
    }

    // Continue drawing loop using setTimeout instead of requestAnimationFrame
    // This ensures continuous drawing even when tab is in background
    // requestAnimationFrame is throttled/paused when tab is hidden, but setTimeout continues
    this.timeoutId = setTimeout(() => this.draw(), this.FRAME_INTERVAL);
  }

  /**
   * Stop drawing
   */
  stopDrawing(): void {
    this.isDrawing = false;
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  /**
   * Get canvas stream for recording
   */
  getStream(): MediaStream {
    // Ensure drawing has started
    if (!this.isDrawing) {
      this.startDrawing();
    }
    return this.canvas.captureStream(30); // 30 FPS
  }

  /**
   * Check if streams are ready
   */
  areStreamsReady(): boolean {
    const screenReady =
      this.screenVideo.readyState >= 2 &&
      this.screenVideo.videoWidth > 0 &&
      this.screenVideo.videoHeight > 0 &&
      this.screenVideo.srcObject !== null;

    const webcamReady =
      !this.webcamVideo ||
      !this.webcamVideo.srcObject ||
      (this.webcamVideo.readyState >= 2 &&
        this.webcamVideo.videoWidth > 0 &&
        this.webcamVideo.videoHeight > 0);

    return screenReady && webcamReady;
  }

  /**
   * Get canvas element (for preview)
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Update canvas size
   */
  setSize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.options.width = width;
    this.options.height = height;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stopDrawing();

    if (this.screenVideo.srcObject) {
      const stream = this.screenVideo.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      this.screenVideo.srcObject = null;
    }

    if (this.webcamVideo && this.webcamVideo.srcObject) {
      const stream = this.webcamVideo.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      this.webcamVideo.srcObject = null;
    }
  }
}

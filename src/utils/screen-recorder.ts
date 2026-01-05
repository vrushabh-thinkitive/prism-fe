/**
 * Screen Recorder Utility
 * Handles screen recording using MediaRecorder API with optional webcam overlay
 */

import { CanvasMerger, type WebcamPosition } from "./canvas-merger";

export type RecordingState =
  | "idle"
  | "recording"
  | "paused"
  | "stopped"
  | "error";

export type RecordingOptions = {
  mimeType?: string;
  videoBitsPerSecond?: number;
  audioBitsPerSecond?: number;
  timeslice?: number; // Milliseconds between dataavailable events
  enableWebcam?: boolean; // Enable webcam overlay
  webcamPosition?: WebcamPosition; // Webcam position on canvas
  enableMicrophone?: boolean; // Enable microphone audio
  countdownDuration?: number; // Countdown duration in seconds (default: 3)
};

export type RecordingEventCallbacks = {
  onStateChange?: (state: RecordingState) => void;
  onDataAvailable?: (chunk: Blob) => void;
  onError?: (error: Error) => void;
  onDurationUpdate?: (duration: number) => void;
  onScreenShareStopped?: () => void;
  onWebcamDisconnected?: () => void;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void; // For preview
  onMicrophoneDisconnected?: () => void;
  onMicrophoneLevelUpdate?: (level: number) => void; // 0-100
  onScreenSelected?: () => void; // Called after user selects screen and clicks share
};

export class ScreenRecorder {
  private stream: MediaStream | null = null;
  private webcamStream: MediaStream | null = null;
  private microphoneStream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private screenRecorder: MediaRecorder | null = null; // Separate recorder for screen
  private webcamRecorder: MediaRecorder | null = null; // Separate recorder for webcam
  private chunks: Blob[] = [];
  private screenChunks: Blob[] = []; // Separate chunks for screen
  private webcamChunks: Blob[] = []; // Separate chunks for webcam
  private state: RecordingState = "idle";
  private startTime: number = 0;
  private pausedTime: number = 0;
  private totalPausedDuration: number = 0;
  private durationInterval: NodeJS.Timeout | null = null;
  private callbacks: RecordingEventCallbacks = {};
  private preferredMimeType: string | null = null;
  private canvasMerger: CanvasMerger | null = null;
  private enableWebcam: boolean = false;
  private enableMicrophone: boolean = false;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphoneTrack: MediaStreamTrack | null = null;
  private micLevelInterval: NodeJS.Timeout | null = null;
  private countdownAborted: boolean = false;
  private countdownResolve: ((value: void) => void) | null = null;
  private countdownReject: ((reason?: any) => void) | null = null;

  constructor(callbacks?: RecordingEventCallbacks) {
    this.callbacks = callbacks || {};
    this.detectPreferredMimeType();
  }

  /**
   * Detect the best supported MIME type
   */
  private detectPreferredMimeType(): void {
    const possibleTypes = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/webm;codecs=h264",
    ];

    for (const type of possibleTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        this.preferredMimeType = type;
        break;
      }
    }
  }

  /**
   * Get current recording state
   */
  getState(): RecordingState {
    return this.state;
  }

  /**
   * Get current recording duration in seconds
   */
  getDuration(): number {
    if (this.state === "idle" || this.state === "stopped") {
      return 0;
    }

    if (this.state === "paused") {
      return (
        (this.pausedTime - this.startTime - this.totalPausedDuration) / 1000
      );
    }

    const now = Date.now();
    return (now - this.startTime - this.totalPausedDuration) / 1000;
  }

  /**
   * Get the recorded blob (only available after stop)
   * Returns merged blob for backward compatibility
   */
  getBlob(): Blob | null {
    if (this.chunks.length === 0) {
      return null;
    }
    return new Blob(this.chunks, {
      type: this.preferredMimeType || "video/webm",
    });
  }

  /**
   * Get the screen recording blob (only available after stop)
   */
  getScreenBlob(): Blob | null {
    if (this.screenChunks.length === 0) {
      return null;
    }
    return new Blob(this.screenChunks, {
      type: this.preferredMimeType || "video/webm",
    });
  }

  /**
   * Get the webcam recording blob (only available after stop)
   */
  getWebcamBlob(): Blob | null {
    if (this.webcamChunks.length === 0) {
      return null;
    }
    return new Blob(this.webcamChunks, {
      type: this.preferredMimeType || "video/webm",
    });
  }

  /**
   * Get the size of recorded data in bytes
   */
  getSize(): number {
    return this.chunks.reduce((total, chunk) => total + chunk.size, 0);
  }

  /**
   * Get the size of screen recording in bytes
   */
  getScreenSize(): number {
    return this.screenChunks.reduce((total, chunk) => total + chunk.size, 0);
  }

  /**
   * Get the size of webcam recording in bytes
   */
  getWebcamSize(): number {
    return this.webcamChunks.reduce((total, chunk) => total + chunk.size, 0);
  }

  /**
   * Start recording
   */
  async start(options?: RecordingOptions): Promise<void> {
    if (this.state === "recording") {
      throw new Error("Recording is already in progress");
    }

    if (this.state === "paused") {
      // Resume instead of starting new
      this.resume();
      return;
    }

    try {
      // Request screen capture
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error("Screen capture API is not available");
      }

      const screenOptions: MediaStreamConstraints = {
        video: {
          displaySurface: "browser" as DisplayCaptureSurfaceType,
          width: { ideal: 1280, max: 1280 }, // Cap at 720p width
          height: { ideal: 720, max: 720 }, // Cap at 720p height
          frameRate: { ideal: 30, max: 30 }, // Cap at 30 FPS
        } as MediaTrackConstraints,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        } as MediaTrackConstraints, // Request system audio
      };

      const screenStream = await navigator.mediaDevices.getDisplayMedia(
        screenOptions
      );

      // Notify that screen has been selected and shared
      // This will trigger countdown timer in UI
      this.callbacks.onScreenSelected?.();

      // Wait for countdown to complete before starting actual recording
      // This can be aborted if user cancels
      this.countdownAborted = false;
      const countdownDuration = (options?.countdownDuration || 3) * 1000; // Convert to milliseconds

      let countdownTimeout: NodeJS.Timeout | null = null;
      let countdownReject: ((reason?: any) => void) | null = null;

      try {
        await new Promise<void>((resolve, reject) => {
          this.countdownReject = reject;
          this.countdownResolve = resolve;
          countdownTimeout = setTimeout(() => {
            if (!this.countdownAborted) {
              resolve();
            } else {
              reject(new Error("Countdown cancelled by user"));
            }
          }, countdownDuration);
        });
      } catch (error) {
        // Countdown was cancelled or aborted
        if (countdownTimeout) {
          clearTimeout(countdownTimeout);
        }
        // Clean up screen stream
        screenStream.getTracks().forEach((track) => track.stop());
        // Reset state
        this.setState("idle");
        this.countdownResolve = null;
        this.countdownReject = null;
        throw error;
      } finally {
        // Clean up
        this.countdownResolve = null;
        this.countdownReject = null;
        if (countdownTimeout) {
          clearTimeout(countdownTimeout);
        }
      }

      // Check if countdown was aborted (double check)
      if (this.countdownAborted) {
        // Clean up screen stream
        screenStream.getTracks().forEach((track) => track.stop());
        this.setState("idle");
        throw new Error("Recording cancelled during countdown");
      }

      // Handle screen share stop event
      const videoTrack = screenStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          this.handleScreenShareStopped();
        };
      }

      // Get screen dimensions for canvas (capped at 720p)
      const screenWidth = Math.min(
        videoTrack?.getSettings().width || 1920,
        1280
      );
      const screenHeight = Math.min(
        videoTrack?.getSettings().height || 1080,
        720
      );

      // Check if webcam is enabled
      this.enableWebcam = options?.enableWebcam || false;
      this.enableMicrophone = options?.enableMicrophone || false;
      let recordingStream: MediaStream = screenStream;

      // Request microphone stream if enabled
      if (this.enableMicrophone) {
        try {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("Microphone API is not available");
          }

          this.microphoneStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });

          // Handle microphone disconnect
          this.microphoneTrack = this.microphoneStream.getAudioTracks()[0];
          if (this.microphoneTrack) {
            this.microphoneTrack.onended = () => {
              this.handleMicrophoneDisconnected();
            };
          }

          // Setup audio level monitoring
          this.setupMicrophoneLevelMonitoring();
        } catch (micError) {
          console.warn(
            "Microphone not available, recording without audio:",
            micError
          );
          this.enableMicrophone = false;
          if (this.microphoneStream) {
            this.microphoneStream.getTracks().forEach((track) => track.stop());
            this.microphoneStream = null;
          }
        }
      }

      // If webcam is enabled, set up canvas merger
      if (this.enableWebcam) {
        try {
          // Request webcam stream
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("Webcam API is not available");
          }

          this.webcamStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 640, max: 640 }, // VGA for overlay
              height: { ideal: 480, max: 480 }, // VGA for overlay
              frameRate: { ideal: 30, max: 30 }, // Cap at 30 FPS
            },
            audio: false,
          });

          // Handle webcam disconnect
          const webcamTrack = this.webcamStream.getVideoTracks()[0];
          if (webcamTrack) {
            webcamTrack.onended = () => {
              this.handleWebcamDisconnected();
            };
          }

          // Create canvas merger
          this.canvasMerger = new CanvasMerger({
            width: screenWidth,
            height: screenHeight,
            webcamPosition: options?.webcamPosition,
          });

          // Set streams
          this.canvasMerger.setScreenStream(screenStream);
          this.canvasMerger.setWebcamStream(this.webcamStream);

          // Wait for video elements to be ready and drawing to start
          let attempts = 0;
          while (!this.canvasMerger.areStreamsReady() && attempts < 50) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            attempts++;
          }

          if (!this.canvasMerger.areStreamsReady()) {
            throw new Error("Video streams not ready for canvas recording");
          }

          // Get canvas stream for recording
          recordingStream = this.canvasMerger.getStream();

          // Notify canvas is ready for preview
          const canvas = this.canvasMerger.getCanvas();
          this.callbacks.onCanvasReady?.(canvas);
        } catch (webcamError) {
          // If webcam fails, continue with screen only
          console.warn(
            "Webcam not available, recording screen only:",
            webcamError
          );
          this.enableWebcam = false;
          if (this.webcamStream) {
            this.webcamStream.getTracks().forEach((track) => track.stop());
            this.webcamStream = null;
          }
        }
      }

      // Add microphone audio to recording stream if available
      if (this.enableMicrophone && this.microphoneStream) {
        const audioTracks = this.microphoneStream.getAudioTracks();
        audioTracks.forEach((track) => {
          recordingStream.addTrack(track);
        });
      }

      // Store the original screen stream
      this.stream = screenStream;

      // Setup MediaRecorder options
      const recorderOptions: MediaRecorderOptions = {
        mimeType: options?.mimeType || this.preferredMimeType || undefined,
        videoBitsPerSecond: options?.videoBitsPerSecond || 1200000, // 1.2 Mbps for 720p@30fps
        audioBitsPerSecond:
          options?.audioBitsPerSecond ||
          (this.enableMicrophone ? 128000 : undefined), // 128 kbps
      };

      // Create MediaRecorder with merged stream (or screen stream if no webcam) for preview
      this.recorder = new MediaRecorder(recordingStream, recorderOptions);

      // Setup event handlers for merged recorder (for preview)
      this.recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          this.chunks.push(event.data);
          this.callbacks.onDataAvailable?.(event.data);
        }
      };

      this.recorder.onstop = () => {
        this.handleStop();
      };

      this.recorder.onerror = (event: Event) => {
        const error = new Error("MediaRecorder error occurred");
        this.handleError(error);
      };

      // Create separate screen recorder (screen + system audio if available)
      const screenStreamWithAudio = new MediaStream();
      screenStream.getVideoTracks().forEach(track => screenStreamWithAudio.addTrack(track));
      // Try to get system audio from screen stream
      screenStream.getAudioTracks().forEach(track => screenStreamWithAudio.addTrack(track));
      
      this.screenRecorder = new MediaRecorder(screenStreamWithAudio, recorderOptions);
      this.screenRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          this.screenChunks.push(event.data);
        }
      };
      this.screenRecorder.onerror = (event: Event) => {
        console.error("Screen recorder error:", event);
      };

      // Create separate webcam recorder (webcam + mic audio)
      if (this.webcamStream) {
        const webcamStreamWithAudio = new MediaStream();
        this.webcamStream.getVideoTracks().forEach(track => webcamStreamWithAudio.addTrack(track));
        if (this.microphoneStream) {
          this.microphoneStream.getAudioTracks().forEach(track => webcamStreamWithAudio.addTrack(track));
        }
        
        this.webcamRecorder = new MediaRecorder(webcamStreamWithAudio, recorderOptions);
        this.webcamRecorder.ondataavailable = (event: BlobEvent) => {
          if (event.data && event.data.size > 0) {
            this.webcamChunks.push(event.data);
          }
        };
        this.webcamRecorder.onerror = (event: Event) => {
          console.error("Webcam recorder error:", event);
        };
      }

      // Start all recorders
      const timeslice = options?.timeslice || 1000; // Collect data every 1 second
      this.recorder.start(timeslice);
      this.screenRecorder.start(timeslice);
      if (this.webcamRecorder) {
        this.webcamRecorder.start(timeslice);
      }

      // Update state
      this.startTime = Date.now();
      this.totalPausedDuration = 0;
      this.chunks = []; // Reset chunks for new recording
      this.screenChunks = []; // Reset screen chunks
      this.webcamChunks = []; // Reset webcam chunks
      this.setState("recording");

      // Start duration tracking
      this.startDurationTracking();
    } catch (error) {
      const err = error as Error;
      this.handleError(err);
      throw err;
    }
  }

  /**
   * Stop recording
   */
  stop(): Blob | null {
    if (this.state === "idle" || this.state === "stopped") {
      return null;
    }

    try {
      // Stop all MediaRecorders
      if (this.recorder && this.recorder.state !== "inactive") {
        this.recorder.stop();
      }

      if (this.screenRecorder && this.screenRecorder.state !== "inactive") {
        this.screenRecorder.stop();
      }

      if (this.webcamRecorder && this.webcamRecorder.state !== "inactive") {
        this.webcamRecorder.stop();
      }

      // Stop canvas drawing
      if (this.canvasMerger) {
        this.canvasMerger.stopDrawing();
      }

      // Stop all tracks
      if (this.stream) {
        this.stream.getTracks().forEach((track) => {
          track.stop();
        });
        this.stream = null;
      }

      if (this.webcamStream) {
        this.webcamStream.getTracks().forEach((track) => {
          track.stop();
        });
        this.webcamStream = null;
      }

      if (this.microphoneStream) {
        this.microphoneStream.getTracks().forEach((track) => {
          track.stop();
        });
        this.microphoneStream = null;
      }

      this.stopMicrophoneLevelMonitoring();

      // Stop duration tracking
      this.stopDurationTracking();

      // State will be updated in handleStop()
      return this.getBlob();
    } catch (error) {
      const err = error as Error;
      this.handleError(err);
      return null;
    }
  }

  /**
   * Pause recording
   */
  pause(): void {
    if (this.state !== "recording") {
      return;
    }

    try {
      if (this.recorder && this.recorder.state === "recording") {
        this.recorder.pause();
        this.pausedTime = Date.now();
        this.setState("paused");
        this.stopDurationTracking();
      }
    } catch (error) {
      const err = error as Error;
      this.handleError(err);
    }
  }

  /**
   * Resume recording
   */
  resume(): void {
    if (this.state !== "paused") {
      return;
    }

    try {
      if (this.recorder && this.recorder.state === "paused") {
        const pausedDuration = Date.now() - this.pausedTime;
        this.totalPausedDuration += pausedDuration;
        this.recorder.resume();
        this.setState("recording");
        this.startDurationTracking();
      }
    } catch (error) {
      const err = error as Error;
      this.handleError(err);
    }
  }

  /**
   * Handle screen share stopped by user
   */
  private handleScreenShareStopped(): void {
    if (this.state === "recording" || this.state === "paused") {
      // Automatically stop recording if user stops screen sharing
      this.stop();
      this.callbacks.onScreenShareStopped?.();
    }
  }

  /**
   * Handle webcam disconnect
   */
  private handleWebcamDisconnected(): void {
    if (this.state === "recording" || this.state === "paused") {
      // Continue recording without webcam
      if (this.canvasMerger) {
        this.canvasMerger.setWebcamStream(null);
      }
      this.webcamStream = null;
      this.enableWebcam = false;
      this.callbacks.onWebcamDisconnected?.();
    }
  }

  /**
   * Update webcam position (only works if webcam is enabled)
   */
  updateWebcamPosition(position: WebcamPosition): void {
    if (this.canvasMerger) {
      this.canvasMerger.setWebcamPosition(position);
    }
  }

  /**
   * Get canvas element for preview (if webcam is enabled)
   */
  getCanvas(): HTMLCanvasElement | null {
    return this.canvasMerger?.getCanvas() || null;
  }

  /**
   * Check if webcam is enabled
   */
  isWebcamEnabled(): boolean {
    return this.enableWebcam && this.webcamStream !== null;
  }

  /**
   * Handle microphone disconnect
   */
  private handleMicrophoneDisconnected(): void {
    if (this.state === "recording" || this.state === "paused") {
      this.microphoneStream = null;
      this.enableMicrophone = false;
      this.stopMicrophoneLevelMonitoring();
      this.callbacks.onMicrophoneDisconnected?.();
    }
  }

  /**
   * Setup microphone level monitoring
   */
  private setupMicrophoneLevelMonitoring(): void {
    if (!this.microphoneStream) return;

    try {
      this.audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(
        this.microphoneStream
      );
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      const updateLevel = () => {
        if (
          !this.analyser ||
          this.state === "idle" ||
          this.state === "stopped"
        ) {
          return;
        }

        this.analyser.getByteFrequencyData(dataArray);
        const average =
          dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        const level = Math.min(100, (average / 255) * 100);
        this.callbacks.onMicrophoneLevelUpdate?.(level);
      };

      this.micLevelInterval = setInterval(updateLevel, 100); // Update every 100ms
    } catch (error) {
      console.warn("Failed to setup microphone level monitoring:", error);
    }
  }

  /**
   * Stop microphone level monitoring
   */
  private stopMicrophoneLevelMonitoring(): void {
    if (this.micLevelInterval) {
      clearInterval(this.micLevelInterval);
      this.micLevelInterval = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
  }

  /**
   * Mute/unmute microphone
   */
  muteMicrophone(muted: boolean): void {
    if (this.microphoneTrack) {
      this.microphoneTrack.enabled = !muted;
    }
  }

  /**
   * Check if microphone is enabled
   */
  isMicrophoneEnabled(): boolean {
    return this.enableMicrophone && this.microphoneStream !== null;
  }

  /**
   * Abort countdown and cancel recording start
   */
  abortCountdown(): void {
    this.countdownAborted = true;
    if (this.countdownReject) {
      // Reject the promise to stop recording start
      this.countdownReject(new Error("Countdown cancelled by user"));
      this.countdownReject = null;
      this.countdownResolve = null;
    }
  }

  /**
   * Handle stop event
   */
  private handleStop(): void {
    this.setState("stopped");
    this.stopDurationTracking();
  }

  /**
   * Handle errors
   */
  private handleError(error: Error): void {
    this.setState("error");
    this.stopDurationTracking();

    // Cleanup
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.webcamStream) {
      this.webcamStream.getTracks().forEach((track) => track.stop());
      this.webcamStream = null;
    }

    if (this.microphoneStream) {
      this.microphoneStream.getTracks().forEach((track) => track.stop());
      this.microphoneStream = null;
    }

    this.stopMicrophoneLevelMonitoring();

    if (this.canvasMerger) {
      this.canvasMerger.cleanup();
      this.canvasMerger = null;
    }

    this.callbacks.onError?.(error);
  }

  /**
   * Update state and notify callbacks
   */
  private setState(newState: RecordingState): void {
    this.state = newState;
    this.callbacks.onStateChange?.(newState);
  }

  /**
   * Start duration tracking
   */
  private startDurationTracking(): void {
    this.stopDurationTracking(); // Clear any existing interval

    this.durationInterval = setInterval(() => {
      const duration = this.getDuration();
      this.callbacks.onDurationUpdate?.(duration);
    }, 100); // Update every 100ms
  }

  /**
   * Stop duration tracking
   */
  private stopDurationTracking(): void {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stopDurationTracking();

    if (this.recorder && this.recorder.state !== "inactive") {
      this.recorder.stop();
    }

    if (this.canvasMerger) {
      this.canvasMerger.cleanup();
      this.canvasMerger = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
    }

    if (this.webcamStream) {
      this.webcamStream.getTracks().forEach((track) => track.stop());
    }

    if (this.microphoneStream) {
      this.microphoneStream.getTracks().forEach((track) => track.stop());
    }

    this.stopMicrophoneLevelMonitoring();

    this.chunks = [];
    this.screenChunks = [];
    this.webcamChunks = [];
    this.stream = null;
    this.webcamStream = null;
    this.microphoneStream = null;
    this.recorder = null;
    this.screenRecorder = null;
    this.webcamRecorder = null;
    this.state = "idle";
    this.enableWebcam = false;
    this.enableMicrophone = false;
  }
}


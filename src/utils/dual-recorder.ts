/**
 * Dual Recorder Utility
 * Records screen and webcam separately using two MediaRecorder instances
 * - Screen: getDisplayMedia (with system audio if allowed)
 * - Webcam: getUserMedia (video + mic audio)
 * - NO combining/merging in browser - backend handles merge
 */

export type DualRecordingState =
  | "idle"
  | "recording"
  | "paused"
  | "stopped"
  | "error";

export type DualRecordingOptions = {
  mimeType?: string;
  videoBitsPerSecond?: number;
  audioBitsPerSecond?: number;
  timeslice?: number; // Milliseconds between dataavailable events
  countdownDuration?: number; // Countdown duration in seconds (default: 3)
};

export type DualRecordingEventCallbacks = {
  onStateChange?: (state: DualRecordingState) => void;
  onScreenDataAvailable?: (chunk: Blob) => void;
  onWebcamDataAvailable?: (chunk: Blob) => void;
  onError?: (error: Error) => void;
  onDurationUpdate?: (duration: number) => void;
  onScreenShareStopped?: () => void;
  onWebcamDisconnected?: () => void;
  onMicrophoneDisconnected?: () => void;
  onScreenSelected?: () => void; // Called after user selects screen and clicks share
};

export class DualRecorder {
  private screenStream: MediaStream | null = null;
  private webcamStream: MediaStream | null = null;
  private screenRecorder: MediaRecorder | null = null;
  private webcamRecorder: MediaRecorder | null = null;
  private screenChunks: Blob[] = [];
  private webcamChunks: Blob[] = [];
  private state: DualRecordingState = "idle";
  private startTime: number = 0;
  private pausedTime: number = 0;
  private totalPausedDuration: number = 0;
  private durationInterval: NodeJS.Timeout | null = null;
  private callbacks: DualRecordingEventCallbacks = {};
  private preferredMimeType: string | null = null;
  private countdownAborted: boolean = false;
  private countdownReject: ((reason?: any) => void) | null = null;

  constructor(callbacks?: DualRecordingEventCallbacks) {
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
  getState(): DualRecordingState {
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
   * Get the recorded screen blob (only available after stop)
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
   * Get the recorded webcam blob (only available after stop)
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
   * Get the size of recorded screen data in bytes
   */
  getScreenSize(): number {
    return this.screenChunks.reduce((total, chunk) => total + chunk.size, 0);
  }

  /**
   * Get the size of recorded webcam data in bytes
   */
  getWebcamSize(): number {
    return this.webcamChunks.reduce((total, chunk) => total + chunk.size, 0);
  }

  /**
   * Start recording
   */
  async start(options?: DualRecordingOptions): Promise<void> {
    if (this.state === "recording") {
      throw new Error("Recording is already in progress");
    }

    if (this.state === "paused") {
      // Resume instead of starting new
      this.resume();
      return;
    }

    try {
      // Step 1: Request screen capture with system audio
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error("Screen capture API is not available");
      }

      // Standard settings for consistent recording
      const TARGET_AUDIO_SAMPLE_RATE = 48000; // Standard audio sample rate

      const screenOptions: MediaStreamConstraints = {
        video: {
          displaySurface: "browser" as DisplayCaptureSurfaceType,
        } as MediaTrackConstraints,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: {
            ideal: TARGET_AUDIO_SAMPLE_RATE,
            max: TARGET_AUDIO_SAMPLE_RATE,
          },
        } as MediaTrackConstraints, // Request system audio
      };

      const screenStream = await navigator.mediaDevices.getDisplayMedia(
        screenOptions
      );

      // Notify that screen has been selected and shared
      this.callbacks.onScreenSelected?.();

      // Wait for countdown to complete before starting actual recording
      this.countdownAborted = false;
      const countdownDuration = (options?.countdownDuration || 3) * 1000;

      let countdownTimeout: NodeJS.Timeout | null = null;

      try {
        await new Promise<void>((resolve, reject) => {
          this.countdownReject = reject;
          countdownTimeout = setTimeout(() => {
            if (!this.countdownAborted) {
              resolve();
            } else {
              reject(new Error("Countdown cancelled by user"));
            }
          }, countdownDuration);
        });
      } catch (error) {
        if (countdownTimeout) {
          clearTimeout(countdownTimeout);
        }
        screenStream.getTracks().forEach((track) => track.stop());
        this.setState("idle");
        this.countdownReject = null;
        throw error;
      } finally {
        this.countdownReject = null;
        if (countdownTimeout) {
          clearTimeout(countdownTimeout);
        }
      }

      if (this.countdownAborted) {
        screenStream.getTracks().forEach((track) => track.stop());
        this.setState("idle");
        throw new Error("Recording cancelled during countdown");
      }

      // Handle screen share stop event
      const screenVideoTrack = screenStream.getVideoTracks()[0];
      if (screenVideoTrack) {
        screenVideoTrack.onended = () => {
          this.handleScreenShareStopped();
        };
      }

      this.screenStream = screenStream;

      // Step 2: Request webcam with microphone
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Webcam API is not available");
      }

      const webcamStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: {
          sampleRate: {
            ideal: TARGET_AUDIO_SAMPLE_RATE,
            max: TARGET_AUDIO_SAMPLE_RATE,
          },
        },
      });

      // Handle webcam disconnect
      const webcamVideoTrack = webcamStream.getVideoTracks()[0];
      if (webcamVideoTrack) {
        webcamVideoTrack.onended = () => {
          this.handleWebcamDisconnected();
        };
      }

      // Handle microphone disconnect
      const webcamAudioTrack = webcamStream.getAudioTracks()[0];
      if (webcamAudioTrack) {
        webcamAudioTrack.onended = () => {
          this.handleMicrophoneDisconnected();
        };
      }

      this.webcamStream = webcamStream;

      // Step 3: Normalize track settings to ensure identical audio rate
      // Ensure both audio tracks use the same sampleRate
      const screenAudioTrack = screenStream.getAudioTracks()[0];
      // Reuse webcamAudioTrack that was already declared above

      if (screenAudioTrack && webcamAudioTrack) {
        try {
          await screenAudioTrack.applyConstraints({
            sampleRate: {
              ideal: TARGET_AUDIO_SAMPLE_RATE,
              max: TARGET_AUDIO_SAMPLE_RATE,
            },
          });
          await webcamAudioTrack.applyConstraints({
            sampleRate: {
              ideal: TARGET_AUDIO_SAMPLE_RATE,
              max: TARGET_AUDIO_SAMPLE_RATE,
            },
          });
        } catch (error) {
          console.warn("Could not apply audio sampleRate constraints:", error);
        }
      }

      // Step 4: Create two separate MediaRecorder instances with identical settings
      const recorderOptions: MediaRecorderOptions = {
        mimeType: options?.mimeType || this.preferredMimeType || undefined,
        videoBitsPerSecond: options?.videoBitsPerSecond,
        audioBitsPerSecond: options?.audioBitsPerSecond,
      };

      // Screen recorder (screen + system audio if available)
      this.screenRecorder = new MediaRecorder(screenStream, recorderOptions);
      this.screenRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          this.screenChunks.push(event.data);
          this.callbacks.onScreenDataAvailable?.(event.data);
        }
      };
      this.screenRecorder.onstop = () => {
        // Screen recording stopped
      };
      this.screenRecorder.onerror = () => {
        const error = new Error("Screen MediaRecorder error occurred");
        this.handleError(error);
      };

      // Webcam recorder (webcam video + mic audio)
      this.webcamRecorder = new MediaRecorder(webcamStream, recorderOptions);
      this.webcamRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          this.webcamChunks.push(event.data);
          this.callbacks.onWebcamDataAvailable?.(event.data);
        }
      };
      this.webcamRecorder.onstop = () => {
        // Webcam recording stopped
      };
      this.webcamRecorder.onerror = () => {
        const error = new Error("Webcam MediaRecorder error occurred");
        this.handleError(error);
      };

      // Start both recorders
      const timeslice = options?.timeslice || 1000;
      this.screenRecorder.start(timeslice);
      this.webcamRecorder.start(timeslice);

      // Update state
      this.startTime = Date.now();
      this.totalPausedDuration = 0;
      this.screenChunks = [];
      this.webcamChunks = [];
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
  stop(): { screenBlob: Blob | null; webcamBlob: Blob | null } {
    if (this.state === "idle" || this.state === "stopped") {
      return { screenBlob: null, webcamBlob: null };
    }

    try {
      // Stop both MediaRecorders
      if (this.screenRecorder && this.screenRecorder.state !== "inactive") {
        this.screenRecorder.stop();
      }

      if (this.webcamRecorder && this.webcamRecorder.state !== "inactive") {
        this.webcamRecorder.stop();
      }

      // Stop all tracks
      if (this.screenStream) {
        this.screenStream.getTracks().forEach((track) => {
          track.stop();
        });
        this.screenStream = null;
      }

      if (this.webcamStream) {
        this.webcamStream.getTracks().forEach((track) => {
          track.stop();
        });
        this.webcamStream = null;
      }

      // Stop duration tracking
      this.stopDurationTracking();

      // State will be updated in handleStop()
      const screenBlob = this.getScreenBlob();
      const webcamBlob = this.getWebcamBlob();
      this.setState("stopped");
      return { screenBlob, webcamBlob };
    } catch (error) {
      const err = error as Error;
      this.handleError(err);
      return { screenBlob: null, webcamBlob: null };
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
      if (this.screenRecorder && this.screenRecorder.state === "recording") {
        this.screenRecorder.pause();
      }

      if (this.webcamRecorder && this.webcamRecorder.state === "recording") {
        this.webcamRecorder.pause();
      }

      this.pausedTime = Date.now();
      this.setState("paused");
      this.stopDurationTracking();
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
      if (this.screenRecorder && this.screenRecorder.state === "paused") {
        const pausedDuration = Date.now() - this.pausedTime;
        this.totalPausedDuration += pausedDuration;
        this.screenRecorder.resume();
      }

      if (this.webcamRecorder && this.webcamRecorder.state === "paused") {
        this.webcamRecorder.resume();
      }

      this.setState("recording");
      this.startDurationTracking();
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
      this.stop();
      this.callbacks.onScreenShareStopped?.();
    }
  }

  /**
   * Handle webcam disconnect
   */
  private handleWebcamDisconnected(): void {
    if (this.state === "recording" || this.state === "paused") {
      this.webcamStream = null;
      this.callbacks.onWebcamDisconnected?.();
    }
  }

  /**
   * Handle microphone disconnect
   */
  private handleMicrophoneDisconnected(): void {
    if (this.state === "recording" || this.state === "paused") {
      this.callbacks.onMicrophoneDisconnected?.();
    }
  }

  /**
   * Abort countdown and cancel recording start
   */
  abortCountdown(): void {
    this.countdownAborted = true;
    if (this.countdownReject) {
      this.countdownReject(new Error("Countdown cancelled by user"));
      this.countdownReject = null;
    }
  }

  /**
   * Handle errors
   */
  private handleError(error: Error): void {
    this.setState("error");
    this.stopDurationTracking();

    // Cleanup
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => track.stop());
      this.screenStream = null;
    }

    if (this.webcamStream) {
      this.webcamStream.getTracks().forEach((track) => track.stop());
      this.webcamStream = null;
    }

    this.callbacks.onError?.(error);
  }

  /**
   * Update state and notify callbacks
   */
  private setState(newState: DualRecordingState): void {
    this.state = newState;
    this.callbacks.onStateChange?.(newState);
  }

  /**
   * Start duration tracking
   */
  private startDurationTracking(): void {
    this.stopDurationTracking();

    this.durationInterval = setInterval(() => {
      const duration = this.getDuration();
      this.callbacks.onDurationUpdate?.(duration);
    }, 100);
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

    if (this.screenRecorder && this.screenRecorder.state !== "inactive") {
      this.screenRecorder.stop();
    }

    if (this.webcamRecorder && this.webcamRecorder.state !== "inactive") {
      this.webcamRecorder.stop();
    }

    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => track.stop());
    }

    if (this.webcamStream) {
      this.webcamStream.getTracks().forEach((track) => track.stop());
    }

    this.screenChunks = [];
    this.webcamChunks = [];
    this.screenStream = null;
    this.webcamStream = null;
    this.screenRecorder = null;
    this.webcamRecorder = null;
    this.state = "idle";
  }
}

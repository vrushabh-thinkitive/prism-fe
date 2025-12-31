import { useState, useEffect, useRef } from "react";
import { useScreenRecorder } from "../hooks/useScreenRecorder";
import { useSimpleUpload } from "../hooks/useSimpleUpload";
import { useResumableUpload } from "../hooks/useResumableUpload";
import type { WebcamPosition } from "../utils/canvas-merger";
import CountdownTimer from "./CountdownTimer";

// Threshold for choosing V1 vs V2 upload (500MB)
// TEMPORARY: Changed to 0 to test V2 resumable upload for all files
const LARGE_FILE_THRESHOLD = 0; // Temporarily 0 to force V2 for all files (was 500MB)

export default function ScreenRecorder() {
  const {
    state,
    duration,
    blob,
    size,
    error,
    canvas,
    isWebcamEnabled,
    isMicrophoneEnabled,
    microphoneLevel,
    start,
    stop,
    pause,
    resume,
    reset,
    updateWebcamPosition,
    muteMicrophone,
    onScreenSelected,
    abortCountdown,
  } = useScreenRecorder();

  // Use both hooks (React hooks must be called unconditionally)
  const simpleUpload = useSimpleUpload();
  const resumableUpload = useResumableUpload();

  // Determine which upload hook to use based on blob size
  // TEMPORARY: Using V2 (resumable) for all files for testing
  // Use V2 (resumable) for files >= threshold, V1 (simple) for smaller files
  const useResumable = blob ? blob.size >= LARGE_FILE_THRESHOLD : false;
  const uploadHook = useResumable ? resumableUpload : simpleUpload;

  const {
    upload,
    state: uploadState,
    progress: uploadProgress,
    error: uploadError,
    recordingId,
    playbackUrl,
    reset: resetUpload,
  } = uploadHook;

  // Get resume function only if using resumable upload
  const resumeUpload =
    useResumable && "resume" in resumableUpload ? resumableUpload.resume : null;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [enableWebcam, setEnableWebcam] = useState<boolean>(false);
  const [enableMicrophone, setEnableMicrophone] = useState<boolean>(false);
  const [isMicrophoneMuted, setIsMicrophoneMuted] = useState<boolean>(false);
  const [webcamPosition, setWebcamPosition] = useState<WebcamPosition>({
    x: 80,
    y: 5,
    width: 18,
    height: 24,
  });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedCorner, setSelectedCorner] = useState<string>("top-right");
  const [showCountdown, setShowCountdown] = useState<boolean>(false);
  const [countdownDuration] = useState<number>(3);
  const [recordingOptions, setRecordingOptions] = useState<{
    enableWebcam: boolean;
    enableMicrophone: boolean;
    webcamPosition: WebcamPosition;
  } | null>(null);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  // Compute state variables
  const isRecording = state === "recording";
  const isPaused = state === "paused";
  const isStopped = state === "stopped";
  const canStart = state === "idle" || state === "stopped" || state === "error";
  const canStop = state === "recording" || state === "paused";

  // Update canvas preview when canvas is available
  useEffect(() => {
    if (canvas && canvasRef.current) {
      const previewCanvas = canvasRef.current;
      const ctx = previewCanvas.getContext("2d");
      if (ctx) {
        const drawCanvas = () => {
          if (canvas && previewCanvas && (isRecording || isPaused)) {
            // Set preview canvas size to match aspect ratio
            const aspectRatio = canvas.width / canvas.height;
            const maxWidth = 1920;
            const maxHeight = 1080;
            let previewWidth = maxWidth;
            let previewHeight = maxWidth / aspectRatio;

            if (previewHeight > maxHeight) {
              previewHeight = maxHeight;
              previewWidth = maxHeight * aspectRatio;
            }

            previewCanvas.width = previewWidth;
            previewCanvas.height = previewHeight;

            ctx.drawImage(canvas, 0, 0, previewWidth, previewHeight);
            requestAnimationFrame(drawCanvas);
          }
        };
        const animationId = requestAnimationFrame(drawCanvas);
        return () => cancelAnimationFrame(animationId);
      }
    }
  }, [canvas, isRecording, isPaused]);

  // Update webcam position when corner changes
  const handleCornerChange = (corner: string) => {
    setSelectedCorner(corner);
    let newPosition: WebcamPosition;
    switch (corner) {
      case "top-left":
        newPosition = { x: 2, y: 5, width: 18, height: 24 };
        break;
      case "top-right":
        newPosition = { x: 80, y: 5, width: 18, height: 24 };
        break;
      case "bottom-left":
        newPosition = { x: 2, y: 71, width: 18, height: 24 };
        break;
      case "bottom-right":
        newPosition = { x: 80, y: 71, width: 18, height: 24 };
        break;
      default:
        newPosition = webcamPosition;
    }
    setWebcamPosition(newPosition);
    if (state === "recording") {
      updateWebcamPosition(newPosition);
    }
  };

  // Setup callback for when screen is selected
  useEffect(() => {
    onScreenSelected(() => {
      // Show countdown timer after screen is selected
      setShowCountdown(true);
    });
  }, [onScreenSelected]);

  // Close countdown when recording actually starts or on error (safety measure)
  useEffect(() => {
    if ((state === "recording" || state === "error") && showCountdown) {
      setShowCountdown(false);
    }
  }, [state, showCountdown]);

  // Create preview URL when blob becomes available (handles both manual stop and browser stop)
  useEffect(() => {
    if (blob && state === "stopped" && !previewUrl) {
      // Create preview URL when blob is available and recording is stopped
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      console.log("Preview URL created from blob:", url);
    }
  }, [blob, state, previewUrl]);

  const handleStartClick = async () => {
    // Clear previous preview URL if starting new recording
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }

    // ALWAYS clear sessionStorage when starting a fresh recording
    // This prevents "Upload Interrupted" tab from showing for a new recording
    // If user wants to resume an old upload, they should use "Resume Upload" button, not "Start Recording"
    if (typeof window !== "undefined") {
      const oldRecordingId = sessionStorage.getItem("activeRecordingId");
      if (oldRecordingId) {
        console.log(
          "🧹 Clearing old recordingId from sessionStorage before starting fresh recording:",
          oldRecordingId
        );
        sessionStorage.removeItem("activeRecordingId");
      }
    }
    // Also reset upload state to ensure hook state is cleared
    if (recordingId || uploadState !== "idle") {
      console.log("🧹 Resetting upload state before starting fresh recording");
      resetUpload();
    }

    // Store options for use after countdown
    setRecordingOptions({
      enableWebcam,
      enableMicrophone,
      webcamPosition,
    });

    // Start recording - this will trigger screen share prompt
    // Countdown will appear after user selects screen and clicks share
    try {
      await start({
        enableWebcam: enableWebcam,
        webcamPosition: webcamPosition,
        enableMicrophone: enableMicrophone,
        countdownDuration: countdownDuration,
      });
    } catch (err) {
      // Error is already handled by the hook
      console.error("Failed to start recording:", err);
      setShowCountdown(false);
      setRecordingOptions(null);
    }
  };

  const handleCountdownComplete = () => {
    // Countdown is complete, recording has already started
    // Just hide the countdown
    setShowCountdown(false);
  };

  const handleCountdownCancel = async () => {
    setShowCountdown(false);

    // Abort the countdown - this will stop the recording start process
    abortCountdown();

    // Stop recording if it somehow started
    if (state === "recording" || state === "paused") {
      stop();
    }

    // Reset to idle state
    reset();
    setRecordingOptions(null);
  };

  const handleMuteToggle = () => {
    const newMutedState = !isMicrophoneMuted;
    setIsMicrophoneMuted(newMutedState);
    muteMicrophone(newMutedState);
  };

  const handleStop = () => {
    const recordedBlob = stop();
    if (recordedBlob) {
      console.log("recordedBlob", recordedBlob);

      // Clear old upload state if this is a fresh recording (no upload was started)
      // This prevents "Upload Interrupted" tab from showing for a fresh recording
      // If uploadState is "paused" or "error" but no upload progress exists,
      // it means the upload was never started for this recording, so the recordingId
      // must be from a previous recording that was restored from sessionStorage
      if (
        recordingId &&
        (uploadState === "paused" || uploadState === "error") &&
        !uploadProgress
      ) {
        console.log(
          "🧹 Clearing old recordingId from previous recording - no upload was started for this recording"
        );
        // Directly clear sessionStorage to ensure it's cleared
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("activeRecordingId");
          console.log("🗑️ Removed activeRecordingId from sessionStorage");
        }
        resetUpload();
      }

      // Create preview URL if it doesn't already exist
      // (useEffect will handle it if blob is set via browser stop)
      if (!previewUrl) {
        const url = URL.createObjectURL(recordedBlob);
        setPreviewUrl(url);
      }
    }
  };

  const handleReset = () => {
    // Revoke preview URL to free memory
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    resetUpload();
    reset();
  };

  const handleUpload = async () => {
    if (!blob) {
      console.error("No recording blob available");
      return;
    }

    try {
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `recording-${timestamp}.webm`;

      // Choose upload method based on file size
      const isLargeFile = blob.size >= LARGE_FILE_THRESHOLD;
      console.log(
        `📤 Starting ${isLargeFile ? "V2 (Resumable)" : "V1 (Simple)"} upload:`,
        {
          fileName,
          size: `${(blob.size / 1024 / 1024).toFixed(2)} MB`,
          method: isLargeFile ? "Resumable (Backend-Driven)" : "Simple PUT",
        }
      );

      const result = await upload(blob, {
        fileName,
        duration: Math.floor(duration),
        // userId: "user123", // TODO: Get from auth context
      });

      console.log("Upload successful:", {
        recordingId: result.recordingId,
        playbackUrl: result.playbackUrl,
      });
    } catch (error) {
      console.error("Upload failed:", error);
    }
  };

  // Resume upload handler
  const handleResume = async () => {
    if (!blob) {
      console.error("❌ Cannot resume: blob is null");
      return;
    }

    if (!recordingId) {
      console.error("❌ Cannot resume: recordingId is null");
      return;
    }

    if (!useResumable || !resumeUpload) {
      console.error("❌ Resume not available: not using resumable upload");
      return;
    }

    try {
      console.log("🔄 Attempting to resume upload:", {
        recordingId,
        blobSize: `${(blob.size / 1024 / 1024).toFixed(2)} MB`,
      });

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `recording-${timestamp}.webm`;

      const result = await resumeUpload(recordingId, blob, {
        fileName,
        duration: Math.floor(duration),
      });

      console.log("✅ Resume successful:", {
        recordingId: result.recordingId,
        playbackUrl: result.playbackUrl,
      });
    } catch (error) {
      console.error("❌ Resume failed:", error);
    }
  };

  // Start new upload (clear sessionStorage and reset)
  const handleStartNewUpload = () => {
    console.log("🆕 Starting new upload - clearing sessionStorage");
    resetUpload();
  };

  // Check if resume is possible
  // "Upload Interrupted" tab is shown when ALL of these conditions are true:
  // 1. useResumable: Current blob is large enough to use resumable upload (size >= threshold)
  // 2. resumableUpload.recordingId: A recordingId exists (from an interrupted upload)
  // 3. blob: A recording blob exists (current recording)
  // 4. uploadState is "paused" or "error": Upload was interrupted or failed
  // 5. resumeUpload: Resume function is available
  // 6. uploadProgress exists: An upload was actually STARTED (chunks were uploaded)
  //    This ensures we only show the tab if an upload was initiated for THIS recording,
  //    not just because an old recordingId exists from a previous recording
  //    If uploadProgress is null, it means no upload was started, so don't show the tab
  const canResume =
    useResumable &&
    resumableUpload.recordingId &&
    blob &&
    (uploadState === "paused" || uploadState === "error") &&
    resumeUpload &&
    // Critical: Only show if an upload was actually started (has progress)
    // This prevents showing the tab for fresh recordings where no upload was initiated
    // If uploadProgress is null, it means the uploadState "paused" is from hook initialization,
    // not from an actual interrupted upload
    uploadProgress !== null;

  // Check if page was refreshed (recordingId exists but blob is null)
  const wasRefreshed =
    useResumable &&
    resumableUpload.recordingId &&
    !blob &&
    (uploadState === "paused" || uploadState === "error");

  // Helper to check if upload is in progress (for button disabled state)
  const isUploadInProgress =
    uploadState === "uploading" ||
    uploadState === "initializing" ||
    uploadState === "completing";

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-black dark:text-white">
          🎥 Screen Recorder
        </h2>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Record your screen with start, pause, and stop controls
        </p>
      </div>

      {/* Recording Status Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-black dark:text-white">
            Recording Status
          </h3>
          <div
            className={`px-4 py-2 rounded-full text-sm font-medium ${
              isRecording
                ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 animate-pulse"
                : isPaused
                ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                : isStopped
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
            }`}
          >
            {isRecording && "🔴 Recording"}
            {isPaused && "⏸️ Paused"}
            {isStopped && "✅ Stopped"}
            {state === "idle" && "⏹️ Idle"}
            {state === "error" && "❌ Error"}
          </div>
        </div>

        {/* Duration and Size */}
        {(isRecording || isPaused || isStopped) && (
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
              <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                Duration
              </div>
              <div className="text-2xl font-bold text-black dark:text-white">
                {formatDuration(duration)}
              </div>
            </div>
            {isStopped && size > 0 && (
              <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
                <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                  File Size
                </div>
                <div className="text-2xl font-bold text-black dark:text-white">
                  {formatSize(size)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Countdown Timer */}
      {showCountdown && (
        <CountdownTimer
          duration={countdownDuration}
          onComplete={handleCountdownComplete}
          onCancel={handleCountdownCancel}
        />
      )}

      {/* Webcam Settings */}
      {canStart && (
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-black dark:text-white mb-4">
            📹 Webcam Settings
          </h3>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={enableWebcam}
                onChange={(e) => setEnableWebcam(e.target.checked)}
                className="w-5 h-5 rounded border-zinc-300 dark:border-zinc-700"
              />
              <span className="text-black dark:text-white">
                Enable webcam overlay (Picture-in-Picture)
              </span>
            </label>

            {enableWebcam && (
              <div className="pl-8 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Webcam Position:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "top-left", label: "Top Left" },
                      { value: "top-right", label: "Top Right" },
                      { value: "bottom-left", label: "Bottom Left" },
                      { value: "bottom-right", label: "Bottom Right" },
                    ].map((corner) => (
                      <button
                        key={corner.value}
                        onClick={() => handleCornerChange(corner.value)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          selectedCorner === corner.value
                            ? "bg-blue-600 text-white dark:bg-blue-500"
                            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                        }`}
                      >
                        {corner.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Microphone Settings */}
      {canStart && (
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-black dark:text-white mb-4">
            🎤 Microphone Settings
          </h3>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={enableMicrophone}
                onChange={(e) => setEnableMicrophone(e.target.checked)}
                className="w-5 h-5 rounded border-zinc-300 dark:border-zinc-700"
              />
              <span className="text-black dark:text-white">
                Enable microphone audio recording
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Microphone Controls (During Recording) */}
      {isMicrophoneEnabled && (isRecording || isPaused) && (
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-black dark:text-white mb-4">
            🎤 Microphone
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-zinc-600 dark:text-zinc-400">Status:</span>
              <span
                className={`font-medium ${
                  isMicrophoneMuted
                    ? "text-red-600 dark:text-red-400"
                    : "text-green-600 dark:text-green-400"
                }`}
              >
                {isMicrophoneMuted ? "🔇 Muted" : "🎤 Active"}
              </span>
            </div>
            {!isMicrophoneMuted && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-600 dark:text-zinc-400">
                    Microphone Level:
                  </span>
                  <span className="font-medium text-black dark:text-white">
                    {Math.round(microphoneLevel)}%
                  </span>
                </div>
                <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all duration-100"
                    style={{ width: `${microphoneLevel}%` }}
                  />
                </div>
              </div>
            )}
            <button
              onClick={handleMuteToggle}
              className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                isMicrophoneMuted
                  ? "bg-green-600 text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
                  : "bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
              }`}
            >
              {isMicrophoneMuted
                ? "🔊 Unmute Microphone"
                : "🔇 Mute Microphone"}
            </button>
          </div>
        </div>
      )}

      {/* Canvas Preview (Live Recording Preview) */}
      {canvas && (isRecording || isPaused) && (
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-black dark:text-white mb-4">
            📺 Live Preview
          </h3>
          <div className="relative bg-black rounded-lg overflow-hidden">
            <canvas
              ref={canvasRef}
              className="w-full h-auto max-h-[600px] object-contain"
              style={{ display: "block" }}
            />
            {isWebcamEnabled && (
              <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-medium">
                📹 Webcam Active
              </div>
            )}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
        <h3 className="text-xl font-semibold text-black dark:text-white mb-4">
          Controls
        </h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleStartClick}
            disabled={!canStart}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              canStart
                ? "bg-green-600 text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
                : "bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500"
            }`}
          >
            ▶️ Start Recording
          </button>

          <button
            onClick={pause}
            disabled={!isRecording}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              isRecording
                ? "bg-yellow-600 text-white hover:bg-yellow-700 dark:bg-yellow-500 dark:hover:bg-yellow-600"
                : "bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500"
            }`}
          >
            ⏸️ Pause
          </button>

          <button
            onClick={resume}
            disabled={!isPaused}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              isPaused
                ? "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                : "bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500"
            }`}
          >
            ▶️ Resume
          </button>

          <button
            onClick={handleStop}
            disabled={!canStop}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              canStop
                ? "bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
                : "bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500"
            }`}
          >
            ⏹️ Stop Recording
          </button>

          <button
            onClick={handleReset}
            disabled={state === "idle"}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              state !== "idle"
                ? "bg-gray-600 text-white hover:bg-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600"
                : "bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500"
            }`}
          >
            🔄 Reset
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-200 mb-1">
                Recording Error
              </h3>
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Resume UI - Show when upload was interrupted but blob exists */}
      {canResume && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">⏸️</span>
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-1">
                Upload Interrupted
              </h3>
              <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-3">
                Your upload was interrupted but can be resumed. Click "Resume
                Upload" to continue from where you left off.
              </p>
              {recordingId && (
                <p className="text-xs text-yellow-700 dark:text-yellow-400 mb-3">
                  Recording ID:{" "}
                  <code className="bg-yellow-100 dark:bg-yellow-900/50 px-1 py-0.5 rounded">
                    {recordingId.substring(0, 8)}...
                  </code>
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleResume}
                  disabled={isUploadInProgress || !resumeUpload}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 dark:bg-yellow-500 dark:hover:bg-yellow-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {isUploadInProgress
                    ? uploadState === "uploading"
                      ? "⏳ Resuming..."
                      : "🔄 Initializing..."
                    : "▶️ Resume Upload"}
                </button>
                <button
                  onClick={handleStartNewUpload}
                  disabled={isUploadInProgress}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  🆕 Start New Upload
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Refresh Limitation UI - Show when page was refreshed */}
      {wasRefreshed && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 dark:text-red-200 mb-1">
                Upload Cannot Be Resumed After Refresh
              </h3>
              <p className="text-sm text-red-800 dark:text-red-300 mb-3">
                The page was refreshed and the recording data is no longer
                available. You cannot resume this upload. Please start a new
                recording and upload.
              </p>
              {recordingId && (
                <p className="text-xs text-red-700 dark:text-red-400 mb-3">
                  Previous Recording ID:{" "}
                  <code className="bg-red-100 dark:bg-red-900/50 px-1 py-0.5 rounded">
                    {recordingId.substring(0, 8)}...
                  </code>
                </p>
              )}
              <button
                onClick={handleStartNewUpload}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 transition-colors text-sm font-medium"
              >
                🆕 Start New Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview */}
      {previewUrl && blob && (
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-black dark:text-white mb-4">
            Recording Preview
          </h3>
          <div className="space-y-4">
            <video
              src={previewUrl}
              controls
              className="w-full rounded-lg bg-black"
              style={{ maxHeight: "600px" }}
            />
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                Duration: {formatDuration(duration)} • Size: {formatSize(size)}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleUpload}
                  disabled={
                    uploadState === "uploading" ||
                    uploadState === "initializing" ||
                    uploadState === "completing" ||
                    uploadState === "completed"
                  }
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    uploadState === "uploading" ||
                    uploadState === "initializing" ||
                    uploadState === "completing"
                      ? "bg-blue-400 text-white cursor-not-allowed dark:bg-blue-600"
                      : uploadState === "completed"
                      ? "bg-green-600 text-white cursor-not-allowed dark:bg-green-500"
                      : "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                  }`}
                >
                  {uploadState === "initializing"
                    ? "🔄 Initializing..."
                    : uploadState === "uploading"
                    ? "⏳ Uploading..."
                    : uploadState === "completing"
                    ? "🎯 Completing..."
                    : uploadState === "completed"
                    ? "✅ Upload Complete"
                    : "☁️ Upload Recording"}
                </button>
                <a
                  href={previewUrl}
                  download={`recording-${Date.now()}.webm`}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600 transition-colors"
                >
                  💾 Download
                </a>
              </div>
            </div>

            {/* Upload Progress */}
            {uploadProgress && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-600 dark:text-zinc-400">
                    Upload Progress
                  </span>
                  <span className="font-medium text-black dark:text-white">
                    {uploadProgress.percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress.percentage}%` }}
                  />
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {(uploadProgress.uploadedBytes / 1024 / 1024).toFixed(2)} MB /{" "}
                  {(uploadProgress.totalBytes / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>
            )}

            {/* Upload Error */}
            {uploadError && (
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 p-3">
                <div className="flex items-start gap-2">
                  <span className="text-lg">⚠️</span>
                  <div>
                    <p className="text-sm font-medium text-red-900 dark:text-red-200">
                      Upload Error
                    </p>
                    <p className="text-xs text-red-800 dark:text-red-300">
                      {uploadError}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Upload Success */}
            {uploadState === "completed" && (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">✅</span>
                  <p className="text-sm font-medium text-green-900 dark:text-green-200">
                    Recording uploaded successfully!
                  </p>
                </div>
                {recordingId && (
                  <div className="text-xs text-green-800 dark:text-green-300">
                    Recording ID:{" "}
                    <code className="bg-green-100 dark:bg-green-900/50 px-1 py-0.5 rounded">
                      {recordingId}
                    </code>
                  </div>
                )}
                {playbackUrl && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-green-900 dark:text-green-200">
                      🎬 Playback URL:
                    </p>
                    <video
                      src={playbackUrl}
                      controls
                      className="w-full rounded-lg bg-black"
                      style={{ maxHeight: "600px" }}
                    />
                    <a
                      href={playbackUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 transition-colors text-sm"
                    >
                      🔗 Open in New Tab
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">ℹ️</span>
          <div className="text-sm text-blue-800 dark:text-blue-300">
            <p className="font-semibold mb-1">Recording Tips:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Click "Start Recording" to begin capturing your screen</li>
              <li>Enable webcam overlay for Picture-in-Picture recording</li>
              <li>You can pause and resume recording at any time</li>
              <li>
                If you stop screen sharing, recording will automatically stop
              </li>
              <li>If webcam disconnects, recording continues without webcam</li>
              <li>
                After stopping, you can preview and download your recording
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
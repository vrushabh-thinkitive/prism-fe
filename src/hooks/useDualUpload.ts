import { useState, useCallback } from "react";
import {
  sliceBlobIntoChunks,
  type UploadProgress,
} from "../utils/resumable-upload";
import {
  initDualUpload,
  uploadScreenChunk,
  uploadWebcamChunk,
  completeDualUpload,
} from "../utils/api-config";
import { webcamPositionToApiFormat, type WebcamPosition } from "../utils/canvas-merger";

export type DualUploadState =
  | "idle"
  | "initializing"
  | "uploading"
  | "completing"
  | "completed"
  | "error";

export type DualUploadProgress = {
  screen: UploadProgress;
  webcam: UploadProgress;
};

export type UseDualUploadReturn = {
  state: DualUploadState;
  progress: DualUploadProgress | null;
  error: string | null;
  recordingId: string | null;
  playbackUrl: string | null;
  upload: (
    screenBlob: Blob,
    webcamBlob: Blob,
    options?: {
      duration: number;
      webcamPosition: WebcamPosition;
      userId?: string;
      onProgress?: (progress: DualUploadProgress) => void;
      onError?: (error: Error) => void;
    }
  ) => Promise<{
    recordingId: string;
    playbackUrl?: string;
    fileSize?: number;
  }>;
  reset: () => void;
};

export function useDualUpload(): UseDualUploadReturn {
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [state, setState] = useState<DualUploadState>("idle");
  const [progress, setProgress] = useState<DualUploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);

  const uploadStreamChunks = useCallback(
    async (
      blob: Blob,
      recordingId: string,
      chunkSize: number,
      uploadFn: (
        recordingId: string,
        chunk: Blob,
        chunkIndex: number,
        chunkSize: number,
        totalSize: number
      ) => Promise<{ uploadedBytes: number; done: boolean }>,
      onProgress?: (progress: UploadProgress) => void
    ): Promise<void> => {
      const chunks = sliceBlobIntoChunks(blob, chunkSize);
      const totalSize = blob.size;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const result = await uploadFn(
          recordingId,
          chunk,
          i,
          chunkSize,
          totalSize
        );

        const progressData: UploadProgress = {
          uploadedBytes: result.uploadedBytes,
          totalBytes: totalSize,
          percentage: (result.uploadedBytes / totalSize) * 100,
        };

        onProgress?.(progressData);

        if (result.done) {
          break;
        }
      }
    },
    []
  );

  const upload = useCallback(
    async (
      screenBlob: Blob,
      webcamBlob: Blob,
      options?: {
        duration: number;
        webcamPosition: WebcamPosition;
        userId?: string;
        onProgress?: (progress: DualUploadProgress) => void;
        onError?: (error: Error) => void;
      }
    ): Promise<{
      recordingId: string;
      playbackUrl?: string;
      fileSize?: number;
    }> => {
      if (!options || !options.duration) {
        throw new Error("duration is required");
      }
      if (!options.webcamPosition) {
        throw new Error("webcamPosition is required");
      }

      const opts = options;
      setError(null);
      setProgress(null);
      setRecordingId(null);
      setPlaybackUrl(null);

      try {
        setState("initializing");
        console.log("🚀 Step 1: Initializing dual upload session...");
        console.log(
          `📊 Screen: ${(screenBlob.size / 1024 / 1024).toFixed(2)} MB`
        );
        console.log(
          `📊 Webcam: ${(webcamBlob.size / 1024 / 1024).toFixed(2)} MB`
        );

        const apiWebcamPosition = webcamPositionToApiFormat(opts.webcamPosition);
        console.log(
          `📹 Webcam position: (${opts.webcamPosition.x}, ${opts.webcamPosition.y}) → API: ${apiWebcamPosition}`
        );

        const initResult = await initDualUpload({
          screenSize: screenBlob.size,
          webcamSize: webcamBlob.size,
          webcamPosition: apiWebcamPosition,
          duration: opts.duration,
          userId: opts.userId,
        });

        console.log("✅ Dual upload session initialized:", {
          recordingId: initResult.recordingId,
          chunkSize: `${(initResult.chunkSize / 1024 / 1024).toFixed(2)} MB`,
        });

        setRecordingId(initResult.recordingId);

        setState("uploading");
        console.log("☁️ Step 2: Uploading chunks to backend...");

        const initialProgress: DualUploadProgress = {
          screen: {
            uploadedBytes: 0,
            totalBytes: screenBlob.size,
            percentage: 0,
          },
          webcam: {
            uploadedBytes: 0,
            totalBytes: webcamBlob.size,
            percentage: 0,
          },
        };
        setProgress(initialProgress);

        const [screenResult, webcamResult] = await Promise.all([
          uploadStreamChunks(
            screenBlob,
            initResult.recordingId,
            initResult.chunkSize,
            uploadScreenChunk,
            (screenProgress) => {
              setProgress((prev) => {
                if (!prev) return null;
                const newProgress: DualUploadProgress = {
                  ...prev,
                  screen: screenProgress,
                };
                opts.onProgress?.(newProgress);
                return newProgress;
              });
            }
          ),
          uploadStreamChunks(
            webcamBlob,
            initResult.recordingId,
            initResult.chunkSize,
            uploadWebcamChunk,
            (webcamProgress) => {
              setProgress((prev) => {
                if (!prev) return null;
                const newProgress: DualUploadProgress = {
                  ...prev,
                  webcam: webcamProgress,
                };
                opts.onProgress?.(newProgress);
                return newProgress;
              });
            }
          ),
        ]);

        console.log("✅ All chunks uploaded!");

        setState("completing");
        console.log("🎯 Step 3: Completing dual upload and triggering merge...");

        const completeResult = await completeDualUpload({
          recordingId: initResult.recordingId,
        });

        console.log("✅ Dual upload completed:", {
          recordingId: completeResult.recordingId,
          status: completeResult.status,
          playbackUrl: completeResult.playbackUrl
            ? completeResult.playbackUrl.substring(0, 50) + "..."
            : "Not available",
          fileSize: `${(completeResult.fileSize / 1024 / 1024).toFixed(2)} MB`,
        });

        if (completeResult.playbackUrl) {
          setPlaybackUrl(completeResult.playbackUrl);
        }

        setState("completed");
        console.log("🎉 Dual upload flow complete!");

        return {
          recordingId: completeResult.recordingId,
          playbackUrl: completeResult.playbackUrl,
          fileSize: completeResult.fileSize,
        };
      } catch (err) {
        const error = err as Error;
        setError(error.message);
        setState("error");
        console.error("❌ Dual upload failed:", error);
        opts.onError?.(error);
        throw error;
      }
    },
    [uploadStreamChunks]
  );

  const reset = useCallback(() => {
    setState("idle");
    setProgress(null);
    setError(null);
    setRecordingId(null);
    setPlaybackUrl(null);
  }, []);

  return {
    state,
    progress,
    error,
    recordingId,
    playbackUrl,
    upload,
    reset,
  };
}


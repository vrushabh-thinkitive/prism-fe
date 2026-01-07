import { useState, useCallback } from "react";
import {
  uploadChunk,
  sliceBlobIntoChunks,
  calculateStartingChunkIndex,
  type ResumableUploadOptions,
  type UploadProgress,
} from "../utils/resumable-upload";
import {
  initResumableUpload,
  getUploadStatus,
  completeVideoUpload,
} from "../utils/api-config";
import { useAuthUser } from "./useAuthUser";

const SESSION_STORAGE_KEY = "activeRecordingId";

export type UploadState =
  | "idle"
  | "initializing"
  | "uploading"
  | "completing"
  | "completed"
  | "error"
  | "paused";

export type UseResumableUploadReturn = {
  state: UploadState;
  progress: UploadProgress | null;
  error: string | null;
  recordingId: string | null;
  playbackUrl: string | null;
  upload: (
    blob: Blob,
    options?: {
      fileName?: string;
      duration?: number;
      userId?: string;
      onProgress?: (progress: UploadProgress) => void;
      onError?: (error: Error) => void;
    }
  ) => Promise<{
    recordingId: string;
    playbackUrl?: string;
  }>;
  resume: (
    recordingId: string,
    blob: Blob,
    options?: {
      fileName?: string;
      duration?: number;
      onProgress?: (progress: UploadProgress) => void;
      onError?: (error: Error) => void;
    }
  ) => Promise<{
    recordingId: string;
    playbackUrl?: string;
  }>;
  reset: () => void;
};

/**
 * React hook for resumable file uploads (V2 - Backend-Driven)
 *
 * V2 Architecture (Loom-style):
 * 1. Frontend → Backend: Initialize resumable session (POST /upload/init-resumable)
 * 2. Frontend → Backend: Upload chunks sequentially (PUT /upload/:recordingId/chunk)
 * 3. Frontend → Backend: Complete upload (POST /upload/complete)
 *
 * Key differences from V1:
 * - Browser uploads chunks ONLY to backend (never directly to GCS)
 * - Backend handles GCS resumable uploads
 * - Supports resume after refresh/page reload
 * - Sequential chunk uploads (no parallel uploads)
 *
 * @example
 * ```tsx
 * const { upload, resume, state, progress, error, recordingId, playbackUrl } = useResumableUpload();
 *
 * // Start new upload
 * const result = await upload(blob, {
 *   fileName: "recording.webm",
 *   duration: 120,
 *   onProgress: (progress) => {
 *     console.log(`Uploaded ${progress.percentage}%`);
 *   }
 * });
 *
 * // Resume existing upload
 * const resumed = await resume(recordingId, blob);
 * ```
 */
export function useResumableUpload(): UseResumableUploadReturn {
  // Restore recordingId from sessionStorage on mount
  const [recordingId, setRecordingId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        console.log(
          "📦 Restored activeRecordingId from sessionStorage:",
          stored
        );
        return stored;
      }
    }
    return null;
  });

  const [state, setState] = useState<UploadState>(() => {
    // If recordingId exists on mount, mark as paused
    if (recordingId) {
      console.log(
        "⏸️ Upload state set to 'paused' - recordingId found in sessionStorage"
      );
      return "paused";
    }
    return "idle";
  });
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const { getAccessToken, isAuthenticated } = useAuthUser();

  // Save recordingId to sessionStorage helper
  const saveRecordingId = useCallback((id: string) => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, id);
    console.log("💾 Saved activeRecordingId to sessionStorage:", id);
  }, []);

  // Remove recordingId from sessionStorage helper
  const clearRecordingId = useCallback(() => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    console.log("🗑️ Removed activeRecordingId from sessionStorage");
  }, []);

  /**
   * Internal function to upload chunks sequentially
   */
  const uploadChunks = useCallback(
    async (
      blob: Blob,
      recordingId: string,
      chunkSize: number,
      startFromChunk: number,
      accessToken: string,
      options: ResumableUploadOptions = {}
    ): Promise<void> => {
      // Slice blob into chunks
      const chunks = sliceBlobIntoChunks(blob, chunkSize);
      const totalSize = blob.size;

      // Upload chunks sequentially starting from startFromChunk
      for (let i = startFromChunk; i < chunks.length; i++) {
        const chunk = chunks[i];

        // Upload chunk with retry logic
        const result = await uploadChunk(
          recordingId,
          chunk,
          i,
          chunkSize,
          totalSize,
          accessToken
        );

        // Update progress
        const uploadedBytes = result.uploadedBytes;
        const progressData: UploadProgress = {
          uploadedBytes,
          totalBytes: totalSize,
          percentage: (uploadedBytes / totalSize) * 100,
        };

        setProgress(progressData);
        options.onProgress?.(progressData);

        console.log(
          `📊 Upload progress: ${progressData.percentage.toFixed(1)}% (${(
            uploadedBytes /
            1024 /
            1024
          ).toFixed(2)} MB / ${(totalSize / 1024 / 1024).toFixed(2)} MB)`
        );

        // Check if upload is complete
        if (result.done) {
          console.log("✅ All chunks uploaded successfully!");
          break;
        }
      }
    },
    []
  );

  /**
   * Start a new resumable upload
   */
  const upload = useCallback(
    async (
      blob: Blob,
      options?: {
        fileName?: string;
        duration?: number;
        userId?: string;
        onProgress?: (progress: UploadProgress) => void;
        onError?: (error: Error) => void;
      }
    ): Promise<{
      recordingId: string;
      playbackUrl?: string;
    }> => {
      if (!isAuthenticated) {
        throw new Error("User must be authenticated to upload");
      }

      const opts = options || {};
      setError(null);
      setProgress(null);
      setRecordingId(null);
      setPlaybackUrl(null);

      try {
        const fileName = opts.fileName || "recording.webm";
        const mimeType = blob.type || "video/webm";
        const accessToken = await getAccessToken();

        // Step 1: Initialize resumable upload session
        setState("initializing");
        console.log("🚀 Step 1: Initializing resumable upload session...");
        console.log(
          `📊 File: ${fileName} (${(blob.size / 1024 / 1024).toFixed(2)} MB)`
        );

        const initResult = await initResumableUpload({
          fileName,
          fileSize: blob.size,
          mimeType,
          duration: opts.duration,
          userId: opts.userId || "user123",
          accessToken,
        });

        console.log("✅ Resumable upload session initialized:", {
          recordingId: initResult.recordingId,
          chunkSize: `${(initResult.chunkSize / 1024 / 1024).toFixed(2)} MB`,
        });

        setRecordingId(initResult.recordingId);
        // Save recordingId to sessionStorage when upload starts successfully
        saveRecordingId(initResult.recordingId);

        // Step 2: Upload chunks sequentially
        setState("uploading");
        console.log("☁️ Step 2: Uploading chunks to backend...");

        await uploadChunks(
          blob,
          initResult.recordingId,
          initResult.chunkSize,
          0, // Start from beginning
          accessToken,
          {
            onProgress: (progressData) => {
              setProgress(progressData);
              opts.onProgress?.(progressData);
            },
            onError: (err) => {
              console.error("❌ Upload error:", err);
              opts.onError?.(err);
              throw err;
            },
          }
        );

        console.log("✅ All chunks uploaded!");

        // Step 3: Complete upload
        setState("completing");
        console.log("🎯 Step 3: Completing upload...");

        const completeResult = await completeVideoUpload({
          recordingId: initResult.recordingId,
          size: blob.size,
          accessToken,
        });

        console.log("✅ Upload completed:", {
          recordingId: completeResult.recordingId,
          status: completeResult.status,
          playbackUrl: completeResult.playbackUrl
            ? completeResult.playbackUrl.substring(0, 50) + "..."
            : "Not available",
        });

        if (completeResult.playbackUrl) {
          setPlaybackUrl(completeResult.playbackUrl);
        }

        setState("completed");
        // Remove recordingId from sessionStorage when upload completes successfully
        clearRecordingId();
        console.log("🎉 Upload flow complete!");

        return {
          recordingId: completeResult.recordingId,
          playbackUrl: completeResult.playbackUrl,
        };
      } catch (err) {
        const error = err as Error;
        setError(error.message);
        setState("error");
        // Keep recordingId in sessionStorage when upload fails (for resume)
        console.error("❌ Upload failed:", error);
        console.log(
          "💾 Keeping activeRecordingId in sessionStorage for resume"
        );
        throw error;
      }
    },
    [uploadChunks]
  );

  /**
   * Resume an existing upload
   */
  const resume = useCallback(
    async (
      recordingId: string,
      blob: Blob,
      options?: {
        fileName?: string;
        duration?: number;
        onProgress?: (progress: UploadProgress) => void;
        onError?: (error: Error) => void;
      }
    ): Promise<{
      recordingId: string;
      playbackUrl?: string;
    }> => {
      if (!isAuthenticated) {
        throw new Error("User must be authenticated to resume upload");
      }

      const opts = options || {};
      setError(null);
      setRecordingId(recordingId);

      try {
        const accessToken = await getAccessToken();

        // Step 1: Get upload status
        setState("initializing");
        console.log("🔄 Resuming upload:", recordingId);

        const status = await getUploadStatus({
          recordingId,
          accessToken,
        });

        console.log("📊 Upload status:", {
          uploadedBytes: `${(status.uploadedBytes / 1024 / 1024).toFixed(
            2
          )} MB`,
          totalSize: `${(status.fileSize / 1024 / 1024).toFixed(2)} MB`,
          chunkSize: `${(status.chunkSize / 1024 / 1024).toFixed(2)} MB`,
        });

        // Check if already complete
        if (status.uploadedBytes >= status.fileSize) {
          console.log("✅ Upload already complete!");
          setState("completed");
          setProgress({
            uploadedBytes: status.fileSize,
            totalBytes: status.fileSize,
            percentage: 100,
          });

          // Get playback URL
          const completeResult = await completeVideoUpload({
            recordingId,
            size: status.fileSize,
            accessToken,
          });

          if (completeResult.playbackUrl) {
            setPlaybackUrl(completeResult.playbackUrl);
          }

          return {
            recordingId,
            playbackUrl: completeResult.playbackUrl,
          };
        }

        // Step 2: Calculate starting chunk index
        const startFromChunk = calculateStartingChunkIndex(
          status.uploadedBytes,
          status.chunkSize
        );

        console.log(
          `📦 Resuming from chunk ${startFromChunk + 1} (${(
            status.uploadedBytes /
            1024 /
            1024
          ).toFixed(2)} MB uploaded)`
        );

        // Step 3: Upload remaining chunks
        setState("uploading");

        await uploadChunks(
          blob,
          recordingId,
          status.chunkSize,
          startFromChunk,
          accessToken,
          {
            onProgress: (progressData) => {
              setProgress(progressData);
              opts.onProgress?.(progressData);
            },
            onError: (err) => {
              console.error("❌ Upload error:", err);
              opts.onError?.(err);
              throw err;
            },
          }
        );

        console.log("✅ All chunks uploaded!");

        // Step 4: Complete upload
        setState("completing");
        console.log("🎯 Step 4: Completing upload...");

        const completeResult = await completeVideoUpload({
          recordingId,
          size: blob.size,
          accessToken,
        });

        console.log("✅ Upload completed:", {
          recordingId: completeResult.recordingId,
          status: completeResult.status,
          playbackUrl: completeResult.playbackUrl
            ? completeResult.playbackUrl.substring(0, 50) + "..."
            : "Not available",
        });

        if (completeResult.playbackUrl) {
          setPlaybackUrl(completeResult.playbackUrl);
        }

        setState("completed");
        // Remove recordingId from sessionStorage when resume completes successfully
        clearRecordingId();
        console.log("🎉 Resume flow complete!");

        return {
          recordingId: completeResult.recordingId,
          playbackUrl: completeResult.playbackUrl,
        };
      } catch (err) {
        const error = err as Error;
        setError(error.message);
        setState("error");
        // Keep recordingId in sessionStorage when resume fails (for retry)
        console.error("❌ Resume failed:", error);
        console.log("💾 Keeping activeRecordingId in sessionStorage for retry");
        throw error;
      }
    },
    [uploadChunks, isAuthenticated, getAccessToken]
  );

  const reset = useCallback(() => {
    setState("idle");
    setProgress(null);
    setError(null);
    setRecordingId(null);
    setPlaybackUrl(null);
    // Clear sessionStorage when resetting
    clearRecordingId();
  }, [clearRecordingId]);

  return {
    state,
    progress,
    error,
    recordingId,
    playbackUrl,
    upload,
    resume,
    reset,
  };
}

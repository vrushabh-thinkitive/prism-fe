import { useState, useCallback } from "react";
import { uploadBlobToGCS, type SimpleUploadOptions } from "../utils/simple-upload";
import { initVideoUpload, completeVideoUpload } from "../utils/api-config";
import { useAuthUser } from "./useAuthUser";

export type UploadState =
  | "idle"
  | "initializing"
  | "uploading"
  | "completing"
  | "completed"
  | "error";

export type UploadProgress = {
  uploadedBytes: number;
  totalBytes: number;
  percentage: number;
};

export type UseSimpleUploadReturn = {
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
  reset: () => void;
};

/**
 * React hook for simple file uploads to GCS (V1 - Browser-Safe)
 *
 * Correct V1 flow (simple & mandatory):
 * 1. Frontend → Backend: "I want to upload a video" (POST /upload/init)
 * 2. Backend → GCP: generate signed PUT URL (NOT resumable)
 * 3. Backend → Frontend: return that upload link
 * 4. Frontend → GCP: upload video using the link (single PUT, no chunking)
 * 5. Frontend → Backend: mark upload complete (POST /upload/complete)
 *
 * Why this approach:
 * - ✅ GCS resumable uploads are NOT reliably browser-compatible
 * - ✅ Single PUT works in Chrome/Safari/Firefox without CORS issues
 * - ✅ No Content-Range header needed
 * - ✅ No 308 responses to handle
 * - ✅ Simple and reliable for V1
 *
 * Mental model: Backend authorizes → Frontend uploads → Backend tracks
 *
 * @example
 * ```tsx
 * const { upload, state, progress, error, recordingId, playbackUrl } = useSimpleUpload();
 *
 * const handleUpload = async () => {
 *   const result = await upload(recordingBlob, {
 *     fileName: "recording.webm",
 *     duration: 120,
 *     onProgress: (progress) => {
 *       console.log(`Uploaded ${progress.percentage}%`);
 *     }
 *   });
 *   console.log("Recording ID:", result.recordingId);
 *   console.log("Playback URL:", result.playbackUrl);
 * };
 * ```
 */
export function useSimpleUpload(): UseSimpleUploadReturn {
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const { getAccessToken, isAuthenticated } = useAuthUser();

  const upload = useCallback(
    async (
      blob: Blob,
      options: {
        fileName?: string;
        duration?: number;
        userId?: string;
        onProgress?: (progress: UploadProgress) => void;
        onError?: (error: Error) => void;
      } = {}
    ): Promise<{
      recordingId: string;
      playbackUrl?: string;
    }> => {
      if (!isAuthenticated) {
        throw new Error("User must be authenticated to upload");
      }

      setError(null);
      setProgress(null);
      setRecordingId(null);
      setPlaybackUrl(null);

      try {
        const fileName = options.fileName || "recording.webm";
        const mimeType = blob.type || "video/webm";
        const accessToken = await getAccessToken();

        // Step 1: Initialize upload session (get signed PUT URL from backend)
        setState("initializing");
        console.log("🚀 Step 1: Initializing upload session...");
        console.log(
          `📊 File: ${fileName} (${(blob.size / 1024 / 1024).toFixed(2)} MB)`
        );

        const initResult = await initVideoUpload({
          fileName,
          fileSize: blob.size,
          mimeType,
          duration: options.duration,
          userId: options?.userId || "user123",
          accessToken,
        });

        console.log("✅ Upload session initialized:", {
          recordingId: initResult.recordingId,
          uploadUrl: initResult.uploadUrl.substring(0, 50) + "...",
          gcsFilePath: initResult.gcsFilePath,
        });

        setRecordingId(initResult.recordingId);

        // Step 2: Upload blob directly to GCS using signed PUT URL
        // IMPORTANT: This is a single PUT request (NOT resumable, NOT chunked)
        setState("uploading");
        console.log("☁️ Step 2: Uploading blob to GCS (single PUT)...");

        await uploadBlobToGCS(blob, initResult.uploadUrl, mimeType, {
          onProgress: (progressData) => {
            setProgress(progressData);
            options.onProgress?.(progressData);
          },
          onError: (err) => {
            console.error("❌ Upload error:", err);
            options.onError?.(err);
            throw err;
          },
        });

        console.log("✅ Upload complete!");

        // Step 3: Complete upload (mark as completed and get playback URL)
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
        console.log("🎉 Upload flow complete!");

        return {
          recordingId: completeResult.recordingId,
          playbackUrl: completeResult.playbackUrl,
        };
      } catch (err) {
        const error = err as Error;
        setError(error.message);
        setState("error");
        console.error("❌ Upload failed:", error);
        throw error;
      }
    },
    [isAuthenticated, getAccessToken]
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


import { useState, useCallback } from "react";
import {
  chunkBlob,
  uploadChunksSequentially,
  type ChunkedUploadOptions,
} from "../utils/chunked-upload";
import { initVideoUpload, completeVideoUpload } from "../utils/api-config";

export type UploadState =
  | "idle"
  | "initializing"
  | "chunking"
  | "uploading"
  | "completing"
  | "completed"
  | "error";

export type UploadProgress = {
  uploadedBytes: number;
  totalBytes: number;
  percentage: number;
  chunkIndex: number;
  totalChunks: number;
};

export type UseChunkedUploadReturn = {
  state: UploadState;
  progress: UploadProgress | null;
  error: string | null;
  recordingId: string | null;
  playbackUrl: string | null;
  upload: (
    blob: Blob,
    options?: ChunkedUploadOptions & {
      fileName?: string;
      duration?: number;
      userId?: string;
    }
  ) => Promise<{
    recordingId: string;
    playbackUrl?: string;
  }>;
  reset: () => void;
};

/**
 * React hook for chunked file uploads to GCS
 *
 * Flow:
 * 1. Call init API to get resumable upload URL
 * 2. Upload chunks directly to GCS
 * 3. Call complete API to mark upload as done and get playback URL
 *
 * @example
 * ```tsx
 * const { upload, state, progress, error, recordingId, playbackUrl } = useChunkedUpload();
 *
 * const handleUpload = async () => {
 *   const result = await upload(recordingBlob, {
 *     chunkSize: 8 * 1024 * 1024, // 8MB chunks
 *     fileName: "recording.webm",
 *     duration: 120, // seconds
 *     onProgress: (progress) => {
 *       console.log(`Uploaded ${progress.percentage}%`);
 *     }
 *   });
 *   console.log("Recording ID:", result.recordingId);
 *   console.log("Playback URL:", result.playbackUrl);
 * };
 * ```
 */
export function useChunkedUpload(): UseChunkedUploadReturn {
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);

  const upload = useCallback(
    async (
      blob: Blob,
      options: ChunkedUploadOptions & {
        fileName?: string;
        duration?: number;
        userId?: string;
      } = {}
    ): Promise<{
      recordingId: string;
      playbackUrl?: string;
    }> => {
      setError(null);
      setProgress(null);
      setRecordingId(null);
      setPlaybackUrl(null);

      try {
        const fileName = options.fileName || "recording.webm";
        const mimeType = blob.type || "video/webm";

        // Step 1: Initialize upload session (get resumable URL from backend)
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
        });

        console.log("✅ Upload session initialized:", {
          recordingId: initResult.recordingId,
          uploadUrl: initResult.uploadUrl.substring(0, 50) + "...",
          gcsFilePath: initResult.gcsFilePath,
        });

        setRecordingId(initResult.recordingId);

        // Step 2: Chunk the blob
        setState("chunking");
        console.log("🔪 Step 2: Chunking blob...");
        const chunkSize = options.chunkSize || 8 * 1024 * 1024; // Default 8MB
        console.log(
          `📦 Chunk size: ${(chunkSize / 1024 / 1024).toFixed(2)} MB`
        );

        const chunks = chunkBlob(blob, {
          ...options,
          uploadId: initResult.recordingId,
        });

        console.log(`✅ Chunking complete: ${chunks.length} chunks created`);

        // Step 3: Upload chunks to GCS sequentially
        // Note: GCS resumable uploads require sequential chunk uploads
        setState("uploading");
        console.log("☁️ Step 3: Uploading chunks to GCS sequentially...");

        const uploadOptions: ChunkedUploadOptions = {
          ...options,
          resumableUrl: initResult.uploadUrl,
          uploadId: initResult.recordingId,
          onProgress: (progressData) => {
            setProgress(progressData);
            options.onProgress?.(progressData);
          },
          onChunkComplete: (chunkIndex, totalChunks) => {
            console.log(`✅ Chunk ${chunkIndex + 1}/${totalChunks} uploaded`);
            options.onChunkComplete?.(chunkIndex, totalChunks);
          },
          onError: (err, chunkIndex) => {
            console.error(`❌ Error uploading chunk ${chunkIndex}:`, err);
            options.onError?.(err, chunkIndex);
          },
        };

        await uploadChunksSequentially(chunks, uploadOptions);

        console.log("✅ All chunks uploaded to GCS");

        // Step 4: Complete upload (mark as completed and get playback URL)
        setState("completing");
        console.log("🎯 Step 4: Completing upload...");

        const completeResult = await completeVideoUpload({
          recordingId: initResult.recordingId,
          size: blob.size,
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
    []
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

/**
 * UploadManager - Singleton class for managing V2 backend-driven resumable uploads
 *
 * Features:
 * - Survives tab switches and route changes (in-memory state)
 * - Does NOT survive page refresh (by design - no blob persistence)
 * - Sequential chunk uploads with retry logic
 * - Progress tracking in memory
 */

const API_BASE_URL = "https://localhost:3018";

export type UploadStatus = "uploading" | "completed" | "error" | "cancelled";

export type UploadMetadata = {
  fileName: string;
  fileSize: number;
  mimeType: string;
  duration?: number;
  userId?: string;
};

export type UploadProgress = {
  recordingId: string;
  status: UploadStatus;
  uploadedBytes: number;
  totalBytes: number;
  progressPercent: number;
  errorMessage?: string;
};

export type UploadCallbacks = {
  onProgress?: (progress: UploadProgress) => void;
  onComplete?: (recordingId: string, playbackUrl?: string) => void;
  onError?: (recordingId: string, error: Error) => void;
  onCancel?: (recordingId: string) => void;
};

type UploadState = {
  recordingId: string;
  blob: Blob;
  chunkSize: number;
  metadata: UploadMetadata;
  callbacks: UploadCallbacks;
  abortController: AbortController;
  status: UploadStatus;
  uploadedBytes: number;
  errorMessage?: string;
};

/**
 * UploadManager - Singleton class for managing resumable uploads
 *
 * Why singleton?
 * - Upload state persists across React component unmounts
 * - Survives route changes and tab switches
 * - Single source of truth for all uploads
 *
 * Why no refresh resume?
 * - Blobs cannot be persisted (too large for localStorage)
 * - IndexedDB/Service Workers are out of scope
 * - Page refresh = new session = new upload required
 */
class UploadManager {
  private static instance: UploadManager;
  private uploads: Map<string, UploadState> = new Map();
  private readonly maxRetries = 3;
  private readonly retryDelays = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get singleton instance
   */
  static getInstance(): UploadManager {
    if (!UploadManager.instance) {
      UploadManager.instance = new UploadManager();
    }
    return UploadManager.instance;
  }

  /**
   * Start a new upload
   */
  async startUpload(
    blob: Blob,
    metadata: UploadMetadata,
    callbacks: UploadCallbacks = {}
  ): Promise<string> {
    try {
      // Step 1: Initialize resumable upload session
      const initResponse = await fetch(
        `${API_BASE_URL}/upload/init-resumable`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileName: metadata.fileName,
            fileSize: metadata.fileSize,
            mimeType: metadata.mimeType,
            duration: metadata.duration,
            userId: metadata.userId || "anonymous",
          }),
        }
      );

      if (!initResponse.ok) {
        const errorText = await initResponse.text().catch(() => "");
        throw new Error(
          `Failed to initialize upload: ${initResponse.status} ${
            initResponse.statusText
          }${errorText ? ` - ${errorText}` : ""}`
        );
      }

      const initResult = await initResponse.json();
      const { recordingId, chunkSize } = initResult;

      console.log("🚀 Upload initialized:", {
        recordingId,
        chunkSize: `${(chunkSize / 1024 / 1024).toFixed(2)} MB`,
        fileSize: `${(blob.size / 1024 / 1024).toFixed(2)} MB`,
      });

      // Step 2: Create upload state
      const abortController = new AbortController();
      const uploadState: UploadState = {
        recordingId,
        blob,
        chunkSize,
        metadata,
        callbacks,
        abortController,
        status: "uploading",
        uploadedBytes: 0,
      };

      this.uploads.set(recordingId, uploadState);

      // Step 3: Start uploading chunks (non-blocking)
      this.uploadChunks(recordingId).catch((error) => {
        console.error("❌ Upload failed:", error);
        const state = this.uploads.get(recordingId);
        if (state) {
          state.status = "error";
          state.errorMessage = error.message;
          this.updateProgress(recordingId);
          callbacks.onError?.(recordingId, error);
        }
      });

      return recordingId;
    } catch (error) {
      const err = error as Error;
      console.error("❌ Failed to start upload:", err);
      throw err;
    }
  }

  /**
   * Resume an existing upload
   *
   * Resume logic:
   * 1. Get current upload status from backend
   * 2. Calculate which chunk to start from
   * 3. Upload remaining chunks sequentially
   *
   * Note: Blob must be provided (cannot be restored after refresh)
   */
  async resumeUpload(
    recordingId: string,
    blob: Blob,
    callbacks: UploadCallbacks = {}
  ): Promise<void> {
    const existingState = this.uploads.get(recordingId);
    if (existingState) {
      // Update blob and callbacks if resuming existing upload
      existingState.blob = blob;
      existingState.callbacks = { ...existingState.callbacks, ...callbacks };
      existingState.status = "uploading";
      existingState.errorMessage = undefined;
      existingState.abortController = new AbortController();
    } else {
      // New resume - need to get chunk size from backend
      const status = await this.getUploadStatus(recordingId);
      const abortController = new AbortController();
      const uploadState: UploadState = {
        recordingId,
        blob,
        chunkSize: status.chunkSize,
        metadata: {
          fileName: "resumed-recording.webm",
          fileSize: blob.size,
          mimeType: blob.type || "video/webm",
        },
        callbacks,
        abortController,
        status: "uploading",
        uploadedBytes: status.uploadedBytes,
      };
      this.uploads.set(recordingId, uploadState);
    }

    console.log("🔄 Resuming upload:", recordingId);

    // Start uploading remaining chunks
    this.uploadChunks(recordingId).catch((error) => {
      console.error("❌ Resume failed:", error);
      const state = this.uploads.get(recordingId);
      if (state) {
        state.status = "error";
        state.errorMessage = error.message;
        this.updateProgress(recordingId);
        callbacks.onError?.(recordingId, error);
      }
    });
  }

  /**
   * Cancel an upload
   */
  cancelUpload(recordingId: string): void {
    const state = this.uploads.get(recordingId);
    if (state) {
      state.abortController.abort();
      state.status = "cancelled";
      this.updateProgress(recordingId);
      state.callbacks.onCancel?.(recordingId);
      console.log("🚫 Upload cancelled:", recordingId);
    }
  }

  /**
   * Get upload progress
   */
  getProgress(recordingId: string): UploadProgress | null {
    const state = this.uploads.get(recordingId);
    if (!state) return null;

    return {
      recordingId: state.recordingId,
      status: state.status,
      uploadedBytes: state.uploadedBytes,
      totalBytes: state.blob.size,
      progressPercent: (state.uploadedBytes / state.blob.size) * 100,
      errorMessage: state.errorMessage,
    };
  }

  /**
   * Get all active uploads
   */
  getAllUploads(): UploadProgress[] {
    return Array.from(this.uploads.values()).map((state) => ({
      recordingId: state.recordingId,
      status: state.status,
      uploadedBytes: state.uploadedBytes,
      totalBytes: state.blob.size,
      progressPercent: (state.uploadedBytes / state.blob.size) * 100,
      errorMessage: state.errorMessage,
    }));
  }

  /**
   * Internal: Upload chunks sequentially
   *
   * Retry logic:
   * - Each chunk retries up to 3 times
   * - Exponential backoff: 1s, 2s, 4s
   * - If all retries fail, upload stops and status = "error"
   */
  private async uploadChunks(recordingId: string): Promise<void> {
    const state = this.uploads.get(recordingId);
    if (!state) {
      throw new Error(`Upload state not found: ${recordingId}`);
    }

    // Get current status from backend to determine starting point
    const backendStatus = await this.getUploadStatus(recordingId);
    const startFromBytes = backendStatus.uploadedBytes;
    const startFromChunk = Math.floor(startFromBytes / state.chunkSize);

    // Slice blob into chunks
    const chunks: Blob[] = [];
    let offset = 0;
    while (offset < state.blob.size) {
      const end = Math.min(offset + state.chunkSize, state.blob.size);
      chunks.push(state.blob.slice(offset, end));
      offset = end;
    }

    console.log(
      `📦 Uploading ${chunks.length} chunks, starting from chunk ${
        startFromChunk + 1
      }`
    );

    // Upload chunks sequentially
    for (let i = startFromChunk; i < chunks.length; i++) {
      // Check if cancelled
      if (state.abortController.signal.aborted) {
        console.log("🚫 Upload cancelled during chunk upload");
        return;
      }

      const chunk = chunks[i];
      const startByte = i * state.chunkSize;
      const endByte = Math.min(startByte + chunk.size - 1, state.blob.size - 1);
      const contentRange = `bytes ${startByte}-${endByte}/${state.blob.size}`;

      // Upload chunk with retry logic
      let uploaded = false;
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < this.maxRetries; attempt++) {
        try {
          const response = await fetch(
            `${API_BASE_URL}/upload/${recordingId}/chunk`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/octet-stream",
                "Content-Range": contentRange,
              },
              body: chunk,
              signal: state.abortController.signal,
            }
          );

          if (!response.ok) {
            const errorText = await response.text().catch(() => "");
            throw new Error(
              `Chunk upload failed: ${response.status} ${response.statusText}${
                errorText ? ` - ${errorText}` : ""
              }`
            );
          }

          const result = await response.json();
          state.uploadedBytes = result.uploadedBytes || endByte + 1;
          uploaded = true;

          console.log(
            `✅ Chunk ${i + 1}/${chunks.length} uploaded: ${(
              (state.uploadedBytes / state.blob.size) *
              100
            ).toFixed(1)}%`
          );

          // Update progress
          this.updateProgress(recordingId);

          // Check if upload is complete
          if (result.done || state.uploadedBytes >= state.blob.size) {
            await this.completeUpload(recordingId);
            return;
          }

          break; // Success, exit retry loop
        } catch (error) {
          lastError = error as Error;

          // Don't retry if aborted
          if (state.abortController.signal.aborted) {
            console.log("🚫 Upload cancelled during retry");
            return;
          }

          // If not the last attempt, wait and retry
          if (attempt < this.maxRetries - 1) {
            const delay = this.retryDelays[attempt];
            console.warn(
              `⚠️ Chunk ${i + 1} attempt ${
                attempt + 1
              } failed, retrying in ${delay}ms...`,
              lastError.message
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      // If chunk upload failed after all retries
      if (!uploaded) {
        state.status = "error";
        state.errorMessage =
          lastError?.message || "Chunk upload failed after retries";
        this.updateProgress(recordingId);
        state.callbacks.onError?.(
          recordingId,
          lastError || new Error("Upload failed")
        );
        throw lastError || new Error("Chunk upload failed");
      }
    }

    // All chunks uploaded, complete the upload
    await this.completeUpload(recordingId);
  }

  /**
   * Internal: Get upload status from backend
   */
  private async getUploadStatus(recordingId: string): Promise<{
    uploadedBytes: number;
    chunkSize: number;
    fileSize: number;
  }> {
    const response = await fetch(
      `${API_BASE_URL}/upload/${recordingId}/status`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `Failed to get upload status: ${response.status} ${
          response.statusText
        }${errorText ? ` - ${errorText}` : ""}`
      );
    }

    return await response.json();
  }

  /**
   * Internal: Complete upload
   */
  private async completeUpload(recordingId: string): Promise<void> {
    const state = this.uploads.get(recordingId);
    if (!state) {
      throw new Error(`Upload state not found: ${recordingId}`);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/upload/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recordingId,
          size: state.blob.size,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
          `Failed to complete upload: ${response.status} ${
            response.statusText
          }${errorText ? ` - ${errorText}` : ""}`
        );
      }

      const result = await response.json();
      state.status = "completed";
      state.uploadedBytes = state.blob.size;
      this.updateProgress(recordingId);

      console.log("✅ Upload completed:", recordingId);
      state.callbacks.onComplete?.(recordingId, result.playbackUrl);
    } catch (error) {
      const err = error as Error;
      state.status = "error";
      state.errorMessage = err.message;
      this.updateProgress(recordingId);
      state.callbacks.onError?.(recordingId, err);
      throw err;
    }
  }

  /**
   * Internal: Update progress and notify callbacks
   */
  private updateProgress(recordingId: string): void {
    const state = this.uploads.get(recordingId);
    if (!state) return;

    const progress: UploadProgress = {
      recordingId: state.recordingId,
      status: state.status,
      uploadedBytes: state.uploadedBytes,
      totalBytes: state.blob.size,
      progressPercent: (state.uploadedBytes / state.blob.size) * 100,
      errorMessage: state.errorMessage,
    };

    state.callbacks.onProgress?.(progress);
  }
}

// Export singleton instance
export const uploadManager = UploadManager.getInstance();

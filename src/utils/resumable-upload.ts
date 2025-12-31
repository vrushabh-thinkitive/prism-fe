/**
 * Resumable Upload Utility - V2 (Backend-Driven)
 *
 * V2 Architecture (Loom-style):
 * - Browser uploads chunks ONLY to backend APIs
 * - Backend controls resumable session, retries, and cloud upload
 * - Frontend is responsible only for:
 *   - slicing blobs
 *   - sending chunks sequentially
 *   - retrying failed chunks
 *   - resuming after refresh
 *
 * IMPORTANT: Browser NEVER uploads directly to GCS in V2.
 */

import { API_ENDPOINTS } from "./api-config";

export type UploadProgress = {
  uploadedBytes: number;
  totalBytes: number;
  percentage: number;
};

export type ResumableUploadOptions = {
  onProgress?: (progress: UploadProgress) => void;
  onError?: (error: Error) => void;
};

export type ChunkUploadResult = {
  uploadedBytes: number;
  done: boolean;
};

/**
 * Upload a single chunk to the backend
 *
 * @param recordingId - Recording ID from init-resumable
 * @param chunk - The chunk blob to upload
 * @param chunkIndex - Zero-based index of the chunk
 * @param chunkSize - Size of each chunk (from backend)
 * @param totalSize - Total file size
 * @param apiBaseUrl - Backend API base URL
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 */
export async function uploadChunk(
  recordingId: string,
  chunk: Blob,
  chunkIndex: number,
  chunkSize: number,
  totalSize: number,
  maxRetries: number = 3
): Promise<ChunkUploadResult> {
  const start = chunkIndex * chunkSize;
  const end = Math.min(start + chunkSize, totalSize);
  const chunkSizeActual = end - start;

  // Content-Range format: bytes start-end/total
  // Note: end is exclusive in Blob.slice, but inclusive in Content-Range
  // So we use end - 1 for Content-Range
  const contentRange = `bytes ${start}-${end - 1}/${totalSize}`;

  console.log(`📤 Uploading chunk ${chunkIndex + 1}:`, {
    range: contentRange,
    size: `${(chunkSizeActual / 1024 / 1024).toFixed(2)} MB`,
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(API_ENDPOINTS.UPLOAD_CHUNK(recordingId), {
        method: "PUT",
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Range": contentRange,
        },
        body: chunk,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
          `Chunk upload failed: ${response.status} ${response.statusText}${
            errorText ? ` - ${errorText}` : ""
          }`
        );
      }

      const result: ChunkUploadResult = await response.json();
      console.log(`✅ Chunk ${chunkIndex + 1} uploaded successfully:`, result);
      return result;
    } catch (error) {
      lastError = error as Error;
      const isLastAttempt = attempt === maxRetries - 1;

      if (isLastAttempt) {
        console.error(
          `❌ Chunk ${chunkIndex + 1} failed after ${maxRetries} attempts:`,
          lastError
        );
        throw lastError;
      }

      // Exponential backoff: wait 1s, 2s, 4s
      const delay = Math.pow(2, attempt) * 1000;
      console.warn(
        `⚠️ Chunk ${chunkIndex + 1} attempt ${
          attempt + 1
        } failed, retrying in ${delay}ms...`,
        lastError.message
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new Error("Chunk upload failed");
}

/**
 * Slice a blob into chunks based on chunk size
 *
 * @param blob - The blob to slice
 * @param chunkSize - Size of each chunk in bytes
 * @returns Array of chunk blobs
 */
export function sliceBlobIntoChunks(blob: Blob, chunkSize: number): Blob[] {
  const chunks: Blob[] = [];
  let start = 0;

  while (start < blob.size) {
    const end = Math.min(start + chunkSize, blob.size);
    const chunk = blob.slice(start, end);
    chunks.push(chunk);
    start = end;
  }

  console.log(`📦 Sliced blob into ${chunks.length} chunks:`, {
    totalSize: `${(blob.size / 1024 / 1024).toFixed(2)} MB`,
    chunkSize: `${(chunkSize / 1024 / 1024).toFixed(2)} MB`,
    chunks: chunks.length,
  });

  return chunks;
}

/**
 * Calculate which chunk index to start from based on uploaded bytes
 *
 * @param uploadedBytes - Number of bytes already uploaded
 * @param chunkSize - Size of each chunk in bytes
 * @returns Zero-based chunk index to start from
 *
 * Examples:
 * - uploadedBytes=0, chunkSize=8MB → returns 0 (start from beginning)
 * - uploadedBytes=8MB, chunkSize=8MB → returns 1 (chunk 0 complete, start chunk 1)
 * - uploadedBytes=4MB, chunkSize=8MB → returns 0 (chunk 0 incomplete, re-upload)
 */
export function calculateStartingChunkIndex(
  uploadedBytes: number,
  chunkSize: number
): number {
  // If no bytes uploaded, start from beginning
  if (uploadedBytes === 0) {
    return 0;
  }

  // Calculate which chunk we're in
  // Math.floor(uploadedBytes / chunkSize) gives us:
  // - The next chunk index if uploadedBytes is exactly on a boundary
  // - The current chunk index if uploadedBytes is in the middle of a chunk
  const chunkIndex = Math.floor(uploadedBytes / chunkSize);

  // If uploadedBytes is exactly at a chunk boundary, chunkIndex is the next chunk to upload
  // If uploadedBytes is in the middle, chunkIndex is the current chunk that needs re-uploading
  // In both cases, we return chunkIndex (the logic works out correctly)
  return chunkIndex;
}

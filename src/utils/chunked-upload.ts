/**
 * Chunked Upload Utility
 * Handles splitting files into chunks and uploading them directly to GCS using resumable upload
 */

export type ChunkMetadata = {
  chunkIndex: number;
  totalChunks: number;
  chunkSize: number;
  totalSize: number;
  fileName: string;
  fileType: string;
  uploadId: string; // Unique identifier for this upload session
  startByte: number;
  endByte: number;
};

export type ChunkData = {
  metadata: ChunkMetadata;
  blob: Blob;
};

export type ChunkedUploadOptions = {
  chunkSize?: number; // Size of each chunk in bytes (default: 8MB for GCS)
  uploadId?: string; // Optional custom upload ID
  resumableUrl?: string; // GCS resumable upload URL
  onProgress?: (progress: {
    uploadedBytes: number;
    totalBytes: number;
    percentage: number;
    chunkIndex: number;
    totalChunks: number;
  }) => void;
  onChunkComplete?: (chunkIndex: number, totalChunks: number) => void;
  onError?: (error: Error, chunkIndex?: number) => void;
};

/**
 * Generate a unique upload ID
 */
export function generateUploadId(): string {
  return `upload_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Split a blob/file into chunks
 * Returns an array of chunk data with metadata
 */
export function chunkBlob(
  blob: Blob,
  options: ChunkedUploadOptions = {}
): ChunkData[] {
  // Default chunk size for GCS resumable uploads (8MB recommended)
  const chunkSize = options.chunkSize || 8 * 1024 * 1024; // Default 8MB
  const totalSize = blob.size;
  const totalChunks = Math.ceil(totalSize / chunkSize);
  const uploadId = options.uploadId || generateUploadId();
  const fileName = blob instanceof File ? blob.name : "recording.webm";
  const fileType = blob.type || "video/webm";

  const chunks: ChunkData[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const startByte = i * chunkSize;
    const endByte = Math.min(startByte + chunkSize, totalSize);
    const chunkBlob = blob.slice(startByte, endByte);

    const metadata: ChunkMetadata = {
      chunkIndex: i,
      totalChunks,
      chunkSize: chunkBlob.size,
      totalSize,
      fileName,
      fileType,
      uploadId,
      startByte,
      endByte,
    };

    chunks.push({
      metadata,
      blob: chunkBlob,
    });
  }

  return chunks;
}

/**
 * Upload a single chunk to GCS using resumable upload protocol
 * Uses PUT request with Content-Range header
 */
export async function uploadChunkToGCS(
  chunkData: ChunkData,
  resumableUrl: string
): Promise<void> {
  const { metadata, blob } = chunkData;

  // Calculate Content-Range header
  // Format: bytes start-end/total
  const startByte = metadata.startByte;
  const endByte = metadata.endByte - 1; // endByte is exclusive, so subtract 1
  const totalSize = metadata.totalSize;
  const contentRange = `bytes ${startByte}-${endByte}/${totalSize}`;

  console.log(
    `📤 Uploading chunk ${metadata.chunkIndex + 1}/${metadata.totalChunks}`,
    {
      range: contentRange,
      size: `${(blob.size / 1024 / 1024).toFixed(2)} MB`,
    }
  );

  // Upload chunk to GCS resumable URL
  const response = await fetch(resumableUrl, {
    method: "PUT",
    headers: {
      "Content-Length": blob.size.toString(),
      "Content-Range": contentRange,
    },
    body: blob,
  });

  // GCS returns different status codes:
  // - 200/201: Upload complete (for last chunk)
  // - 308: Resume Incomplete (for intermediate chunks)
  if (!response.ok && response.status !== 308) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Failed to upload chunk ${metadata.chunkIndex}: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  // Check if upload is complete (200 or 201)
  if (response.status === 200 || response.status === 201) {
    console.log(`✅ Upload complete! Final chunk uploaded.`);
  } else if (response.status === 308) {
    // Get the Range header to verify what was uploaded
    const rangeHeader = response.headers.get("Range");
    if (rangeHeader) {
      console.log(`📊 Upload progress: ${rangeHeader}`);
    }
  }
}

/**
 * Upload all chunks sequentially to GCS
 */
export async function uploadChunksSequentially(
  chunks: ChunkData[],
  options: ChunkedUploadOptions = {}
): Promise<void> {
  if (!options.resumableUrl) {
    throw new Error("Resumable URL is required for GCS upload");
  }

  let uploadedBytes = 0;
  const totalBytes = chunks[0]?.metadata.totalSize || 0;

  for (let i = 0; i < chunks.length; i++) {
    try {
      await uploadChunkToGCS(chunks[i], options.resumableUrl);

      uploadedBytes += chunks[i].metadata.chunkSize;

      // Report progress
      options.onProgress?.({
        uploadedBytes,
        totalBytes,
        percentage: (uploadedBytes / totalBytes) * 100,
        chunkIndex: i,
        totalChunks: chunks.length,
      });

      options.onChunkComplete?.(i, chunks.length);
    } catch (error) {
      const err = error as Error;
      options.onError?.(err, i);
      throw err;
    }
  }
}

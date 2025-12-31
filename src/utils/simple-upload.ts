/**
 * Simple Upload Utility - V1 (Browser-Safe)
 *
 * Uses single PUT signed URL (NOT resumable) for browser compatibility.
 *
 * Why this approach:
 * - ✅ GCS resumable uploads are NOT reliably browser-compatible
 * - ✅ Single PUT works in Chrome/Safari/Firefox without CORS issues
 * - ✅ No Content-Range header needed
 * - ✅ No 308 responses to handle
 * - ✅ Simple and reliable for V1
 *
 * Architecture: Backend authorizes → Frontend uploads → Backend tracks
 */

export type UploadProgress = {
  uploadedBytes: number;
  totalBytes: number;
  percentage: number;
};

export type SimpleUploadOptions = {
  onProgress?: (progress: UploadProgress) => void;
  onError?: (error: Error) => void;
};

/**
 * Upload a blob directly to GCS using a signed PUT URL
 *
 * @param blob - The blob/file to upload
 * @param uploadUrl - Signed PUT URL from backend (NOT resumable)
 * @param mimeType - MIME type of the file (e.g., "video/webm")
 * @param options - Optional progress and error callbacks
 */
export async function uploadBlobToGCS(
  blob: Blob,
  uploadUrl: string,
  mimeType: string,
  options: SimpleUploadOptions = {}
): Promise<void> {
  console.log("📤 Uploading blob to GCS:", {
    size: `${(blob.size / 1024 / 1024).toFixed(2)} MB`,
    type: mimeType,
  });

  try {
    // Use XMLHttpRequest for upload progress tracking
    const xhr = new XMLHttpRequest();

    // Set up progress tracking
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const uploadedBytes = event.loaded;
        const totalBytes = event.total;
        const percentage = (uploadedBytes / totalBytes) * 100;

        options.onProgress?.({
          uploadedBytes,
          totalBytes,
          percentage,
        });

        console.log(
          `📊 Upload progress: ${percentage.toFixed(1)}% (${(
            uploadedBytes /
            1024 /
            1024
          ).toFixed(2)} MB / ${(totalBytes / 1024 / 1024).toFixed(2)} MB)`
        );
      }
    });

    // Set up error handling
    xhr.addEventListener("error", () => {
      const error = new Error("Upload failed: Network error");
      options.onError?.(error);
      throw error;
    });

    // Set up completion handler
    const uploadPromise = new Promise<void>((resolve, reject) => {
      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          console.log("✅ Upload complete!");
          resolve();
        } else {
          const error = new Error(
            `Upload failed: ${xhr.status} ${xhr.statusText}`
          );
          options.onError?.(error);
          reject(error);
        }
      });

      xhr.addEventListener("error", () => {
        const error = new Error("Upload failed: Network error");
        options.onError?.(error);
        reject(error);
      });

      xhr.addEventListener("abort", () => {
        const error = new Error("Upload aborted");
        options.onError?.(error);
        reject(error);
      });
    });

    // Start upload
    xhr.open("PUT", uploadUrl);
    // IMPORTANT: Only set Content-Type. Browser sets Content-Length automatically.
    xhr.setRequestHeader("Content-Type", mimeType);
    // DO NOT set Content-Length - browser handles it automatically
    // DO NOT set Content-Range - this is NOT a resumable upload

    xhr.send(blob);

    await uploadPromise;
  } catch (error) {
    const err = error as Error;
    console.error("❌ Upload error:", err);
    options.onError?.(err);
    throw err;
  }
}

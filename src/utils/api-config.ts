/**
 * API Configuration
 * Centralized configuration for backend API endpoints
 */

import type { Recording } from "../types/recording";

// Backend API base URL
// In production, this should come from environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://localhost:3000";
const PRISM_API_PREFIX = "/api/prism";

/**
 * Video upload API endpoints
 *
 * Flow:
 * 1. POST /upload/init - Backend generates signed PUT URL from GCP (NOT resumable)
 * 2. Frontend uploads directly to GCP using signed URL (single PUT)
 * 3. POST /upload/complete - Backend marks upload as complete
 */
export const API_ENDPOINTS = {
  /**
   * Initialize video upload - creates signed PUT URL (NOT resumable)
   * Backend → GCP: generate signed PUT URL
   * Backend → Frontend: return that upload link
   * POST /upload/init
   */
  INIT_UPLOAD: `${API_BASE_URL}${PRISM_API_PREFIX}/upload/init`,

  /**
   * Initialize resumable upload - creates resumable session (V2)
   * Backend → GCP: create resumable upload session
   * Backend → Frontend: return recordingId and chunkSize
   * POST /upload/init-resumable
   */
  INIT_RESUMABLE_UPLOAD: `${API_BASE_URL}${PRISM_API_PREFIX}/upload/init-resumable`,

  /**
   * Upload chunk - uploads a single chunk to backend (V2)
   * Frontend → Backend: upload chunk with Content-Range
   * Backend → GCP: upload chunk to resumable session
   * PUT /upload/:recordingId/chunk
   */
  UPLOAD_CHUNK: (recordingId: string) =>
    `${API_BASE_URL}${PRISM_API_PREFIX}/upload/${recordingId}/chunk`,

  /**
   * Get upload status - get current upload progress (V2)
   * Frontend → Backend: get upload status
   * GET /upload/:recordingId/status
   */
  GET_UPLOAD_STATUS: (recordingId: string) =>
    `${API_BASE_URL}${PRISM_API_PREFIX}/upload/${recordingId}/status`,

  /**
   * Complete video upload - marks upload as completed
   * Frontend → Backend: mark upload complete
   * POST /upload/complete
   */
  COMPLETE_UPLOAD: `${API_BASE_URL}${PRISM_API_PREFIX}/upload/complete`,

  /**
   * Get all recordings - fetch list of user's recordings
   * Frontend → Backend: get recordings list
   * GET /recordings
   */
  GET_RECORDINGS: `${API_BASE_URL}${PRISM_API_PREFIX}/recordings`,

  /**
   * Get single recording - fetch recording details
   * Frontend → Backend: get recording by ID
   * GET /recordings/:recordingId
   */
  GET_RECORDING: (recordingId: string) =>
    `${API_BASE_URL}${PRISM_API_PREFIX}/recordings/${recordingId}`,

  /**
   * Initialize dual upload - creates dual upload session (screen + webcam)
   * Backend → GCP: create resumable upload sessions for screen and webcam
   * Backend → Frontend: return recordingId and chunkSize
   * POST /upload/init-dual
   */
  INIT_DUAL_UPLOAD: `${API_BASE_URL}${PRISM_API_PREFIX}/upload/init-dual`,

  /**
   * Upload screen chunk - uploads a single screen chunk to backend
   * Frontend → Backend: upload screen chunk with Content-Range
   * Backend → GCP: upload chunk to screen resumable session
   * PUT /upload/:recordingId/screen/chunk
   */
  UPLOAD_SCREEN_CHUNK: (recordingId: string) =>
    `${API_BASE_URL}${PRISM_API_PREFIX}/upload/${recordingId}/screen/chunk`,

  /**
   * Upload webcam chunk - uploads a single webcam chunk to backend
   * Frontend → Backend: upload webcam chunk with Content-Range
   * Backend → GCP: upload chunk to webcam resumable session
   * PUT /upload/:recordingId/webcam/chunk
   */
  UPLOAD_WEBCAM_CHUNK: (recordingId: string) =>
    `${API_BASE_URL}${PRISM_API_PREFIX}/upload/${recordingId}/webcam/chunk`,

  /**
   * Complete dual upload - marks dual upload as completed and triggers merge
   * Frontend → Backend: mark dual upload complete
   * Backend → GCP: merges screen and webcam videos, uploads merged video
   * POST /upload/complete-dual
   */
  COMPLETE_DUAL_UPLOAD: `${API_BASE_URL}${PRISM_API_PREFIX}/upload/complete-dual`,
} as const;

/**
 * Initialize video upload session
 *
 * Flow: Frontend → Backend: "I want to upload a video"
 * Backend → GCP: generate signed PUT URL (NOT resumable - browser-safe)
 * Backend → Frontend: return that upload link
 *
 * Returns signed PUT URL from GCS that frontend will use for direct upload
 * IMPORTANT: This is a simple PUT URL, NOT a resumable upload URL
 */
export async function initVideoUpload(params: {
  fileName: string;
  fileSize: number;
  mimeType: string;
  duration?: number;
  userId?: string;
  accessToken?: string;
}): Promise<{
  recordingId: string;
  uploadUrl: string;
  gcsFilePath: string;
  expiresIn: number;
}> {
  console.log("📤 Initializing upload:", params);
  console.log("🌐 API Endpoint:", API_ENDPOINTS.INIT_UPLOAD);

  try {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (params.accessToken) {
      headers["Authorization"] = `Bearer ${params.accessToken}`;
    }

    const response = await fetch(API_ENDPOINTS.INIT_UPLOAD, {
      method: "POST",
      headers,
      body: JSON.stringify({
        fileName: params.fileName,
        fileSize: params.fileSize,
        mimeType: params.mimeType,
        duration: params.duration,
        ...(params.userId && { userId: params.userId }),
      }),
    });

    // Handle network errors (empty response, connection refused, etc.)
    if (!response.ok) {
      let errorMessage = `Failed to initialize upload: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        // If response is not JSON, try to get text
        try {
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText;
          }
        } catch {
          // Ignore if we can't read response
        }
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log("✅ Upload initialized successfully:", result);
    return result;
  } catch (error) {
    console.error("❌ Upload initialization error:", error);
    throw error;
  }
}

/**
 * Initialize resumable upload session (V2)
 *
 * Flow: Frontend → Backend: "I want to upload a large video"
 * Backend → GCP: create resumable upload session
 * Backend → Frontend: return recordingId and chunkSize
 *
 * Returns recordingId and chunkSize for chunked uploads
 */
export async function initResumableUpload(params: {
  fileName: string;
  fileSize: number;
  mimeType: string;
  duration?: number;
  userId?: string;
  accessToken?: string;
}): Promise<{
  recordingId: string;
  chunkSize: number;
}> {
  console.log("📤 Initializing resumable upload:", params);
  console.log("🌐 API Endpoint:", API_ENDPOINTS.INIT_RESUMABLE_UPLOAD);

  try {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (params.accessToken) {
      headers["Authorization"] = `Bearer ${params.accessToken}`;
    }

    const response = await fetch(API_ENDPOINTS.INIT_RESUMABLE_UPLOAD, {
      method: "POST",
      headers,
      body: JSON.stringify({
        fileName: params.fileName,
        fileSize: params.fileSize,
        mimeType: params.mimeType,
        duration: params.duration,
        ...(params.userId && { userId: params.userId }),
      }),
    });

    if (!response.ok) {
      let errorMessage = `Failed to initialize resumable upload: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        try {
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText;
          }
        } catch {
          // Ignore if we can't read response
        }
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log("✅ Resumable upload initialized successfully:", result);
    return result;
  } catch (error) {
    console.error("❌ Resumable upload initialization error:", error);
    throw error;
  }
}

/**
 * Get upload status (V2)
 *
 * Flow: Frontend → Backend: "What's the upload status?"
 * Backend → Frontend: return uploadedBytes, chunkSize, fileSize
 */
export async function getUploadStatus(params: {
  recordingId: string;
  accessToken?: string;
}): Promise<{
  uploadedBytes: number;
  chunkSize: number;
  fileSize: number;
}> {
  console.log("📊 Getting upload status:", params.recordingId);
  console.log("🌐 API Endpoint:", API_ENDPOINTS.GET_UPLOAD_STATUS(params.recordingId));

  try {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (params.accessToken) {
      headers["Authorization"] = `Bearer ${params.accessToken}`;
    }

    const response = await fetch(API_ENDPOINTS.GET_UPLOAD_STATUS(params.recordingId), {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      let errorMessage = `Failed to get upload status: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        try {
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText;
          }
        } catch {
          // Ignore if we can't read response
        }
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log("✅ Upload status retrieved successfully:", result);
    return result;
  } catch (error) {
    console.error("❌ Get upload status error:", error);
    throw error;
  }
}

/**
 * Complete video upload
 * Marks the upload as completed and returns playback URL
 */
export async function completeVideoUpload(params: {
  recordingId: string;
  size: number;
  accessToken?: string;
}): Promise<{
  success: boolean;
  recordingId: string;
  status: string;
  fileSize: number;
  playbackUrl?: string;
}> {
  console.log("🎯 Completing upload:", params);
  console.log("🌐 API Endpoint:", API_ENDPOINTS.COMPLETE_UPLOAD);

  try {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (params.accessToken) {
      headers["Authorization"] = `Bearer ${params.accessToken}`;
    }

    const response = await fetch(API_ENDPOINTS.COMPLETE_UPLOAD, {
      method: "POST",
      headers,
      body: JSON.stringify({
        recordingId: params.recordingId,
        size: params.size,
      }),
    });

    // Handle network errors
    if (!response.ok) {
      let errorMessage = `Failed to complete upload: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        // If response is not JSON, try to get text
        try {
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText;
          }
        } catch {
          // Ignore if we can't read response
        }
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log("✅ Upload completed successfully:", result);
    return result;
  } catch (error) {
    // Handle network errors
    if (error instanceof TypeError && error.message.includes("fetch")) {
      const networkError = new Error(
        `Cannot connect to backend API at ${API_BASE_URL}. ` +
          `Please ensure the backend server is running.\n` +
          `Original error: ${error.message}`
      );
      console.error("❌ Network error:", networkError.message);
      throw networkError;
    }
    // Re-throw other errors
    console.error("❌ Upload completion error:", error);
    throw error;
  }
}

/**
 * Get all recordings
 * Fetches list of user's recordings
 */
export async function getRecordings(params?: {
  accessToken?: string;
}): Promise<Recording[]> {
  console.log("📋 Fetching recordings...");
  console.log("🌐 API Endpoint:", API_ENDPOINTS.GET_RECORDINGS);

  try {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (params?.accessToken) {
      headers["Authorization"] = `Bearer ${params.accessToken}`;
    }

    const response = await fetch(API_ENDPOINTS.GET_RECORDINGS, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      let errorMessage = `Failed to fetch recordings: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        try {
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText;
          }
        } catch {
          // Ignore if we can't read response
        }
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log("✅ Recordings fetched successfully:", result);
    console.log("📊 Response type:", typeof result);
    console.log("📊 Is array:", Array.isArray(result));

    // Handle different response formats
    let recordings: Recording[] = [];
    if (Array.isArray(result)) {
      recordings = result;
    } else if (result && Array.isArray(result.data)) {
      // Backend might wrap in { data: [...] }
      recordings = result.data;
    } else if (result && Array.isArray(result.recordings)) {
      // Backend might wrap in { recordings: [...] }
      recordings = result.recordings;
    } else if (result && typeof result === "object") {
      // Single recording object? Wrap in array
      recordings = [result];
    }

    console.log("📊 Processed recordings:", recordings);
    console.log("📊 Processed recordings count:", recordings.length);

    return recordings;
  } catch (error) {
    console.error("❌ Fetch recordings error:", error);
    throw error;
  }
}

/**
 * Get single recording by ID
 * Fetches detailed information about a specific recording
 */
export async function getRecording(params: {
  recordingId: string;
  accessToken?: string;
}): Promise<Recording> {
  console.log("📋 Fetching recording:", params.recordingId);
  console.log("🌐 API Endpoint:", API_ENDPOINTS.GET_RECORDING(params.recordingId));

  try {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (params.accessToken) {
      headers["Authorization"] = `Bearer ${params.accessToken}`;
    }

    const response = await fetch(API_ENDPOINTS.GET_RECORDING(params.recordingId), {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      let errorMessage = `Failed to fetch recording: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        try {
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText;
          }
        } catch {
          // Ignore if we can't read response
        }
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log("✅ Recording fetched successfully:", result);
    return result;
  } catch (error) {
    console.error("❌ Fetch recording error:", error);
    throw error;
  }
}

/**
 * Initialize dual upload session
 *
 * Flow: Frontend → Backend: "I want to upload screen + webcam videos"
 * Backend → GCP: create resumable upload sessions for both
 * Backend → Frontend: return recordingId and chunkSize
 *
 * Returns recordingId and chunkSize for chunked uploads
 */
export async function initDualUpload(params: {
  screenSize: number;
  webcamSize: number;
  webcamPosition: number;
  duration: number;
  userId?: string;
  accessToken?: string;
}): Promise<{
  recordingId: string;
  chunkSize: number;
}> {
  console.log("📤 Initializing dual upload:", params);
  console.log("🌐 API Endpoint:", API_ENDPOINTS.INIT_DUAL_UPLOAD);

  try {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (params.accessToken) {
      headers["Authorization"] = `Bearer ${params.accessToken}`;
    }

    const response = await fetch(API_ENDPOINTS.INIT_DUAL_UPLOAD, {
      method: "POST",
      headers,
      body: JSON.stringify({
        screenSize: params.screenSize,
        webcamSize: params.webcamSize,
        webcamPosition: params.webcamPosition,
        duration: params.duration,
        ...(params.userId && { userId: params.userId }),
      }),
    });

    if (!response.ok) {
      let errorMessage = `Failed to initialize dual upload: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        try {
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText;
          }
        } catch {
          // Ignore if we can't read response
        }
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log("✅ Dual upload initialized successfully:", result);
    return result;
  } catch (error) {
    console.error("❌ Dual upload initialization error:", error);
    throw error;
  }
}

/**
 * Upload a single screen chunk to the backend
 *
 * @param recordingId - Recording ID from init-dual
 * @param chunk - The chunk blob to upload
 * @param chunkIndex - Zero-based index of the chunk
 * @param chunkSize - Size of each chunk (from backend)
 * @param totalSize - Total file size
 * @param accessToken - Access token for authentication
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 */
export async function uploadScreenChunk(
  recordingId: string,
  chunk: Blob,
  chunkIndex: number,
  chunkSize: number,
  totalSize: number,
  accessToken: string,
  maxRetries: number = 3
): Promise<{ uploadedBytes: number; done: boolean }> {
  const start = chunkIndex * chunkSize;
  const end = Math.min(start + chunkSize, totalSize);
  const chunkSizeActual = end - start;

  // Content-Range format: bytes start-end/total
  const contentRange = `bytes ${start}-${end - 1}/${totalSize}`;

  console.log(`📤 Uploading screen chunk ${chunkIndex + 1}:`, {
    range: contentRange,
    size: `${(chunkSizeActual / 1024 / 1024).toFixed(2)} MB`,
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const headers: HeadersInit = {
        "Content-Type": "application/octet-stream",
        "Content-Range": contentRange,
        "Authorization": `Bearer ${accessToken}`,
      };

      const response = await fetch(API_ENDPOINTS.UPLOAD_SCREEN_CHUNK(recordingId), {
        method: "PUT",
        headers,
        body: chunk,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
          `Screen chunk upload failed: ${response.status} ${response.statusText}${
            errorText ? ` - ${errorText}` : ""
          }`
        );
      }

      const result = await response.json();
      console.log(`✅ Screen chunk ${chunkIndex + 1} uploaded successfully:`, result);
      return result;
    } catch (error) {
      lastError = error as Error;
      const isLastAttempt = attempt === maxRetries - 1;

      if (isLastAttempt) {
        console.error(
          `❌ Screen chunk ${chunkIndex + 1} failed after ${maxRetries} attempts:`,
          lastError
        );
        throw lastError;
      }

      // Exponential backoff: wait 1s, 2s, 4s
      const delay = Math.pow(2, attempt) * 1000;
      console.warn(
        `⚠️ Screen chunk ${chunkIndex + 1} attempt ${
          attempt + 1
        } failed, retrying in ${delay}ms...`,
        lastError.message
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new Error("Screen chunk upload failed");
}

/**
 * Upload a single webcam chunk to the backend
 *
 * @param recordingId - Recording ID from init-dual
 * @param chunk - The chunk blob to upload
 * @param chunkIndex - Zero-based index of the chunk
 * @param chunkSize - Size of each chunk (from backend)
 * @param totalSize - Total file size
 * @param accessToken - Access token for authentication
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 */
export async function uploadWebcamChunk(
  recordingId: string,
  chunk: Blob,
  chunkIndex: number,
  chunkSize: number,
  totalSize: number,
  accessToken: string,
  maxRetries: number = 3
): Promise<{ uploadedBytes: number; done: boolean }> {
  const start = chunkIndex * chunkSize;
  const end = Math.min(start + chunkSize, totalSize);
  const chunkSizeActual = end - start;

  // Content-Range format: bytes start-end/total
  const contentRange = `bytes ${start}-${end - 1}/${totalSize}`;

  console.log(`📤 Uploading webcam chunk ${chunkIndex + 1}:`, {
    range: contentRange,
    size: `${(chunkSizeActual / 1024 / 1024).toFixed(2)} MB`,
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const headers: HeadersInit = {
        "Content-Type": "application/octet-stream",
        "Content-Range": contentRange,
        "Authorization": `Bearer ${accessToken}`,
      };

      const response = await fetch(API_ENDPOINTS.UPLOAD_WEBCAM_CHUNK(recordingId), {
        method: "PUT",
        headers,
        body: chunk,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
          `Webcam chunk upload failed: ${response.status} ${response.statusText}${
            errorText ? ` - ${errorText}` : ""
          }`
        );
      }

      const result = await response.json();
      console.log(`✅ Webcam chunk ${chunkIndex + 1} uploaded successfully:`, result);
      return result;
    } catch (error) {
      lastError = error as Error;
      const isLastAttempt = attempt === maxRetries - 1;

      if (isLastAttempt) {
        console.error(
          `❌ Webcam chunk ${chunkIndex + 1} failed after ${maxRetries} attempts:`,
          lastError
        );
        throw lastError;
      }

      // Exponential backoff: wait 1s, 2s, 4s
      const delay = Math.pow(2, attempt) * 1000;
      console.warn(
        `⚠️ Webcam chunk ${chunkIndex + 1} attempt ${
          attempt + 1
        } failed, retrying in ${delay}ms...`,
        lastError.message
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new Error("Webcam chunk upload failed");
}

/**
 * Complete dual upload
 * Marks the dual upload as completed, triggers video merge, and returns playback URL
 */
export async function completeDualUpload(params: {
  recordingId: string;
  accessToken?: string;
}): Promise<{
  success: boolean;
  recordingId: string;
  status: string;
  playbackUrl?: string;
  fileSize: number;
}> {
  console.log("🎯 Completing dual upload:", params);
  console.log("🌐 API Endpoint:", API_ENDPOINTS.COMPLETE_DUAL_UPLOAD);

  try {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (params.accessToken) {
      headers["Authorization"] = `Bearer ${params.accessToken}`;
    }

    const response = await fetch(API_ENDPOINTS.COMPLETE_DUAL_UPLOAD, {
      method: "POST",
      headers,
      body: JSON.stringify({
        recordingId: params.recordingId,
      }),
    });

    // Handle network errors
    if (!response.ok) {
      let errorMessage = `Failed to complete dual upload: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        // If response is not JSON, try to get text
        try {
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText;
          }
        } catch {
          // Ignore if we can't read response
        }
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log("✅ Dual upload completed successfully:", result);
    return result;
  } catch (error) {
    // Handle network errors
    if (error instanceof TypeError && error.message.includes("fetch")) {
      const networkError = new Error(
        `Cannot connect to backend API at ${API_BASE_URL}. ` +
          `Please ensure the backend server is running.\n` +
          `Original error: ${error.message}`
      );
      console.error("❌ Network error:", networkError.message);
      throw networkError;
    }
    // Re-throw other errors
    console.error("❌ Dual upload completion error:", error);
    throw error;
  }
}
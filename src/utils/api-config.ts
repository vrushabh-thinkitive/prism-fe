import type { Recording } from "../types/recording";

const API_BASE_URL = "https://localhost:3018";

export const API_ENDPOINTS = {
  INIT_UPLOAD: `${API_BASE_URL}/upload/init`,
  INIT_RESUMABLE_UPLOAD: `${API_BASE_URL}/upload/init-resumable`,
  UPLOAD_CHUNK: (recordingId: string) =>
    `${API_BASE_URL}/upload/${recordingId}/chunk`,
  GET_UPLOAD_STATUS: (recordingId: string) =>
    `${API_BASE_URL}/upload/${recordingId}/status`,
  COMPLETE_UPLOAD: `${API_BASE_URL}/upload/complete`,
  GET_RECORDINGS: `${API_BASE_URL}/recordings`,
  GET_RECORDING: (recordingId: string) =>
    `${API_BASE_URL}/recordings/${recordingId}`,
  INIT_DUAL_UPLOAD: `${API_BASE_URL}/upload/init-dual`,
  UPLOAD_SCREEN_CHUNK: (recordingId: string) =>
    `${API_BASE_URL}/upload/${recordingId}/screen/chunk`,
  UPLOAD_WEBCAM_CHUNK: (recordingId: string) =>
    `${API_BASE_URL}/upload/${recordingId}/webcam/chunk`,
  COMPLETE_DUAL_UPLOAD: `${API_BASE_URL}/upload/complete-dual`,
} as const;

export async function initVideoUpload(params: {
  fileName: string;
  fileSize: number;
  mimeType: string;
  duration?: number;
  userId?: string;
}): Promise<{
  recordingId: string;
  uploadUrl: string;
  gcsFilePath: string;
  expiresIn: number;
}> {
  console.log("📤 Initializing upload:", params);
  console.log("🌐 API Endpoint:", API_ENDPOINTS.INIT_UPLOAD);

  try {
    const response = await fetch(API_ENDPOINTS.INIT_UPLOAD, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName: params.fileName,
        fileSize: params.fileSize,
        mimeType: params.mimeType,
        duration: params.duration,
        ...(params.userId && { userId: params.userId }),
      }),
    });

    if (!response.ok) {
      let errorMessage = `Failed to initialize upload: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        try {
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText;
          }
        } catch {}
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

export async function initResumableUpload(params: {
  fileName: string;
  fileSize: number;
  mimeType: string;
  duration?: number;
  userId?: string;
}): Promise<{
  recordingId: string;
  chunkSize: number;
}> {
  console.log("📤 Initializing resumable upload:", params);
  console.log("🌐 API Endpoint:", API_ENDPOINTS.INIT_RESUMABLE_UPLOAD);

  try {
    const response = await fetch(API_ENDPOINTS.INIT_RESUMABLE_UPLOAD, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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
        } catch {}
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

export async function getUploadStatus(recordingId: string): Promise<{
  uploadedBytes: number;
  chunkSize: number;
  fileSize: number;
}> {
  console.log("📊 Getting upload status:", recordingId);
  console.log("🌐 API Endpoint:", API_ENDPOINTS.GET_UPLOAD_STATUS(recordingId));

  try {
    const response = await fetch(API_ENDPOINTS.GET_UPLOAD_STATUS(recordingId), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
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
        } catch {}
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

export async function completeVideoUpload(params: {
  recordingId: string;
  size: number;
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
    const response = await fetch(API_ENDPOINTS.COMPLETE_UPLOAD, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recordingId: params.recordingId,
        size: params.size,
      }),
    });

    if (!response.ok) {
      let errorMessage = `Failed to complete upload: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        try {
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText;
          }
        } catch {}
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log("✅ Upload completed successfully:", result);
    return result;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("fetch")) {
      const networkError = new Error(
        `Cannot connect to backend API at ${API_BASE_URL}. ` +
          `Please ensure the backend server is running.\n` +
          `Original error: ${error.message}`
      );
      console.error("❌ Network error:", networkError.message);
      throw networkError;
    }
    console.error("❌ Upload completion error:", error);
    throw error;
  }
}

export async function getRecordings(): Promise<Recording[]> {
  console.log("📋 Fetching recordings...");
  console.log("🌐 API Endpoint:", API_ENDPOINTS.GET_RECORDINGS);

  try {
    const response = await fetch(API_ENDPOINTS.GET_RECORDINGS, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
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
        } catch {}
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log("✅ Recordings fetched successfully:", result);
    console.log("📊 Response type:", typeof result);
    console.log("📊 Is array:", Array.isArray(result));

    let recordings: Recording[] = [];
    if (Array.isArray(result)) {
      recordings = result;
    } else if (result && Array.isArray(result.data)) {
      recordings = result.data;
    } else if (result && Array.isArray(result.recordings)) {
      recordings = result.recordings;
    } else if (result && typeof result === "object") {
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

export async function getRecording(recordingId: string): Promise<Recording> {
  console.log("📋 Fetching recording:", recordingId);
  console.log("🌐 API Endpoint:", API_ENDPOINTS.GET_RECORDING(recordingId));

  try {
    const response = await fetch(API_ENDPOINTS.GET_RECORDING(recordingId), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
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
        } catch {}
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

export async function initDualUpload(params: {
  screenSize: number;
  webcamSize: number;
  webcamPosition: number;
  duration: number;
  userId?: string;
}): Promise<{
  recordingId: string;
  chunkSize: number;
}> {
  console.log("📤 Initializing dual upload:", params);
  console.log("🌐 API Endpoint:", API_ENDPOINTS.INIT_DUAL_UPLOAD);

  try {
    const response = await fetch(API_ENDPOINTS.INIT_DUAL_UPLOAD, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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
        } catch {}
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

export async function uploadScreenChunk(
  recordingId: string,
  chunk: Blob,
  chunkIndex: number,
  chunkSize: number,
  totalSize: number,
  maxRetries: number = 3
): Promise<{ uploadedBytes: number; done: boolean }> {
  const start = chunkIndex * chunkSize;
  const end = Math.min(start + chunkSize - 1, totalSize - 1);
  const contentRange = `bytes ${start}-${end}/${totalSize}`;

  console.log(`📤 Uploading screen chunk ${chunkIndex + 1}:`, {
    range: contentRange,
    size: `${(chunk.size / 1024 / 1024).toFixed(2)} MB`,
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(
        API_ENDPOINTS.UPLOAD_SCREEN_CHUNK(recordingId),
        {
          method: "PUT",
          headers: {
            "Content-Type": "video/webm",
            "Content-Range": contentRange,
          },
          body: chunk,
        }
      );

      if (!response.ok) {
        let errorMessage = `Screen chunk upload failed: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          try {
            const errorText = await response.text();
            if (errorText) {
              errorMessage = errorText;
            }
          } catch {}
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log(
        `✅ Screen chunk ${chunkIndex + 1} uploaded successfully:`,
        result
      );
      return result;
    } catch (error) {
      lastError = error as Error;
      const isLastAttempt = attempt === maxRetries - 1;

      if (isLastAttempt) {
        console.error(
          `❌ Screen chunk ${
            chunkIndex + 1
          } failed after ${maxRetries} attempts:`,
          lastError
        );
        throw lastError;
      }

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

  throw lastError || new Error("Screen chunk upload failed");
}

export async function uploadWebcamChunk(
  recordingId: string,
  chunk: Blob,
  chunkIndex: number,
  chunkSize: number,
  totalSize: number,
  maxRetries: number = 3
): Promise<{ uploadedBytes: number; done: boolean }> {
  const start = chunkIndex * chunkSize;
  const end = Math.min(start + chunkSize - 1, totalSize - 1);
  const contentRange = `bytes ${start}-${end}/${totalSize}`;

  console.log(`📤 Uploading webcam chunk ${chunkIndex + 1}:`, {
    range: contentRange,
    size: `${(chunk.size / 1024 / 1024).toFixed(2)} MB`,
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(
        API_ENDPOINTS.UPLOAD_WEBCAM_CHUNK(recordingId),
        {
          method: "PUT",
          headers: {
            "Content-Type": "video/webm",
            "Content-Range": contentRange,
          },
          body: chunk,
        }
      );

      if (!response.ok) {
        let errorMessage = `Webcam chunk upload failed: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          try {
            const errorText = await response.text();
            if (errorText) {
              errorMessage = errorText;
            }
          } catch {}
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log(
        `✅ Webcam chunk ${chunkIndex + 1} uploaded successfully:`,
        result
      );
      return result;
    } catch (error) {
      lastError = error as Error;
      const isLastAttempt = attempt === maxRetries - 1;

      if (isLastAttempt) {
        console.error(
          `❌ Webcam chunk ${
            chunkIndex + 1
          } failed after ${maxRetries} attempts:`,
          lastError
        );
        throw lastError;
      }

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

  throw lastError || new Error("Webcam chunk upload failed");
}

export async function completeDualUpload(params: {
  recordingId: string;
}): Promise<{
  success: boolean;
  recordingId: string;
  status: string;
  playbackUrl: string;
  fileSize: number;
}> {
  console.log("🎯 Completing dual upload:", params);
  console.log("🌐 API Endpoint:", API_ENDPOINTS.COMPLETE_DUAL_UPLOAD);

  try {
    const response = await fetch(API_ENDPOINTS.COMPLETE_DUAL_UPLOAD, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recordingId: params.recordingId,
      }),
    });

    if (!response.ok) {
      let errorMessage = `Failed to complete dual upload: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        try {
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText;
          }
        } catch {}
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log("✅ Dual upload completed successfully:", result);
    return result;
  } catch (error) {
    console.error("❌ Dual upload completion error:", error);
    throw error;
  }
}

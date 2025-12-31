/**
 * Recording type definition
 * Matches backend API response structure
 */
export type RecordingStatus = "uploading" | "completed" | "error" | "initiated";

export type Recording = {
  recordingId: string;
  userId?: string;
  fileName: string;
  fileSize: number;
  duration?: number;
  mimeType?: string;
  status: RecordingStatus;
  createdAt: string; // ISO date string
  updatedAt?: string; // ISO date string
  playbackUrl?: string; // Signed URL for video playback (may expire)
  gcsFilePath?: string;
  error?: string; // Error message if status is "error"
};


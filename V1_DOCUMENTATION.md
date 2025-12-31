# 📚 V1 Simple Upload - Complete Documentation

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [API Specification](#api-specification)
4. [Frontend Implementation](#frontend-implementation)
5. [Backend Requirements](#backend-requirements)
6. [Usage Examples](#usage-examples)
7. [Error Handling](#error-handling)
8. [Security Considerations](#security-considerations)
9. [Performance & Limitations](#performance--limitations)
10. [Testing Guide](#testing-guide)

---

## 🎯 Overview

**V1 Simple Upload** is a browser-safe video upload implementation that uses **single PUT signed URLs** instead of resumable chunked uploads. This approach was chosen because GCS resumable uploads are NOT reliably browser-compatible, even with perfect CORS configuration.

### Key Features

- ✅ **Browser-Compatible**: Works reliably in Chrome, Safari, Firefox
- ✅ **Simple Architecture**: Single PUT request (no chunking)
- ✅ **Progress Tracking**: Real-time upload progress via XMLHttpRequest
- ✅ **Direct Upload**: Browser uploads directly to GCS (no backend proxy)
- ✅ **Secure**: GCP credentials never exposed to browser

### Why V1?

**The Problem with Resumable Uploads:**

- ❌ Browser + Content-Range + 308 responses = frequent CORS failures
- ❌ Resumable uploads designed for server-to-server, not browser-to-GCS
- ❌ Even with correct CORS, browsers struggle with resumable upload protocol

**The V1 Solution:**

- ✅ Simple signed PUT URL - Works reliably across browsers
- ✅ No Content-Range header - Browser handles everything automatically
- ✅ No 308 responses - Just 200/201 success
- ✅ Single PUT request - Upload entire blob in one go

---

## 🏗️ Architecture

### High-Level Flow

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  Frontend   │         │   Backend   │         │     GCS     │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       │ 1. POST /upload/init  │                       │
       │──────────────────────>│                       │
       │                       │                       │
       │                       │ 2. Generate signed    │
       │                       │    PUT URL            │
       │                       │──────────────────────>│
       │                       │                       │
       │ 3. Return uploadUrl   │                       │
       │<──────────────────────│                       │
       │                       │                       │
       │ 4. PUT {uploadUrl}    │                       │
       │──────────────────────────────────────────────>│
       │    (Direct upload)    │                       │
       │                       │                       │
       │ 5. POST /upload/complete                      │
       │──────────────────────>│                       │
       │                       │                       │
       │ 6. Return playbackUrl │                       │
       │<──────────────────────│                       │
       │                       │                       │
```

### Mental Model

**Backend authorizes → Frontend uploads → Backend tracks**

1. **Backend Authorizes**: Generates signed PUT URL with proper permissions
2. **Frontend Uploads**: Browser uploads directly to GCS using signed URL
3. **Backend Tracks**: Backend marks upload as complete and provides playback URL

---

## 🔌 API Specification

### Base URL

```
https://localhost:3018
```

### Endpoint 1: Initialize Upload

**POST** `/upload/init`

**Purpose:** Get signed PUT URL from backend for direct GCS upload.

**Request Body:**

```typescript
{
  fileName: string;      // Required: e.g., "recording-2024-01-15.webm"
  fileSize: number;     // Required: file size in bytes
  mimeType: string;     // Required: e.g., "video/webm"
  duration?: number;     // Optional: recording duration in seconds
  userId?: string;      // Optional: user identifier (defaults to "anonymous")
}
```

**Response (200 OK):**

```typescript
{
  recordingId: string; // Unique identifier for this recording
  uploadUrl: string; // GCS signed PUT URL (expires in 15 minutes)
  gcsFilePath: string; // GCS object path
  expiresIn: number; // URL expiration time in seconds (typically 900)
}
```

**Error Responses:**

**400 Bad Request:**

```typescript
{
  error: string; // e.g., "fileName is required"
}
```

**500 Internal Server Error:**

```typescript
{
  error: string; // e.g., "Failed to create upload session"
}
```

### Endpoint 2: Direct Upload to GCS

**PUT** `{uploadUrl}` (Direct to GCS)

**Purpose:** Upload video blob directly to GCS using signed PUT URL.

**IMPORTANT:** This is a single PUT request (NOT resumable, NOT chunked).

**Request:**

```
PUT {uploadUrl}
Content-Type: {mimeType}  // e.g., "video/webm"

{blob}  // Entire video blob (binary data)
```

**Response:**

```
Status: 200 OK  // or 201 Created
```

**Notes:**

- ✅ Frontend uploads entire blob in single PUT request
- ✅ DO NOT set Content-Length header (browser sets it automatically)
- ✅ DO NOT set Content-Range header (this is NOT a resumable upload)
- ✅ Backend is NOT involved in this step (direct browser → GCS)
- ✅ Use XMLHttpRequest for upload progress tracking

### Endpoint 3: Complete Upload

**POST** `/upload/complete`

**Purpose:** Mark upload as completed and get playback URL.

**Request Body:**

```typescript
{
  recordingId: string; // Required: from /upload/init response
  size: number; // Required: final file size in bytes
}
```

**Response (200 OK):**

```typescript
{
  success: boolean;      // Always true on success
  recordingId: string;   // Echo of provided recordingId
  status: string;       // "completed"
  fileSize: number;      // Echo of provided size
  playbackUrl?: string;  // Optional: signed URL for video playback (expires in 7 days)
}
```

**Error Responses:**

**400 Bad Request:**

```typescript
{
  error: string; // e.g., "recordingId is required"
}
```

**404 Not Found:**

```typescript
{
  error: string; // e.g., "Recording not found"
}
```

**500 Internal Server Error:**

```typescript
{
  error: string; // e.g., "Failed to complete upload"
}
```

---

## 💻 Frontend Implementation

### File Structure

```
src/
├── hooks/
│   └── useSimpleUpload.ts      # React hook for upload functionality
├── utils/
│   ├── simple-upload.ts        # Core upload utility
│   └── api-config.ts           # API endpoint configuration
└── components/
    └── ScreenRecorder.tsx      # UI component using the hook
```

### Core Components

#### 1. `useSimpleUpload` Hook

**Location:** `src/hooks/useSimpleUpload.ts`

**Purpose:** React hook that manages the complete upload flow.

**API:**

```typescript
const {
  state, // UploadState: "idle" | "initializing" | "uploading" | "completing" | "completed" | "error"
  progress, // UploadProgress | null
  error, // string | null
  recordingId, // string | null
  playbackUrl, // string | null
  upload, // Function to start upload
  reset, // Function to reset state
} = useSimpleUpload();
```

**Upload Function:**

```typescript
await upload(blob, {
  fileName?: string;      // Optional: defaults to "recording.webm"
  duration?: number;      // Optional: recording duration in seconds
  userId?: string;       // Optional: user identifier
  onProgress?: (progress: UploadProgress) => void;
  onError?: (error: Error) => void;
});
```

**Returns:**

```typescript
{
  recordingId: string;
  playbackUrl?: string;
}
```

**Example Usage:**

```typescript
import { useSimpleUpload } from "../hooks/useSimpleUpload";

function MyComponent() {
  const { upload, state, progress, error, recordingId, playbackUrl } =
    useSimpleUpload();

  const handleUpload = async (blob: Blob) => {
    try {
      const result = await upload(blob, {
        fileName: "my-recording.webm",
        duration: 120,
        onProgress: (progress) => {
          console.log(`Uploaded ${progress.percentage}%`);
        },
      });
      console.log("Recording ID:", result.recordingId);
      console.log("Playback URL:", result.playbackUrl);
    } catch (err) {
      console.error("Upload failed:", err);
    }
  };

  return (
    <div>
      {state === "uploading" && progress && (
        <div>Progress: {progress.percentage.toFixed(1)}%</div>
      )}
      {error && <div>Error: {error}</div>}
      {playbackUrl && <video src={playbackUrl} controls />}
    </div>
  );
}
```

#### 2. `uploadBlobToGCS` Utility

**Location:** `src/utils/simple-upload.ts`

**Purpose:** Core function that uploads a blob to GCS using XMLHttpRequest.

**API:**

```typescript
await uploadBlobToGCS(
  blob: Blob,
  uploadUrl: string,
  mimeType: string,
  options?: {
    onProgress?: (progress: UploadProgress) => void;
    onError?: (error: Error) => void;
  }
);
```

**Key Features:**

- Uses XMLHttpRequest for upload progress tracking
- Single PUT request (no chunking)
- Only sets Content-Type header (browser sets Content-Length automatically)
- No Content-Range header (not a resumable upload)

**Implementation Details:**

- Progress tracking via `xhr.upload.addEventListener("progress")`
- Error handling for network errors, HTTP errors, and aborts
- Returns Promise that resolves on success or rejects on error

#### 3. API Configuration

**Location:** `src/utils/api-config.ts`

**Purpose:** Centralized API endpoint configuration and helper functions.

**Exports:**

- `API_ENDPOINTS`: Object with endpoint URLs
- `initVideoUpload()`: Function to initialize upload session
- `completeVideoUpload()`: Function to complete upload

**Configuration:**

```typescript
const API_BASE_URL = "https://localhost:3018";

export const API_ENDPOINTS = {
  INIT_UPLOAD: `${API_BASE_URL}/upload/init`,
  COMPLETE_UPLOAD: `${API_BASE_URL}/upload/complete`,
};
```

---

## 🔧 Backend Requirements

### Required Changes

#### 1. Update `/upload/init` Endpoint

**Before (Resumable - DON'T USE):**

```typescript
// ❌ DON'T USE THIS FOR BROWSER UPLOADS
const [resumableUrl] = await file.createResumableUpload({
  metadata: { contentType: "video/webm" },
});
```

**After (Simple PUT - USE THIS):**

```typescript
// ✅ USE THIS FOR BROWSER UPLOADS
const [url] = await file.getSignedUrl({
  version: "v4",
  action: "write",
  expires: Date.now() + 15 * 60 * 1000, // 15 minutes
  contentType: "video/webm",
});

return {
  recordingId,
  uploadUrl: url, // Simple PUT URL
  gcsFilePath,
  expiresIn: 900, // 15 minutes
};
```

#### 2. Key Differences

| Aspect         | Resumable (V0)        | Simple PUT (V1) |
| -------------- | --------------------- | --------------- |
| URL Type       | Resumable session URL | Signed PUT URL  |
| Expiration     | 1 hour                | 15 minutes      |
| Browser Compat | ❌ Unreliable         | ✅ Reliable     |
| Chunking       | Required              | Not needed      |
| Content-Range  | Required              | Not used        |
| 308 Responses  | Yes                   | No              |

#### 3. Backend Responsibilities

**For `/upload/init`:**

1. ✅ Validate input (fileName, fileSize, mimeType required)
2. ✅ Validate file size (max 2GB recommended)
3. ✅ Generate unique recordingId
4. ✅ Create GCS signed PUT URL (NOT resumable - use `file.getSignedUrl()`)
5. ✅ Set proper metadata (contentType, custom metadata)
6. ✅ Save recording record to MongoDB (status: "initiated")
7. ✅ Return signed PUT URL (expires in 15 minutes)

**For `/upload/complete`:**

1. ✅ Validate input (recordingId, size required)
2. ✅ Find recording in MongoDB
3. ✅ Verify file exists in GCS (handle eventual consistency)
4. ✅ Update MongoDB status to "completed"
5. ✅ Generate signed playback URL (7-day expiration)
6. ✅ Return completion confirmation

### CORS Configuration

Ensure your GCS bucket CORS allows:

```json
[
  {
    "origin": ["http://localhost:3000", "https://yourdomain.com"],
    "method": ["PUT"],
    "responseHeader": ["Content-Type", "Content-Length"],
    "maxAgeSeconds": 3600
  }
]
```

**Important:** Do NOT include `Content-Range` in `responseHeader` - we're not using resumable uploads.

---

## 📖 Usage Examples

### Basic Upload

```typescript
import { useSimpleUpload } from "../hooks/useSimpleUpload";

function UploadComponent() {
  const { upload, state, progress } = useSimpleUpload();

  const handleUpload = async (blob: Blob) => {
    await upload(blob, {
      fileName: "recording.webm",
      duration: 120,
    });
  };

  return (
    <div>
      <button onClick={() => handleUpload(myBlob)}>Upload</button>
      {state === "uploading" && (
        <div>Progress: {progress?.percentage.toFixed(1)}%</div>
      )}
    </div>
  );
}
```

### Upload with Progress Tracking

```typescript
const { upload, progress } = useSimpleUpload();

await upload(blob, {
  fileName: "recording.webm",
  onProgress: (progress) => {
    console.log(`Uploaded: ${progress.uploadedBytes} / ${progress.totalBytes}`);
    console.log(`Percentage: ${progress.percentage.toFixed(1)}%`);
  },
});
```

### Upload with Error Handling

```typescript
const { upload, error } = useSimpleUpload();

try {
  await upload(blob, {
    fileName: "recording.webm",
    onError: (err) => {
      console.error("Upload error:", err);
      // Show user-friendly error message
    },
  });
} catch (err) {
  console.error("Upload failed:", err);
  // Handle error
}
```

### Complete Example (ScreenRecorder Component)

```typescript
import { useSimpleUpload } from "../hooks/useSimpleUpload";

function ScreenRecorder() {
  const { upload, state, progress, error, playbackUrl } = useSimpleUpload();
  const [blob, setBlob] = useState<Blob | null>(null);

  const handleUpload = async () => {
    if (!blob) return;

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `recording-${timestamp}.webm`;

      const result = await upload(blob, {
        fileName,
        duration: 120,
      });

      console.log("Upload successful:", result);
    } catch (error) {
      console.error("Upload failed:", error);
    }
  };

  return (
    <div>
      {/* Recording UI */}

      {blob && (
        <div>
          <button onClick={handleUpload}>Upload Recording</button>

          {state === "uploading" && progress && (
            <div>
              <div>Progress: {progress.percentage.toFixed(1)}%</div>
              <progress value={progress.percentage} max={100} />
            </div>
          )}

          {error && <div>Error: {error}</div>}

          {playbackUrl && <video src={playbackUrl} controls />}
        </div>
      )}
    </div>
  );
}
```

---

## ⚠️ Error Handling

### Upload States

The `useSimpleUpload` hook manages the following states:

- `idle`: Initial state, ready to upload
- `initializing`: Requesting signed URL from backend
- `uploading`: Uploading blob to GCS
- `completing`: Marking upload as complete
- `completed`: Upload finished successfully
- `error`: Upload failed

### Error Types

1. **Network Errors**

   - Connection refused (backend not running)
   - Network timeout
   - CORS errors

2. **HTTP Errors**

   - 400 Bad Request (invalid input)
   - 404 Not Found (recording not found)
   - 500 Internal Server Error (backend error)

3. **Upload Errors**
   - GCS upload failure
   - Signed URL expiration
   - File size exceeded

### Error Handling Example

```typescript
const { upload, error, state } = useSimpleUpload();

try {
  await upload(blob, {
    onError: (err) => {
      // Handle error during upload
      if (err.message.includes("Network")) {
        console.error("Network error - check connection");
      } else if (err.message.includes("expired")) {
        console.error("Upload URL expired - retry upload");
      } else {
        console.error("Upload error:", err);
      }
    },
  });
} catch (err) {
  // Handle error from upload function
  if (state === "error") {
    console.error("Upload failed:", error);
  }
}
```

---

## 🔒 Security Considerations

### Current Implementation (Development)

- ✅ userId from request body (with fallback to "anonymous")
- ✅ Signed URLs expire after 15 minutes
- ✅ GCP credentials never exposed to browser

### Production Recommendations

1. **Add JWT Authentication:**

   ```typescript
   Authorization: Bearer {jwt_token}
   ```

2. **Extract userId from JWT:**

   ```typescript
   const userId = req.user?.sub; // From JWT middleware
   ```

3. **Validate User Ownership:**

   ```typescript
   // In /upload/complete, verify user owns the recording
   if (recording.userId !== req.user?.sub) {
     return res.status(403).json({ error: "Forbidden" });
   }
   ```

4. **Rate Limiting:**

   - Consider adding rate limits for upload init/complete
   - Prevent abuse of signed URL generation

5. **Signed URL Expiration:**
   - **15 minutes** is sufficient for most uploads
   - If upload fails, user can retry (new signed URL will be generated)
   - Prevents URL reuse after expiration

---

## 📊 Performance & Limitations

### File Size Limits

**V1 (Simple PUT):**

- ✅ Works reliably up to ~500MB
- ⚠️ May timeout for very large files (>1GB)
- ✅ Perfect for screen recordings (typically 10-100MB)

**Future V2+ (Resumable):**

- Can handle files >1GB
- Requires more complex error handling
- Better for very large uploads

### Upload Progress

- ✅ XMLHttpRequest provides accurate progress tracking
- ✅ Works in all modern browsers
- ✅ No need for manual chunk progress calculation

### Performance Considerations

1. **Single Request:** Entire blob uploaded in one PUT request
2. **No Chunking:** Simpler but may timeout for very large files
3. **Direct Upload:** Browser → GCS (no backend proxy, more efficient)
4. **Progress Tracking:** Real-time progress updates via XMLHttpRequest

---

## 🧪 Testing Guide

### Test 1: Verify Simple PUT Works

```bash
# Get signed URL from backend
curl -X POST http://localhost:3018/upload/init \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "test.webm",
    "fileSize": 1000000,
    "mimeType": "video/webm"
  }'

# Use the uploadUrl to upload directly
curl -X PUT "{uploadUrl}" \
  -H "Content-Type: video/webm" \
  --upload-file test.webm
```

### Test 2: Browser Upload

1. Record a video in the app
2. Click "Upload Recording"
3. Check browser DevTools → Network tab
4. Verify:
   - ✅ Single PUT request (not multiple chunk requests)
   - ✅ No Content-Range header
   - ✅ No 308 responses
   - ✅ 200/201 success response

### Test 3: Error Scenarios

1. **Backend Not Running:**

   - Should show network error
   - Should handle gracefully

2. **Invalid File Size:**

   - Should show 400 error from backend
   - Should display user-friendly message

3. **Signed URL Expiration:**
   - Wait 15+ minutes after getting URL
   - Try to upload - should fail with expiration error
   - Should allow retry with new URL

### Test 4: Progress Tracking

1. Upload a large file (>10MB)
2. Verify progress updates in real-time
3. Check that percentage increases smoothly
4. Verify uploaded/total bytes are accurate

---

## 📝 Summary

### What V1 Provides

- ✅ Browser-safe video uploads
- ✅ Simple architecture (single PUT request)
- ✅ Real-time progress tracking
- ✅ Direct browser → GCS upload
- ✅ Secure (credentials never exposed)

### What V1 Doesn't Support

- ❌ Resumable uploads (use V2+ for files >500MB)
- ❌ Chunked uploads (not needed for V1)
- ❌ Upload pause/resume (single request)

### When to Use V1

- ✅ Screen recordings (typically 10-100MB)
- ✅ Files up to ~500MB
- ✅ Simple upload requirements
- ✅ Browser compatibility is critical

### When to Consider V2+

- Files >500MB
- Need resumable uploads
- Need upload pause/resume
- More complex error recovery

---

## 📚 References

- [GCS Signed URLs Documentation](https://cloud.google.com/storage/docs/access-control/signing-urls-with-helpers)
- [XMLHttpRequest Upload Progress](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/upload)
- [API Specification](./API_SPECIFICATION.md)
- [Migration Guide](./V1_SIMPLE_UPLOAD_MIGRATION.md)

---

**Last Updated:** 2024-01-15  
**Version:** V1 (Simple PUT)  
**Status:** ✅ Production Ready

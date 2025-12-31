# 📚 V2 Resumable Upload - Documentation

## 🎯 Overview

**V2 Resumable Upload** is a backend-driven chunked upload system designed for large files (>500MB). Unlike V1 which uploads directly to Google Cloud Storage (GCS), V2 uploads chunks through your backend, which then handles the GCS resumable upload.

### Key Features

- ✅ **Resumable Uploads**: Resume after page refresh or network interruption
- ✅ **Large File Support**: Handles files >500MB reliably
- ✅ **Backend-Driven**: Browser uploads to backend, backend handles GCS
- ✅ **Chunked Uploads**: Files split into manageable chunks (typically 8MB)
- ✅ **Progress Tracking**: Real-time upload progress with retry logic
- ✅ **Automatic Retry**: Failed chunks retry automatically with exponential backoff

---

## 🏗️ Architecture

### High-Level Flow

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  Frontend   │         │   Backend   │         │     GCS     │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       │ 1. POST /upload/init-resumable              │
       │──────────────────────>│                       │
       │                       │ 2. Create resumable   │
       │                       │    session            │
       │                       │──────────────────────>│
       │                       │                       │
       │ 3. Return recordingId │                       │
       │    & chunkSize         │                       │
       │<──────────────────────│                       │
       │                       │                       │
       │ 4. PUT /upload/:id/chunk (chunk 0)          │
       │──────────────────────>│                       │
       │                       │ 5. Upload chunk to GCS│
       │                       │──────────────────────>│
       │                       │                       │
       │ 6. PUT /upload/:id/chunk (chunk 1)          │
       │──────────────────────>│                       │
       │                       │ 7. Upload chunk to GCS│
       │                       │──────────────────────>│
       │                       │                       │
       │ ... (repeat for all chunks)                  │
       │                       │                       │
       │ 8. POST /upload/complete                      │
       │──────────────────────>│                       │
       │                       │ 9. Finalize upload    │
       │                       │──────────────────────>│
       │                       │                       │
       │ 10. Return playbackUrl│                       │
       │<──────────────────────│                       │
       │                       │                       │
```

### Mental Model

**Frontend chunks → Backend proxies → GCS resumable session**

1. **Frontend**: Splits file into chunks and uploads sequentially to backend
2. **Backend**: Receives chunks and uploads them to GCS resumable session
3. **GCS**: Stores chunks and assembles final file

---

## 🔌 API Specification

### Base URL

```
https://localhost:3018
```

### Endpoint 1: Initialize Resumable Upload

**POST** `/upload/init-resumable`

**Purpose:** Create a resumable upload session and get chunk size.

**Request Body:**

```typescript
{
  fileName: string;      // Required: e.g., "recording-2024-01-15.webm"
  fileSize: number;      // Required: file size in bytes
  mimeType: string;      // Required: e.g., "video/webm"
  duration?: number;     // Optional: recording duration in seconds
  userId?: string;       // Optional: user identifier
}
```

**Response (200 OK):**

```typescript
{
  recordingId: string; // Unique identifier for this recording
  chunkSize: number; // Chunk size in bytes (typically 8MB)
}
```

### Endpoint 2: Upload Chunk

**PUT** `/upload/:recordingId/chunk`

**Purpose:** Upload a single chunk to the backend.

**Request Headers:**

```
Content-Type: application/octet-stream
Content-Range: bytes {start}-{end}/{total}
```

**Request Body:**

```
{chunk binary data}
```

**Response (200 OK):**

```typescript
{
  uploadedBytes: number; // Total bytes uploaded so far
  done: boolean; // true if all chunks uploaded
}
```

### Endpoint 3: Get Upload Status

**GET** `/upload/:recordingId/status`

**Purpose:** Get current upload progress (for resume functionality).

**Response (200 OK):**

```typescript
{
  uploadedBytes: number; // Bytes uploaded so far
  chunkSize: number; // Chunk size in bytes
  fileSize: number; // Total file size
}
```

### Endpoint 4: Complete Upload

**POST** `/upload/complete`

**Purpose:** Mark upload as completed and get playback URL.

**Request Body:**

```typescript
{
  recordingId: string; // Required: from init-resumable
  size: number; // Required: final file size
}
```

**Response (200 OK):**

```typescript
{
  success: boolean;
  recordingId: string;
  status: string;       // "completed"
  fileSize: number;
  playbackUrl?: string; // Signed URL for video playback (expires in 7 days)
}
```

---

## 💻 Frontend Implementation

### File Structure

```
src/
├── hooks/
│   └── useResumableUpload.ts    # React hook for V2 uploads
├── utils/
│   ├── resumable-upload.ts      # Core chunk upload utilities
│   └── api-config.ts            # API endpoint configuration
└── components/
    └── ScreenRecorder.tsx       # UI component using the hook
```

### Core Hook: `useResumableUpload`

**Location:** `src/hooks/useResumableUpload.ts`

**Usage:**

```typescript
import { useResumableUpload } from "../hooks/useResumableUpload";

function MyComponent() {
  const { upload, resume, state, progress, error, recordingId, playbackUrl } =
    useResumableUpload();

  const handleUpload = async (blob: Blob) => {
    try {
      const result = await upload(blob, {
        fileName: "recording.webm",
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

  // Resume existing upload
  const handleResume = async (recordingId: string, blob: Blob) => {
    try {
      const result = await resume(recordingId, blob);
      console.log("Resumed upload:", result);
    } catch (err) {
      console.error("Resume failed:", err);
    }
  };

  return (
    <div>
      {state === "uploading" && progress && (
        <div>
          Progress: {progress.percentage.toFixed(1)}%
          <progress value={progress.percentage} max={100} />
        </div>
      )}
      {error && <div>Error: {error}</div>}
      {playbackUrl && <video src={playbackUrl} controls />}
    </div>
  );
}
```

### Upload States

- `idle`: Ready to upload
- `initializing`: Requesting upload session from backend
- `uploading`: Uploading chunks
- `completing`: Finalizing upload
- `completed`: Upload finished successfully
- `error`: Upload failed

---

## 🔄 Complete Flow Example

### Step 1: Initialize Upload Session

```typescript
const initResult = await initResumableUpload({
  fileName: "recording.webm",
  fileSize: 15728640, // 15 MB
  mimeType: "video/webm",
  duration: 120,
});

// Returns: { recordingId: "507f1f77bcf86cd799439011", chunkSize: 8388608 }
```

### Step 2: Upload Chunks Sequentially

```typescript
// File is split into chunks (e.g., 8MB each)
// Chunk 0: bytes 0-8388607/15728640
await uploadChunk(recordingId, chunk0, 0, chunkSize, totalSize);

// Chunk 1: bytes 8388608-15728639/15728640
await uploadChunk(recordingId, chunk1, 1, chunkSize, totalSize);

// ... continues until all chunks uploaded
```

### Step 3: Complete Upload

```typescript
const result = await completeVideoUpload({
  recordingId: "507f1f77bcf86cd799439011",
  size: 15728640,
});

// Returns: { success: true, playbackUrl: "https://..." }
```

---

## 🔄 Resume Functionality

V2 supports resuming uploads after page refresh or network interruption:

```typescript
// Get upload status
const status = await getUploadStatus(recordingId);
// Returns: { uploadedBytes: 8388608, chunkSize: 8388608, fileSize: 15728640 }

// Resume from where it left off
const result = await resume(recordingId, blob);
// Automatically calculates which chunk to start from
// Only uploads remaining chunks
```

---

## ⚙️ Key Differences: V1 vs V2

| Feature             | V1 (Simple)       | V2 (Resumable)         |
| ------------------- | ----------------- | ---------------------- |
| **Upload Method**   | Single PUT to GCS | Chunked PUT to backend |
| **File Size Limit** | ~500MB            | Unlimited              |
| **Resume Support**  | ❌ No             | ✅ Yes                 |
| **Browser → GCS**   | Direct            | Via backend            |
| **Chunking**        | No                | Yes (sequential)       |
| **Use Case**        | Small files       | Large files            |

### When to Use V2

- ✅ Files >500MB
- ✅ Need resume after refresh
- ✅ Unstable network connections
- ✅ Large screen recordings

### When to Use V1

- ✅ Files <500MB
- ✅ Simple upload requirements
- ✅ Stable network connections
- ✅ Screen recordings (typically 10-100MB)

---

## 🔧 Backend Requirements

### 1. Initialize Resumable Session

```typescript
// Backend creates GCS resumable upload session
const [resumableUrl] = await file.createResumableUpload({
  metadata: { contentType: "video/webm" },
});

// Store resumableUrl in database with recordingId
// Return recordingId and chunkSize to frontend
```

### 2. Handle Chunk Uploads

```typescript
// Receive chunk from frontend
// Upload chunk to GCS resumable session using Content-Range
await fetch(resumableUrl, {
  method: "PUT",
  headers: {
    "Content-Range": `bytes ${start}-${end}/${total}`,
  },
  body: chunk,
});

// Track uploaded bytes in database
```

### 3. Complete Upload

```typescript
// Verify all chunks uploaded
// Generate signed playback URL
// Update database status to "completed"
```

---

## ⚠️ Error Handling

### Automatic Retry

- Failed chunks retry automatically (up to 3 attempts)
- Exponential backoff: 1s, 2s, 4s delays
- Network errors handled gracefully

### Error States

- Network errors: Connection refused, timeout
- HTTP errors: 400, 404, 500 responses
- Upload errors: Chunk upload failures

---

## 🔒 Security Considerations

### Current Implementation

- ✅ userId from request body (with fallback)
- ✅ Backend validates all inputs
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
   // Verify user owns the recording before allowing resume
   if (recording.userId !== req.user?.sub) {
     return res.status(403).json({ error: "Forbidden" });
   }
   ```

---

## 📊 Performance & Limitations

### Performance

- ✅ Sequential chunk uploads (prevents server overload)
- ✅ Automatic retry on failures
- ✅ Progress tracking for each chunk
- ✅ Resume capability reduces wasted bandwidth

### Limitations

- ⚠️ Sequential uploads (not parallel) - slower but more reliable
- ⚠️ Requires backend to proxy chunks to GCS
- ⚠️ More complex than V1 simple upload

---

## 🧪 Testing Guide

### Test 1: Basic Upload

1. Record a video (>500MB)
2. Click "Upload Recording"
3. Verify chunks upload sequentially
4. Check progress updates in real-time
5. Verify playback URL received after completion

### Test 2: Resume Functionality

1. Start uploading a large file
2. Refresh page mid-upload
3. Call `resume(recordingId, blob)`
4. Verify upload continues from correct chunk
5. Verify no duplicate chunks uploaded

### Test 3: Error Recovery

1. Disconnect network mid-upload
2. Verify automatic retry attempts
3. Reconnect network
4. Verify upload continues successfully

---

## 📝 Summary

### What V2 Provides

- ✅ Resumable uploads for large files
- ✅ Chunked upload architecture
- ✅ Resume after page refresh
- ✅ Automatic retry on failures
- ✅ Backend-driven upload flow

### What V2 Requires

- ✅ Backend implementation of resumable upload endpoints
- ✅ Database to track upload progress
- ✅ GCS resumable upload session management

---

**Last Updated:** 2024-01-15  
**Version:** V2 (Resumable - Backend-Driven)  
**Status:** ✅ Production Ready

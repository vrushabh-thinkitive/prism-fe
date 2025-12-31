# 📋 API Specification - Video Upload Flow

## ✅ Architecture Overview

**Correct V1 Flow (Simple & Mandatory):**

```
1. Frontend → Backend: "I want to upload a video"
2. Backend → GCP: generate signed PUT URL
3. Backend → Frontend: return that upload link
4. Frontend → GCP: upload video using the link
5. Frontend → Backend: mark upload complete
```

**Why this is compulsory:**

- ✅ Keeps GCP credentials off the browser
- ✅ Enables private buckets (HIPAA-safe)
- ✅ Allows access control + audit
- ✅ This is exactly how Loom, Dropbox, Drive work

**Mental model:** `Backend authorizes → Frontend uploads → Backend tracks`

---

## 🔌 API Endpoints

### Base URL

```
https://localhost:3018
```

---

## 1️⃣ POST `/upload/init`

**Purpose:** Initialize video upload session and get signed PUT URL from GCP.

**IMPORTANT:** This returns a simple signed PUT URL (NOT resumable). Resumable uploads are NOT reliably browser-compatible.

**Request:**

```typescript
POST /upload/init
Content-Type: application/json

{
  fileName: string;      // Required: e.g., "recording-2024-01-15.webm"
  fileSize: number;      // Required: file size in bytes
  mimeType: string;      // Required: e.g., "video/webm"
  duration?: number;      // Optional: recording duration in seconds
  userId?: string;        // Optional: user identifier (defaults to "anonymous")
}
```

**Response (200 OK):**

```typescript
{
  recordingId: string; // Unique identifier for this recording
  uploadUrl: string; // GCS signed PUT URL (NOT resumable, expires in 15 minutes)
  gcsFilePath: string; // GCS object path (e.g., "recordings/user123/recording-123.webm")
  expiresIn: number; // URL expiration time in seconds (typically 900 = 15 minutes)
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

**Backend Responsibilities:**

1. ✅ Validate input (fileName, fileSize, mimeType required)
2. ✅ Validate file size (max 2GB)
3. ✅ Generate unique recordingId
4. ✅ Create GCS signed PUT URL (NOT resumable - use `file.getSignedUrl()` with `action: "write"`)
5. ✅ Set proper metadata (contentType, custom metadata)
6. ✅ Save recording record to MongoDB (status: "initiated")
7. ✅ Return signed PUT URL (expires in 15 minutes)

---

## 2️⃣ PUT `{uploadUrl}` (Direct to GCS)

**Purpose:** Upload video blob directly to GCS using the signed PUT URL.

**IMPORTANT:** This is a single PUT request (NOT resumable, NOT chunked). The entire blob is uploaded in one request.

**Request:**

```typescript
PUT {uploadUrl}  // The signed PUT URL from /upload/init
Content-Type: {mimeType}  // e.g., "video/webm"

{blob}  // Entire video blob (binary data)
```

**Response (200/201 OK):**

```
Status: 200 OK  // or 201 Created
```

**Notes:**

- ✅ Frontend uploads entire blob in single PUT request
- ✅ DO NOT set Content-Length header (browser sets it automatically)
- ✅ DO NOT set Content-Range header (this is NOT a resumable upload)
- ✅ Backend is NOT involved in this step (direct browser → GCS)
- ✅ Use XMLHttpRequest for upload progress tracking
- ✅ Works reliably in Chrome/Safari/Firefox without CORS issues

---

## 3️⃣ POST `/upload/complete`

**Purpose:** Mark upload as completed and get playback URL.

**Request:**

```typescript
POST /upload/complete
Content-Type: application/json

{
  recordingId: string;    // Required: from /upload/init response
  size: number;          // Required: final file size in bytes
}
```

**Response (200 OK):**

```typescript
{
  success: boolean;       // Always true on success
  recordingId: string;    // Echo of provided recordingId
  status: string;        // "completed"
  fileSize: number;       // Echo of provided size
  playbackUrl?: string;   // Optional: signed URL for video playback (expires in 7 days)
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

**Backend Responsibilities:**

1. ✅ Validate input (recordingId, size required)
2. ✅ Find recording in MongoDB
3. ✅ Verify file exists in GCS (handle eventual consistency)
4. ✅ Update MongoDB status to "completed"
5. ✅ Generate signed playback URL (7-day expiration)
6. ✅ Return completion confirmation

**Idempotency:**

- ✅ Safe to call multiple times
- ✅ Returns 200 OK if already completed

---

## 🔄 Complete Flow Example

### Step 1: Initialize Upload

```typescript
// Frontend
const initResponse = await fetch("https://localhost:3018/upload/init", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    fileName: "recording.webm",
    fileSize: 15728640, // 15 MB
    mimeType: "video/webm",
    duration: 120,
  }),
});

const { recordingId, uploadUrl } = await initResponse.json();
// recordingId: "507f1f77bcf86cd799439011"
// uploadUrl: "https://storage.googleapis.com/..."
```

### Step 2: Upload Blob to GCS

```typescript
// Frontend - Upload entire blob directly to GCS (single PUT)
const xhr = new XMLHttpRequest();
xhr.open("PUT", uploadUrl);
xhr.setRequestHeader("Content-Type", "video/webm");
// DO NOT set Content-Length - browser handles it automatically
// DO NOT set Content-Range - this is NOT a resumable upload

xhr.upload.addEventListener("progress", (event) => {
  if (event.lengthComputable) {
    const percentage = (event.loaded / event.total) * 100;
    console.log(`Upload progress: ${percentage.toFixed(1)}%`);
  }
});

xhr.send(blob);
await new Promise((resolve, reject) => {
  xhr.addEventListener("load", () => {
    if (xhr.status >= 200 && xhr.status < 300) resolve();
    else reject(new Error(`Upload failed: ${xhr.status}`));
  });
  xhr.addEventListener("error", reject);
});
```

### Step 3: Complete Upload

```typescript
// Frontend
const completeResponse = await fetch("https://localhost:3018/upload/complete", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    recordingId: "507f1f77bcf86cd799439011",
    size: 15728640,
  }),
});

const { playbackUrl } = await completeResponse.json();
// playbackUrl: "https://storage.googleapis.com/...?X-Goog-Signature=..."
```

---

## 🚫 What NOT to Do in V1

❌ **Browser → GCP without signed URL**  
❌ **Resumable uploads from browser** - GCS resumable uploads are NOT reliably browser-compatible  
❌ **Chunking from frontend** - Not needed for V1, adds complexity  
❌ **Setting Content-Length header manually** - Browser sets it automatically  
❌ **Setting Content-Range header** - Only for resumable uploads (which we're NOT using)  
❌ **Uploading via backend proxy** - Direct upload is more efficient

---

## 🔒 Security Considerations

### Current (Development):

- ✅ userId from request body (with fallback to "anonymous")
- ✅ TODO comment for JWT auth

### Production Recommendations:

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

4. **Rate Limiting:** Consider adding rate limits for upload init/complete

---

## 📊 Status Codes Summary

| Endpoint           | Method | Success      | Client Error | Server Error |
| ------------------ | ------ | ------------ | ------------ | ------------ |
| `/upload/init`     | POST   | 200          | 400          | 500          |
| `{uploadUrl}`      | PUT    | 200/201      | 400, 403     | 500          |
| `/upload/complete` | POST   | 200          | 400, 404     | 500          |

**Note:** The PUT to `{uploadUrl}` returns 200/201 (NOT 308) because it's a simple PUT, not resumable.

---

## ✅ Implementation Checklist

### Frontend:

- [x] Call `/upload/init` to get signed URL
- [x] Upload chunks directly to GCS using signed URL
- [x] Call `/upload/complete` after upload finishes
- [x] Handle errors at each step
- [x] Show upload progress

### Backend:

- [x] Generate signed PUT URLs (NOT resumable)
- [x] Validate all inputs
- [x] Store recording metadata in MongoDB
- [x] Generate signed playback URLs
- [ ] Add JWT authentication (TODO)
- [ ] Add rate limiting (TODO)

**Backend Code Example (Node.js):**

```typescript
// Generate signed PUT URL (NOT resumable)
const [url] = await file.getSignedUrl({
  version: "v4",
  action: "write",
  expires: Date.now() + 15 * 60 * 1000, // 15 minutes
  contentType: "video/webm",
});

// Return to frontend
return {
  recordingId,
  uploadUrl: url, // Simple PUT URL
  gcsFilePath,
  expiresIn: 900, // 15 minutes
};
```

---

**Last Updated:** 2024-01-15  
**Version:** V1

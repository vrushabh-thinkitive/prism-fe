# 🎯 V1 Simple Upload Migration Guide

## ✅ What Changed

We've migrated from **resumable chunked uploads** to **simple PUT uploads** for V1.

### Why?

**GCS resumable uploads are NOT reliably browser-compatible**, even with perfect CORS configuration.

### The Problem

- ❌ Browser + Content-Range + 308 responses = frequent CORS failures
- ❌ Resumable uploads are designed for server-to-server, not browser-to-GCS
- ❌ Even with correct CORS, browsers struggle with resumable upload protocol

### The Solution

- ✅ **Simple signed PUT URL** - Works reliably in Chrome/Safari/Firefox
- ✅ **No Content-Range header** - Browser handles everything automatically
- ✅ **No 308 responses** - Just 200/201 success
- ✅ **Single PUT request** - Upload entire blob in one go

---

## 📋 Code Changes

### Frontend Changes

#### 1. New Hook: `useSimpleUpload` (replaces `useChunkedUpload`)

**Before:**

```typescript
import { useChunkedUpload } from "../hooks/useChunkedUpload";
const { upload } = useChunkedUpload();
await upload(blob, { chunkSize: 8 * 1024 * 1024 });
```

**After:**

```typescript
import { useSimpleUpload } from "../hooks/useSimpleUpload";
const { upload } = useSimpleUpload();
await upload(blob); // No chunking needed
```

#### 2. New Utility: `simple-upload.ts` (replaces `chunked-upload.ts`)

**Key differences:**

- ✅ Uses XMLHttpRequest for upload progress tracking
- ✅ Single PUT request (no chunking)
- ✅ Only sets Content-Type header (browser sets Content-Length automatically)
- ✅ No Content-Range header

#### 3. Updated API Endpoints

**Before:**

- `/api/video/upload-init` → Returns resumable URL
- `/api/video/upload-complete`

**After:**

- `/upload/init` → Returns simple signed PUT URL
- `/upload/complete`

---

## 🔧 Backend Changes Required

### Update `/upload/init` Endpoint

**Before (Resumable):**

```typescript
// ❌ DON'T USE THIS FOR BROWSER UPLOADS
const [resumableUrl] = await file.createResumableUpload({
  metadata: { contentType: "video/webm" },
});
```

**After (Simple PUT):**

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

### Key Differences

| Aspect         | Resumable (V0)        | Simple PUT (V1) |
| -------------- | --------------------- | --------------- |
| URL Type       | Resumable session URL | Signed PUT URL  |
| Expiration     | 1 hour                | 15 minutes      |
| Browser Compat | ❌ Unreliable         | ✅ Reliable     |
| Chunking       | Required              | Not needed      |
| Content-Range  | Required              | Not used        |
| 308 Responses  | Yes                   | No              |

---

## 🚀 Migration Checklist

### Frontend ✅

- [x] Created `useSimpleUpload` hook
- [x] Created `simple-upload.ts` utility
- [x] Updated `ScreenRecorder.tsx` to use new hook
- [x] Removed chunking UI elements
- [x] Updated API endpoints to `/upload/init` and `/upload/complete`

### Backend ⚠️

- [ ] Update `/upload/init` to return simple signed PUT URL (NOT resumable)
- [ ] Set expiration to 15 minutes (not 1 hour)
- [ ] Ensure CORS is configured for PUT requests
- [ ] Test with browser uploads

---

## 🧪 Testing

### Test 1: Verify Simple PUT Works

```bash
# Get signed URL from backend
curl -X POST http://localhost:3018/upload/init \
  -H "Content-Type: application/json" \
  -d '{"fileName":"test.webm","fileSize":1000000,"mimeType":"video/webm"}'

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

---

## 📊 Performance Considerations

### File Size Limits

**V1 (Simple PUT):**

- ✅ Works reliably up to ~500MB
- ⚠️ May timeout for very large files (>1GB)
- ✅ Perfect for screen recordings (typically 10-100MB)

**V2+ (Future - Resumable):**

- Can handle files >1GB
- Requires more complex error handling
- Better for very large uploads

### Upload Progress

- ✅ XMLHttpRequest provides accurate progress tracking
- ✅ Works in all modern browsers
- ✅ No need for manual chunk progress calculation

---

## 🔒 Security Notes

### Signed URL Expiration

- **15 minutes** is sufficient for most uploads
- If upload fails, user can retry (new signed URL will be generated)
- Prevents URL reuse after expiration

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

## 🎯 Next Steps

1. **Update Backend:** Modify `/upload/init` to return simple signed PUT URL
2. **Test:** Verify uploads work in browser
3. **Monitor:** Check for any timeout issues with large files
4. **V2 Planning:** Consider resumable uploads for files >500MB (future enhancement)

---

## 📚 References

- [GCS Signed URLs Documentation](https://cloud.google.com/storage/docs/access-control/signing-urls-with-helpers)
- [XMLHttpRequest Upload Progress](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/upload)
- [API Specification](./API_SPECIFICATION.md) - Updated for V1

---

**Last Updated:** 2024-01-15  
**Version:** V1 (Simple PUT)

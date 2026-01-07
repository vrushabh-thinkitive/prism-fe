# Frontend-Backend Flow Comparison

## ✅ Matched Endpoints

### 1. Base URL Configuration ✅
**Backend Spec:**
```
API_BASE_URL = process.env.VITE_API_BASE_URL || "https://localhost:3000"
PRISM_API_PREFIX = "/api/prism"
```

**Frontend Code (`api-config.ts`):**
```typescript
const API_BASE_URL = process.env.VITE_API_BASE_URL || "https://localhost:3000";
const PRISM_API_PREFIX = "/api/prism";
```
**Status:** ✅ **MATCHES**

---

### 2. Initialize Resumable Upload ✅
**Backend Spec:**
```
POST /api/prism/upload/init-resumable
Headers: Authorization: Bearer <JWT_TOKEN>
Body: { fileName, fileSize, mimeType, duration }
```

**Frontend Code:**
```typescript
INIT_RESUMABLE_UPLOAD: `${API_BASE_URL}${PRISM_API_PREFIX}/upload/init-resumable`
// Function: initResumableUpload() adds Authorization header when accessToken provided
```
**Status:** ✅ **MATCHES**

---

### 3. Upload Chunk ✅
**Backend Spec:**
```
PUT /api/prism/upload/:id/chunk
Headers: 
  - Content-Type: video/webm or application/octet-stream
  - Content-Range: bytes start-end/total
  - Authorization: Bearer <JWT_TOKEN>
Body: <binary chunk data>
```

**Frontend Code:**
```typescript
UPLOAD_CHUNK: (recordingId: string) => 
  `${API_BASE_URL}${PRISM_API_PREFIX}/upload/${recordingId}/chunk`
// uploadChunk() function adds:
// - Content-Type: application/octet-stream
// - Content-Range header
// - Authorization: Bearer <token>
```
**Status:** ✅ **MATCHES**

---

### 4. Complete Upload ✅
**Backend Spec:**
```
POST /api/prism/upload/complete
Headers: Authorization: Bearer <JWT_TOKEN>
Body: { recordingId, size }
```

**Frontend Code:**
```typescript
COMPLETE_UPLOAD: `${API_BASE_URL}${PRISM_API_PREFIX}/upload/complete`
// completeVideoUpload() adds Authorization header when accessToken provided
```
**Status:** ✅ **MATCHES**

---

### 5. Get Recordings ✅
**Backend Spec:**
```
GET /api/prism/recordings
Headers: Authorization: Bearer <JWT_TOKEN>
```

**Frontend Code:**
```typescript
GET_RECORDINGS: `${API_BASE_URL}${PRISM_API_PREFIX}/recordings`
// getRecordings() adds Authorization header when accessToken provided
```
**Status:** ✅ **MATCHES**

---

### 6. Get Upload Status ✅
**Backend Spec:**
```
GET /api/prism/upload/:id/status
Headers: Authorization: Bearer <JWT_TOKEN>
```

**Frontend Code:**
```typescript
GET_UPLOAD_STATUS: (recordingId: string) => 
  `${API_BASE_URL}${PRISM_API_PREFIX}/upload/${recordingId}/status`
// getUploadStatus() adds Authorization header when accessToken provided
```
**Status:** ✅ **MATCHES**

---

## ⚠️ Missing Endpoints (Not in Frontend)

### 1. Health Check ❌
**Backend Spec:**
```
GET /api/prism/health
No authentication required
```

**Frontend:** ❌ **NOT IMPLEMENTED**
- No endpoint defined
- No function to call health check

---

### 2. Status Check ❌
**Backend Spec:**
```
GET /api/prism/status
No authentication required
```

**Frontend:** ❌ **NOT IMPLEMENTED**
- No endpoint defined
- No function to call status check

---

### 3. Initialize Dual Upload ❌
**Backend Spec:**
```
POST /api/prism/upload/init-dual
Headers: Authorization: Bearer <JWT_TOKEN>
Body: { screenSize, webcamSize, webcamPosition, duration }
```

**Frontend:** ❌ **NOT IMPLEMENTED**
- No endpoint defined in `api-config.ts`
- `useDualUpload` hook exists but uses different endpoint structure
- Need to check if `useDualUpload` calls this endpoint

---

### 4. Upload Screen Chunk ❌
**Backend Spec:**
```
PUT /api/prism/upload/:id/screen/chunk
Headers: 
  - Content-Type: video/webm
  - Content-Range: bytes start-end/total
  - Authorization: Bearer <JWT_TOKEN>
Body: <binary chunk data>
```

**Frontend:** ❌ **NOT IMPLEMENTED**
- No endpoint defined in `api-config.ts`
- Need to check `useDualUpload` implementation

---

### 5. Upload Webcam Chunk ❌
**Backend Spec:**
```
PUT /api/prism/upload/:id/webcam/chunk
Headers: 
  - Content-Type: video/webm
  - Content-Range: bytes start-end/total
  - Authorization: Bearer <JWT_TOKEN>
Body: <binary chunk data>
```

**Frontend:** ❌ **NOT IMPLEMENTED**
- No endpoint defined in `api-config.ts`
- Need to check `useDualUpload` implementation

---

### 6. Complete Dual Upload ❌
**Backend Spec:**
```
POST /api/prism/upload/complete-dual
Headers: Authorization: Bearer <JWT_TOKEN>
Body: { recordingId }
```

**Frontend:** ❌ **NOT IMPLEMENTED**
- No endpoint defined in `api-config.ts`
- Need to check `useDualUpload` implementation

---

## 🔍 Additional Frontend Endpoints (Not in Backend Spec)

### 1. Initialize Simple Upload (V1)
**Frontend:**
```
POST /api/prism/upload/init
```
**Status:** ⚠️ **EXTRA** - Not mentioned in backend spec, but might be V1 endpoint

---

### 2. Get Single Recording
**Frontend:**
```
GET /api/prism/recordings/:id
```
**Status:** ⚠️ **EXTRA** - Not mentioned in backend spec

---

## 📊 Summary

### Matched Endpoints: 6/12
- ✅ Initialize Resumable Upload
- ✅ Upload Chunk
- ✅ Complete Upload
- ✅ Get Recordings
- ✅ Get Upload Status
- ✅ Base URL Configuration

### Missing Endpoints: 6/12
- ❌ Health Check (`/api/prism/health`)
- ❌ Status Check (`/api/prism/status`)
- ❌ Initialize Dual Upload (`/api/prism/upload/init-dual`)
- ❌ Upload Screen Chunk (`/api/prism/upload/:id/screen/chunk`)
- ❌ Upload Webcam Chunk (`/api/prism/upload/:id/webcam/chunk`)
- ❌ Complete Dual Upload (`/api/prism/upload/complete-dual`)

### Extra Endpoints: 2
- ⚠️ Initialize Simple Upload (`/api/prism/upload/init`) - V1 endpoint?
- ⚠️ Get Single Recording (`/api/prism/recordings/:id`)

---

## 🔍 Header Verification

### Required Headers (Backend Spec)
All authenticated endpoints require:
- ✅ `Authorization: Bearer <JWT_TOKEN>` - **IMPLEMENTED** (added in recent changes)
- ✅ `Content-Type: application/json` - **IMPLEMENTED**
- ✅ `Content-Type: video/webm` or `application/octet-stream` - **IMPLEMENTED** (for chunks)
- ✅ `Content-Range: bytes start-end/total` - **IMPLEMENTED** (for chunk uploads)

**Status:** ✅ **ALL HEADERS MATCH**

---

## ⚠️ Issues Found

### 1. Dual Upload Endpoints Missing
The `useDualUpload` hook exists but the endpoints it uses are not defined in `api-config.ts`. Need to verify:
- What endpoints does `useDualUpload` actually call?
- Do they match the backend spec?

### 2. Health/Status Endpoints Missing
- No way to check service health from frontend
- No way to check service status from frontend

### 3. UploadManager Uses Wrong Base URL
Found in `src/utils/uploadManager.ts`:
```typescript
const API_BASE_URL = "https://localhost:3018";  // ❌ Wrong! Should be 3000 (API Gateway)
```
This bypasses the API Gateway and goes directly to Prism Service.

---

## ✅ What Works Correctly

1. **Base URL Configuration** - Matches backend spec ✅
2. **API Prefix** - Matches backend spec ✅
3. **Resumable Upload Flow** - All endpoints match ✅
4. **Authentication Headers** - All API calls include tokens ✅
5. **Chunk Upload Headers** - Content-Range and Content-Type correct ✅
6. **Request Methods** - POST/GET/PUT match backend spec ✅

---

## 📝 Recommendations

1. **Add Missing Endpoints** to `api-config.ts`:
   - Health check endpoint
   - Status check endpoint
   - Dual upload endpoints (init-dual, screen/chunk, webcam/chunk, complete-dual)

2. **Fix UploadManager**:
   - Change base URL from `3018` to `3000` (API Gateway)
   - Add `/api/prism` prefix

3. **Verify useDualUpload**:
   - Check what endpoints it currently uses
   - Update to match backend spec if needed

4. **Add Health/Status Functions**:
   - Create functions to call health and status endpoints
   - Useful for monitoring and debugging

---

## ✅ Conclusion

**Core Upload Flow:** ✅ **MATCHES** (Resumable upload endpoints align with backend spec)

**Dual Upload Flow:** ❌ **MISSING** (Endpoints not defined in frontend)

**Health/Status:** ❌ **MISSING** (Endpoints not implemented)

**Authentication:** ✅ **MATCHES** (All endpoints include Authorization headers)

**Headers:** ✅ **MATCHES** (All required headers are included)

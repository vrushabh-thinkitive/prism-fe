# Project Flow Documentation

## 📋 Overview

This is a **Screen Recording POC** application built with React + TypeScript. It allows users to:

- Record screen with optional webcam overlay (Picture-in-Picture)
- Record with microphone audio
- Upload recordings to backend (supports resumable uploads)
- View recordings in a dashboard

---

## 🏗️ Application Architecture

### Entry Point Flow

```
index.html
  └─> main.tsx (React entry point)
      └─> App.tsx (Main app component with routing)
          ├─> RecordingProvider (Context wrapper)
          ├─> BrowserRouter (React Router)
          │   ├─> HomePage ("/") - Recording interface
          │   └─> RecordingDashboard ("/dashboard") - View recordings
          └─> Navigation (Top navigation bar)
```

---

## 📁 File-by-File Flow

### 1. **Entry Point: `main.tsx`**

- **Purpose**: React application entry point
- **Flow**:
  - Renders `<App />` component into `#root` DOM element
  - Wraps in `StrictMode` for development checks

### 2. **App Component: `App.tsx`**

- **Purpose**: Main application shell with routing
- **Key Components**:
  - `RecordingProvider`: Provides recording state context globally
  - `BrowserRouter`: Handles client-side routing
  - `Navigation`: Top navigation bar (Record/Dashboard links)
  - `HomePage`: Recording interface (route: "/")
  - `RecordingDashboard`: Dashboard page (route: "/dashboard")

**Flow**:

```
App.tsx
  ├─> RecordingProvider wraps entire app
  ├─> BrowserRouter handles routes
  ├─> Navigation component (uses useRecordingState hook)
  └─> Routes:
      ├─> "/" → HomePage
      │   ├─> BrowserValidation
      │   ├─> PermissionChecklist
      │   └─> ScreenRecorder (main recording component)
      └─> "/dashboard" → RecordingDashboard
          └─> RecordingRow (for each recording)
```

### 3. **Context: `RecordingContext.tsx`**

- **Purpose**: Global state management for recording status
- **State**: `idle | recording | paused | stopped | error`
- **Used by**: Navigation component (to disable dashboard during recording)

---

## 🎥 Recording Flow (HomePage → ScreenRecorder)

### Component: `ScreenRecorder.tsx`

**Main recording interface component**

**Dependencies**:

- `useScreenRecorder` hook → Manages recording logic
- `useSimpleUpload` hook → V1 simple upload (small files)
- `useResumableUpload` hook → V2 resumable upload (large files)
- `useDualUpload` hook → Dual upload (screen + webcam separate)

**Flow**:

```
User clicks "Start Recording"
  └─> ScreenRecorder.handleStartClick()
      └─> useScreenRecorder.start()
          └─> utils/screen-recorder.ts → ScreenRecorder.start()
              ├─> Requests screen share permission
              ├─> Requests webcam permission (if enabled)
              ├─> Requests microphone permission (if enabled)
              ├─> Starts MediaRecorder for screen
              ├─> Starts MediaRecorder for webcam (if enabled)
              └─> Merges streams using canvas-merger.ts
                  └─> Creates merged video blob

User clicks "Stop Recording"
  └─> ScreenRecorder.handleStop()
      └─> useScreenRecorder.stop()
          └─> Returns blob(s):
              ├─> blob (merged video)
              ├─> screenBlob (screen only)
              └─> webcamBlob (webcam only)

User clicks "Upload Recording"
  └─> ScreenRecorder.handleUpload()
      ├─> If uploadType === "dual":
      │   └─> useDualUpload.upload(screenBlob, webcamBlob)
      │       └─> API Flow (see Dual Upload API Flow below)
      │
      └─> If uploadType === "resumable":
          └─> useResumableUpload.upload(blob)
              └─> API Flow (see Resumable Upload API Flow below)
```

---

## 🔄 Hook Flow

### Hook: `useScreenRecorder.ts`

**Wraps `utils/screen-recorder.ts` ScreenRecorder class**

**Flow**:

```
useScreenRecorder()
  ├─> Creates ScreenRecorder instance (on mount)
  ├─> Sets up callbacks:
  │   ├─> onStateChange → Updates React state
  │   ├─> onDurationUpdate → Updates duration
  │   ├─> onError → Sets error state
  │   └─> onScreenShareStopped → Handles auto-stop
  └─> Returns:
      ├─> state, duration, blob, screenBlob, webcamBlob
      ├─> start(), stop(), pause(), resume(), reset()
      └─> updateWebcamPosition(), muteMicrophone()
```

**Underlying Utility**: `utils/screen-recorder.ts`

- Handles MediaRecorder API
- Manages canvas merging (via `canvas-merger.ts`)
- Tracks recording state

### Hook: `useDualUpload.ts`

**Manages dual upload (screen + webcam separately)**

**Flow**:

```
useDualUpload.upload(screenBlob, webcamBlob, options)
  ├─> Step 1: Initialize dual upload
  │   └─> api-config.ts → initDualUpload()
  │       └─> POST /upload/init-dual
  │           └─> Returns: { recordingId, chunkSize }
  │
  ├─> Step 2: Upload chunks in parallel
  │   ├─> Upload screen chunks → uploadScreenChunk()
  │   │   └─> PUT /upload/:recordingId/screen/chunk
  │   └─> Upload webcam chunks → uploadWebcamChunk()
  │       └─> PUT /upload/:recordingId/webcam/chunk
  │
  └─> Step 3: Complete upload
      └─> api-config.ts → completeDualUpload()
          └─> POST /upload/complete-dual
              └─> Returns: { playbackUrl, recordingId, status }
```

### Hook: `useResumableUpload.ts`

**Manages resumable upload (single merged file)**

**Flow**:

```
useResumableUpload.upload(blob, options)
  ├─> Step 1: Initialize resumable upload
  │   └─> api-config.ts → initResumableUpload()
  │       └─> POST /upload/init-resumable
  │           └─> Returns: { recordingId, chunkSize }
  │           └─> Saves recordingId to sessionStorage
  │
  ├─> Step 2: Upload chunks sequentially
  │   └─> For each chunk:
  │       └─> resumable-upload.ts → uploadChunk()
  │           └─> api-config.ts → PUT /upload/:recordingId/chunk
  │               └─> Updates progress state
  │
  └─> Step 3: Complete upload
      └─> api-config.ts → completeVideoUpload()
          └─> POST /upload/complete
              └─> Returns: { playbackUrl, recordingId, status }
              └─> Clears sessionStorage

useResumableUpload.resume(recordingId, blob)
  ├─> Step 1: Get upload status
  │   └─> api-config.ts → getUploadStatus(recordingId)
  │       └─> GET /upload/:recordingId/status
  │           └─> Returns: { uploadedBytes, chunkSize, fileSize }
  │
  ├─> Step 2: Calculate starting chunk
  │   └─> resumable-upload.ts → calculateStartingChunkIndex()
  │
  ├─> Step 3: Upload remaining chunks
  │   └─> Same as Step 2 in upload()
  │
  └─> Step 4: Complete upload
      └─> Same as Step 3 in upload()
```

---

## 🌐 API Call Flow

### API Configuration: `api-config.ts`

**Central file for all API endpoints and functions**

**Base URL**: `https://localhost:3018`

### API Endpoints:

#### 1. **Initialize Upload (V1 - Simple)**

```typescript
POST /upload/init
Body: { fileName, fileSize, mimeType, duration?, userId? }
Response: { recordingId, uploadUrl, gcsFilePath, expiresIn }
```

**Called by**: `useSimpleUpload` hook (not currently used in main flow)

#### 2. **Initialize Resumable Upload (V2)**

```typescript
POST /upload/init-resumable
Body: { fileName, fileSize, mimeType, duration?, userId? }
Response: { recordingId, chunkSize }
```

**Called by**: `useResumableUpload.upload()`
**Flow**: `ScreenRecorder.handleUpload()` → `useResumableUpload.upload()` → `initResumableUpload()`

#### 3. **Upload Chunk (Resumable)**

```typescript
PUT /upload/:recordingId/chunk
Headers: { Content-Type: video/webm, Content-Range: bytes start-end/total }
Body: Blob (chunk data)
Response: { uploadedBytes, done }
```

**Called by**: `useResumableUpload.uploadChunks()`
**Flow**: `useResumableUpload.upload()` → `uploadChunks()` → `uploadChunk()` → `PUT /upload/:recordingId/chunk`

#### 4. **Get Upload Status**

```typescript
GET /upload/:recordingId/status
Response: { uploadedBytes, chunkSize, fileSize }
```

**Called by**: `useResumableUpload.resume()`
**Flow**: `ScreenRecorder.handleResume()` → `useResumableUpload.resume()` → `getUploadStatus()`

#### 5. **Complete Upload**

```typescript
POST /upload/complete
Body: { recordingId, size }
Response: { success, recordingId, status, fileSize, playbackUrl? }
```

**Called by**: `useResumableUpload.upload()` and `useResumableUpload.resume()`
**Flow**: After all chunks uploaded → `completeVideoUpload()`

#### 6. **Initialize Dual Upload**

```typescript
POST /upload/init-dual
Body: { screenSize, webcamSize, webcamPosition, duration, userId? }
Response: { recordingId, chunkSize }
```

**Called by**: `useDualUpload.upload()`
**Flow**: `ScreenRecorder.handleUpload()` (dual mode) → `useDualUpload.upload()` → `initDualUpload()`

#### 7. **Upload Screen Chunk (Dual)**

```typescript
PUT /upload/:recordingId/screen/chunk
Headers: { Content-Type: video/webm, Content-Range: bytes start-end/total }
Body: Blob (screen chunk)
Response: { uploadedBytes, done }
```

**Called by**: `useDualUpload.uploadStreamChunks()` (screen stream)
**Flow**: `useDualUpload.upload()` → `uploadStreamChunks(screenBlob, ...)` → `uploadScreenChunk()`

#### 8. **Upload Webcam Chunk (Dual)**

```typescript
PUT /upload/:recordingId/webcam/chunk
Headers: { Content-Type: video/webm, Content-Range: bytes start-end/total }
Body: Blob (webcam chunk)
Response: { uploadedBytes, done }
```

**Called by**: `useDualUpload.uploadStreamChunks()` (webcam stream)
**Flow**: `useDualUpload.upload()` → `uploadStreamChunks(webcamBlob, ...)` → `uploadWebcamChunk()`

#### 9. **Complete Dual Upload**

```typescript
POST / upload / complete - dual;
Body: {
  recordingId;
}
Response: {
  success, recordingId, status, playbackUrl, fileSize;
}
```

**Called by**: `useDualUpload.upload()`
**Flow**: After both screen and webcam chunks uploaded → `completeDualUpload()`

#### 10. **Get Recordings List**

```typescript
GET /recordings
Response: Recording[] (array of recording objects)
```

**Called by**: `useRecordings` hook
**Flow**: `RecordingDashboard` → `useRecordings()` → `getRecordings()`

#### 11. **Get Single Recording**

```typescript
GET /recordings/:recordingId
Response: Recording (single recording object)
```

**Called by**: Not currently used in main flow (available for future use)

---

## 📊 Dashboard Flow

### Component: `RecordingDashboard.tsx`

**Displays list of all recordings**

**Flow**:

```
RecordingDashboard mounts
  └─> useRecordings() hook
      ├─> On mount: Calls getRecordings()
      │   └─> api-config.ts → getRecordings()
      │       └─> GET /recordings
      │           └─> Returns: Recording[]
      │
      └─> Renders:
          ├─> Loading state (while fetching)
          ├─> Error state (if fetch fails)
          └─> Table with RecordingRow components
              └─> RecordingRow (for each recording)
                  ├─> Displays: ID, Created, Duration, Size, Status
                  └─> "Play" button (if completed)
                      └─> Opens playbackUrl in new tab
```

### Hook: `useRecordings.ts`

**Manages recordings list state**

**Flow**:

```
useRecordings()
  ├─> On mount: fetchRecordings()
  │   └─> api-config.ts → getRecordings()
  │       └─> GET /recordings
  │
  └─> Returns:
      ├─> recordings: Recording[]
      ├─> loading: boolean
      ├─> error: string | null
      └─> refresh: () => Promise<void>
          └─> Re-fetches recordings
```

---

## 🔧 Utility Files

### `utils/screen-recorder.ts`

- **Purpose**: Core recording logic using MediaRecorder API
- **Used by**: `useScreenRecorder` hook
- **Features**:
  - Screen capture
  - Webcam overlay (via canvas-merger)
  - Microphone audio
  - Pause/resume
  - State management

### `utils/canvas-merger.ts`

- **Purpose**: Merges screen and webcam streams into single canvas
- **Used by**: `screen-recorder.ts`
- **Features**:
  - Webcam positioning (top-left, top-right, bottom-left, bottom-right)
  - Canvas rendering
  - Blob creation

### `utils/resumable-upload.ts`

- **Purpose**: Chunking and upload utilities for resumable uploads
- **Used by**: `useResumableUpload` hook
- **Functions**:
  - `sliceBlobIntoChunks()`: Splits blob into chunks
  - `calculateStartingChunkIndex()`: Calculates resume point
  - `uploadChunk()`: Uploads single chunk

### `utils/dual-recorder.ts`

- **Purpose**: Records screen and webcam separately
- **Used by**: `useDualRecorder` hook (not currently used in main flow)

---

## 🔄 Complete User Journey Flow

### Scenario 1: Record and Upload (Resumable)

```
1. User opens app → App.tsx renders
   └─> HomePage renders → ScreenRecorder component

2. User configures settings:
   ├─> Enable webcam? (checkbox)
   ├─> Enable microphone? (checkbox)
   ├─> Webcam position? (top-right, etc.)
   └─> Upload type? (resumable)

3. User clicks "Start Recording"
   └─> ScreenRecorder.handleStartClick()
       └─> useScreenRecorder.start()
           └─> Browser prompts for screen share
               └─> User selects screen
                   └─> Countdown timer (3 seconds)
                       └─> Recording starts
                           ├─> Screen stream captured
                           ├─> Webcam stream captured (if enabled)
                           └─> Canvas merger combines streams

4. User clicks "Stop Recording"
   └─> ScreenRecorder.handleStop()
       └─> useScreenRecorder.stop()
           └─> Returns blob(s)
               └─> Preview video shown

5. User clicks "Upload Recording"
   └─> ScreenRecorder.handleUpload()
       └─> useResumableUpload.upload(blob)
           ├─> Step 1: POST /upload/init-resumable
           │   └─> Backend returns: { recordingId, chunkSize }
           │   └─> recordingId saved to sessionStorage
           │
           ├─> Step 2: Upload chunks sequentially
           │   └─> For each chunk:
           │       └─> PUT /upload/:recordingId/chunk
           │           └─> Progress updated in UI
           │
           └─> Step 3: POST /upload/complete
               └─> Backend returns: { playbackUrl, recordingId }
               └─> sessionStorage cleared
               └─> Success message shown

6. User navigates to Dashboard
   └─> RecordingDashboard renders
       └─> useRecordings() hook
           └─> GET /recordings
               └─> Displays list of recordings
                   └─> User can click "Play" to view
```

### Scenario 2: Record and Upload (Dual)

```
1-4. Same as Scenario 1 (recording steps)

5. User clicks "Upload Recording" (dual mode)
   └─> ScreenRecorder.handleUpload()
       └─> useDualUpload.upload(screenBlob, webcamBlob)
           ├─> Step 1: POST /upload/init-dual
           │   └─> Backend returns: { recordingId, chunkSize }
           │
           ├─> Step 2: Upload chunks in parallel
           │   ├─> Screen chunks: PUT /upload/:recordingId/screen/chunk
           │   └─> Webcam chunks: PUT /upload/:recordingId/webcam/chunk
           │       └─> Progress tracked separately for each stream
           │
           └─> Step 3: POST /upload/complete-dual
               └─> Backend merges screen + webcam
               └─> Returns: { playbackUrl, recordingId }
               └─> Success message shown
```

### Scenario 3: Resume Interrupted Upload

```
1. User starts upload (resumable mode)
   └─> Upload interrupted (network error, page refresh, etc.)
       └─> recordingId saved in sessionStorage

2. User returns to page
   └─> useResumableUpload detects recordingId in sessionStorage
       └─> Shows "Upload Interrupted" banner

3. User clicks "Resume Upload"
   └─> ScreenRecorder.handleResume()
       └─> useResumableUpload.resume(recordingId, blob)
           ├─> Step 1: GET /upload/:recordingId/status
           │   └─> Backend returns: { uploadedBytes, chunkSize, fileSize }
           │
           ├─> Step 2: Calculate starting chunk
           │   └─> calculateStartingChunkIndex(uploadedBytes, chunkSize)
           │
           ├─> Step 3: Upload remaining chunks
           │   └─> PUT /upload/:recordingId/chunk (starting from calculated chunk)
           │
           └─> Step 4: POST /upload/complete
               └─> Upload completed
               └─> sessionStorage cleared
```

---

## 📦 State Management

### Global State (Context)

- **RecordingContext**: Manages recording state (`idle | recording | paused | stopped | error`)
- **Used by**: Navigation component (to disable dashboard during recording)

### Component State

- **ScreenRecorder**: Manages UI state (preview URL, upload type selection, etc.)
- **RecordingDashboard**: Manages recordings list state (via `useRecordings` hook)

### Hook State

- **useScreenRecorder**: Recording state, blobs, duration, error
- **useResumableUpload**: Upload state, progress, recordingId, playbackUrl
- **useDualUpload**: Upload state, dual progress, recordingId, playbackUrl
- **useRecordings**: Recordings list, loading, error

### Session Storage

- **Key**: `"activeRecordingId"`
- **Purpose**: Persist recordingId across page refreshes for resume functionality
- **Managed by**: `useResumableUpload` hook
- **Lifecycle**:
  - Set when upload starts
  - Cleared when upload completes successfully
  - Kept when upload fails (for resume)

---

## 🎯 Key Design Patterns

1. **Hook Pattern**: Business logic separated into custom hooks

   - `useScreenRecorder`: Recording logic
   - `useResumableUpload`: Resumable upload logic
   - `useDualUpload`: Dual upload logic
   - `useRecordings`: Recordings list logic

2. **Utility Classes**: Core functionality in utility classes

   - `ScreenRecorder`: MediaRecorder wrapper
   - `DualRecorder`: Dual recording wrapper
   - `CanvasMerger`: Canvas merging logic

3. **API Abstraction**: All API calls centralized in `api-config.ts`

   - Single source of truth for endpoints
   - Consistent error handling
   - Type-safe API functions

4. **State Management**: React hooks + Context API
   - Local state for component-specific data
   - Context for global recording state
   - SessionStorage for persistence

---

## 🔍 Debugging Tips

1. **Check Console Logs**: All API calls and state changes are logged with emojis:

   - 📤 Upload operations
   - ✅ Success messages
   - ❌ Error messages
   - 📊 Progress updates
   - 🔄 Resume operations

2. **Session Storage**: Check `sessionStorage.getItem("activeRecordingId")` to see if upload was interrupted

3. **Network Tab**: Monitor API calls in browser DevTools Network tab

4. **React DevTools**: Inspect component state and props

---

## 📝 Summary

**Main Flow**:

1. User starts recording → `ScreenRecorder` → `useScreenRecorder` → `screen-recorder.ts`
2. User stops recording → Blob(s) created
3. User uploads → `useResumableUpload` or `useDualUpload` → `api-config.ts` → Backend API
4. User views dashboard → `RecordingDashboard` → `useRecordings` → `api-config.ts` → Backend API

**API Calls**:

- Recording: No API calls (all client-side)
- Upload: `POST /upload/init-*` → `PUT /upload/:id/chunk` → `POST /upload/complete-*`
- Dashboard: `GET /recordings`

**Key Files**:

- `App.tsx`: Routing and layout
- `ScreenRecorder.tsx`: Main recording UI
- `RecordingDashboard.tsx`: Recordings list UI
- `api-config.ts`: All API endpoints
- `useScreenRecorder.ts`: Recording hook
- `useResumableUpload.ts`: Resumable upload hook
- `useDualUpload.ts`: Dual upload hook
- `useRecordings.ts`: Recordings list hook


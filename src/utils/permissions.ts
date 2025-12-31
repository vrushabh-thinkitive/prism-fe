/**
 * Permission Handling Utilities
 * Manages screen capture, microphone, and webcam permissions
 */

export type PermissionStatus = "granted" | "denied" | "prompt" | "error" | "checking";

export type PermissionState = {
  screen: PermissionStatus;
  microphone: PermissionStatus;
  webcam: PermissionStatus;
  error: string | null;
};

export type PermissionRequestResult = {
  success: boolean;
  error?: string;
  stream?: MediaStream;
};

/**
 * Check current permission status for microphone
 */
export async function checkMicrophonePermission(): Promise<PermissionStatus> {
  try {
    if (!navigator.permissions) {
      // Fallback: try to query the device
      return "prompt";
    }

    const result = await navigator.permissions.query({ name: "microphone" as PermissionName });
    return result.state as PermissionStatus;
  } catch (error) {
    // Some browsers don't support permission query API
    return "prompt";
  }
}

/**
 * Check current permission status for camera
 */
export async function checkCameraPermission(): Promise<PermissionStatus> {
  try {
    if (!navigator.permissions) {
      return "prompt";
    }

    const result = await navigator.permissions.query({ name: "camera" as PermissionName });
    return result.state as PermissionStatus;
  } catch (error) {
    return "prompt";
  }
}

/**
 * Check all permissions status
 */
export async function checkAllPermissions(): Promise<PermissionState> {
  const state: PermissionState = {
    screen: "prompt", // Screen capture doesn't have a query API
    microphone: await checkMicrophonePermission(),
    webcam: await checkCameraPermission(),
    error: null,
  };

  return state;
}

/**
 * Request screen capture permission
 * Note: getDisplayMedia will prompt user, no explicit permission API exists
 */
export async function requestScreenCapture(): Promise<PermissionRequestResult> {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      return {
        success: false,
        error: "Screen capture API is not available in this browser",
      };
    }

    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: "browser" as DisplayCaptureSurfaceType,
      } as MediaTrackConstraints,
      audio: false, // Screen audio can be requested separately if needed
    });

    return {
      success: true,
      stream,
    };
  } catch (error) {
    const err = error as Error;
    if (err.name === "NotAllowedError") {
      return {
        success: false,
        error: "Screen capture permission was denied. Please allow screen sharing to continue.",
      };
    } else if (err.name === "NotFoundError") {
      return {
        success: false,
        error: "No screen capture source found.",
      };
    } else if (err.name === "AbortError") {
      return {
        success: false,
        error: "Screen capture request was cancelled.",
      };
    }
    return {
      success: false,
      error: err.message || "Failed to request screen capture permission",
    };
  }
}

/**
 * Request microphone permission
 */
export async function requestMicrophonePermission(): Promise<PermissionRequestResult> {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return {
        success: false,
        error: "Microphone API is not available in this browser",
      };
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

    // Stop the stream immediately, we just needed to check permission
    stream.getTracks().forEach((track) => track.stop());

    return {
      success: true,
      stream: undefined,
    };
  } catch (error) {
    const err = error as Error;
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      return {
        success: false,
        error: "Microphone permission was denied. Please enable microphone access in your browser settings.",
      };
    } else if (err.name === "NotFoundError") {
      return {
        success: false,
        error: "No microphone found. Please connect a microphone and try again.",
      };
    }
    return {
      success: false,
      error: err.message || "Failed to request microphone permission",
    };
  }
}

/**
 * Request webcam permission
 */
export async function requestWebcamPermission(): Promise<PermissionRequestResult> {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return {
        success: false,
        error: "Webcam API is not available in this browser",
      };
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: true,
    });

    // Stop the stream immediately, we just needed to check permission
    stream.getTracks().forEach((track) => track.stop());

    return {
      success: true,
      stream: undefined,
    };
  } catch (error) {
    const err = error as Error;
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      return {
        success: false,
        error: "Webcam permission was denied. Please enable camera access in your browser settings.",
      };
    } else if (err.name === "NotFoundError") {
      return {
        success: false,
        error: "No webcam found. Please connect a camera and try again.",
      };
    }
    return {
      success: false,
      error: err.message || "Failed to request webcam permission",
    };
  }
}

/**
 * Request all permissions at once
 */
export async function requestAllPermissions(): Promise<{
  screen: PermissionRequestResult;
  microphone: PermissionRequestResult;
  webcam: PermissionRequestResult;
}> {
  const [screen, microphone, webcam] = await Promise.all([
    requestScreenCapture(),
    requestMicrophonePermission(),
    requestWebcamPermission(),
  ]);

  return { screen, microphone, webcam };
}

/**
 * Check if all required permissions are granted
 */
export function areAllPermissionsGranted(state: PermissionState): boolean {
  return (
    state.screen === "granted" &&
    state.microphone === "granted" &&
    state.webcam === "granted"
  );
}

/**
 * Get user-friendly permission status message
 */
export function getPermissionStatusMessage(
  permission: "screen" | "microphone" | "webcam",
  status: PermissionStatus
): string {
  switch (status) {
    case "granted":
      return "Permission granted";
    case "denied":
      return "Permission denied - check browser settings";
    case "prompt":
      return "Click to request permission";
    case "checking":
      return "Checking...";
    case "error":
      return "Error checking permission";
    default:
      return "Unknown status";
  }
}


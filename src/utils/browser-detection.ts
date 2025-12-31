/**
 * Browser Detection and Capability Validation
 * Checks for supported browsers and MediaRecorder API availability
 */

export type BrowserInfo = {
  name: string;
  version: string | null;
  isSupported: boolean;
  isChrome: boolean;
  isEdge: boolean;
  isFirefox: boolean;
  isSafari: boolean;
  isOpera: boolean;
  isUnknown: boolean;
};

export type CapabilityCheck = {
  mediaRecorder: boolean;
  getUserMedia: boolean;
  getDisplayMedia: boolean;
  mediaRecorderMimeTypes: string[];
  preferredMimeType: string | null;
  isFullySupported: boolean;
  issues: string[];
};

/**
 * Detects the current browser and version
 */
export function detectBrowser(): BrowserInfo {
  if (typeof window === "undefined") {
    return {
      name: "Unknown",
      version: null,
      isSupported: false,
      isChrome: false,
      isEdge: false,
      isFirefox: false,
      isSafari: false,
      isOpera: false,
      isUnknown: true,
    };
  }

  const userAgent = navigator.userAgent;
  let name = "Unknown";
  let version: string | null = null;
  let isChrome = false;
  let isEdge = false;
  let isFirefox = false;
  let isSafari = false;
  let isOpera = false;
  let isSupported = false;

  // Edge (must check before Chrome)
  if (userAgent.includes("Edg/")) {
    name = "Microsoft Edge";
    version = userAgent.match(/Edg\/(\d+)/)?.[1] || null;
    isEdge = true;
    isSupported = true;
  }
  // Chrome
  else if (userAgent.includes("Chrome/") && !userAgent.includes("Edg/")) {
    name = "Google Chrome";
    version = userAgent.match(/Chrome\/(\d+)/)?.[1] || null;
    isChrome = true;
    isSupported = true;
  }
  // Firefox
  else if (userAgent.includes("Firefox/")) {
    name = "Mozilla Firefox";
    version = userAgent.match(/Firefox\/(\d+)/)?.[1] || null;
    isFirefox = true;
    isSupported = true;
  }
  // Safari
  else if (userAgent.includes("Safari/") && !userAgent.includes("Chrome/")) {
    name = "Safari";
    version = userAgent.match(/Version\/(\d+)/)?.[1] || null;
    isSafari = true;
    // Safari has limited MediaRecorder support
    isSupported = false;
  }
  // Opera
  else if (userAgent.includes("OPR/") || userAgent.includes("Opera/")) {
    name = "Opera";
    version = userAgent.match(/(?:OPR|Opera)\/(\d+)/)?.[1] || null;
    isOpera = true;
    isSupported = true;
  }

  return {
    name,
    version,
    isSupported,
    isChrome,
    isEdge,
    isFirefox,
    isSafari,
    isOpera,
    isUnknown: name === "Unknown",
  };
}

/**
 * Checks MediaRecorder API capabilities
 */
export function checkCapabilities(): CapabilityCheck {
  const issues: string[] = [];
  let mediaRecorder = false;
  let getUserMedia = false;
  let getDisplayMedia = false;
  const mediaRecorderMimeTypes: string[] = [];
  let preferredMimeType: string | null = null;

  // Check MediaRecorder API
  if (typeof MediaRecorder !== "undefined") {
    mediaRecorder = true;

    // Check supported MIME types
    const possibleTypes = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4",
      "video/webm;codecs=h264",
    ];

    for (const type of possibleTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        mediaRecorderMimeTypes.push(type);
        if (!preferredMimeType) {
          preferredMimeType = type;
        }
      }
    }

    if (mediaRecorderMimeTypes.length === 0) {
      issues.push(
        "MediaRecorder API is available but no supported MIME types found"
      );
    }
  } else {
    issues.push("MediaRecorder API is not available");
  }

  // Check getUserMedia (for webcam/mic)
  if (
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  ) {
    getUserMedia = true;
  } else {
    issues.push("getUserMedia API is not available");
  }

  // Check getDisplayMedia (for screen capture)
  if (
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === "function"
  ) {
    getDisplayMedia = true;
  } else {
    issues.push("getDisplayMedia API is not available");
  }

  const isFullySupported =
    mediaRecorder &&
    getUserMedia &&
    getDisplayMedia &&
    mediaRecorderMimeTypes.length > 0;

  return {
    mediaRecorder,
    getUserMedia,
    getDisplayMedia,
    mediaRecorderMimeTypes,
    preferredMimeType,
    isFullySupported,
    issues,
  };
}

/**
 * Get a user-friendly message about browser support
 */
export function getBrowserSupportMessage(
  browser: BrowserInfo,
  capabilities: CapabilityCheck
): string {
  if (!browser.isSupported) {
    if (browser.isSafari) {
      return "Safari has limited MediaRecorder support. Please use Chrome, Edge, or Firefox for the best experience.";
    }
    return "Your browser is not fully supported. Please use Chrome, Edge, or Firefox.";
  }

  if (!capabilities.isFullySupported) {
    return "Your browser supports recording but some features may be limited.";
  }

  return "Your browser is fully supported for screen recording!";
}


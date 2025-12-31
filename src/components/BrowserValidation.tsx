import { useEffect, useState } from "react";
import {
  detectBrowser,
  checkCapabilities,
  getBrowserSupportMessage,
} from "../utils/browser-detection";
import type { BrowserInfo, CapabilityCheck } from "../utils/browser-detection";

export default function BrowserValidation() {
  const [browser, setBrowser] = useState<BrowserInfo | null>(null);
  const [capabilities, setCapabilities] = useState<CapabilityCheck | null>(
    null
  );
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const browserInfo = detectBrowser();
    const capabilityInfo = checkCapabilities();
    setBrowser(browserInfo);
    setCapabilities(capabilityInfo);
  }, []);

  if (!isClient || !browser || !capabilities) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded mb-4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded"></div>
        </div>
      </div>
    );
  }

  const supportMessage = getBrowserSupportMessage(browser, capabilities);
  const isSupported = browser.isSupported && capabilities.isFullySupported;

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-black dark:text-white">
          🎥 Recording POC - Browser Validation
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Checking browser compatibility for screen recording
        </p>
      </div>

      {/* Browser Info Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4 text-black dark:text-white">
          Browser Information
        </h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-zinc-600 dark:text-zinc-400">Browser:</span>
            <span className="font-medium text-black dark:text-white">
              {browser.name} {browser.version ? `v${browser.version}` : ""}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-600 dark:text-zinc-400">Status:</span>
            <span
              className={`font-medium px-3 py-1 rounded-full text-sm ${
                isSupported
                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                  : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
              }`}
            >
              {isSupported ? "✅ Supported" : "❌ Not Fully Supported"}
            </span>
          </div>
        </div>
      </div>

      {/* Capabilities Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4 text-black dark:text-white">
          API Capabilities
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-zinc-600 dark:text-zinc-400">
              MediaRecorder API:
            </span>
            <span
              className={`font-medium ${
                capabilities.mediaRecorder
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {capabilities.mediaRecorder ? "✅ Available" : "❌ Not Available"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-600 dark:text-zinc-400">
              getUserMedia (Webcam/Mic):
            </span>
            <span
              className={`font-medium ${
                capabilities.getUserMedia
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {capabilities.getUserMedia ? "✅ Available" : "❌ Not Available"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-600 dark:text-zinc-400">
              getDisplayMedia (Screen):
            </span>
            <span
              className={`font-medium ${
                capabilities.getDisplayMedia
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {capabilities.getDisplayMedia
                ? "✅ Available"
                : "❌ Not Available"}
            </span>
          </div>
          {capabilities.preferredMimeType && (
            <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <div className="space-y-2">
                <span className="text-zinc-600 dark:text-zinc-400 block">
                  Preferred Video Format:
                </span>
                <code className="block bg-zinc-100 dark:bg-zinc-800 px-3 py-2 rounded text-sm text-black dark:text-white">
                  {capabilities.preferredMimeType}
                </code>
                {capabilities.mediaRecorderMimeTypes.length > 1 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white">
                      View all supported formats (
                      {capabilities.mediaRecorderMimeTypes.length})
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {capabilities.mediaRecorderMimeTypes.map((type, idx) => (
                        <li key={idx}>
                          <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
                            {type}
                          </code>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Support Message */}
      <div
        className={`rounded-lg border p-4 ${
          isSupported
            ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
            : "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
        }`}
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl">{isSupported ? "✅" : "⚠️"}</span>
          <div>
            <h3
              className={`font-semibold mb-1 ${
                isSupported
                  ? "text-green-900 dark:text-green-200"
                  : "text-yellow-900 dark:text-yellow-200"
              }`}
            >
              {isSupported
                ? "Browser Fully Supported"
                : "Browser Limitations Detected"}
            </h3>
            <p
              className={`text-sm ${
                isSupported
                  ? "text-green-800 dark:text-green-300"
                  : "text-yellow-800 dark:text-yellow-300"
              }`}
            >
              {supportMessage}
            </p>
          </div>
        </div>
      </div>

      {/* Issues List */}
      {capabilities.issues.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 p-4">
          <h3 className="font-semibold text-red-900 dark:text-red-200 mb-2">
            ⚠️ Issues Found:
          </h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-red-800 dark:text-red-300">
            {capabilities.issues.map((issue, idx) => (
              <li key={idx}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommended Browsers */}
      {!isSupported && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-4">
          <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
            💡 Recommended Browsers:
          </h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-blue-800 dark:text-blue-300">
            <li>Google Chrome (latest version)</li>
            <li>Microsoft Edge (latest version)</li>
            <li>Mozilla Firefox (latest version)</li>
          </ul>
        </div>
      )}
    </div>
  );
}


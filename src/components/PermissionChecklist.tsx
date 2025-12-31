import { useEffect, useState } from "react";
import {
  checkAllPermissions,
  requestScreenCapture,
  requestMicrophonePermission,
  requestWebcamPermission,
  areAllPermissionsGranted,
  getPermissionStatusMessage,
  type PermissionState,
  type PermissionStatus,
  type PermissionRequestResult,
} from "../utils/permissions";

type PermissionType = "screen" | "microphone" | "webcam";

export default function PermissionChecklist() {
  const [permissions, setPermissions] = useState<PermissionState>({
    screen: "prompt",
    microphone: "prompt",
    webcam: "prompt",
    error: null,
  });
  const [isChecking, setIsChecking] = useState(false);
  const [requesting, setRequesting] = useState<PermissionType | null>(null);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    setIsChecking(true);
    try {
      const state = await checkAllPermissions();
      setPermissions(state);
    } catch (error) {
      setPermissions((prev) => ({
        ...prev,
        error: "Failed to check permissions",
      }));
    } finally {
      setIsChecking(false);
    }
  };

  const handleRequestPermission = async (type: PermissionType) => {
    setRequesting(type);
    setPermissions((prev) => ({ ...prev, error: null }));

    try {
      let result: PermissionRequestResult;
      let newStatus: PermissionStatus = "granted";

      switch (type) {
        case "screen":
          result = await requestScreenCapture();
          if (result.success && result.stream) {
            // Stop the stream immediately - we just needed permission
            result.stream.getTracks().forEach((track) => track.stop());
            newStatus = "granted";
            setPermissions((prev) => ({
              ...prev,
              screen: "granted",
            }));
          } else {
            newStatus = "denied";
            setPermissions((prev) => ({
              ...prev,
              screen: "denied",
              error: result.error || "Failed to get screen capture permission",
            }));
          }
          break;

        case "microphone":
          result = await requestMicrophonePermission();
          if (result.success) {
            newStatus = "granted";
            // Re-check permissions to get updated state
            const micStatus = await checkAllPermissions();
            setPermissions((prev) => ({
              ...prev,
              microphone: micStatus.microphone,
            }));
          } else {
            newStatus = "denied";
            setPermissions((prev) => ({
              ...prev,
              microphone: "denied",
              error: result.error || "Failed to get microphone permission",
            }));
          }
          break;

        case "webcam":
          result = await requestWebcamPermission();
          if (result.success) {
            newStatus = "granted";
            // Re-check permissions to get updated state
            const camStatus = await checkAllPermissions();
            setPermissions((prev) => ({
              ...prev,
              webcam: camStatus.webcam,
            }));
          } else {
            newStatus = "denied";
            setPermissions((prev) => ({
              ...prev,
              webcam: "denied",
              error: result.error || "Failed to get webcam permission",
            }));
          }
          break;
      }
    } catch (error) {
      const err = error as Error;
      setPermissions((prev) => ({
        ...prev,
        [type]: "error",
        error: err.message || `Failed to request ${type} permission`,
      }));
    } finally {
      setRequesting(null);
    }
  };

  const allGranted = areAllPermissionsGranted(permissions);

  const getStatusIcon = (status: PermissionStatus) => {
    switch (status) {
      case "granted":
        return "✅";
      case "denied":
        return "❌";
      case "prompt":
        return "⏳";
      case "checking":
        return "🔄";
      case "error":
        return "⚠️";
      default:
        return "❓";
    }
  };

  const getStatusColor = (status: PermissionStatus) => {
    switch (status) {
      case "granted":
        return "text-green-600 dark:text-green-400";
      case "denied":
        return "text-red-600 dark:text-red-400";
      case "prompt":
        return "text-yellow-600 dark:text-yellow-400";
      case "checking":
        return "text-blue-600 dark:text-blue-400";
      case "error":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  const permissionItems: Array<{
    type: PermissionType;
    label: string;
    description: string;
    icon: string;
  }> = [
    {
      type: "screen",
      label: "Screen Capture",
      description: "Record your screen or browser tab",
      icon: "🖥️",
    },
    {
      type: "microphone",
      label: "Microphone",
      description: "Record audio from your microphone",
      icon: "🎤",
    },
    {
      type: "webcam",
      label: "Webcam",
      description: "Record video from your camera",
      icon: "📹",
    },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-black dark:text-white">
          🔐 Permission Checklist
        </h2>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Grant permissions to enable screen recording features
        </p>
      </div>

      {/* Permission Items */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
        <div className="space-y-4">
          {permissionItems.map((item) => {
            const status = permissions[item.type];
            const isRequesting = requesting === item.type;
            const isGranted = status === "granted";

            return (
              <div
                key={item.type}
                className={`p-4 rounded-lg border ${
                  isGranted
                    ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <span className="text-2xl">{item.icon}</span>
                    <div className="flex-1">
                      <h3 className="font-semibold text-black dark:text-white mb-1">
                        {item.label}
                      </h3>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                        {item.description}
                      </p>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-medium ${getStatusColor(
                            status
                          )}`}
                        >
                          {getStatusIcon(status)}{" "}
                          {getPermissionStatusMessage(item.type, status)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRequestPermission(item.type)}
                    disabled={isGranted || isRequesting || isChecking}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                      isGranted
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 cursor-not-allowed"
                        : isRequesting || isChecking
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 cursor-wait"
                        : "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                    }`}
                  >
                    {isGranted
                      ? "Granted"
                      : isRequesting
                      ? "Requesting..."
                      : "Request"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Error Message */}
      {permissions.error && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-200 mb-1">
                Permission Error
              </h3>
              <p className="text-sm text-red-800 dark:text-red-300">
                {permissions.error}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* All Permissions Granted */}
      {allGranted && (
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <h3 className="font-semibold text-green-900 dark:text-green-200 mb-1">
                All Permissions Granted!
              </h3>
              <p className="text-sm text-green-800 dark:text-green-300">
                You're ready to start recording. All required permissions have
                been granted.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={checkPermissions}
          disabled={isChecking}
          className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isChecking ? "Checking..." : "Refresh Status"}
        </button>

        {!allGranted && (
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            <p>
              💡 Tip: If permissions are denied, check your browser settings and
              allow access to camera, microphone, and screen sharing.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}


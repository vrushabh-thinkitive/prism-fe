import type { Recording } from "../types/recording";

type RecordingRowProps = {
  recording: Recording;
};

/**
 * Format bytes to human-readable size
 */
function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Format duration in seconds to MM:SS
 */
function formatDuration(seconds?: number): string {
  if (!seconds) return "N/A";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format date to readable string
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Shorten recording ID for display
 */
function shortenId(id: string): string {
  return `${id.substring(0, 8)}...`;
}

/**
 * Get status badge styling
 */
function getStatusBadge(status: Recording["status"]) {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "uploading":
    case "initiated":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    case "error":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  }
}

/**
 * Get status label
 */
function getStatusLabel(status: Recording["status"]): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "uploading":
      return "Uploading";
    case "initiated":
      return "Initiated";
    case "error":
      return "Error";
    default:
      return status;
  }
}

export default function RecordingRow({ recording }: RecordingRowProps) {
  const canPlay = recording.status === "completed" && recording.playbackUrl;

  const handlePlay = () => {
    if (canPlay && recording.playbackUrl) {
      window.open(recording.playbackUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <tr className="border-b border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
      {/* Recording ID */}
      <td className="px-4 py-3 text-sm">
        <code className="text-zinc-600 dark:text-zinc-400 font-mono">
          {shortenId(recording.recordingId)}
        </code>
      </td>

      {/* Created Date */}
      <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
        {formatDate(recording.createdAt)}
      </td>

      {/* Duration */}
      <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
        {formatDuration(recording.duration)}
      </td>

      {/* File Size */}
      <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
        {formatSize(recording.fileSize)}
      </td>

      {/* Status Badge */}
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(
            recording.status
          )}`}
        >
          {getStatusLabel(recording.status)}
        </span>
      </td>

      {/* Action */}
      <td className="px-4 py-3">
        {canPlay ? (
          <button
            onClick={handlePlay}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors text-sm font-medium"
          >
            ▶️ Play
          </button>
        ) : recording.status === "uploading" || recording.status === "initiated" ? (
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            Uploading...
          </span>
        ) : recording.status === "error" ? (
          <span className="text-sm text-red-600 dark:text-red-400">
            Failed
          </span>
        ) : (
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            N/A
          </span>
        )}
      </td>
    </tr>
  );
}


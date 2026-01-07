import { useRecordings } from "../hooks/useRecordings";
import RecordingRow from "../components/RecordingRow";

export default function RecordingDashboard() {
  const { recordings, loading, error, refresh } = useRecordings();

  // Debug logging
  console.log("📊 Dashboard State:", {
    recordingsCount: recordings.length,
    loading,
    error,
    recordings: recordings,
  });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black py-8">
      <div className="w-full max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-black dark:text-white">
              📹 Recording Dashboard
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 mt-1">
              View and manage your recordings
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "🔄 Refreshing..." : "🔄 Refresh"}
          </button>
        </div>

        {/* Loading State */}
        {loading && recordings.length === 0 && (
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-12 text-center">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3 mx-auto"></div>
              <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2 mx-auto"></div>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400 mt-4">
              Loading recordings...
            </p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 p-4">
            <div className="flex items-start gap-3">
              <span className="text-xl">⚠️</span>
              <div>
                <h3 className="font-semibold text-red-900 dark:text-red-200 mb-1">
                  Error Loading Recordings
                </h3>
                <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
                <button
                  onClick={refresh}
                  className="mt-3 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 transition-colors text-sm"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Recordings Table */}
        {!loading && (
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            {recordings.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-zinc-600 dark:text-zinc-400 text-lg">
                  No recordings found
                </p>
                <p className="text-zinc-500 dark:text-zinc-500 text-sm mt-2">
                  Start recording to see your videos here
                </p>
                {error && (
                  <p className="text-red-600 dark:text-red-400 text-sm mt-2">
                    Error: {error}
                  </p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        Recording ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        Duration
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        File Size
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {recordings.map((recording) => (
                      <RecordingRow key={recording.recordingId} recording={recording} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Debug Info (remove in production) */}
        {import.meta.env.DEV && recordings.length > 0 && (
          <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 p-4">
            <details className="text-xs">
              <summary className="cursor-pointer text-gray-600 dark:text-gray-400 font-medium mb-2">
                🔍 Debug Info (Development Only)
              </summary>
              <pre className="mt-2 p-2 bg-white dark:bg-zinc-900 rounded text-xs overflow-auto max-h-40">
                {JSON.stringify({ recordingsCount: recordings.length, recordings }, null, 2)}
              </pre>
            </details>
          </div>
        )}

        {/* Info Banner */}
        {!loading && recordings.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-4">
            <div className="flex items-start gap-3">
              <span className="text-xl">ℹ️</span>
              <div className="text-sm text-blue-800 dark:text-blue-300">
                <p className="font-semibold mb-1">Dashboard Info:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Click "🔄 Refresh" to update the recordings list</li>
                  <li>Click "Play" to view completed recordings in a new tab</li>
                  <li>Playback URLs expire after 7 days</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


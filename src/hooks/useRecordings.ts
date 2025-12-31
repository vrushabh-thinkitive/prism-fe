import { useState, useEffect, useRef } from "react";
import { getRecordings } from "../utils/api-config";
import type { Recording } from "../types/recording";

export type UseRecordingsReturn = {
  recordings: Recording[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

/**
 * React hook for fetching and managing recordings list
 * Fetches on mount and when refresh() is called manually
 */
export function useRecordings(): UseRecordingsReturn {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const fetchRecordings = async () => {
    try {
      setError(null);
      setLoading(true);
      console.log("🔄 Fetching recordings...");
      const data = await getRecordings();
      console.log("📊 Recordings received:", data);
      console.log("📊 Recordings count:", Array.isArray(data) ? data.length : 0);
      
      if (isMountedRef.current) {
        setRecordings(Array.isArray(data) ? data : []);
        setLoading(false);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch recordings";
      console.error("❌ Failed to fetch recordings:", err);
      if (isMountedRef.current) {
        setError(errorMessage);
        setLoading(false);
      }
    }
  };

  // Initial fetch only - runs once when component mounts
  useEffect(() => {
    isMountedRef.current = true;
    fetchRecordings();

    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
    };
  }, []); // Empty deps - only run on mount/unmount

  return {
    recordings,
    loading,
    error,
    refresh: fetchRecordings,
  };
}


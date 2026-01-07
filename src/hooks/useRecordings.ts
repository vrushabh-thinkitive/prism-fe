import { useState, useEffect, useRef, useCallback } from "react";
import { getRecordings } from "../utils/api-config";
import { useAuthUser } from "./useAuthUser";
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
  const { getAccessToken, isAuthenticated } = useAuthUser();

  const fetchRecordings = useCallback(async () => {
    if (!isAuthenticated) {
      console.warn("⚠️ User not authenticated, skipping recordings fetch");
      if (isMountedRef.current) {
        setError("User not authenticated");
        setLoading(false);
      }
      return;
    }

    try {
      setError(null);
      setLoading(true);
      console.log("🔄 Fetching recordings...");
      const accessToken = await getAccessToken();
      const data = await getRecordings({ accessToken });
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
  }, [isAuthenticated, getAccessToken]);

  // Initial fetch only - runs once when component mounts or when authenticated
  useEffect(() => {
    isMountedRef.current = true;
    if (isAuthenticated) {
      fetchRecordings();
    } else {
      setLoading(false);
    }

    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
    };
  }, [isAuthenticated, fetchRecordings]); // Re-fetch when authentication status changes

  return {
    recordings,
    loading,
    error,
    refresh: fetchRecordings,
  };
}


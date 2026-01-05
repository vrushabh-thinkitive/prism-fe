import { useState, useEffect, useRef, useCallback } from "react";
import {
  DualRecorder,
  type DualRecordingState,
  type DualRecordingOptions,
} from "../utils/dual-recorder";

export type UseDualRecorderReturn = {
  state: DualRecordingState;
  duration: number;
  screenBlob: Blob | null;
  webcamBlob: Blob | null;
  screenSize: number;
  webcamSize: number;
  error: string | null;
  start: (options?: DualRecordingOptions) => Promise<void>;
  stop: () => { screenBlob: Blob | null; webcamBlob: Blob | null };
  pause: () => void;
  resume: () => void;
  reset: () => void;
  onScreenSelected: (callback: () => void) => void;
  abortCountdown: () => void;
};

export function useDualRecorder(): UseDualRecorderReturn {
  const recorderRef = useRef<DualRecorder | null>(null);
  const [state, setState] = useState<DualRecordingState>("idle");
  const [duration, setDuration] = useState<number>(0);
  const [screenBlob, setScreenBlob] = useState<Blob | null>(null);
  const [webcamBlob, setWebcamBlob] = useState<Blob | null>(null);
  const [screenSize, setScreenSize] = useState<number>(0);
  const [webcamSize, setWebcamSize] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const screenSelectedCallbackRef = useRef<(() => void) | null>(null);

  // Initialize recorder
  useEffect(() => {
    recorderRef.current = new DualRecorder({
      onStateChange: (newState) => {
        setState(newState);
      },
      onDurationUpdate: (newDuration) => {
        setDuration(newDuration);
      },
      onError: (err) => {
        setError(err.message);
      },
      onScreenShareStopped: () => {
        const result = recorderRef.current?.stop() || {
          screenBlob: null,
          webcamBlob: null,
        };
        setScreenBlob(result.screenBlob);
        setWebcamBlob(result.webcamBlob);
        setScreenSize(recorderRef.current?.getScreenSize() || 0);
        setWebcamSize(recorderRef.current?.getWebcamSize() || 0);
      },
      onWebcamDisconnected: () => {
        // Webcam disconnected
      },
      onMicrophoneDisconnected: () => {
        // Microphone disconnected
      },
      onScreenSelected: () => {
        screenSelectedCallbackRef.current?.();
      },
    });

    return () => {
      recorderRef.current?.cleanup();
    };
  }, []);

  const start = useCallback(async (options?: DualRecordingOptions) => {
    setError(null);
    try {
      await recorderRef.current?.start(options);
    } catch (err) {
      const error = err as Error;
      setError(error.message);
      throw error;
    }
  }, []);

  const stop = useCallback(() => {
    setError(null);
    const result = recorderRef.current?.stop() || {
      screenBlob: null,
      webcamBlob: null,
    };
    setScreenBlob(result.screenBlob);
    setWebcamBlob(result.webcamBlob);
    setScreenSize(recorderRef.current?.getScreenSize() || 0);
    setWebcamSize(recorderRef.current?.getWebcamSize() || 0);
    return result;
  }, []);

  const pause = useCallback(() => {
    recorderRef.current?.pause();
  }, []);

  const resume = useCallback(() => {
    recorderRef.current?.resume();
  }, []);

  const reset = useCallback(() => {
    recorderRef.current?.cleanup();
    setState("idle");
    setDuration(0);
    setScreenBlob(null);
    setWebcamBlob(null);
    setScreenSize(0);
    setWebcamSize(0);
    setError(null);

    // Reinitialize recorder
    recorderRef.current = new DualRecorder({
      onStateChange: (newState) => {
        setState(newState);
      },
      onDurationUpdate: (newDuration) => {
        setDuration(newDuration);
      },
      onError: (err) => {
        setError(err.message);
      },
      onScreenShareStopped: () => {
        const result = recorderRef.current?.stop() || {
          screenBlob: null,
          webcamBlob: null,
        };
        setScreenBlob(result.screenBlob);
        setWebcamBlob(result.webcamBlob);
        setScreenSize(recorderRef.current?.getScreenSize() || 0);
        setWebcamSize(recorderRef.current?.getWebcamSize() || 0);
      },
      onWebcamDisconnected: () => {
        // Webcam disconnected
      },
      onMicrophoneDisconnected: () => {
        // Microphone disconnected
      },
    });
  }, []);

  const onScreenSelected = useCallback((callback: () => void) => {
    screenSelectedCallbackRef.current = callback;
  }, []);

  const abortCountdown = useCallback(() => {
    recorderRef.current?.abortCountdown();
  }, []);

  return {
    state,
    duration,
    screenBlob,
    webcamBlob,
    screenSize,
    webcamSize,
    error,
    start,
    stop,
    pause,
    resume,
    reset,
    onScreenSelected,
    abortCountdown,
  };
}

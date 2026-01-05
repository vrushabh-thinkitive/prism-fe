import { useState, useEffect, useRef, useCallback } from "react";
import {
  ScreenRecorder,
  type RecordingState,
  type RecordingOptions,
} from "../utils/screen-recorder";

export type UseScreenRecorderReturn = {
  state: RecordingState;
  duration: number;
  blob: Blob | null;
  screenBlob: Blob | null;
  webcamBlob: Blob | null;
  size: number;
  screenSize: number;
  webcamSize: number;
  error: string | null;
  canvas: HTMLCanvasElement | null;
  isWebcamEnabled: boolean;
  isMicrophoneEnabled: boolean;
  microphoneLevel: number;
  start: (options?: RecordingOptions) => Promise<void>;
  stop: () => Blob | null;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  updateWebcamPosition: (position: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
  muteMicrophone: (muted: boolean) => void;
  onScreenSelected: (callback: () => void) => void;
  abortCountdown: () => void;
};

export function useScreenRecorder(): UseScreenRecorderReturn {
  const recorderRef = useRef<ScreenRecorder | null>(null);
  const [state, setState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState<number>(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [screenBlob, setScreenBlob] = useState<Blob | null>(null);
  const [webcamBlob, setWebcamBlob] = useState<Blob | null>(null);
  const [size, setSize] = useState<number>(0);
  const [screenSize, setScreenSize] = useState<number>(0);
  const [webcamSize, setWebcamSize] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [isWebcamEnabled, setIsWebcamEnabled] = useState<boolean>(false);
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] =
    useState<boolean>(false);
  const [microphoneLevel, setMicrophoneLevel] = useState<number>(0);
  const screenSelectedCallbackRef = useRef<(() => void) | null>(null);

  // Initialize recorder
  useEffect(() => {
    recorderRef.current = new ScreenRecorder({
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
        // Screen share was stopped by user
        const finalBlob = recorderRef.current?.getBlob() || null;
        const finalScreenBlob = recorderRef.current?.getScreenBlob() || null;
        const finalWebcamBlob = recorderRef.current?.getWebcamBlob() || null;
        setBlob(finalBlob);
        setScreenBlob(finalScreenBlob);
        setWebcamBlob(finalWebcamBlob);
        setSize(recorderRef.current?.getSize() || 0);
        setScreenSize(recorderRef.current?.getScreenSize() || 0);
        setWebcamSize(recorderRef.current?.getWebcamSize() || 0);
      },
      onWebcamDisconnected: () => {
        setIsWebcamEnabled(false);
      },
      onCanvasReady: (canvasElement) => {
        setCanvas(canvasElement);
        setIsWebcamEnabled(recorderRef.current?.isWebcamEnabled() || false);
        setIsMicrophoneEnabled(
          recorderRef.current?.isMicrophoneEnabled() || false
        );
      },
      onMicrophoneDisconnected: () => {
        setIsMicrophoneEnabled(false);
        setMicrophoneLevel(0);
      },
      onMicrophoneLevelUpdate: (level) => {
        setMicrophoneLevel(level);
      },
      onScreenSelected: () => {
        screenSelectedCallbackRef.current?.();
      },
    });

    return () => {
      // Cleanup on unmount
      recorderRef.current?.cleanup();
    };
  }, []);

  const start = useCallback(async (options?: RecordingOptions) => {
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
    const resultBlob = recorderRef.current?.stop() || null;
    const resultScreenBlob = recorderRef.current?.getScreenBlob() || null;
    const resultWebcamBlob = recorderRef.current?.getWebcamBlob() || null;
    setBlob(resultBlob);
    setScreenBlob(resultScreenBlob);
    setWebcamBlob(resultWebcamBlob);
    setSize(recorderRef.current?.getSize() || 0);
    setScreenSize(recorderRef.current?.getScreenSize() || 0);
    setWebcamSize(recorderRef.current?.getWebcamSize() || 0);
    return resultBlob;
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
    setBlob(null);
    setScreenBlob(null);
    setWebcamBlob(null);
    setSize(0);
    setScreenSize(0);
    setWebcamSize(0);
    setError(null);
    setCanvas(null);
    setIsWebcamEnabled(false);

    // Reinitialize recorder
    recorderRef.current = new ScreenRecorder({
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
        const finalBlob = recorderRef.current?.getBlob() || null;
        const finalScreenBlob = recorderRef.current?.getScreenBlob() || null;
        const finalWebcamBlob = recorderRef.current?.getWebcamBlob() || null;
        setBlob(finalBlob);
        setScreenBlob(finalScreenBlob);
        setWebcamBlob(finalWebcamBlob);
        setSize(recorderRef.current?.getSize() || 0);
        setScreenSize(recorderRef.current?.getScreenSize() || 0);
        setWebcamSize(recorderRef.current?.getWebcamSize() || 0);
      },
      onWebcamDisconnected: () => {
        setIsWebcamEnabled(false);
      },
      onCanvasReady: (canvasElement) => {
        setCanvas(canvasElement);
        setIsWebcamEnabled(recorderRef.current?.isWebcamEnabled() || false);
        setIsMicrophoneEnabled(
          recorderRef.current?.isMicrophoneEnabled() || false
        );
      },
      onMicrophoneDisconnected: () => {
        setIsMicrophoneEnabled(false);
        setMicrophoneLevel(0);
      },
      onMicrophoneLevelUpdate: (level) => {
        setMicrophoneLevel(level);
      },
    });
  }, []);

  const updateWebcamPosition = useCallback(
    (position: { x: number; y: number; width: number; height: number }) => {
      recorderRef.current?.updateWebcamPosition(position);
    },
    []
  );

  const muteMicrophone = useCallback((muted: boolean) => {
    recorderRef.current?.muteMicrophone(muted);
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
    blob,
    screenBlob,
    webcamBlob,
    size,
    screenSize,
    webcamSize,
    error,
    canvas,
    isWebcamEnabled,
    isMicrophoneEnabled,
    microphoneLevel,
    start,
    stop,
    pause,
    resume,
    reset,
    updateWebcamPosition,
    muteMicrophone,
    onScreenSelected,
    abortCountdown,
  };
}


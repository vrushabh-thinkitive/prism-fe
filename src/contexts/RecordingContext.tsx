import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

type RecordingState = "idle" | "recording" | "paused" | "stopped" | "error";

type RecordingContextType = {
  recordingState: RecordingState;
  setRecordingState: (state: RecordingState) => void;
};

const RecordingContext = createContext<RecordingContextType | undefined>(
  undefined
);

export function RecordingProvider({ children }: { children: ReactNode }) {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");

  return (
    <RecordingContext.Provider value={{ recordingState, setRecordingState }}>
      {children}
    </RecordingContext.Provider>
  );
}

export function useRecordingState() {
  const context = useContext(RecordingContext);
  if (!context) {
    throw new Error("useRecordingState must be used within RecordingProvider");
  }
  return context;
}

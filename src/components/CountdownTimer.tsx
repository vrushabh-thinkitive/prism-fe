import { useEffect, useState, useRef } from "react";

type CountdownTimerProps = {
  duration: number; // Duration in seconds (3-5)
  onComplete: () => void;
  onCancel: () => void;
};

export default function CountdownTimer({
  duration,
  onComplete,
  onCancel,
}: CountdownTimerProps) {
  const [countdown, setCountdown] = useState<number>(duration);
  const [isCancelled, setIsCancelled] = useState<boolean>(false);
  const onCompleteRef = useRef(onComplete);
  const hasCompletedRef = useRef(false);

  // Update ref when callback changes
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Reset countdown when duration changes (component remounts)
  useEffect(() => {
    setCountdown(duration);
    hasCompletedRef.current = false;
    setIsCancelled(false);
  }, [duration]);

  useEffect(() => {
    if (isCancelled) return;

    if (countdown <= 0) {
      if (!hasCompletedRef.current) {
        hasCompletedRef.current = true;
        onCompleteRef.current();
      }
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, isCancelled]);

  const handleCancel = () => {
    setIsCancelled(true);
    onCancel();
  };

  if (isCancelled) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-2xl max-w-md w-full mx-4">
        <div className="text-center space-y-6">
          <div className="relative">
            <div className="text-8xl font-bold text-blue-600 dark:text-blue-400 animate-pulse">
              {countdown}
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="w-32 h-32 border-8 border-blue-600 dark:border-blue-400 rounded-full animate-spin"
                style={{
                  borderTopColor: "transparent",
                  animationDuration: "1s",
                }}
              />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-semibold text-black dark:text-white mb-2">
              Recording Starting...
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400">
              Get ready! Recording will begin in {countdown} second
              {countdown !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={handleCancel}
            className="px-6 py-3 rounded-lg bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 transition-colors font-medium"
          >
            Cancel Recording
          </button>
        </div>
      </div>
    </div>
  );
}


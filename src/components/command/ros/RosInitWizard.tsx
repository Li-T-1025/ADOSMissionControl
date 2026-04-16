"use client";

/**
 * @module RosInitWizard
 * @description Full-width progress view shown during ROS 2 environment initialization.
 * Displays SSE step list, log tail, elapsed counter, and cancel button.
 * @license GPL-3.0-only
 */

import { useEffect, useRef, useState } from "react";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { useRosStore } from "@/stores/ros-store";

export function RosInitWizard() {
  const initProgress = useRosStore((s) => s.initProgress);
  const initInProgress = useRosStore((s) => s.initInProgress);
  const rosState = useRosStore((s) => s.rosState);
  const error = useRosStore((s) => s.error);

  const [elapsed, setElapsed] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);

  // Elapsed timer
  useEffect(() => {
    if (!initInProgress) return;
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [initInProgress]);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [initProgress]);

  const isDone = rosState === "running" && !initInProgress;
  const isError = rosState === "error" && !initInProgress;

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 max-w-xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        {initInProgress && <Loader2 className="w-6 h-6 text-accent-primary animate-spin" />}
        {isDone && <CheckCircle className="w-6 h-6 text-status-success" />}
        {isError && <XCircle className="w-6 h-6 text-status-error" />}
        <h2 className="text-lg font-semibold text-text-primary">
          {initInProgress
            ? "Initializing ROS 2 Environment..."
            : isDone
              ? "ROS 2 Environment Ready"
              : "Initialization Failed"}
        </h2>
      </div>

      {/* Elapsed */}
      {initInProgress && (
        <p className="text-xs text-text-secondary mb-4">
          Elapsed: {Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, "0")}
        </p>
      )}

      {/* Step log */}
      <div
        ref={logRef}
        className="w-full bg-surface-secondary border border-border-primary rounded-lg p-4 max-h-64 overflow-y-auto mb-4 font-mono text-xs"
      >
        {initProgress.length === 0 && (
          <p className="text-text-secondary">Waiting for progress events...</p>
        )}
        {initProgress.map((entry, i) => (
          <div
            key={i}
            className={`py-0.5 ${
              entry.step === "error"
                ? "text-status-error"
                : entry.step === "done"
                  ? "text-status-success"
                  : "text-text-secondary"
            }`}
          >
            <span className="text-text-tertiary mr-2">[{entry.step || "..."}]</span>
            {entry.message}
          </div>
        ))}
      </div>

      {/* Error detail */}
      {isError && error && (
        <div className="w-full bg-status-error/10 border border-status-error/30 rounded-lg p-3 mb-4">
          <p className="text-sm text-status-error">{error}</p>
        </div>
      )}
    </div>
  );
}

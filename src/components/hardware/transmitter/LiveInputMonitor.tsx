"use client";

/**
 * @module LiveInputMonitor
 * @description Live 16-channel monitor for the ADOS Edge transmitter.
 * Opens the CHANNEL MONITOR stream on mount, closes it on unmount.
 * Renders each channel as a horizontal bar with a numeric value.
 * @license GPL-3.0-only
 */

import { useEffect } from "react";
import { useAdosEdgeStore } from "@/stores/ados-edge-store";
import { useAdosEdgeInputStore } from "@/stores/ados-edge-input-store";

function formatValue(v: number): string {
  // Channels come in as signed -1024..+1024 from the mixer.
  return `${v >= 0 ? "+" : ""}${v}`;
}

function ChannelBar({ index, value }: { index: number; value: number }) {
  const clamped = Math.max(-1024, Math.min(1024, value));
  const pct = ((clamped + 1024) / 2048) * 100;
  return (
    <div className="flex items-center gap-3">
      <span className="w-8 text-xs tabular-nums text-text-muted">{index + 1}</span>
      <div className="relative h-4 flex-1 overflow-hidden rounded border border-border bg-surface-primary">
        <div
          className="absolute top-0 h-full bg-accent-primary transition-[width] duration-75"
          style={{
            left: value >= 0 ? "50%" : `${50 - (Math.abs(clamped) / 1024) * 50}%`,
            width: `${(Math.abs(clamped) / 1024) * 50}%`,
          }}
        />
        <div className="absolute top-0 left-1/2 h-full w-px bg-text-muted/40" />
      </div>
      <span className="w-14 text-right text-xs tabular-nums text-text-primary">
        {formatValue(value)}
      </span>
      <span className="w-10 text-right text-xs tabular-nums text-text-muted">
        {Math.round(pct)}%
      </span>
    </div>
  );
}

export function LiveInputMonitor() {
  const connected = useAdosEdgeStore((s) => s.state === "connected");
  const channels = useAdosEdgeInputStore((s) => s.channels);
  const streaming = useAdosEdgeInputStore((s) => s.streaming);
  const lastFrameAt = useAdosEdgeInputStore((s) => s.lastFrameAt);
  const startStream = useAdosEdgeInputStore((s) => s.startStream);
  const stopStream = useAdosEdgeInputStore((s) => s.stopStream);

  useEffect(() => {
    if (!connected) return undefined;
    void startStream();
    return () => {
      void stopStream();
    };
  }, [connected, startStream, stopStream]);

  if (!connected) {
    return (
      <div className="p-6 text-sm text-text-secondary">
        Connect the transmitter first.
      </div>
    );
  }

  const stale = streaming && Date.now() - lastFrameAt > 1000;

  return (
    <div className="flex flex-col gap-2 p-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Live channels</h2>
        <div className="flex items-center gap-3 text-xs">
          {streaming ? (
            <span className={stale ? "text-status-warning" : "text-status-success"}>
              {stale ? "stale" : "streaming"}
            </span>
          ) : (
            <span className="text-text-muted">idle</span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        {channels.map((v, i) => (
          <ChannelBar key={i} index={i} value={v} />
        ))}
      </div>
    </div>
  );
}

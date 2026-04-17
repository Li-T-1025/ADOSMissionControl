"use client";

/**
 * @module MeshWsBanner
 * @description Surfaces mesh WebSocket connection loss so the operator
 * knows neighbor, gateway, and pairing events are temporarily not flowing.
 * Renders only when the WS has moved away from "connected". Hidden while
 * idle (never connected yet) so a first-mount state is not misread as a
 * drop.
 * @license GPL-3.0-only
 */

import { useEffect, useState } from "react";
import { useGroundStationStore } from "@/stores/ground-station-store";

export function MeshWsBanner() {
  const wsState = useGroundStationStore((s) => s.mesh.wsState);
  const disconnectedAt = useGroundStationStore((s) => s.mesh.wsDisconnectedAt);
  const [now, setNow] = useState<number>(() => Date.now());

  // Tick the clock while disconnected so the elapsed-seconds counter
  // advances without the store churning.
  useEffect(() => {
    if (wsState === "connected" || wsState === "idle") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [wsState]);

  if (wsState === "connected" || wsState === "idle") {
    return null;
  }

  const elapsedS = disconnectedAt
    ? Math.max(0, Math.floor((now - disconnectedAt) / 1000))
    : null;

  const tone = wsState === "closed" ? "error" : "warning";
  const toneClasses =
    tone === "error"
      ? "border-status-error bg-status-error/10 text-status-error"
      : "border-status-warning bg-status-warning/10 text-status-warning";

  const label =
    wsState === "closed"
      ? "Mesh event stream closed"
      : "Mesh event stream reconnecting";
  const detail =
    elapsedS !== null ? ` (${elapsedS}s)` : "";

  // Screen readers announce the static label + explanation ONCE per
  // transition into reconnecting/closed state. The elapsed counter
  // updates every second for sighted users but is marked aria-hidden
  // so the live region does not re-read "5 seconds... 6 seconds..."
  // indefinitely.
  const announced =
    wsState === "closed"
      ? "Mesh event stream closed. Live mesh and pairing events are paused. Polling data still refreshes."
      : "Mesh event stream reconnecting. Live mesh and pairing events are paused. Polling data still refreshes.";

  return (
    <div
      className={`mb-4 rounded-sm border px-3 py-2 text-xs ${toneClasses}`}
    >
      <span role="status" aria-live="polite" className="sr-only">
        {announced}
      </span>
      <span aria-hidden="true">
        <span className="font-medium">{label}{detail}.</span>{" "}
        <span className="text-text-secondary">
          Live mesh and pairing events are paused. Polling data still refreshes.
        </span>
      </span>
    </div>
  );
}

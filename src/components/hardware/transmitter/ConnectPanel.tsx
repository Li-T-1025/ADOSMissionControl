"use client";

/**
 * @module ConnectPanel
 * @description ADOS Edge transmitter connect flow. WebSerial picker +
 * firmware handshake. Disconnected state shows the big Connect button;
 * connected state hides itself so the dashboard can render.
 * @license GPL-3.0-only
 */

import { useEffect } from "react";
import { AdosEdgeTransport } from "@/lib/ados-edge/transport";
import { useAdosEdgeStore } from "@/stores/ados-edge-store";
import { isDemoMode } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function ConnectPanel() {
  const state = useAdosEdgeStore((s) => s.state);
  const error = useAdosEdgeStore((s) => s.error);
  const connect = useAdosEdgeStore((s) => s.connect);
  const clearError = useAdosEdgeStore((s) => s.clearError);

  useEffect(() => {
    if (state === "error") {
      const t = setTimeout(() => clearError(), 4000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [state, clearError]);

  if (state === "connected") {
    return null;
  }

  const supported = AdosEdgeTransport.isSupported();
  const demo = isDemoMode();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-6">
      <div className="w-full max-w-lg rounded-lg border border-border bg-surface-secondary p-8 text-center">
        <h2 className="text-2xl font-semibold text-text-primary">ADOS Edge Controller</h2>
        <p className="mt-3 text-sm text-text-secondary">
          Plug the transmitter in over USB-C, click Connect, and pick the device.
          The panel edits models, streams live sticks, runs calibration, and flashes firmware.
        </p>

        {demo && (
          <div className="mt-4 rounded border border-accent-primary/40 bg-accent-primary/10 px-3 py-2 text-xs text-accent-primary">
            Demo mode ACTIVE. Connect picks up a synthetic transmitter with simulated sticks and three sample models.
          </div>
        )}

        <div className="mt-6 flex flex-col items-center gap-3">
          <Button
            onClick={() => void connect()}
            disabled={(!demo && !supported) || state === "connecting"}
            className="px-8 py-3 text-base"
          >
            {state === "connecting"
              ? "Connecting..."
              : demo
                ? "Connect (demo)"
                : "Connect device"}
          </Button>

          {!supported && !demo && (
            <p className="text-xs text-status-warning">
              WebSerial needed. Try Chrome, Edge, or Opera on desktop.
            </p>
          )}

          {error && state === "error" && (
            <p className="text-sm text-status-error">{error}</p>
          )}
        </div>
      </div>

      <p className="text-xs text-text-muted">
        On Safari or Firefox? The ADOS Mission Control Android app covers the mobile path.
      </p>
    </div>
  );
}

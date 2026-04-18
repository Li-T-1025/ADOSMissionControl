/**
 * @module stores/ados-edge-telemetry-store
 * @description Live CRSF telemetry mirror. Subscribes to the CDC
 * stream dispatcher and populates a flat record the telemetry
 * dashboard reads. Typed to the 5 frame shapes the firmware emits.
 * @license GPL-3.0-only
 */

import { create } from "zustand";
import { useAdosEdgeStore } from "./ados-edge-store";
import type { StreamFrame } from "@/lib/ados-edge/cdc-client";

export interface LinkStats {
  rssi1: number;
  lq: number;
  snr: number;
}

interface TelemetryState {
  link: LinkStats | null;
  streaming: boolean;
  lastFrameAt: number;
  unsubscribe: (() => void) | null;
}

interface TelemetryActions {
  startStream: () => Promise<void>;
  stopStream: () => Promise<void>;
  clear: () => void;
}

function isLinkStatsFrame(f: StreamFrame): f is { type: "link" } & LinkStats {
  if (typeof f !== "object" || f === null) return false;
  const maybe = f as { type?: unknown; rssi1?: unknown; lq?: unknown; snr?: unknown };
  return (
    maybe.type === "link" &&
    typeof maybe.rssi1 === "number" &&
    typeof maybe.lq === "number" &&
    typeof maybe.snr === "number"
  );
}

export const useAdosEdgeTelemetryStore = create<TelemetryState & TelemetryActions>((set, get) => ({
  link: null,
  streaming: false,
  lastFrameAt: 0,
  unsubscribe: null,

  async startStream() {
    const client = useAdosEdgeStore.getState().client;
    if (!client || get().streaming) return;

    const unsubscribe = client.onStream((frame) => {
      if (isLinkStatsFrame(frame)) {
        set({
          link: { rssi1: frame.rssi1, lq: frame.lq, snr: frame.snr },
          lastFrameAt: Date.now(),
        });
      }
    });
    set({ unsubscribe, streaming: true });
    try {
      await client.telem(true);
    } catch {
      unsubscribe();
      set({ unsubscribe: null, streaming: false });
    }
  },

  async stopStream() {
    const client = useAdosEdgeStore.getState().client;
    const { unsubscribe } = get();
    if (unsubscribe) unsubscribe();
    set({ unsubscribe: null, streaming: false });
    if (client) {
      await client.telem(false).catch(() => {});
    }
  },

  clear() {
    const { unsubscribe } = get();
    if (unsubscribe) unsubscribe();
    set({ link: null, streaming: false, unsubscribe: null, lastFrameAt: 0 });
  },
}));

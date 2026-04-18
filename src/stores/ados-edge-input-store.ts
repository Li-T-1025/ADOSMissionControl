/**
 * @module stores/ados-edge-input-store
 * @description Live input + channel monitor state. Reads 50 Hz
 * streaming frames from the CDC client and mirrors them into Zustand.
 * Subscribers use `useAdosEdgeInputStore((s) => s.channels)` to pick up
 * updates.
 * @license GPL-3.0-only
 */

import { create } from "zustand";
import { useAdosEdgeStore } from "./ados-edge-store";
import type { StreamFrame } from "@/lib/ados-edge/cdc-client";

interface InputState {
  channels: number[];
  streaming: boolean;
  lastFrameAt: number;
  unsubscribe: (() => void) | null;
}

interface InputActions {
  startStream: () => Promise<void>;
  stopStream: () => Promise<void>;
  clear: () => void;
}

function isChannelFrame(f: StreamFrame): f is { ch: number[] } {
  return (
    typeof f === "object" &&
    f !== null &&
    Array.isArray((f as { ch?: unknown }).ch) &&
    (f as { ch: unknown[] }).ch.every((v) => typeof v === "number")
  );
}

export const useAdosEdgeInputStore = create<InputState & InputActions>((set, get) => ({
  channels: new Array(16).fill(0),
  streaming: false,
  lastFrameAt: 0,
  unsubscribe: null,

  async startStream() {
    const client = useAdosEdgeStore.getState().client;
    if (!client) return;
    if (get().streaming) return;

    const unsubscribe = client.onStream((frame) => {
      if (isChannelFrame(frame)) {
        set({ channels: frame.ch.slice(0, 16), lastFrameAt: Date.now() });
      }
    });
    set({ unsubscribe, streaming: true });
    try {
      await client.channelMonitor(true);
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
      await client.channelMonitor(false).catch(() => {});
    }
  },

  clear() {
    const { unsubscribe } = get();
    if (unsubscribe) unsubscribe();
    set({ channels: new Array(16).fill(0), streaming: false, unsubscribe: null, lastFrameAt: 0 });
  },
}));

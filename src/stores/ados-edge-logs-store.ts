/**
 * @module stores/ados-edge-logs-store
 * @description Live firmware log tail. Subscribes to the CDC stream
 * dispatcher, filters frames with `type === "log"`, and pushes each
 * entry into a fixed-capacity ring buffer. The view renders the
 * buffer with severity filter chips, search, and pause / resume
 * controls; pause flips a flag that keeps the ring buffer filling
 * (so no data is lost) but freezes the rendered snapshot.
 * @license GPL-3.0-only
 */

import { create } from "zustand";
import { useAdosEdgeStore } from "./ados-edge-store";
import { RingBuffer } from "@/lib/ring-buffer";
import type { StreamFrame } from "@/lib/ados-edge/cdc-client";
import { logsStart, logsStop } from "@/lib/ados-edge/edge-link-streams";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogLine {
  t: number;
  level: LogLevel;
  msg: string;
  seq: number;
}

const LOG_BUFFER_CAP = 500;
const VALID_LEVELS: readonly LogLevel[] = ["debug", "info", "warn", "error"];

function isLogLevel(v: unknown): v is LogLevel {
  return typeof v === "string" && (VALID_LEVELS as readonly string[]).includes(v);
}

function isLogFrame(f: StreamFrame): f is { type: "log"; t: number; level: string; msg: string } {
  const m = f as { type?: unknown; t?: unknown; level?: unknown; msg?: unknown };
  return (
    m.type === "log" &&
    typeof m.t === "number" &&
    typeof m.level === "string" &&
    typeof m.msg === "string"
  );
}

interface LogsState {
  lines: RingBuffer<LogLine>;
  /** Monotonic counter so consumers can detect buffer mutation without
   * walking the ring. Bumps on every push. */
  revision: number;
  streaming: boolean;
  paused: boolean;
  unsubscribe: (() => void) | null;
}

interface LogsActions {
  startStream: () => Promise<void>;
  stopStream: () => Promise<void>;
  clear: () => void;
  pause: () => void;
  resume: () => void;
}

export const useAdosEdgeLogsStore = create<LogsState & LogsActions>((set, get) => {
  let seq = 0;

  return {
    lines: new RingBuffer<LogLine>(LOG_BUFFER_CAP),
    revision: 0,
    streaming: false,
    paused: false,
    unsubscribe: null,

    async startStream() {
      const link = useAdosEdgeStore.getState().link;
      if (!link || get().streaming) return;

      const unsubscribe = link.onStream((frame) => {
        if (!isLogFrame(frame)) return;
        const level: LogLevel = isLogLevel(frame.level) ? frame.level : "info";
        seq += 1;
        get().lines.push({
          t: frame.t,
          level,
          msg: frame.msg,
          seq,
        });
        set((prev) => ({ revision: prev.revision + 1 }));
      });

      set({ unsubscribe, streaming: true });
      try {
        await logsStart(link);
      } catch {
        unsubscribe();
        set({ unsubscribe: null, streaming: false });
      }
    },

    async stopStream() {
      const link = useAdosEdgeStore.getState().link;
      const { unsubscribe } = get();
      if (unsubscribe) unsubscribe();
      set({ unsubscribe: null, streaming: false });
      if (link) {
        await logsStop(link).catch(() => {});
      }
    },

    clear() {
      get().lines.clear();
      set((prev) => ({ revision: prev.revision + 1 }));
    },

    pause() {
      set({ paused: true });
    },

    resume() {
      set({ paused: false });
    },
  };
});

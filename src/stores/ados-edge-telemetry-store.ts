/**
 * @module stores/ados-edge-telemetry-store
 * @description Live CRSF telemetry mirror. Subscribes to the CDC
 * stream dispatcher and populates typed slices for link, GPS, battery,
 * attitude, and active flight mode.
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

export interface GpsStats {
  lat: number;  /* degrees * 1e7 */
  lon: number;
  alt: number;  /* metres (offset already removed firmware-side) */
  sats: number;
}

export interface BatteryStats {
  voltageDv: number;  /* deci-volts */
  currentDa: number;  /* deci-amps */
  mah: number;
  pct: number;
}

export interface AttitudeStats {
  pitch: number;  /* rad * 1e4 */
  roll: number;
  yaw: number;
}

export interface ModeStats {
  name: string;
}

interface TelemetryState {
  link: LinkStats | null;
  gps: GpsStats | null;
  battery: BatteryStats | null;
  attitude: AttitudeStats | null;
  mode: ModeStats | null;
  streaming: boolean;
  lastFrameAt: number;
  lastLinkAt: number;
  lastBatteryAt: number;
  lastGpsAt: number;
  lastAttitudeAt: number;
  lastModeAt: number;
  unsubscribe: (() => void) | null;
}

interface TelemetryActions {
  startStream: () => Promise<void>;
  stopStream: () => Promise<void>;
  clear: () => void;
}

function isLinkFrame(f: StreamFrame): f is { type: "link" } & LinkStats {
  const m = f as { type?: unknown; rssi1?: unknown; lq?: unknown; snr?: unknown };
  return (
    m.type === "link" &&
    typeof m.rssi1 === "number" &&
    typeof m.lq === "number" &&
    typeof m.snr === "number"
  );
}
function isGpsFrame(f: StreamFrame): f is { type: "gps"; lat: number; lon: number; alt: number; sats: number } {
  const m = f as { type?: unknown; lat?: unknown; lon?: unknown; alt?: unknown; sats?: unknown };
  return (
    m.type === "gps" &&
    typeof m.lat === "number" &&
    typeof m.lon === "number" &&
    typeof m.alt === "number" &&
    typeof m.sats === "number"
  );
}
function isBatteryFrame(f: StreamFrame): f is { type: "battery"; v: number; a: number; mah: number; pct: number } {
  const m = f as { type?: unknown; v?: unknown; a?: unknown; mah?: unknown; pct?: unknown };
  return (
    m.type === "battery" &&
    typeof m.v === "number" &&
    typeof m.a === "number" &&
    typeof m.mah === "number" &&
    typeof m.pct === "number"
  );
}
function isAttitudeFrame(f: StreamFrame): f is { type: "attitude"; pitch: number; roll: number; yaw: number } {
  const m = f as { type?: unknown; pitch?: unknown; roll?: unknown; yaw?: unknown };
  return (
    m.type === "attitude" &&
    typeof m.pitch === "number" &&
    typeof m.roll === "number" &&
    typeof m.yaw === "number"
  );
}
function isModeFrame(f: StreamFrame): f is { type: "mode"; name: string } {
  const m = f as { type?: unknown; name?: unknown };
  return m.type === "mode" && typeof m.name === "string";
}

export const useAdosEdgeTelemetryStore = create<TelemetryState & TelemetryActions>((set, get) => ({
  link: null,
  gps: null,
  battery: null,
  attitude: null,
  mode: null,
  streaming: false,
  lastFrameAt: 0,
  lastLinkAt: 0,
  lastBatteryAt: 0,
  lastGpsAt: 0,
  lastAttitudeAt: 0,
  lastModeAt: 0,
  unsubscribe: null,

  async startStream() {
    const client = useAdosEdgeStore.getState().client;
    if (!client || get().streaming) return;

    const unsubscribe = client.onStream((frame) => {
      const now = Date.now();
      if (isLinkFrame(frame)) {
        set({
          link: { rssi1: frame.rssi1, lq: frame.lq, snr: frame.snr },
          lastFrameAt: now,
          lastLinkAt: now,
        });
      } else if (isGpsFrame(frame)) {
        set({
          gps: { lat: frame.lat, lon: frame.lon, alt: frame.alt, sats: frame.sats },
          lastFrameAt: now,
          lastGpsAt: now,
        });
      } else if (isBatteryFrame(frame)) {
        set({
          battery: {
            voltageDv: frame.v,
            currentDa: frame.a,
            mah: frame.mah,
            pct: frame.pct,
          },
          lastFrameAt: now,
          lastBatteryAt: now,
        });
      } else if (isAttitudeFrame(frame)) {
        set({
          attitude: { pitch: frame.pitch, roll: frame.roll, yaw: frame.yaw },
          lastFrameAt: now,
          lastAttitudeAt: now,
        });
      } else if (isModeFrame(frame)) {
        set({
          mode: { name: frame.name },
          lastFrameAt: now,
          lastModeAt: now,
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
    set({
      link: null,
      gps: null,
      battery: null,
      attitude: null,
      mode: null,
      streaming: false,
      unsubscribe: null,
      lastFrameAt: 0,
      lastLinkAt: 0,
      lastBatteryAt: 0,
      lastGpsAt: 0,
      lastAttitudeAt: 0,
      lastModeAt: 0,
    });
  },
}));

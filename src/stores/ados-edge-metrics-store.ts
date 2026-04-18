/**
 * @module stores/ados-edge-metrics-store
 * @description Live firmware metrics mirror. Subscribes to the CDC
 * stream dispatcher, filters frames with `type === "metrics"`, and
 * maps the payload into typed slices for scheduler slots, CRSF TX,
 * USB counters, watchdog kicks, battery, and MCU temperature. A
 * ring buffer captures the mixer slot worst-case budget for the
 * dashboard sparkline.
 * @license GPL-3.0-only
 */

import { create } from "zustand";
import { useAdosEdgeStore } from "./ados-edge-store";
import { RingBuffer } from "@/lib/ring-buffer";
import type { StreamFrame } from "@/lib/ados-edge/cdc-client";
import { metricsStart, metricsStop } from "@/lib/ados-edge/edge-link-streams";

export type SchedSlotId =
  | "mixer"
  | "crsf"
  | "input"
  | "menu"
  | "telemetry"
  | "usb";

export interface SchedSlot {
  last_us: number;
  worst_us: number;
}

export type SchedSlots = Record<SchedSlotId, SchedSlot>;

export interface CrsfTxStats {
  rate_hz: number;
  drops: number;
  err: number;
}

export interface UsbCounters {
  cdc_tx: number;
  cdc_rx: number;
  hid_tx: number;
}

export interface BatteryMetrics {
  raw: number;
  mv: number;
  pct: number;
}

const SLOT_IDS: SchedSlotId[] = ["mixer", "crsf", "input", "menu", "telemetry", "usb"];

const MIXER_SPARKLINE_CAP = 300;
const CRSF_SPARKLINE_CAP = 300;

function zeroSlots(): SchedSlots {
  const out = {} as SchedSlots;
  SLOT_IDS.forEach((id) => {
    out[id] = { last_us: 0, worst_us: 0 };
  });
  return out;
}

type MetricsFrame = {
  type: "metrics";
  sched?: Record<string, unknown>;
  crsf_tx?: Record<string, unknown>;
  usb?: Record<string, unknown>;
  iwdg_kicks?: number;
  batt?: Record<string, unknown>;
  mcu_temp_c?: number;
} & Record<string, unknown>;

function isMetricsFrame(f: StreamFrame): f is MetricsFrame {
  return typeof f === "object" && f !== null && (f as { type?: unknown }).type === "metrics";
}

function num(obj: Record<string, unknown> | undefined, key: string): number {
  if (!obj) return 0;
  const v = obj[key];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

interface MetricsState {
  sched: SchedSlots;
  mixerSparkline: RingBuffer<number>;
  crsfSparkline: RingBuffer<number>;
  crsf: CrsfTxStats;
  usb: UsbCounters;
  iwdg_kicks: number;
  batt: BatteryMetrics;
  mcu_temp_c: number;
  lastFrameAt: number;
  streaming: boolean;
  unsubscribe: (() => void) | null;
}

interface MetricsActions {
  startStream: (intervalMs?: number) => Promise<void>;
  stopStream: () => Promise<void>;
  clear: () => void;
}

export const useAdosEdgeMetricsStore = create<MetricsState & MetricsActions>((set, get) => ({
  sched: zeroSlots(),
  mixerSparkline: new RingBuffer<number>(MIXER_SPARKLINE_CAP),
  crsfSparkline: new RingBuffer<number>(CRSF_SPARKLINE_CAP),
  crsf: { rate_hz: 0, drops: 0, err: 0 },
  usb: { cdc_tx: 0, cdc_rx: 0, hid_tx: 0 },
  iwdg_kicks: 0,
  batt: { raw: 0, mv: 0, pct: 0 },
  mcu_temp_c: 0,
  lastFrameAt: 0,
  streaming: false,
  unsubscribe: null,

  async startStream(intervalMs?: number) {
    const link = useAdosEdgeStore.getState().link;
    if (!link || get().streaming) return;

    const unsubscribe = link.onStream((frame) => {
      if (!isMetricsFrame(frame)) return;
      const now = Date.now();
      const state = get();

      const sched = zeroSlots();
      SLOT_IDS.forEach((id) => {
        sched[id] = {
          last_us: num(frame.sched, `${id}_us`),
          worst_us: num(frame.sched, `${id}_worst`),
        };
      });

      const crsf: CrsfTxStats = {
        rate_hz: num(frame.crsf_tx, "rate_hz"),
        drops: num(frame.crsf_tx, "drops"),
        err: num(frame.crsf_tx, "err"),
      };

      const usb: UsbCounters = {
        cdc_tx: num(frame.usb, "cdc_tx"),
        cdc_rx: num(frame.usb, "cdc_rx"),
        hid_tx: num(frame.usb, "hid_tx"),
      };

      const batt: BatteryMetrics = {
        raw: num(frame.batt, "raw"),
        mv: num(frame.batt, "mv"),
        pct: num(frame.batt, "pct"),
      };

      state.mixerSparkline.push(sched.mixer.last_us);
      state.crsfSparkline.push(crsf.rate_hz);

      set({
        sched,
        crsf,
        usb,
        iwdg_kicks: typeof frame.iwdg_kicks === "number" ? frame.iwdg_kicks : 0,
        batt,
        mcu_temp_c: typeof frame.mcu_temp_c === "number" ? frame.mcu_temp_c : 0,
        lastFrameAt: now,
      });
    });

    set({ unsubscribe, streaming: true });
    try {
      await metricsStart(link, intervalMs);
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
      await metricsStop(link).catch(() => {});
    }
  },

  clear() {
    const { unsubscribe, mixerSparkline, crsfSparkline } = get();
    if (unsubscribe) unsubscribe();
    mixerSparkline.clear();
    crsfSparkline.clear();
    set({
      sched: zeroSlots(),
      crsf: { rate_hz: 0, drops: 0, err: 0 },
      usb: { cdc_tx: 0, cdc_rx: 0, hid_tx: 0 },
      iwdg_kicks: 0,
      batt: { raw: 0, mv: 0, pct: 0 },
      mcu_temp_c: 0,
      lastFrameAt: 0,
      streaming: false,
      unsubscribe: null,
    });
  },
}));

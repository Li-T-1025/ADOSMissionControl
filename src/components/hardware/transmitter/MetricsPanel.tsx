"use client";

/**
 * @module MetricsPanel
 * @description Live firmware metrics dashboard. Starts the METRICS
 * stream on mount, stops it on unmount, and renders four cards in a
 * 2x2 grid: scheduler slots, CRSF TX stats, USB + watchdog counters,
 * and battery + MCU temperature. Each card carries a freshness
 * badge keyed off `lastFrameAt`.
 * @license GPL-3.0-only
 */

import { useEffect, useMemo } from "react";
import { useAdosEdgeStore } from "@/stores/ados-edge-store";
import {
  useAdosEdgeMetricsStore,
  type SchedSlotId,
  type SchedSlot,
} from "@/stores/ados-edge-metrics-store";

const FRESH_WINDOW_MS = 1500;
const AMBER_WINDOW_MS = 4000;
const WORST_SLOT_THRESHOLD_US = 1500;

const SLOT_LABELS: Record<SchedSlotId, string> = {
  mixer: "Mixer",
  crsf: "CRSF",
  input: "Input",
  menu: "Menu",
  telemetry: "Telemetry",
  usb: "USB",
};

type FreshnessTone = "green" | "amber" | "red";

function freshness(lastFrameAt: number): FreshnessTone {
  if (lastFrameAt === 0) return "red";
  const age = Date.now() - lastFrameAt;
  if (age <= FRESH_WINDOW_MS) return "green";
  if (age <= AMBER_WINDOW_MS) return "amber";
  return "red";
}

function FreshnessBadge({ tone }: { tone: FreshnessTone }) {
  const label = tone === "green" ? "live" : tone === "amber" ? "stale" : "offline";
  const cls =
    tone === "green"
      ? "text-status-success"
      : tone === "amber"
        ? "text-status-warning"
        : "text-status-error";
  return <span className={`text-[10px] uppercase tracking-wide ${cls}`}>{label}</span>;
}

function formatInt(n: number): string {
  if (!Number.isFinite(n)) return "--";
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

function Sparkline({
  data,
  width = 80,
  height = 16,
  stroke = "currentColor",
}: {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
}) {
  if (data.length < 2) {
    return (
      <svg width={width} height={height} className="text-text-muted/40">
        <line x1={0} y1={height - 1} x2={width} y2={height - 1} stroke="currentColor" strokeWidth={1} />
      </svg>
    );
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data
    .map((v, i) => {
      const x = i * step;
      const y = height - 1 - ((v - min) / range) * (height - 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} className="text-accent-primary">
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CardShell({
  title,
  lastFrameAt,
  children,
}: {
  title: string;
  lastFrameAt: number;
  children: React.ReactNode;
}) {
  const tone = freshness(lastFrameAt);
  return (
    <div className="rounded-lg border border-border bg-surface-secondary p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">{title}</h3>
        <FreshnessBadge tone={tone} />
      </div>
      {children}
    </div>
  );
}

function SchedRow({ id, slot }: { id: SchedSlotId; slot: SchedSlot }) {
  const hot = slot.worst_us > WORST_SLOT_THRESHOLD_US;
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="w-20 text-text-secondary">{SLOT_LABELS[id]}</span>
      <span className="w-20 text-right tabular-nums text-text-primary">
        {slot.last_us > 0 ? `${formatInt(slot.last_us)} us` : "--"}
      </span>
      <span
        className={`w-24 text-right tabular-nums ${hot ? "text-status-error" : "text-text-muted"}`}
      >
        {slot.worst_us > 0 ? `${formatInt(slot.worst_us)} us` : "--"}
      </span>
    </div>
  );
}

export function MetricsPanel() {
  const connected = useAdosEdgeStore((s) => s.state === "connected");
  const sched = useAdosEdgeMetricsStore((s) => s.sched);
  const crsf = useAdosEdgeMetricsStore((s) => s.crsf);
  const usb = useAdosEdgeMetricsStore((s) => s.usb);
  const iwdg_kicks = useAdosEdgeMetricsStore((s) => s.iwdg_kicks);
  const batt = useAdosEdgeMetricsStore((s) => s.batt);
  const mcu_temp_c = useAdosEdgeMetricsStore((s) => s.mcu_temp_c);
  const lastFrameAt = useAdosEdgeMetricsStore((s) => s.lastFrameAt);
  const mixerSparkline = useAdosEdgeMetricsStore((s) => s.mixerSparkline);
  const crsfSparkline = useAdosEdgeMetricsStore((s) => s.crsfSparkline);
  const startStream = useAdosEdgeMetricsStore((s) => s.startStream);
  const stopStream = useAdosEdgeMetricsStore((s) => s.stopStream);

  useEffect(() => {
    if (!connected) return undefined;
    void startStream();
    return () => {
      void stopStream();
    };
  }, [connected, startStream, stopStream]);

  /* Re-render the tiles on a short interval so the freshness badge
   * transitions from green to amber to red even when no new frames
   * are arriving. */
  useEffect(() => {
    if (!connected) return undefined;
    const id = setInterval(() => {
      /* bump a local no-op to force re-read of Date.now-derived state */
      useAdosEdgeMetricsStore.setState((s) => ({ lastFrameAt: s.lastFrameAt }));
    }, 1000);
    return () => clearInterval(id);
  }, [connected]);

  const mixerSamples = useMemo(() => {
    /* Read the buffer by revision key. Updating on every frame is
     * fine here because the render cost of the sparkline is tiny. */
    return mixerSparkline.toArray();
  }, [mixerSparkline, lastFrameAt]);

  const crsfSamples = useMemo(() => {
    return crsfSparkline.toArray();
  }, [crsfSparkline, lastFrameAt]);

  if (!connected) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Firmware metrics</h2>
        <span className="text-xs text-text-muted">
          Scheduler budget, CRSF TX, USB counters, battery.
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <CardShell title="Scheduler" lastFrameAt={lastFrameAt}>
          <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wide text-text-muted">
            <span className="w-20">Slot</span>
            <span className="w-20 text-right">Last</span>
            <span className="w-24 text-right">Worst</span>
          </div>
          <div className="flex flex-col gap-1">
            {(Object.keys(SLOT_LABELS) as SchedSlotId[]).map((id) => (
              <SchedRow key={id} id={id} slot={sched[id]} />
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] text-text-muted">
            <span>Mixer last-us, 30 s window</span>
            <Sparkline data={mixerSamples} />
          </div>
        </CardShell>

        <CardShell title="CRSF TX" lastFrameAt={lastFrameAt}>
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-text-muted">Rate</div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-semibold tabular-nums text-text-primary">
                  {crsf.rate_hz > 0 ? formatInt(crsf.rate_hz) : "--"}
                </span>
                <span className="text-sm text-text-muted">Hz</span>
              </div>
            </div>
            <Sparkline data={crsfSamples} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-text-muted">Drops</div>
              <div
                className={`tabular-nums ${crsf.drops > 0 ? "text-status-warning" : "text-text-primary"}`}
              >
                {formatInt(crsf.drops)}
              </div>
            </div>
            <div>
              <div className="text-text-muted">Errors</div>
              <div
                className={`tabular-nums ${crsf.err > 0 ? "text-status-error" : "text-text-primary"}`}
              >
                {formatInt(crsf.err)}
              </div>
            </div>
          </div>
        </CardShell>

        <CardShell title="USB + watchdog" lastFrameAt={lastFrameAt}>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-text-muted">CDC TX</div>
              <div className="tabular-nums text-text-primary">{formatInt(usb.cdc_tx)}</div>
            </div>
            <div>
              <div className="text-text-muted">CDC RX</div>
              <div className="tabular-nums text-text-primary">{formatInt(usb.cdc_rx)}</div>
            </div>
            <div>
              <div className="text-text-muted">HID TX</div>
              <div className="tabular-nums text-text-primary">{formatInt(usb.hid_tx)}</div>
            </div>
            <div>
              <div className="text-text-muted">IWDG kicks</div>
              <div className="tabular-nums text-text-primary">{formatInt(iwdg_kicks)}</div>
            </div>
          </div>
        </CardShell>

        <CardShell title="Battery + temperature" lastFrameAt={lastFrameAt}>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-text-muted">Voltage</div>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-semibold tabular-nums text-text-primary">
                  {batt.mv > 0 ? (batt.mv / 1000).toFixed(2) : "--"}
                </span>
                <span className="text-xs text-text-muted">V</span>
              </div>
            </div>
            <div>
              <div className="text-text-muted">Charge</div>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-semibold tabular-nums text-text-primary">
                  {batt.pct > 0 ? formatInt(batt.pct) : "--"}
                </span>
                <span className="text-xs text-text-muted">%</span>
              </div>
            </div>
            <div>
              <div className="text-text-muted">MCU temp</div>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-semibold tabular-nums text-text-primary">
                  {mcu_temp_c !== 0 ? mcu_temp_c.toFixed(1) : "--"}
                </span>
                <span className="text-xs text-text-muted">C</span>
              </div>
            </div>
            <div>
              <div className="text-text-muted">ADC raw</div>
              <div className="tabular-nums text-text-primary">
                {batt.raw > 0 ? formatInt(batt.raw) : "--"}
              </div>
            </div>
          </div>
        </CardShell>
      </div>
    </div>
  );
}

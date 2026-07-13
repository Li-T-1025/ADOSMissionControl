"use client";

/**
 * @module fly/cockpit/CockpitTopRight
 * @description The top-right cockpit cluster — a faithful port of the reference
 * artifact's `.zone.tr`: the density segmented control (Min / Std / Full), the
 * live video stats (resolution · fps · latency), and a camera-select pill.
 * @license GPL-3.0-only
 */

import { useVideoStore } from "@/stores/video-store";

export type CockpitDensity = "minimal" | "standard" | "full";

const MODES: { id: CockpitDensity; label: string }[] = [
  { id: "minimal", label: "Min" },
  { id: "standard", label: "Std" },
  { id: "full", label: "Full" },
];

interface Props {
  density: CockpitDensity;
  onDensity: (d: CockpitDensity) => void;
}

export function CockpitTopRight({ density, onDensity }: Props) {
  const isStreaming = useVideoStore((s) => s.isStreaming);
  const fps = useVideoStore((s) => s.fps);
  const latencyMs = useVideoStore((s) => s.latencyMs);
  const resolution = useVideoStore((s) => s.resolution);

  return (
    <div className="zone tr">
      <div className="seg" role="group" aria-label="Information density">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={density === m.id}
            onClick={() => onDensity(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="vstats panel d-std">
        {isStreaming ? (
          <>
            <span className="s">
              <b>{resolution || "—"}</b>
            </span>
            <span className="s">
              <b>{Math.round(fps) || 0}</b>fps
            </span>
            <span className="s">
              <b>{Math.round(latencyMs) || 0}</b>ms
            </span>
          </>
        ) : (
          <span className="s">OFFLINE</span>
        )}
      </div>

      <div className="camsel panel d-std">
        <i className="dot" />
        <span>CAM · main</span>
      </div>
    </div>
  );
}

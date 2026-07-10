import { useEffect, useState } from "react";
import { useTelemetryStore } from "@/stores/telemetry-store";

type FreshnessLevel = "fresh" | "stale" | "lost" | "none";

type TelemetryChannel =
  | "attitude"
  | "position"
  | "battery"
  | "gps"
  | "vfr"
  | "rc"
  | "sysStatus"
  | "radio"
  | "ekf"
  | "vibration"
  | "servoOutput"
  | "wind"
  | "terrain"
  | "navController";

interface TelemetryFreshnessResult {
  /** Get freshness for a specific channel */
  getFreshness: (channel: TelemetryChannel) => FreshnessLevel;
  /** Map of all channel freshness levels */
  channels: Map<TelemetryChannel, FreshnessLevel>;
  /** Overall system freshness (worst of key channels) */
  overall: FreshnessLevel;
}

const ALL_CHANNELS: TelemetryChannel[] = [
  "attitude",
  "position",
  "battery",
  "gps",
  "vfr",
  "rc",
  "sysStatus",
  "radio",
  "ekf",
  "vibration",
  "servoOutput",
  "wind",
  "terrain",
  "navController",
];

/** Key channels used for overall freshness assessment */
const KEY_CHANNELS: TelemetryChannel[] = [
  "attitude",
  "position",
  "battery",
  "gps",
];

const FRESH_MS = 2000;
const STALE_MS = 5000;

/** Max age for a telemetry sample to count as "live" for a readout gate. */
export const TELEMETRY_FRESH_MS = FRESH_MS;

/**
 * Whether a telemetry sample timestamp is fresh enough to render as live.
 * Pure (no hook) so a canvas HUD draw loop can gate each readout without a
 * React subscription — a blank "—" beats a frozen last value (Rule 44).
 */
export function isTimestampFresh(
  timestamp: number | undefined | null,
  maxAgeMs: number = FRESH_MS,
): boolean {
  return (
    typeof timestamp === "number" &&
    Number.isFinite(timestamp) &&
    Date.now() - timestamp < maxAgeMs
  );
}

function classifyFreshness(timestamp: number | undefined): FreshnessLevel {
  if (timestamp === undefined) return "none";
  const age = Date.now() - timestamp;
  if (age < FRESH_MS) return "fresh";
  if (age < STALE_MS) return "stale";
  return "lost";
}

/** Order: fresh < stale < lost < none (none is worst) */
const FRESHNESS_ORDER: Record<FreshnessLevel, number> = {
  fresh: 0,
  stale: 1,
  lost: 2,
  none: 3,
};

function worstFreshness(levels: FreshnessLevel[]): FreshnessLevel {
  if (levels.length === 0) return "none";
  let worst: FreshnessLevel = "fresh";
  for (const level of levels) {
    if (FRESHNESS_ORDER[level] > FRESHNESS_ORDER[worst]) {
      worst = level;
    }
  }
  return worst;
}

export function useTelemetryFreshness(): TelemetryFreshnessResult {
  const store = useTelemetryStore();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Suppress unused warning — tick drives re-renders
  void tick;

  const channels = new Map<TelemetryChannel, FreshnessLevel>();
  for (const ch of ALL_CHANNELS) {
    const latest = store[ch].latest() as { timestamp?: number } | undefined;
    channels.set(ch, classifyFreshness(latest?.timestamp));
  }

  const getFreshness = (channel: TelemetryChannel): FreshnessLevel =>
    channels.get(channel) ?? "none";

  const keyLevels = KEY_CHANNELS.map((ch) => channels.get(ch) ?? "none");
  const overall = worstFreshness(keyLevels);

  return { getFreshness, channels, overall };
}

/**
 * @module hardware/radio/constants
 * @description Shared constants and small helpers for the WFB-ng radio
 * sub-panels. Pulled out so the per-section components don't have to
 * each redeclare the threshold and label values.
 * @license GPL-3.0-only
 */

import type { RadioTopology } from "@/lib/api/ground-station/types";

export const POLL_INTERVAL_MS = 500;
export const PAIR_POLL_INTERVAL_MS = 2000;
export const EMPTY = "…";

// Threshold: RSSI green when at or above this many dBm.
export const RSSI_GREEN_DBM = -55;
// Threshold: RSSI yellow at or above this. Below this is red.
export const RSSI_YELLOW_DBM = -75;

// Brownout warning fires when host-VBUS topology is paired with TX
// power above the soft floor. The agent caps the slider at 15 dBm in
// this topology; the warning is informational.
export const BROWNOUT_TX_FLOOR_DBM = 12;

// Default safe-floor cap when the agent has not reported a per-driver
// maximum yet. The slider exposes this much head-room conservatively;
// agents that advertise a higher cap unlock more.
export const DEFAULT_TX_MAX_DBM = 15;

export function rssiClass(dbm: number | null): string {
  if (dbm == null) return "text-text-tertiary";
  if (dbm >= RSSI_GREEN_DBM) return "text-status-success";
  if (dbm >= RSSI_YELLOW_DBM) return "text-status-warning";
  return "text-status-error";
}

export function topologyClass(topology: RadioTopology): string {
  if (topology === "external_5v") return "border-status-success/40 text-status-success";
  if (topology === "powered_hub") return "border-accent-primary/40 text-accent-primary";
  return "border-border-default text-text-secondary";
}
